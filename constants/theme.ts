/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import type { TextStyle } from 'react-native';

import {
  wdsSemanticTokens,
  wdsStyleTokens,
  wdsTypographyPrimitiveTokens,
  wdsTypographyTokens,
  wdsSizeTokens,
} from './wdsTokens';

// Style typography tokens reference primitive tokens (e.g. var(--wds-typography-body-size-medium)),
// so build a lookup map we can use to swap those placeholders for their concrete values.
const cssVariableMap = Object.fromEntries(
  Object.entries({
    ...wdsTypographyPrimitiveTokens,
    ...wdsTypographyTokens,
  }).map(([key, value]) => [`--${key}`, value]),
);

// Replace each CSS variable reference inside the font shorthand string with its literal value.
const resolveCssVariables = (value: string) =>
  value.replace(/var\((--[^)]+)\)/g, (_, token) => cssVariableMap[token] ?? token);

const makePalette = (mode: 'light' | 'dark') => ({
  background: {
    default: {
      default: wdsSemanticTokens[mode]['wds-color-background-default-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-background-default-secondary'],
    },
    neutral: {
      secondary: wdsSemanticTokens[mode]['wds-color-background-neutral-secondary'],
      secondaryHover: wdsSemanticTokens[mode]['wds-color-background-neutral-secondary-hover'],
    },
    brand: {
      default: wdsSemanticTokens[mode]['wds-color-background-brand-default'],
      hover: wdsSemanticTokens[mode]['wds-color-background-brand-hover'],
    }
  },
  border: {
    default: {
      default: wdsSemanticTokens[mode]['wds-color-border-default-default'],
    }
  },
  icon: {
    default: {
      default: wdsSemanticTokens[mode]['wds-color-icon-default-default'],
    },
    brand: {
      default: wdsSemanticTokens[mode]['wds-color-icon-brand-default'],
    }
  },
  text: {
    default: {
      default: wdsSemanticTokens[mode]['wds-color-text-default-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-text-default-secondary'],
    },
    neutral: {
      default: wdsSemanticTokens[mode]['wds-color-text-neutral-default'],
      onNeutralSecondary: wdsSemanticTokens[mode]['wds-color-text-neutral-on-neutral-secondary'],
    },
    brand: {
      default: wdsSemanticTokens[mode]['wds-color-text-brand-default'],
      onBrand: wdsSemanticTokens[mode]['wds-color-text-brand-on-brand'],
      secondary: wdsSemanticTokens[mode]['wds-color-text-brand-secondary'],
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
const remToPx = (rem: string) => parseFloat(rem) * 16;

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

export const Typography = {
  titleHero: parseFontShorthand(wdsStyleTokens['wds-font-title-hero'], 'titleHero'),
  titlePage: parseFontShorthand(wdsStyleTokens['wds-font-title-page'], 'titlePage'),
  subtitle: parseFontShorthand(wdsStyleTokens['wds-font-subtitle'], 'subtitle'),
  heading: parseFontShorthand(wdsStyleTokens['wds-font-heading'], 'heading'),
  subheading: parseFontShorthand(wdsStyleTokens['wds-font-subheading'], 'subheading'),
  body: parseFontShorthand(wdsStyleTokens['wds-font-body-base'], 'body'),
  bodyStrong: parseFontShorthand(wdsStyleTokens['wds-font-body-strong'], 'body'),
  link: parseFontShorthand(wdsStyleTokens['wds-font-body-link'], 'body'),
  code: parseFontShorthand(wdsStyleTokens['wds-font-body-code'], 'code'),
  singleLineBody: parseFontShorthand(
    wdsStyleTokens['wds-font-single-line-body-base'],
    'singleLineBody',
  ),
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
