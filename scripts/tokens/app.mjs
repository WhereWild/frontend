import fs from "fs";
import {
  getFileStyles,
  getFileVariables,
  KEY_PREFIX_COLLECTION,
} from "./fromFigma.mjs";

const FILE_KEY = process.env.FIGMA_FILE_KEY;
const SKIP_REST_API = process.argv.includes("--skip-rest-api");
const WRITE_FILE = "../../constants/wds-theme.css";
const TOKENS_JSON_FILE = "./tokens.json";
const STYLES_JSON_FILE = "./styles.json";

const CONVERT_TO_REM = true;
// Extension namespace for the w3c token file
const NAMESPACES = ["com.figma.wds", "org.wds"];
const DEFAULT_NAMESPACE = NAMESPACES[0];
// Prefix for CSS custom properties
const TOKEN_PREFIX = "wds-";

// The data object. Each item in here represents a collection.
// `[collection].definitions` will contain all the token data
// You should ensure these names match those in your Figma variables data.
// Collection names are lowercased and underscored and stripped of non alphanumeric characters.
const COLLECTION_DATA = {
  color_primitives: {
    settings: { prefix: "color" },
  },
  new_color_primitives: {
    settings: { prefix: "new-color" },
  },
  color: {
    settings: {
      prefix: "color",
      // Light mode names from Figma in lower underscore case. First is default light mode.
      colorSchemes: ["wds_light"],
      // Dark mode names from Figma in lower underscore case. First is default dark mode.
      colorSchemesDark: ["wds_dark"],
      // Strings to strip from mode names above when transforming to theme class names. (Only applicable when more than one per mode)
      colorSchemeLightRemove: "_light",
      colorSchemeDarkRemove: "_dark",
      // Strings to find and replace in CSS values
      replacements: {
        color_primitives: "color",
        "@new_color_primitives": "wds-new-color",
        "@new_color": "wds-new-color",
      },
    },
  },
  size: {
    settings: {
      prefix: "size",
      convertPixelToRem: true,
      replacements: {
        [`${KEY_PREFIX_COLLECTION}responsive`]: "responsive",
      },
    },
  },
  typography_primitives: {
    settings: {
      prefix: "typography",
      convertPixelToRem: true,
      replacements: {
        [`${KEY_PREFIX_COLLECTION}responsive`]: "responsive",
        "Extra Bold Italic": "800 italic",
        "Semi Bold Italic": "600 italic",
        "Medium Italic": "500 italic",
        "Regular Italic": "400 italic",
        "Extra Light Italic": "200 italic",
        "Light Italic": "300 italic",
        "Black Italic": "900 italic",
        "Bold Italic": "700 italic",
        "Thin Italic": "100 italic",
      },
    },
  },
  typography: {
    settings: {
      prefix: "typography",
      convertPixelToRem: true,
      replacements: {
        typography_primitives: "typography",
      },
    },
  },
  responsive: {
    settings: {
      prefix: "responsive",
      convertPixelToRem: true,
    },
  },
  time: {
    settings: {
      prefix: "time",
      convertPixelToRem: false,
    },
  },
};

initialize();

async function initialize() {
  // We write data to disk before processing.
  // This allows us to process independent of REST API.
  // You can use Plugins to author these files manually without Variables REST API access.
  if (!SKIP_REST_API) {
    if (!process.env.FIGMA_ACCESS_TOKEN || !FILE_KEY) {
      throw new Error(
        "FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY are required unless --skip-rest-api is set.",
      );
    }
    const stylesJSON = await getFileStyles(FILE_KEY);
    fs.writeFileSync(STYLES_JSON_FILE, JSON.stringify(stylesJSON, null, 2));
    const tokensJSON = await getFileVariables(FILE_KEY, DEFAULT_NAMESPACE);
    fs.writeFileSync(TOKENS_JSON_FILE, JSON.stringify(tokensJSON, null, 2));
  }
  // Process token JSON into CSS
  const { processed, themeCSS } = processTokenJSON(
    JSON.parse(fs.readFileSync(TOKENS_JSON_FILE)),
  );
  // An object to lookup variables in when processing styles.
  const variableLookups = Object.keys(processed)
    .flatMap((key) =>
      Object.values(processed[key].definitions).flatMap(
        (definition) => definition,
      ),
    )
    .reduce((into, item) => {
      into[item.figmaId] = item;
      return into;
    }, {});

  // Process styles JSON into CSS
  const stylesCSS = await processStyleJSON(
    JSON.parse(fs.readFileSync(STYLES_JSON_FILE)),
    variableLookups,
  );

  // Write our processed CSS
  fs.writeFileSync(WRITE_FILE, [...themeCSS, ...stylesCSS].join("\n"));
  console.log(`Wrote ${WRITE_FILE}`);
}

