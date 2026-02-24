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

const parseWithFallback = (rawValue: string, resolvedValue: string, context: string) => {
  const parsed = Number.parseFloat(resolvedValue);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  console.warn(`[tokenHelpers] Invalid ${context} value "${rawValue}" (resolved: "${resolvedValue}"). Falling back to 0.`);
  return 0;
};

export const cssLengthToPx = (value: string, baseRemPx = 16) => {
  const resolved = resolveCssVariables(value).trim();
  if (!resolved || resolved === '0') {
    return 0;
  }
  if (resolved.endsWith('rem')) {
    return parseWithFallback(value, resolved, 'length') * baseRemPx;
  }
  if (resolved.endsWith('px')) {
    return parseWithFallback(value, resolved, 'length');
  }
  const numeric = Number(resolved);
  if (Number.isNaN(numeric)) {
    console.warn(`[tokenHelpers] Invalid numeric value "${value}" (resolved: "${resolved}"). Falling back to 0.`);
    return 0;
  }
  return numeric;
};

export const cssTimeToMs = (value: string) => {
  const resolved = resolveCssVariables(value).trim();
  if (!resolved || resolved === '0') {
    return 0;
  }

  if (resolved.endsWith('ms')) {
    return parseWithFallback(value, resolved, 'time');
  }

  const numeric = Number(resolved);
  if (Number.isNaN(numeric)) {
    console.warn(`[tokenHelpers] Invalid time value "${value}" (resolved: "${resolved}"). Falling back to 0.`);
    return 0;
  }

  return numeric;
};

export const __tokenHelperInternals = {
  cssVariableMap,
};
