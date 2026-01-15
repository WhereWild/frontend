import {
  wdsPrimitiveTokens,
  wdsSizeTokens,
  wdsTypographyPrimitiveTokens,
  wdsTypographyTokens,
} from './wdsTokens';

const typographyPrimitiveEntries = Object.entries(wdsTypographyPrimitiveTokens).flatMap(([key, value]) => {
  const normalizedKey = key.replace(/^wds-/, '');
  const entries: [string, string][] = [[`--${key}`, value]];
  entries.push([`--@${normalizedKey}`, value]);
  if (normalizedKey.startsWith('typography-')) {
    const primitivesKey = normalizedKey.replace('typography-', 'typography_primitives-');
    entries.push([`--@${primitivesKey}`, value]);
  }
  return entries;
});

const cssVariableMap = Object.fromEntries([
  ...typographyPrimitiveEntries,
  ...Object.entries(wdsTypographyTokens).map(([key, value]) => [`--${key}`, value]),
  ...Object.entries(wdsPrimitiveTokens).map(([key, value]) => [`--${key}`, value]),
  ...Object.entries(wdsSizeTokens).flatMap(([key, value]) => {
    const normalizedKey = key.replace(/^wds-/, '');
    return [
      [`--${key}`, value],
      [`--@${normalizedKey}`, value],
    ];
  }),
]);

export const resolveCssVariables = (value: string) =>
  value.replace(/var\((--[^)]+)\)/g, (_, token) => cssVariableMap[token] ?? token);

export const cssLengthToPx = (value: string, baseRemPx = 16) => {
  const resolved = resolveCssVariables(value).trim();
  if (!resolved || resolved === '0') {
    return 0;
  }
  if (resolved.endsWith('rem')) {
    return parseFloat(resolved) * baseRemPx;
  }
  if (resolved.endsWith('px')) {
    return parseFloat(resolved) || 0;
  }
  const numeric = Number(resolved);
  return Number.isNaN(numeric) ? 0 : numeric;
};

export const __tokenHelperInternals = {
  cssVariableMap,
};