/**
 * Massive operation to process Token JSON as parseable object for CSS conversion
 * @param {Object<any>} data - W3C Token Spec JSON with collections at the root.
 * @returns {{ processed: {[collection_key: string]: { definitions: { [mode_name: string]: Array<{ property: string, propertyName: string, figmaId: string, description: string, value: string, type: string }> } } } } }}
 */
function processTokenJSON(data) {
  ensureCollectionSettingsExist(data);
  const processed = { ...COLLECTION_DATA };
  for (let key in processed) {
    const definitionsKey = `${KEY_PREFIX_COLLECTION}${key}`;
    if (!data[definitionsKey]) {
      delete processed[key];
      console.warn(`Skipping token collection "${definitionsKey}" - not found in tokens.json`);
      continue;
    }
    processCollection(data, COLLECTION_DATA[key], definitionsKey);
  }

  // Our theme.css file string.
  const fileStringCSSLines = [
    "/*",
    " * This file is automatically generated by scripts/tokens/app.mjs!",
    " */",
  ];
  for (let key in processed) {
    fileStringCSSLines.push(
      ...fileStringCSSFromProcessedObject(processed[key], key),
    );
  }

  // Turn variable collection data into a CSS file string
  function fileStringCSSFromProcessedObject({ definitions, settings }, key) {
    // Lines of CSS
    const lines = [];
    // This is how we know to do prefers-color scheme rather than plain :root
    if (settings.colorSchemes) {
      settings.colorSchemes.forEach((scheme, i) => {
        if (i === 0) {
          lines.push(...[`/* ${key}: ${scheme} (default) */`, ":root {"]);
        } else {
          lines.push(
            ...[
              `/* ${key}: ${scheme} */`,
              `.${TOKEN_PREFIX}scheme-${key}-${scheme.replace(settings.colorSchemeLightRemove, "")} {`,
            ],
          );
        }
        lines.push(drawCSSPropLines(definitions[scheme], "  "), "}");
      });
      if (settings.colorSchemesDark) {
        lines.push("@media (prefers-color-scheme: dark) {");
        settings.colorSchemesDark.forEach((scheme, i) => {
          if (i === 0) {
            lines.push(...[`  /* ${key}: ${scheme} (default) */`, "  :root {"]);
          } else {
            lines.push(
              ...[
                `  /* ${key}: ${scheme} */`,
                `  .${TOKEN_PREFIX}scheme-${key}-${scheme.replace(settings.colorSchemeDarkRemove, "")} {`,
              ],
            );
          }
          lines.push(drawCSSPropLines(definitions[scheme], "    "), "  }");
        });
        lines.push("}");
      }
    } else {
      let first;
      // For each mode in definitions
      for (let k in definitions) {
        if (!first) {
          first = true;
          lines.push(...[`/* ${key}: ${k} (default) */`, ":root {"]);
        } else {
          lines.push(
            ...[`/* ${key}: ${k} */`, `.${TOKEN_PREFIX}theme-${key}-${k} {`],
          );
        }
        lines.push(...[drawCSSPropLines(definitions[k], "  "), "}"]);
      }
    }
    return lines;
  }

  // Code syntax array string is something we can paste in Figma console
  //  to bulk update variable code syntax and descriptions to match our CSS property names.
  const variableSyntaxAndDescriptionString = `Promise.all([
${Object.keys(processed)
  .map((key) => drawVariableSyntaxAndDescription(processed[key].definitions))
  .sort()
  .join(",\n")},
].map(async ([variableId, webSyntax, description]) => {
  const variable = await figma.variables.getVariableByIdAsync(variableId);
  if (variable) {
    variable.setVariableCodeSyntax("WEB", webSyntax);
    variable.description = description;
  }
  return;
})).then(() => console.log("DONE!")).catch(console.error)`;

  // Write the code syntax snippet
  try {
    fs.writeFileSync(
      "./tokenVariableSyntaxAndDescriptionSnippet.js",
      variableSyntaxAndDescriptionString,
    );
  } catch (error) {
    console.warn(
      "Unable to write tokenVariableSyntaxAndDescriptionSnippet.js:",
      error instanceof Error ? error.message : error,
    );
  }

  // Return our data
  return { processed, themeCSS: fileStringCSSLines };

  /**
   * Transform an array of lines of CSS custom property definitions into indented CSS output.
   * @param {string[]} lines
   * @param {string} indent
   * @returns {string}
   */
  function drawCSSPropLines(lines = [], indent = "  ") {
    return (
      lines
        .sort((a, b) => (a.property > b.property ? 1 : -1))
        .map((l) => `${indent}${l.property}: ${l.value}`)
        .join(";\n") + ";"
    );
  }

  /**
   * Given an object of modes, return the Code Syntax snippet string
   * @param {{ [mode: string]: string[]}} linesObject
   * @returns {string}
   */
  function drawVariableSyntaxAndDescription(linesObject = { default: [] }) {
    const lines = linesObject[Object.keys(linesObject)[0]];
    return lines
      .map(
        (l) =>
          `  ["${l.figmaId}", "var(${l.property})", "${l.description || ""}"]`,
      )
      .sort()
      .join(",\n");
  }

  /**
   *
   * @param {Object<any>} data - All variable collection data (W3C token spec JSON)
   * @param {Object<any>} processed - The object to write collection data to
   * @param {string} definitionsKey - The key for the definitions
   */
  function processCollection(data, processed, definitionsKey) {
    const {
      replacements = {},
      convertPixelToRem = CONVERT_TO_REM,
      prefix,
    } = processed.settings;
    const fullPrefix = `${TOKEN_PREFIX}${prefix}`;
    processed.definitions = {};
    traverse(
      processed.definitions,
      data[definitionsKey],
      replacements,
      definitionsKey,
      fullPrefix,
      convertPixelToRem,
      "",
      fullPrefix ? [fullPrefix] : undefined,
    );
  }

  /**
   * Traverse W3C token file to build out tokens.
   * @param {Object<any>} definitions
   * @param {Object<any>} object - collection from W3C token JSON
   * @param {{[find: string]: string}} replacements - string replacement object, keyed by find.
   * @param {string} definitionsKey
   * @param {string} prefix - collection token prefix
   * @param {boolean} convertPixelToRem - whether or not to turn numbers into n/16 rem values.
   * @param {string} currentType - as we traverse token scope, we may need to track type from parent
   * @param {string[]} keys - history of token scopes to prefix name
   * @returns
   */
  function traverse(
    definitions,
    object,
    replacements,
    definitionsKey,
    prefix,
    convertPixelToRem = CONVERT_TO_REM,
    currentType = "",
    keys = [],
  ) {
    const property = `--${keys.join("-")}`;
    const propertyNameFull = keys
      .map((key) =>
        key
          .split(/[^\dA-Za-z]/)
          .map((k) => `${k.charAt(0).toUpperCase()}${k.slice(1)}`)
          .join(""),
      )
      .join("");
    // .replace(/^color/i, "");
    const valueWithReplacements = (value) => {
      if (typeof value !== "string") return value;
      for (let replacement in replacements) {
        value = value.replace(replacement, replacements[replacement]);
      }
      return value.toLowerCase();
    };
    const propertyName =
      propertyNameFull.charAt(0).toLowerCase() + propertyNameFull.slice(1);
    const type = object.$type || currentType;
    if ("$value" in object) {
      const extensionData =
        "$extensions" in object ? getNamespaceData(object.$extensions) : null;
      if (extensionData && extensionData.modes) {
        const description = object.$description || "";
        const figmaId = extensionData.figmaId;
        for (let mode in extensionData.modes) {
          definitions[mode] = definitions[mode] || [];
          definitions[mode].push({
            property,
            propertyName,
            figmaId,
            description,
            value: valueWithReplacements(
              valueToCSS(
                property,
                extensionData.modes[mode],
                definitionsKey,
                convertPixelToRem,
                prefix,
              ),
            ),
            type,
          });
        }
      } else {
        const description = object.$description || "";
        const figmaId = extensionData ? extensionData.figmaId : "UNDEFINED";
        const mode = "default";
        definitions[mode] = definitions[mode] || [];
        definitions[mode].push({
          property,
          propertyName,
          description,
          figmaId,
          value: valueWithReplacements(
            valueToCSS(
              property,
              object.$value,
              definitionsKey,
              convertPixelToRem,
              "",
            ),
          ),
          type,
        });
      }
    } else {
      Object.entries(object).forEach(([key, value]) => {
        if (key.charAt(0) !== "$") {
          traverse(
            definitions,
            value,
            replacements,
            definitionsKey,
            prefix,
            convertPixelToRem,
            type,
            [...keys, key],
          );
        }
      });
    }
  }

  /**
   * Converting W3C token JSON value to CSS value.
   * @param {string} property
   * @param {string} value
   * @param {string} definitionsKey
   * @param {boolean} convertPixelToRem
   * @param {string} prefix
   * @returns {string}
   */
  function valueToCSS(
    property,
    value,
    definitionsKey,
    convertPixelToRem,
    prefix = "",
  ) {
    if (value.toString().charAt(0) === "{")
      return `var(--${value
        .replace(`${definitionsKey}`, prefix)
        .replace(/[. ]/g, "-")
        .replace(/^\{/, "")
        .replace(/\}$/, "")})`;
    const valueIsDigits = value.toString().match(/^-?\d+(\.\d+)?$/);
    const isRatio = property.match(/(ratio-)/);
    const isTimeDuration =
      definitionsKey === `${KEY_PREFIX_COLLECTION}time` &&
      property.includes("time-duration-");
    const isNumeric =
      valueIsDigits && !property.match(/(weight|ratio-)/) && !isRatio;
    if (isNumeric) {
      if (isTimeDuration) {
        return `${value}ms`;
      }
      return convertPixelToRem ? `${parseInt(value) / 16}rem` : `${value}px`;
    } else if (isRatio) {
      return Math.round(value * 10000) / 10000;
    }
    if (property.match("family-mono")) {
      return `"${value}", monospace`;
    } else if (property.match("family-sans")) {
      return `"${value}", sans-serif`;
    } else if (property.match("family-serif")) {
      return `"${value}", serif`;
    }
    return value;
  }
}

