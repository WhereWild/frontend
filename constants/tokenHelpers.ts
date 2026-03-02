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

/**
 * Builds a grouped token map by filtering keys with a prefix, stripping that prefix,
 * and converting each raw token value into a typed value.
 *
 * @template T - Output value type returned by the converter (e.g. number, string, number[]).
 * @param tokens - Source token dictionary to read from.
 * @param prefix - Token key prefix to match and remove from output keys.
 * @param convert - Converter applied to each matched token value.
 * @returns Record keyed by stripped token names with converted values.
 */
export const buildTokenGroup = <T>(
  tokens: Record<string, string>,
  prefix: string,
  convert: (value: string) => T,
) =>
  Object.fromEntries(
    Object.entries(tokens)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.replace(prefix, ''), convert(value)])
  ) as Record<string, T>;

type StripPrefix<Key extends string, Prefix extends string> = Key extends `${Prefix}${infer Rest}`
  ? Rest
  : never;

type TokenGroupKeys<TTokens extends Record<string, string>, Prefix extends string> =
  StripPrefix<Extract<keyof TTokens, string>, Prefix>;

type TokenGroup<TTokens extends Record<string, string>, Prefix extends string, TValue> = {
  [K in TokenGroupKeys<TTokens, Prefix>]: TValue;
};

/**
 * Like buildTokenGroup, but preserves literal key types derived from the token map
 * and prefix so consumers get IntelliSense for grouped token names.
 *
 * @template TTokens - Source token map type.
 * @template Prefix - Prefix to strip from matching token keys.
 * @template TValue - Output value type returned by the converter.
 * @param tokens - Source token dictionary to read from.
 * @param prefix - Token key prefix to match and remove from output keys.
 * @param convert - Converter applied to each matched token value.
 * @returns Typed token group keyed by prefix-stripped names.
 */
export const buildTypedTokenGroup = <
  TTokens extends Record<string, string>,
  Prefix extends string,
  TValue,
>(
  tokens: TTokens,
  prefix: Prefix,
  convert: (value: string) => TValue,
): TokenGroup<TTokens, Prefix, TValue> =>
  buildTokenGroup(tokens, prefix, convert) as TokenGroup<TTokens, Prefix, TValue>;

/**
 * Recursively converts a hyphen-delimited string literal type to camelCase.
 *
 * Behavior:
 * - For strings containing hyphens, the segment after each hyphen is capitalized
 *   and concatenated to the previous part.
 * - This is applied recursively, so multiple segments are handled:
 *   e.g. `"foo-bar-baz"` becomes `"fooBarBaz"`.
 * - Strings without hyphens are returned unchanged.
 * - Leading or trailing hyphens are preserved in the head/tail decomposition,
 *   which can result in capitalized leading segments (e.g. `"-foo"` → `"Foo"`).
 *
 * This is a type-level helper used to derive camelCase aliases from
 * hyphenated token keys.
 */
type CamelCase<S extends string> = S extends `${infer Head}-${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : S;

type WithCamelCaseAliases<T extends Record<string, number>> = T & {
  [K in keyof T as K extends string ? CamelCase<K> : never]: T[K];
};

/**
 * Adds camelCase aliases for hyphenated token keys while preserving the original keys.
 *
 * Example: { "focus-ring": 2 } becomes accessible as both token['focus-ring'] and token.focusRing.
 *
 * Aliases are generated for hyphenated segments including mixed-case ones.
 * Example: `foo-Bar` is aliased as `fooBar`.
 *
 * This helper is intentionally strict: values must be finite numbers.
 *
 * @template T - Token record with string keys and numeric values.
 * @param tokens - Token record to augment.
 * @returns Token record containing original keys plus camelCase aliases.
 */
export const withCamelCaseAliases = <T extends Record<string, number>>(tokens: T): WithCamelCaseAliases<T> => {
  const mappedTokens: Record<string, number> = { ...tokens };

  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
      throw new TypeError(
        `[tokenHelpers] withCamelCaseAliases expected a finite number for key "${key}", received ${String(value)}.`
      );
    }

    if (key.includes('-')) {
      const camelKey = key.replace(/-([A-Za-z0-9])/g, (_, matchedChar: string) => matchedChar.toUpperCase());
      mappedTokens[camelKey] = value;
    }
  }

  return mappedTokens as WithCamelCaseAliases<T>;
};

export const __tokenHelperInternals = {
  cssVariableMap,
};
