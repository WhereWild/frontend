/*
This script syncs the CSS theme definitions from the wherewild-design-system
repository into the front-end codebase. It copies the raw CSS file and also
generates a TypeScript module exporting resolved theme tokens for use in JS/TS.

To run this script, ensure that the wherewild-design-system repo is checked out
next to the front-end repo, then execute:

  npm run sync-theme

This script was written by OpenAI's GPT-5.1-Codex.
*/

const fs = require('node:fs');
const path = require('node:path');

const FRONT_END_ROOT = path.resolve(__dirname, '..');
const DESIGN_SYSTEM_THEME = path.resolve(
  FRONT_END_ROOT,
  '../wherewild-design-system/src/theme.css',
);
const TARGET_CSS_PATH = path.resolve(
  FRONT_END_ROOT,
  'constants',
  'wds-theme.css',
);
const TARGET_TS_PATH = path.resolve(
  FRONT_END_ROOT,
  'constants',
  'wdsTokens.ts',
);

if (!fs.existsSync(DESIGN_SYSTEM_THEME)) {
  console.error(
    `Unable to find theme.css at ${DESIGN_SYSTEM_THEME}. ` +
      'Is the wherewild-design-system repo checked out next to the front end?',
  );
  process.exit(1);
}

const cssContents = fs.readFileSync(DESIGN_SYSTEM_THEME, 'utf8');
fs.mkdirSync(path.dirname(TARGET_CSS_PATH), { recursive: true });
fs.writeFileSync(TARGET_CSS_PATH, cssContents, 'utf8');

const contexts = {
  colorPrimitives: {},
  colorLight: {},
  colorDark: {},
  size: {},
  typographyPrimitives: {},
  typography: {},
  styles: {},
};

let pendingContext = null;
let activeContext = null;

cssContents.split('\n').forEach((line) => {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();

  // Theme.css is broken into comment-delimited sections (primitives/light/dark)
  // followed by a :root block. Track which section the next :root belongs to.
  if (trimmed.startsWith('/*')) {
    if (lower.includes('color_primitives')) {
      pendingContext = 'colorPrimitives';
    } else if (lower.includes('color: wds_light')) {
      pendingContext = 'colorLight';
    } else if (lower.includes('color: wds_dark')) {
      pendingContext = 'colorDark';
    } else if (lower.includes('size:')) {
      pendingContext = 'size';
    } else if (lower.includes('typography_primitives')) {
      pendingContext = 'typographyPrimitives';
    } else if (
      lower.includes('typography:') &&
      !lower.includes('typography_primitives')
    ) {
      pendingContext = 'typography';
    } else if (lower.includes('styles')) {
      pendingContext = 'styles';
    } else {
      pendingContext = null;
    }
    return;
  }

  // Enter the new section once we hit ":root" after a matching comment.
  if (pendingContext && trimmed.startsWith(':root')) {
    activeContext = pendingContext;
    pendingContext = null;
    return;
  }

  // Close the section when we leave the :root block.
  if (activeContext && trimmed.startsWith('}')) {
    activeContext = null;
    return;
  }

  if (!activeContext) {
    return;
  }

  // Within the active section, collect CSS variables into the matching context.
  const match = trimmed.match(/^--([a-z0-9-]+):\s*([^;]+);/i);
  if (match) {
    contexts[activeContext][match[1]] = match[2].trim();
  }
});

// Convert a raw context map into one where every value has been resolved.
// dependencyContext lets semantic layers reuse primitive definitions.
const resolveContext = (rawContext, dependencyContext = {}) => {
  const combinedRaw = { ...dependencyContext, ...rawContext };
  const cache = {};

  const resolveToken = (name, stack = new Set([name])) => {
    if (cache[name]) {
      return cache[name];
    }

    const rawValue = combinedRaw[name];
    if (rawValue === undefined) {
      return undefined;
    }

    const simpleVarMatch = rawValue.match(/^var\((--[a-z0-9-]+)\)$/i);
    if (simpleVarMatch) {
      const referencedName = simpleVarMatch[1].replace(/^--/, '');
      if (stack.has(referencedName)) {
        throw new Error(
          `Circular token reference detected: ${[
            ...stack,
            referencedName,
          ].join(' -> ')}`,
        );
      }
      const nextStack = new Set(stack);
      nextStack.add(referencedName);
      const resolvedReference = resolveToken(referencedName, nextStack);
      cache[name] = resolvedReference ?? rawValue;
      return cache[name];
    }

    cache[name] = rawValue;
    return rawValue;
  };

  const resolved = {};
  Object.keys(rawContext).forEach((tokenName) => {
    resolved[tokenName] = resolveToken(tokenName);
  });
  return resolved;
};