function ensureCollectionSettingsExist(data = {}) {
  Object.keys(data).forEach((definitionsKey) => {
    if (!definitionsKey.startsWith(KEY_PREFIX_COLLECTION)) return;
    const normalizedKey = definitionsKey.slice(KEY_PREFIX_COLLECTION.length);
    if (!normalizedKey) return;
    if (COLLECTION_DATA[normalizedKey]) {
      return;
    }
    const fallbackPrefix = normalizedKey.replace(/_/g, "-");
    COLLECTION_DATA[normalizedKey] = {
      settings: {
        prefix: fallbackPrefix,
        convertPixelToRem: true,
      },
    };
    console.warn(
      `Added default token collection settings for "${normalizedKey}". Consider configuring it explicitly if special handling is needed.`,
    );
  });
}

/**
 * Turning style JSON into a box shadow, filter, or font property value
 * @param {Object<any>} data - Style JSON data from Figma
 * @param {Object<any>} variablesLookup - Object to find variable names
 * @returns
 */
async function processStyleJSON(data, variablesLookup) {
  const effectDefs = [];
  const text = [];
  const variableLookupValues = Object.values(variablesLookup || {});
  data.forEach(({ type, ...style }) => {
    if (type === "TEXT") {
      const {
        name,
        fontSize: styleFontSize,
        fontFamily: styleFontFamily,
        fontWeight: styleFontWeight,
        fontStyle: styleFontStyle = "normal",
        fontName = {},
        boundVariables = {},
      } = style;

      const {
        fontStyle,
        fontWeight,
        fontFamily,
        fontSizeValue,
      } = deriveFontParts(fontName, styleFontSize, {
        fontFamily: styleFontFamily,
        fontWeight: styleFontWeight,
        fontStyle: styleFontStyle,
        fontSize: styleFontSize,
      });

      const css = [
        boundVariables.fontStyle
          ? valueFromPossibleVariable(
              boundVariables.fontStyle,
              fontStyle,
            )
          : fontStyle,
        boundVariables.fontWeight
          ? valueFromPossibleVariable(
              boundVariables.fontWeight,
              fontWeight,
            )
          : fontWeight,
        boundVariables.fontSize
          ? valueFromPossibleVariable(
              boundVariables.fontSize,
              fontSizeValue,
            )
          : fontSizeValue,
        boundVariables.fontFamily
          ? valueFromPossibleVariable(
              boundVariables.fontFamily,
              fontFamily,
            )
          : fontFamily,
      ].join(" ");
      text.push(
        `--${TOKEN_PREFIX}font-${name
          .replace(/^[^a-zA-Z0-9]+/, "")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .toLowerCase()}: ${css};`,
      );
    } else if (type === "EFFECT") {
      const { name, effects } = style;
      const safeName = sanitizeName(name);
      const shadows = [];
      const filters = [];
      const backdropFilters = [];
      effects.forEach((effect) => {
        if (effect.visible) {
          if (effect.type.match("SHADOW")) {
            shadows.push(formatEffect(effect));
          }
          if (effect.type.match("LAYER_BLUR")) {
            filters.push(formatEffect(effect));
          }
          if (effect.type.match("BACKGROUND_BLUR")) {
            backdropFilters.push(formatEffect(effect));
          }
        }
      });
      if (shadows.length) {
        effectDefs.push(
          `--${TOKEN_PREFIX}effects-shadows-${safeName}: ${shadows.join(", ")};`,
        );
      }
      if (filters.length) {
        effectDefs.push(
          `--${TOKEN_PREFIX}effects-filter-${safeName}: ${filters[0]};`,
        );
      }
      if (backdropFilters.length) {
        effectDefs.push(
          `--${TOKEN_PREFIX}effects-backdrop-filter-${safeName}: ${backdropFilters[0]};`,
        );
      }
    }
  });

  return [
    "/* styles */",
    ":root {",
    "  " + [...text, ...effectDefs].join("\n  "),
    "}",
  ];

  /**
   * Takes possible variable reference or value and returns an appropriate value
   * @param {string} item
   * @returns {string}
   */
  function valueFromPossibleVariable(item = "", fallback = "") {
    if (item && typeof item === "object") {
      // attempting to find bound variables
      const variable = variablesLookup[item.id];
      return variable ? `var(${variable.property})` : fallback;
    }
    const stringItem =
      typeof item === "string" ? item : item !== undefined ? `${item}` : "";
    if (stringItem.match(/^[1-9]00$/)) {
      // attempting to find variable for weights
      // the scenario where style is used so weight is int
      const variable = variableLookupValues.find(
        ({ value }) => value === stringItem,
      );
      return variable ? `var(${variable.property})` : stringItem;
    }
    return stringItem || fallback;
  }

  /**
   * Lowercase hyphenate string
   * @param {string} name
   * @returns {string}
   */
  function sanitizeName(name) {
    return name
      .replace(/[^a-zA-Z0-9 ]/g, " ")
      .trim()
      .replace(/ +/g, "-")
      .toLowerCase();
  }

  /**
   * Transforms Figma effect data into CSS string
   * @param {{type: EffectType, ...effect}} args[0] Figma effect
   * @returns {string}
   */
  function formatEffect({ type, ...effect }) {
    const boundVariables = effect.boundVariables || {};
    if (type === "DROP_SHADOW" || type === "INNER_SHADOW") {
      const {
        radius,
        offset: { x, y },
        spread,
        hex,
      } = effect;
      const numbers = [
        boundVariables.offsetX
          ? valueFromPossibleVariable(boundVariables.offsetX, `${x}px`)
          : `${x}px`,
        boundVariables.offsetY
          ? valueFromPossibleVariable(boundVariables.offsetY, `${y}px`)
          : `${y}px`,
        boundVariables.radius
          ? valueFromPossibleVariable(boundVariables.radius, `${radius}px`)
          : `${radius}px`,
        boundVariables.spread
          ? valueFromPossibleVariable(boundVariables.spread, `${spread}px`)
          : `${spread}px`,
        boundVariables.color
          ? valueFromPossibleVariable(boundVariables.color, hex)
          : hex,
      ];
      return `${type === "INNER_SHADOW" ? "inset " : ""}${numbers.join(" ")}`;
    } else if (type === "LAYER_BLUR" || type === "BACKGROUND_BLUR") {
      const { radius } = effect;
      return `blur(${boundVariables.radius ? valueFromPossibleVariable(boundVariables.radius, `${radius}px`) : `${radius}px`})`;
    }
  }
}

