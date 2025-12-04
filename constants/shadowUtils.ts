type LengthResolver = (value: string) => number;
type VariableResolver = (value: string) => string;

export const dropShadowTokenNames = [
  'wds-effects-shadows-drop-shadow-100',
  'wds-effects-shadows-drop-shadow-200',
  'wds-effects-shadows-drop-shadow-300',
  'wds-effects-shadows-drop-shadow-400',
  'wds-effects-shadows-drop-shadow-500',
  'wds-effects-shadows-drop-shadow-600',
] as const;

export type DropShadowTokenName = (typeof dropShadowTokenNames)[number];
export type ShadowStyleTokens = Record<DropShadowTokenName, string>;

export type ShadowLayer = {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadRadius: number;
  color: string;
  opacity: number;
};

export type ShadowToken = {
  layers: ShadowLayer[];
  style: {
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowRadius?: number;
    shadowOpacity?: number;
    elevation?: number;
  };
};

export const splitShadowLayers = (value: string, resolveCssVariables: VariableResolver) => {
  const resolved = resolveCssVariables(value);
  const layers: string[] = [];
  let depth = 0;
  let buffer = '';

  for (const char of resolved) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    }

    if (char === ',' && depth === 0) {
      if (buffer.trim().length) {
        layers.push(buffer.trim());
      }
      buffer = '';
      continue;
    }

    buffer += char;
  }

  if (buffer.trim().length) {
    layers.push(buffer.trim());
  }

  return layers;
};

const parseRgbChannel = (value: string) => {
  const channel = parseInt(value, 10);
  return Number.isNaN(channel) ? 0 : channel;
};

const parseColorWithOpacity = (color: string) => {
  const hexMatch = color.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/);
  if (hexMatch) {
    const [, rgb, alphaHex] = hexMatch;
    return { color: `#${rgb}`, opacity: parseInt(alphaHex, 16) / 255 };
  }

  const rgbaMatch = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => part.trim());
    const [r = '0', g = '0', b = '0', a = '1'] = parts;
    return {
      color: `rgba(${parseRgbChannel(r)}, ${parseRgbChannel(g)}, ${parseRgbChannel(b)}, 1)`
        .replace(/\s+/g, ''),
      opacity: parseFloat(a) || 1,
    };
  }

  return { color, opacity: 1 };
};

const parseShadowLayer = (layer: string, cssLengthToPx: LengthResolver): ShadowLayer | null => {
  const colorMatch = layer.match(/(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{6,8})$/);
  if (!colorMatch) {
    return null;
  }

  const rawColor = colorMatch[1];
  const { color, opacity } = parseColorWithOpacity(rawColor);
  const numericPart = layer.replace(rawColor, '').trim();
  const lengthTokens = numericPart.split(/\s+/).filter(Boolean);
  while (lengthTokens.length < 4) {
    lengthTokens.push('0');
  }
  const [offsetX, offsetY, blurRadius, spreadRadius] = lengthTokens
    .slice(0, 4)
    .map((token) => cssLengthToPx(token));

  return {
    offsetX: offsetX ?? 0,
    offsetY: offsetY ?? 0,
    blurRadius: blurRadius ?? 0,
    spreadRadius: spreadRadius ?? 0,
    color,
    opacity,
  };
};

export const parseShadowValue = (
  value: string,
  resolveCssVariables: VariableResolver,
  cssLengthToPx: LengthResolver,
) =>
  splitShadowLayers(value, resolveCssVariables)
    .map((layer) => parseShadowLayer(layer, cssLengthToPx))
    .filter((layer): layer is ShadowLayer => Boolean(layer));

const selectProminentLayer = (layers: ShadowLayer[]) =>
  layers.reduce((candidate, layer) => {
    const candidateWeight = Math.abs(candidate.offsetY) + candidate.blurRadius;
    const layerWeight = Math.abs(layer.offsetY) + layer.blurRadius;
    return layerWeight > candidateWeight ? layer : candidate;
  });

export const toReactNativeShadow = (layers: ShadowLayer[]): ShadowToken => {
  if (!layers.length) {
    return { layers, style: {} };
  }

  const primary = selectProminentLayer(layers);
  const elevation = Math.max(1, Math.round((Math.abs(primary.offsetY) + primary.blurRadius) / 2));

  return {
    layers,
    style: {
      shadowColor: primary.color,
      shadowOffset: { width: primary.offsetX, height: primary.offsetY },
      shadowRadius: primary.blurRadius,
      shadowOpacity: primary.opacity,
      elevation,
    },
  };
};

export const buildShadows = (
  styleTokens: ShadowStyleTokens,
  resolveCssVariables: VariableResolver,
  cssLengthToPx: LengthResolver,
) => ({
  dropShadow100: toReactNativeShadow(
    parseShadowValue(getTokenOrThrow(styleTokens, 'wds-effects-shadows-drop-shadow-100'), resolveCssVariables, cssLengthToPx),
  ),
  dropShadow200: toReactNativeShadow(
    parseShadowValue(getTokenOrThrow(styleTokens, 'wds-effects-shadows-drop-shadow-200'), resolveCssVariables, cssLengthToPx),
  ),
  dropShadow300: toReactNativeShadow(
    parseShadowValue(getTokenOrThrow(styleTokens, 'wds-effects-shadows-drop-shadow-300'), resolveCssVariables, cssLengthToPx),
  ),
  dropShadow400: toReactNativeShadow(
    parseShadowValue(getTokenOrThrow(styleTokens, 'wds-effects-shadows-drop-shadow-400'), resolveCssVariables, cssLengthToPx),
  ),
  dropShadow500: toReactNativeShadow(
    parseShadowValue(getTokenOrThrow(styleTokens, 'wds-effects-shadows-drop-shadow-500'), resolveCssVariables, cssLengthToPx),
  ),
  dropShadow600: toReactNativeShadow(
    parseShadowValue(getTokenOrThrow(styleTokens, 'wds-effects-shadows-drop-shadow-600'), resolveCssVariables, cssLengthToPx),
  ),
});

const getTokenOrThrow = (tokens: ShadowStyleTokens, tokenName: DropShadowTokenName) => {
  const tokenValue = tokens[tokenName];
  if (typeof tokenValue !== 'string' || !tokenValue.trim()) {
    throw new Error(`Missing drop shadow token: ${tokenName}`);
  }
  return tokenValue;
};
