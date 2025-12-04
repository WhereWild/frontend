/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import type { TextStyle } from 'react-native';

import {
  buildShadows,
  dropShadowTokenNames,
  parseShadowValue as parseShadowValueWithResolvers,
  splitShadowLayers as splitShadowLayersWithResolver,
} from './shadowUtils';
import type { ShadowStyleTokens } from './shadowUtils';
import {
  wdsPrimitiveTokens,
  wdsResponsiveTokens,
  wdsSemanticTokens,
  wdsSizeTokens,
  wdsStyleTokens,
  wdsTypographyPrimitiveTokens,
  wdsTypographyTokens,
} from './wdsTokens';

// Style typography tokens reference primitive tokens (e.g. var(--wds-typography-body-size-medium)),
// so build a lookup map we can use to swap those placeholders for their concrete values.
const cssVariableMap = Object.fromEntries([
  ...Object.entries({
    ...wdsTypographyPrimitiveTokens,
    ...wdsTypographyTokens,
  }).map(([key, value]) => [`--${key}`, value]),
  ...Object.entries(wdsPrimitiveTokens).map(([key, value]) => [`--${key}`, value]),
  ...Object.entries(wdsSizeTokens).flatMap(([key, value]) => {
    const normalizedKey = key.replace(/^wds-/, '');
    return [
      [`--${key}`, value],
      [`--@${normalizedKey}`, value],
    ];
  }),
]);

// Replace each CSS variable reference inside the font shorthand string with its literal value.
const resolveCssVariables = (value: string) =>
  value.replace(/var\((--[^)]+)\)/g, (_, token) => cssVariableMap[token] ?? token);