function deriveFontParts(fontName = {}, fontSize, fallback = {}) {
  const { family = "", style = "" } = fontName;
  const resolvedFamily = family || fallback.fontFamily || "";
  const styleDescriptor =
    style ||
    [fallback.fontStyle, fallback.fontWeight]
      .filter(
        (value) =>
          value !== undefined &&
          value !== null &&
          `${value}`.trim() !== "",
      )
      .map((value) => `${value}`.trim())
      .join(" ")
      .trim();
  const parsedStyle = parseFontStyle(styleDescriptor);
  const resolvedFontSize =
    typeof fontSize === "number"
      ? fontSize
      : typeof fallback.fontSize === "number"
        ? fallback.fontSize
        : null;
  return {
    fontStyle: parsedStyle.fontStyle,
    fontWeight: parsedStyle.fontWeight,
    fontFamily: resolvedFamily ? `"${resolvedFamily}", sans-serif` : "sans-serif",
    fontSizeValue:
      typeof resolvedFontSize === "number" ? `${resolvedFontSize}px` : "16px",
  };
}

function parseFontStyle(styleName = "") {
  if (!styleName) {
    return { fontStyle: "normal", fontWeight: "400" };
  }
  const lower = styleName.toLowerCase();
  const isItalic = lower.includes("italic");
  const weightKey = lower.replace("italic", "").replace(/ +/g, " ").trim();
  const weightMap = {
    thin: "100",
    "extra light": "200",
    ultralight: "200",
    light: "300",
    book: "350",
    normal: "400",
    regular: "400",
    roman: "400",
    medium: "500",
    "semi bold": "600",
    "demi bold": "600",
    bold: "700",
    "extra bold": "800",
    black: "900",
    heavy: "900",
  };
  const normalizedKey = weightKey.replace(/-+/g, " ").trim();
  const directMatch = weightMap[normalizedKey];
  let fontWeight = directMatch;
  if (!fontWeight && normalizedKey) {
    const fuzzyKey = Object.keys(weightMap).find((key) =>
      normalizedKey.includes(key),
    );
    fontWeight =
      (fuzzyKey && weightMap[fuzzyKey]) ||
      normalizedKey.match(/\d{3}/)?.[0] ||
      "400";
  }
  if (!fontWeight) {
    fontWeight = "400";
  }
  return {
    fontStyle: isItalic ? "italic" : "normal",
    fontWeight,
  };
}

function getNamespaceData(extensions) {
  if (!extensions) return null;
  for (const namespace of NAMESPACES) {
    if (extensions[namespace]) {
      return extensions[namespace];
    }
  }
  return null;
}
