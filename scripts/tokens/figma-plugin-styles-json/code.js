// SPDX-FileCopyrightText: 2024 Figma
// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

/* global figma */

function RGBAToHexA(rgba, forceRemoveAlpha = false) {
  return (
    "#" +
    rgba
      .replace(/^rgba?\(|\s+|\)$/g, "") // Get's rgba / rgb string values
      .split(",") // splits them at ","
      .filter((string, index) => !forceRemoveAlpha || index !== 3)
      .map((string) => parseFloat(string)) // Converts them to numbers
      .map((number, index) => (index === 3 ? Math.round(number * 255) : number)) // Converts alpha to 255 number
      .map((number) => number.toString(16)) // Converts numbers to hex
      .map((string) => (string.length === 1 ? "0" + string : string)) // Adds 0 when length of one number is 1
      .join("")
  ); // Puts the array together to a string
}

function colorToHex({ r, g, b, a }) {
  return RGBAToHexA(
    `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}, ${a})`
  );
}

function mergeObjects(source, extra) {
  const target = {};
  if (source && typeof source === "object") {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }
  if (extra && typeof extra === "object") {
    for (const key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) {
        target[key] = extra[key];
      }
    }
  }
  return target;
}

async function go() {
  const payload = [];
  (await figma.getLocalEffectStylesAsync()).forEach(
    ({ type, name, effects }) => {
      const newEffects = effects
        .filter((a) => a.visible)
        .map((effect) => {
          const variables = {};
          const boundEffectVariables = effect.boundVariables || {};
          for (let property in boundEffectVariables) {
            variables[property] = figma.variables.getVariableById(
              boundEffectVariables[property].id
            ).name;
          }
            const effectColor =
              effect.color && typeof effect.color === "object" ? effect.color : null;
            const hex = effectColor ? colorToHex(effectColor) : null;
          const additions = hex ? { hex, variables } : { variables };
          return mergeObjects(effect, additions);
        });
      payload.push(JSON.stringify({ type, name, effects: newEffects }));
    }
  );
  (await figma.getLocalPaintStylesAsync()).forEach(({ type, name, paints }) => {
    const newPaints = paints
      .filter((a) => a.visible)
      .map((paint) => {
        const variables = {};
        const boundPaintVariables = paint.boundVariables || {};
        for (let property in boundPaintVariables) {
          variables[property] = figma.variables.getVariableById(
            boundPaintVariables[property].id
          ).name;
        }
        return mergeObjects(paint, { variables });
      });
    payload.push(JSON.stringify({ type, name, paints: newPaints }));
  });
  (await figma.getLocalTextStylesAsync()).forEach(
    ({
      type,
      name,
      fontSize,
      textDecoration,
      fontName,
      letterSpacing,
      lineHeight,
      leadingTrim,
      paragraphIndent,
      paragraphSpacing,
      listSpacing,
      hangingPunctuation,
      handlingList,
      textCase,
      boundVariables,
    }) => {
      const variables = {};
      for (let property in boundVariables) {
        variables[property] = figma.variables.getVariableById(
          boundVariables[property].id
        ).name;
      }
      payload.push(
        JSON.stringify({
          type,
          name,
          fontSize,
          textDecoration,
          fontName,
          letterSpacing,
          lineHeight,
          leadingTrim,
          paragraphIndent,
          paragraphSpacing,
          listSpacing,
          hangingPunctuation,
          handlingList,
          textCase,
          boundVariables,
          variables,
        })
      );
    }
  );
  figma.showUI(
    `<style>body { margin: 0 } textarea { font-family: monospace; white-space: pre; height: 100vh; width: 100vw; }</style>
<textarea>[${payload.join(",\n")}]</textarea>`,
    {
      height: 900,
      width: 1200,
    }
  );
}

go();