const makePalette = (mode: 'light' | 'dark') => ({
  background: {
    default: {
      default: wdsSemanticTokens[mode]['wds-color-background-default-default'],
      hover: wdsSemanticTokens[mode]['wds-color-background-default-hover'],
      pressed: wdsSemanticTokens[mode]['wds-color-background-default-pressed'],
      secondary: wdsSemanticTokens[mode]['wds-color-background-default-secondary'],
      secondaryHover: wdsSemanticTokens[mode]['wds-color-background-default-secondary-hover'],
      secondaryPressed: wdsSemanticTokens[mode]['wds-color-background-default-secondary-pressed'],
      tertiary: wdsSemanticTokens[mode]['wds-color-background-default-tertiary'],
      tertiaryHover: wdsSemanticTokens[mode]['wds-color-background-default-tertiary-hover'],
      tertiaryPressed: wdsSemanticTokens[mode]['wds-color-background-default-tertiary-pressed'],
    },
    neutral: {
      default: wdsSemanticTokens[mode]['wds-color-background-neutral-default'],
      hover: wdsSemanticTokens[mode]['wds-color-background-neutral-hover'],
      pressed: wdsSemanticTokens[mode]['wds-color-background-neutral-pressed'],
      secondary: wdsSemanticTokens[mode]['wds-color-background-neutral-secondary'],
      secondaryHover: wdsSemanticTokens[mode]['wds-color-background-neutral-secondary-hover'],
      secondaryPressed: wdsSemanticTokens[mode]['wds-color-background-neutral-secondary-pressed'],
      tertiary: wdsSemanticTokens[mode]['wds-color-background-neutral-tertiary'],
      tertiaryHover: wdsSemanticTokens[mode]['wds-color-background-neutral-tertiary-hover'],
      tertiaryPressed: wdsSemanticTokens[mode]['wds-color-background-neutral-tertiary-pressed'],
    },
    brand: {
      default: wdsSemanticTokens[mode]['wds-color-background-brand-default'],
      hover: wdsSemanticTokens[mode]['wds-color-background-brand-hover'],
      pressed: wdsSemanticTokens[mode]['wds-color-background-brand-pressed'],
    },
    danger: {
      default: wdsSemanticTokens[mode]['wds-color-background-danger-default'],
      hover: wdsSemanticTokens[mode]['wds-color-background-danger-hover'],
      pressed: wdsSemanticTokens[mode]['wds-color-background-danger-pressed'],
      secondary: wdsSemanticTokens[mode]['wds-color-background-danger-secondary'],
      secondaryHover: wdsSemanticTokens[mode]['wds-color-background-danger-secondary-hover'],
      secondaryPressed: wdsSemanticTokens[mode]['wds-color-background-danger-secondary-pressed'],
    },
    disabled: {
      default: wdsSemanticTokens[mode]['wds-color-background-disabled-default'],
    }
  },
  border: {
    default: {
      default: wdsSemanticTokens[mode]['wds-color-border-default-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-border-default-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-border-default-tertiary'],
    },
    brand: {
      default: wdsSemanticTokens[mode]['wds-color-border-brand-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-border-brand-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-border-brand-tertiary'],
    },
    danger: {
      default: wdsSemanticTokens[mode]['wds-color-border-danger-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-border-danger-secondary'],
    },
    neutral: {
      default: wdsSemanticTokens[mode]['wds-color-border-neutral-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-border-neutral-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-border-neutral-tertiary'],
    }
  },
  icon: {
    default: {
      default: wdsSemanticTokens[mode]['wds-color-icon-default-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-icon-default-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-icon-default-tertiary'],
    },
    brand: {
      default: wdsSemanticTokens[mode]['wds-color-icon-brand-default'],
      onBrand: wdsSemanticTokens[mode]['wds-color-icon-brand-on-brand'],
    },
    neutral: {
      default: wdsSemanticTokens[mode]['wds-color-icon-neutral-default'],
      onNeutral: wdsSemanticTokens[mode]['wds-color-icon-neutral-on-neutral'],
      onNeutralSecondary: wdsSemanticTokens[mode]['wds-color-icon-neutral-on-neutral-secondary'],
      onNeutralTertiary: wdsSemanticTokens[mode]['wds-color-icon-neutral-on-neutral-tertiary'],
      secondary: wdsSemanticTokens[mode]['wds-color-icon-neutral-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-icon-neutral-tertiary'],
    },
    danger: {
      default: wdsSemanticTokens[mode]['wds-color-icon-danger-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-icon-danger-secondary'],
      onDanger: wdsSemanticTokens[mode]['wds-color-icon-danger-on-danger'],
      onDangerSecondary: wdsSemanticTokens[mode]['wds-color-icon-danger-on-danger-secondary'],
    },
    disabled: {
      default: wdsSemanticTokens[mode]['wds-color-icon-disabled-default'],
      onDisabled: wdsSemanticTokens[mode]['wds-color-icon-disabled-on-disabled'],
    }
  },
  text: {
    default: {
      default: wdsSemanticTokens[mode]['wds-color-text-default-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-text-default-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-text-default-tertiary'],
    },
    neutral: {
      default: wdsSemanticTokens[mode]['wds-color-text-neutral-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-text-neutral-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-text-neutral-tertiary'],
      onNeutral: wdsSemanticTokens[mode]['wds-color-text-neutral-on-neutral'],
      onNeutralSecondary: wdsSemanticTokens[mode]['wds-color-text-neutral-on-neutral-secondary'],
      onNeutralTertiary: wdsSemanticTokens[mode]['wds-color-text-neutral-on-neutral-tertiary'],
    },
    brand: {
      default: wdsSemanticTokens[mode]['wds-color-text-brand-default'],
      onBrand: wdsSemanticTokens[mode]['wds-color-text-brand-on-brand'],
      secondary: wdsSemanticTokens[mode]['wds-color-text-brand-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-text-brand-tertiary'],
    },
    danger: {
      default: wdsSemanticTokens[mode]['wds-color-text-danger-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-text-danger-secondary'],
      onDanger: wdsSemanticTokens[mode]['wds-color-text-danger-on-danger'],
      onDangerSecondary: wdsSemanticTokens[mode]['wds-color-text-danger-on-danger-secondary'],
    },
    disabled: {
      default: wdsSemanticTokens[mode]['wds-color-text-disabled-default'],
      onDisabled: wdsSemanticTokens[mode]['wds-color-text-disabled-on-disabled'],
    }
  }
})

