/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */
import { Easing, TextStyle } from 'react-native';

import { cssLengthToPx, cssTimeToMs, resolveCssVariables } from './tokenHelpers';
import { wdsSemanticTokens, wdsSizeTokens, wdsStyleTokens, wdsTimeTokens } from './wdsTokens';
import { getResponsive } from './responsive';
import { createShadows } from './shadows';

// Token helpers live in tokenHelpers.ts to enable reuse across responsive and shadow factories.

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
      secondary: wdsSemanticTokens[mode]['wds-color-background-brand-secondary'],
      secondaryHover: wdsSemanticTokens[mode]['wds-color-background-brand-secondary-hover'],
      secondaryPressed: wdsSemanticTokens[mode]['wds-color-background-brand-secondary-pressed'],
      tertiary: wdsSemanticTokens[mode]['wds-color-background-brand-tertiary'],
      tertiaryHover: wdsSemanticTokens[mode]['wds-color-background-brand-tertiary-hover'],
      tertiaryPressed: wdsSemanticTokens[mode]['wds-color-background-brand-tertiary-pressed'],
    },
    danger: {
      default: wdsSemanticTokens[mode]['wds-color-background-danger-default'],
      hover: wdsSemanticTokens[mode]['wds-color-background-danger-hover'],
      pressed: wdsSemanticTokens[mode]['wds-color-background-danger-pressed'],
      secondary: wdsSemanticTokens[mode]['wds-color-background-danger-secondary'],
      secondaryHover: wdsSemanticTokens[mode]['wds-color-background-danger-secondary-hover'],
      secondaryPressed: wdsSemanticTokens[mode]['wds-color-background-danger-secondary-pressed'],
    },
    positive: {
      default: wdsSemanticTokens[mode]['wds-color-background-positive-default'],
      hover: wdsSemanticTokens[mode]['wds-color-background-positive-hover'],
      pressed: wdsSemanticTokens[mode]['wds-color-background-positive-pressed'],
      secondary: wdsSemanticTokens[mode]['wds-color-background-positive-secondary'],
      secondaryHover: wdsSemanticTokens[mode]['wds-color-background-positive-secondary-hover'],
      secondaryPressed: wdsSemanticTokens[mode]['wds-color-background-positive-secondary-pressed'],
    },
    warning: {
      default: wdsSemanticTokens[mode]['wds-color-background-warning-default'],
      hover: wdsSemanticTokens[mode]['wds-color-background-warning-hover'],
      pressed: wdsSemanticTokens[mode]['wds-color-background-warning-pressed'],
      secondary: wdsSemanticTokens[mode]['wds-color-background-warning-secondary'],
      secondaryHover: wdsSemanticTokens[mode]['wds-color-background-warning-secondary-hover'],
      secondaryPressed: wdsSemanticTokens[mode]['wds-color-background-warning-secondary-pressed'],
    },
    utilities: {
      overlay: wdsSemanticTokens[mode]['wds-color-background-utilities-overlay'],
      scrim: wdsSemanticTokens[mode]['wds-color-background-utilities-scrim'],
      blanket: wdsSemanticTokens[mode]['wds-color-background-utilities-blanket'],
      measurement: wdsSemanticTokens[mode]['wds-color-background-utilities-measurement'],
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
    positive: {
      default: wdsSemanticTokens[mode]['wds-color-border-positive-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-border-positive-secondary'],
    },
    warning: {
      default: wdsSemanticTokens[mode]['wds-color-border-warning-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-border-warning-secondary'],
    },
    neutral: {
      default: wdsSemanticTokens[mode]['wds-color-border-neutral-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-border-neutral-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-border-neutral-tertiary'],
    },
    utilities: {
      swatch: wdsSemanticTokens[mode]['wds-color-border-utilities-swatch'],
      measurement: wdsSemanticTokens[mode]['wds-color-border-utilities-measurement'],
    },
    disabled: {
      default: wdsSemanticTokens[mode]['wds-color-border-disabled-default'],
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
      onBrandSecondary: wdsSemanticTokens[mode]['wds-color-icon-brand-on-brand-secondary'],
      onBrandTertiary: wdsSemanticTokens[mode]['wds-color-icon-brand-on-brand-tertiary'],
      secondary: wdsSemanticTokens[mode]['wds-color-icon-brand-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-icon-brand-tertiary'],
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
    positive: {
      default: wdsSemanticTokens[mode]['wds-color-icon-positive-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-icon-positive-secondary'],
      onPositive: wdsSemanticTokens[mode]['wds-color-icon-positive-on-positive'],
      onPositiveSecondary: wdsSemanticTokens[mode]['wds-color-icon-positive-on-positive-secondary'],
    },
    warning: {
      default: wdsSemanticTokens[mode]['wds-color-icon-warning-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-icon-warning-secondary'],
      onWarning: wdsSemanticTokens[mode]['wds-color-icon-warning-on-warning'],
      onWarningSecondary: wdsSemanticTokens[mode]['wds-color-icon-warning-on-warning-secondary'],
    },
    utilities: {
      icon: wdsSemanticTokens[mode]['wds-color-icon-utilities-icon'],
      iconOnMeasurement: wdsSemanticTokens[mode]['wds-color-icon-utilities-icon-on-measurement'],
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
      onBrandSecondary: wdsSemanticTokens[mode]['wds-color-text-brand-on-brand-secondary'],
      onBrandTertiary: wdsSemanticTokens[mode]['wds-color-text-brand-on-brand-tertiary'],
      secondary: wdsSemanticTokens[mode]['wds-color-text-brand-secondary'],
      tertiary: wdsSemanticTokens[mode]['wds-color-text-brand-tertiary'],
    },
    danger: {
      default: wdsSemanticTokens[mode]['wds-color-text-danger-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-text-danger-secondary'],
      onDanger: wdsSemanticTokens[mode]['wds-color-text-danger-on-danger'],
      onDangerSecondary: wdsSemanticTokens[mode]['wds-color-text-danger-on-danger-secondary'],
    },
    positive: {
      default: wdsSemanticTokens[mode]['wds-color-text-positive-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-text-positive-secondary'],
      onPositive: wdsSemanticTokens[mode]['wds-color-text-positive-on-positive'],
      onPositiveSecondary: wdsSemanticTokens[mode]['wds-color-text-positive-on-positive-secondary'],
    },
    warning: {
      default: wdsSemanticTokens[mode]['wds-color-text-warning-default'],
      secondary: wdsSemanticTokens[mode]['wds-color-text-warning-secondary'],
      onWarning: wdsSemanticTokens[mode]['wds-color-text-warning-on-warning'],
      onWarningSecondary: wdsSemanticTokens[mode]['wds-color-text-warning-on-warning-secondary'],
    },
    utilities: {
      textOnOverlay: wdsSemanticTokens[mode]['wds-color-text-utilities-text-on-overlay'],
      textOnMeasurement: wdsSemanticTokens[mode]['wds-color-text-utilities-text-on-measurement'],
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

export type ColorPalette = typeof Colors.light;

// The Figma tokens don't export line heights, so we define them here.
const FONT_LINE_HEIGHTS: Record<string, number> = {
  body: 1.4,
  code: 1.2,
  singleLineBody: 1.2,
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
  '"jetbrains mono", monospace|700': 'JetBrainsMono_700Bold',
};

// Function to get the Expo font name based on family and weight
const getExpoFontName = (family: string, weight: string) =>
  expoFontMap[`${family}|${weight}`] ?? 'System';

// Function to parse CSS font shorthand into React Native style object
const parseFontShorthand = (
  value: string,
  variant: keyof typeof FONT_LINE_HEIGHTS,
  baseRemPx = 16,
): TextStyle => {
  const resolvedValue = resolveCssVariables(value);
  const [style, weight, size, ...familyParts] = resolvedValue.split(' ');
  const family = familyParts.join(' ');
  const fontSize = cssLengthToPx(size, baseRemPx);
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

const DEFAULT_EASING_CURVE = [0.25, 0.1, 0.25, 1];

const isValidCurveShape = (parts: number[]) =>
  parts.length === 4 && parts.every((part) => !Number.isNaN(part));

const hasValidXControlPoints = (parts: number[]) =>
  parts[0] >= 0 && parts[0] <= 1 && parts[2] >= 0 && parts[2] <= 1;

const parseEasingCurve = (value: string): number[] => {
  const normalized = value
    .trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/^\(/, '')
    .replace(/\)$/, '');

  const parts = normalized.split(',').map((part) => Number(part.trim()));
  const hasInvalidShape = !isValidCurveShape(parts);
  const hasInvalidXControlPoints = !hasInvalidShape && !hasValidXControlPoints(parts);

  if (hasInvalidShape || hasInvalidXControlPoints) {
    console.warn(
      `[theme] Invalid easing curve "${value}". Falling back to default curve [${DEFAULT_EASING_CURVE.join(', ')}].`
    );
    return [...DEFAULT_EASING_CURVE];
  }

  return [parts[0], parts[1], parts[2], parts[3]];
};

const isTestEnv = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

// Expose targeted hooks for tests without leaking implementation details at runtime
export const __themeTestHooks = isTestEnv
  ? {
      parseFontShorthand,
      getExpoFontName,
      parseEasingCurve,
    }
  : undefined;

export const Responsive = getResponsive();

// Typography styles with colors that adapt to light/dark mode
const createTypography = (mode: 'light' | 'dark', baseRemPx: number) => ({
  titleHero: { ...parseFontShorthand(wdsStyleTokens['wds-font-title-hero'], 'titleHero', baseRemPx), color: Colors[mode].text.brand.default },
  titlePage: { ...parseFontShorthand(wdsStyleTokens['wds-font-title-page'], 'titlePage', baseRemPx), color: Colors[mode].text.brand.default },
  subtitle: { ...parseFontShorthand(wdsStyleTokens['wds-font-subtitle'], 'subtitle', baseRemPx), color: Colors[mode].text.default.default },
  heading: { ...parseFontShorthand(wdsStyleTokens['wds-font-heading'], 'heading', baseRemPx), color: Colors[mode].text.brand.secondary },
  subheading: { ...parseFontShorthand(wdsStyleTokens['wds-font-subheading'], 'subheading', baseRemPx), color: Colors[mode].text.brand.tertiary },
  body: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-base'], 'body', baseRemPx), color: Colors[mode].text.default.default },
  bodyEmphasis: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-emphasis'], 'body', baseRemPx), color: Colors[mode].text.default.default },
  bodyStrong: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-strong'], 'body', baseRemPx), color: Colors[mode].text.default.default },
  bodySmall: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-small'], 'body', baseRemPx), color: Colors[mode].text.default.default },
  bodySmallEmphasis: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-small-emphasis'], 'body', baseRemPx), color: Colors[mode].text.default.default },
  bodySmallLink: {
    ...parseFontShorthand(wdsStyleTokens['wds-font-body-small-link'], 'body', baseRemPx),
    color: Colors[mode].text.brand.default,
    textDecorationLine: 'underline' as const,
    textDecorationColor: 'transparent',
  },
  bodySmallStrong: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-small-strong'], 'body', baseRemPx), color: Colors[mode].text.default.default },
  bodyTiny: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-tiny'], 'body', baseRemPx), color: Colors[mode].text.default.default },
  bodyTinyStrong: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-tiny-strong'], 'body', baseRemPx), color: Colors[mode].text.default.default },
  link: {
    ...parseFontShorthand(wdsStyleTokens['wds-font-body-link'], 'body', baseRemPx),
    color: Colors[mode].text.brand.default,
    textDecorationLine: 'underline' as const,
    textDecorationColor: 'transparent',
  },
  code: { ...parseFontShorthand(wdsStyleTokens['wds-font-body-code'], 'code', baseRemPx), color: Colors[mode].text.default.default },
  singleLineBody: { ...parseFontShorthand(wdsStyleTokens['wds-font-single-line-body-base'], 'singleLineBody', baseRemPx), color: Colors[mode].text.default.default },
  singleLineBodySmall: { ...parseFontShorthand(wdsStyleTokens['wds-font-single-line-body-small'], 'singleLineBody', baseRemPx), color: Colors[mode].text.default.default },
  singleLineBodySmallStrong: { ...parseFontShorthand(wdsStyleTokens['wds-font-single-line-body-small-strong'], 'singleLineBody', baseRemPx), color: Colors[mode].text.default.default },
  singleLineBodyTiny: { ...parseFontShorthand(wdsStyleTokens['wds-font-single-line-body-tiny'], 'singleLineBody', baseRemPx), color: Colors[mode].text.default.default },
  singleLineBodyTinyStrong: { ...parseFontShorthand(wdsStyleTokens['wds-font-single-line-body-tiny-strong'], 'singleLineBody', baseRemPx), color: Colors[mode].text.default.default },
});

export const getTypographyForMode = (mode: 'light' | 'dark', baseRemPx = Responsive.rootFontSize || 16) =>
  createTypography(mode, baseRemPx);

export const Typography = {
  light: getTypographyForMode('light'),
  dark: getTypographyForMode('dark'),
};

export const Shadows = createShadows();

// Raw size tokens (CSS values) for direct variable usage in web contexts if needed.
export const SizeTokens = wdsSizeTokens;

// Raw time tokens (CSS values) for direct variable usage in web contexts if needed.
export const TimeTokens = wdsTimeTokens;

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
const buildTokenGroup = <T>(
  tokens: Record<string, string>,
  prefix: string,
  convert: (value: string) => T,
) =>
  Object.fromEntries(
    Object.entries(tokens)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.replace(prefix, ''), convert(value)])
  ) as Record<string, T>;

// Groups are organized by semantic intent (spacing, radius, depth, etc.).
export const Size = {
  space: buildTokenGroup(wdsSizeTokens, 'wds-size-space-', cssLengthToPx), // Includes negative space tokens (remain negative after conversion)
  radius: buildTokenGroup(wdsSizeTokens, 'wds-size-radius-', cssLengthToPx),
  icon: buildTokenGroup(wdsSizeTokens, 'wds-size-icon-', cssLengthToPx),
  depth: buildTokenGroup(wdsSizeTokens, 'wds-size-depth-', cssLengthToPx),
  // Negative depth values are already captured inside depth (they have the same prefix);
  // expose a convenience filtered view if needed.
  depthNegative: Object.fromEntries(
    Object.entries(buildTokenGroup(wdsSizeTokens, 'wds-size-depth-', cssLengthToPx)).filter(([k]) => k.startsWith('negative-'))
  ),
  stroke: buildTokenGroup(wdsSizeTokens, 'wds-size-stroke-', cssLengthToPx),
  blur: buildTokenGroup(wdsSizeTokens, 'wds-size-blur-', cssLengthToPx),
} as const;

export type SizeGroup = typeof Size;

// Groups are organized by semantic time intent (durations and easing curves).
// Duration tokens are parsed into numeric milliseconds (e.g. 200ms -> 200).
export const Time = {
  duration: buildTokenGroup(wdsTimeTokens, 'wds-time-duration-', cssTimeToMs),
  easing: buildTokenGroup(wdsTimeTokens, 'wds-time-easing-', (value) => value),
} as const;

export type TimeGroup = typeof Time;

export const TimeEasingCurves = buildTokenGroup<number[]>(
  wdsTimeTokens,
  'wds-time-easing-',
  parseEasingCurve,
);

export type TimeEasingName = keyof typeof TimeEasingCurves;

export const getReactNativeEasing = (name: TimeEasingName) => {
  const [x1, y1, x2, y2] = TimeEasingCurves[name] ?? DEFAULT_EASING_CURVE;
  return Easing.bezier(x1, y1, x2, y2);
};