const resolvedColorPrimitives = resolveContext(contexts.colorPrimitives);
// Semantic maps start with primitives but also include their own overrides.
const resolvedLight = resolveContext(contexts.colorLight, {
  ...contexts.colorPrimitives,
  ...contexts.colorLight,
});
const resolvedDark = resolveContext(contexts.colorDark, {
  ...contexts.colorPrimitives,
  ...contexts.colorDark,
});

const resolvedSizeTokens = resolveContext(contexts.size);
const resolvedTypographyPrimitives = resolveContext(
  contexts.typographyPrimitives,
);
const resolvedTypography = resolveContext(contexts.typography, {
  ...contexts.typographyPrimitives,
  ...contexts.typography,
});
const resolvedStyleTokens = resolveContext(contexts.styles, {
  ...contexts.typographyPrimitives,
  ...contexts.typography,
  ...contexts.styles,
});

const headerComment =
  '/**\n' +
  ' * Auto-generated by scripts/sync-theme.cjs\n' +
  ` * Source: ${path.relative(FRONT_END_ROOT, DESIGN_SYSTEM_THEME)}\n` +
  ' */\n';

const tokensTs =
  `${headerComment}` +
  // Primitive table export
  `export const wdsPrimitiveTokens = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(resolvedColorPrimitives).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    null,
    2,
  )} as const;\n\n` +
  // Serialize primitives and both semantic modes into a TS module
  `export const wdsSemanticTokens = {\n` +
  `  light: ${JSON.stringify(
    Object.fromEntries(
      Object.entries(resolvedLight).sort(([a], [b]) => a.localeCompare(b)),
    ),
    null,
    2,
  ).replace(/\n/g, '\n  ')} as const,\n` +
  `  dark: ${JSON.stringify(
    Object.fromEntries(
      Object.entries(resolvedDark).sort(([a], [b]) => a.localeCompare(b)),
    ),
    null,
    2,
  ).replace(/\n/g, '\n  ')} as const,\n` +
  `} as const;\n\n` +
  `export const wdsSizeTokens = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(resolvedSizeTokens).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    null,
    2,
  )} as const;\n\n` +
  `export const wdsTypographyPrimitiveTokens = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(resolvedTypographyPrimitives).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    null,
    2,
  )} as const;\n\n` +
  `export const wdsTypographyTokens = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(resolvedTypography).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    null,
    2,
  )} as const;\n\n` +
  `export const wdsStyleTokens = ${JSON.stringify(
    Object.fromEntries(
      Object.entries(resolvedStyleTokens).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
    null,
    2,
  )} as const;\n\n` +
  // Helpful types for consumers
  `export type WdsPrimitiveTokenName = keyof typeof wdsPrimitiveTokens;\n` +
  `export type WdsSemanticMode = keyof typeof wdsSemanticTokens;\n` +
  `export type WdsSemanticTokenName = keyof (typeof wdsSemanticTokens)[WdsSemanticMode];\n` +
  `export type WdsSizeTokenName = keyof typeof wdsSizeTokens;\n` +
  `export type WdsTypographyPrimitiveTokenName = keyof typeof wdsTypographyPrimitiveTokens;\n` +
  `export type WdsTypographyTokenName = keyof typeof wdsTypographyTokens;\n` +
  `export type WdsStyleTokenName = keyof typeof wdsStyleTokens;\n`;

fs.writeFileSync(TARGET_TS_PATH, tokensTs, 'utf8');

// Emit a summary so it's obvious what the script touched.
const summaryParts = [
  `color primitives: ${Object.keys(resolvedColorPrimitives).length}`,
  `color semantics: ${Object.keys(resolvedLight).length} light / ${Object.keys(
    resolvedDark,
  ).length} dark`,
  `sizes: ${Object.keys(resolvedSizeTokens).length}`,
  `typography primitives: ${
    Object.keys(resolvedTypographyPrimitives).length
  }`,
  `typography: ${Object.keys(resolvedTypography).length}`,
  `styles: ${Object.keys(resolvedStyleTokens).length}`,
];

console.log(
  `Synced ${path.relative(
    FRONT_END_ROOT,
    DESIGN_SYSTEM_THEME,
  )} -> ${path.relative(
    FRONT_END_ROOT,
    TARGET_CSS_PATH,
  )} and generated ${path.relative(
    FRONT_END_ROOT,
    TARGET_TS_PATH,
  )} (${summaryParts.join(', ')}).`,
);