export const Colors = {
  light: makePalette('light'),
  dark: makePalette('dark'),
};

// The Figma tokens don't export line heights, so we define them here.
const FONT_LINE_HEIGHTS: Record<string, number> = {
  body: 1.4,
  code: 1,
  singleLineBody: 1,
  titleHero: 1.2,
  titlePage: 1.2,
  subtitle: 1.2,
  heading: 1.2,
  subheading: 1.2,
};

// Map CSS font-family and font-weight to Expo font names
const expoFontMap: Record<string, string> = {
  '"domine", serif|400': 'Domine_400Regular',
  '"domine", serif|600': 'Domine_600SemiBold',
  '"domine", serif|700': 'Domine_700Bold',
  '"inter", sans-serif|400': 'Inter_400Regular',
  '"inter", sans-serif|600': 'Inter_600SemiBold',
  '"jetbrains mono", monospace|400': 'JetBrainsMono_400Regular',
};

// Function to get the Expo font name based on family and weight
const getExpoFontName = (family: string, weight: string) =>
  expoFontMap[`${family}|${weight}`] ?? 'System';

// rem units are used across typography and size tokens in the design system.
// React Native expects pixel values, so we convert rem -> px using a 16px base.
// This single helper is reused for font sizes and all size-related tokens to keep consistency.
const remToPx = (rem: string) => parseFloat(resolveCssVariables(rem)) * 16;

const cssLengthToPx = (length: string) => {
  const normalized = typeof length === 'string' ? length : '';
  const resolved = resolveCssVariables(normalized.trim());
  if (resolved.endsWith('rem')) {
    return parseFloat(resolved) * 16;
  }
  if (resolved.endsWith('px')) {
    return parseFloat(resolved);
  }
  if (!resolved) {
    return 0;
  }
  return parseFloat(resolved) || 0;
};

// Function to parse CSS font shorthand into React Native style object
const parseFontShorthand = (
  value: string,
  variant: keyof typeof FONT_LINE_HEIGHTS,
): TextStyle => {
  const resolvedValue = resolveCssVariables(value);
  const [style, weight, size, ...familyParts] = resolvedValue.split(' ');
  const family = familyParts.join(' ');
  const fontSize = remToPx(size);
  const fontStyle = style as TextStyle['fontStyle'];
  const fontWeight = weight as TextStyle['fontWeight'];
  const fontFamily = getExpoFontName(family, weight) as TextStyle['fontFamily'];

  return {
    fontStyle,
    fontWeight,
    fontSize,
    lineHeight: fontSize * (FONT_LINE_HEIGHTS[variant] ?? 1.2), // look up line height and fall back to 1.2
    fontFamily,
  };
};

// Typography styles with colors that adapt to light/dark mode
const createTypography = (mode: 'light' | 'dark') => ({
  titleHero: { ...parseFontShorthand(wdsStyleTokens['wds-font-title-hero'], 'titleHero'), color: Colors[mode].text.brand.default },
  titlePage: { ...parseFontShorthand(wdsStyleTokens['wds-font-title-page'], 'titlePage'), color: Colors[mode].text.brand.default },
  subtitle: { ...parseFontShorthand(wdsStyleTokens['wds-font-subtitle'], 'subtitle'), color: Colors[mode].text.default.default },
  heading: { ...parseFontShorthand(wdsStyleTokens['wds-font-heading'], 'heading'), color: Colors[mode].text.brand.secondary },
  subheading: { ...parseFontShorthand(wdsStyleTokens['wds-font-subheading'], 'subheading'), color: Colors[mode].text.brand.tertiary },
  body: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-base'], 'body'), color: Colors[mode].text.default.default },
  bodyEmphasis: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-emphasis'], 'body'), color: Colors[mode].text.default.default },
  bodyStrong: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-strong'], 'body'), color: Colors[mode].text.default.default },
  bodySmall: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-small'], 'body'), color: Colors[mode].text.default.default },
  bodySmallEmphasis: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-small-emphasis'], 'body'), color: Colors[mode].text.default.default },
  bodySmallStrong: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-small-strong'], 'body'), color: Colors[mode].text.default.default },
  link: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-link'], 'body'), color: Colors[mode].text.brand.default },
  code: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-code'], 'code'), color: Colors[mode].text.default.default },
  singleLineBody: { ...parseFontShorthand(wdsStyleTokens['wds-font-single-line-body-base'], 'singleLineBody'), color: Colors[mode].text.default.default },
});

export const Typography = {
  light: createTypography('light'),
  dark: createTypography('dark'),
};

// Raw size tokens (CSS values) for direct variable usage in web contexts if needed.
export const SizeTokens = wdsSizeTokens;

// Helper to build a grouped map from a token prefix, stripping the prefix and converting units.
// Default conversion uses the shared remToPx helper (negative values are preserved automatically).
const buildGroup = (prefix: string, convert: (value: string) => number = remToPx) =>
  Object.fromEntries(
    Object.entries(wdsSizeTokens)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.replace(prefix, ''), convert(value)])
  );

// Groups are organized by semantic intent (spacing, radius, depth, etc.).
export const Size = {
  space: buildGroup('wds-size-space-'), // Includes negative space tokens (remain negative after conversion)
  radius: buildGroup('wds-size-radius-'),
  icon: buildGroup('wds-size-icon-'),
  depth: buildGroup('wds-size-depth-'),
  // Negative depth values are already captured inside depth (they have the same prefix);
  // expose a convenience filtered view if needed.
  depthNegative: Object.fromEntries(
    Object.entries(buildGroup('wds-size-depth-')).filter(([k]) => k.startsWith('negative-'))
  ),
  stroke: buildGroup('wds-size-stroke-'),
  blur: buildGroup('wds-size-blur-'),
} as const;

export type SizeGroup = typeof Size;

// Layout-related responsive tokens live outside the size system; expose the ones we can use in RN layouts.
// Will need updates as mobile-specific responsive tokens are added to the design system.
const responsiveDeviceWidths = {
  desktop: remToPx(wdsResponsiveTokens.desktop['wds-responsive-device-width']),
  tablet: remToPx(wdsResponsiveTokens.tablet['wds-responsive-device-width']),
  mobile: remToPx(wdsResponsiveTokens.mobile['wds-responsive-device-width']),
} as const;

export const Responsive = {
  contentWidth: remToPx(wdsResponsiveTokens.desktop['wds-responsive-content-width']),
  textWidth: remToPx(wdsResponsiveTokens.desktop['wds-responsive-text-width']),
  marginHorizontal: remToPx(wdsResponsiveTokens.mobile['wds-responsive-margin-horizontal']),
  deviceWidth: responsiveDeviceWidths,
} as const;

const splitShadowLayers = (value: string) => splitShadowLayersWithResolver(value, resolveCssVariables);
const parseShadowValue = (value: string) => parseShadowValueWithResolvers(value, resolveCssVariables, cssLengthToPx);

const dropShadowTokens = dropShadowTokenNames.reduce((acc, tokenName) => {
  acc[tokenName] = wdsStyleTokens[tokenName];
  return acc;
}, {} as ShadowStyleTokens);

export const Shadows = buildShadows(dropShadowTokens, resolveCssVariables, cssLengthToPx);

// Internal helpers are exported for targeted unit tests to ensure token parsing stays stable.
export const themeInternals = {
  resolveCssVariables,
  parseFontShorthand,
  remToPx,
  getExpoFontName,
  cssLengthToPx,
  splitShadowLayers,
  parseShadowValue,
  dropShadowTokens,
};
