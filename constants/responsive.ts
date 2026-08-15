// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Dimensions, Platform } from 'react-native';

import { cssLengthToPx } from './tokenHelpers';
import { wdsResponsiveTokens } from './wdsTokens';

const responsiveVariants = ['desktop', 'tablet', 'phone'] as const;
export type ResponsiveVariant = (typeof responsiveVariants)[number];
export type ResponsiveRuntime = 'web' | 'app';

export type ResponsiveVariantValues = {
  device: string;
  contentWidth: number;
  textWidth: number;
  marginHorizontal: number;
  gap: number;
  rootFontSize: number;
  scale: number;
  maxDeviceWidth: number;
};

export type ResponsiveByDevice = Record<ResponsiveVariant, ResponsiveVariantValues>;

export type ResponsiveResult = {
  breakpoint: ResponsiveVariant;
  /** False when `breakpoint` is a guess (SSR — no real window width was
   * available), rather than a real viewport measurement. Most consumers
   * can ignore this and just use `breakpoint` (which defaults to 'tablet'
   * when unknown, so anything gated on `breakpoint !== 'desktop'` — nav
   * collapsing to a hamburger menu, etc. — safely stays compact rather
   * than flashing full desktop content on a phone). A component whose own
   * bug is specifically about the *unknown* case needing the opposite
   * guess (e.g. a footer that collapses awkwardly if it assumes compact)
   * can check this to override just for itself. */
  isKnownWidth: boolean;
  platformOS: string;
  runtime: ResponsiveRuntime;
  device: string;
  contentWidth: number;
  textWidth: number;
  marginHorizontal: number;
  gap: number;
  rootFontSize: number;
  scale: number;
  platformMaxDeviceWidth: number;
  contentWidthByDevice: Record<ResponsiveVariant, number>;
  textWidthByDevice: Record<ResponsiveVariant, number>;
  marginHorizontalByDevice: Record<ResponsiveVariant, number>;
  gapByDevice: Record<ResponsiveVariant, number>;
  rootFontSizeByDevice: Record<ResponsiveVariant, number>;
  scaleByDevice: Record<ResponsiveVariant, number>;
  maxDeviceWidth: Record<ResponsiveVariant, number>;
  byDevice: ResponsiveByDevice;
};

type PlatformWithPad = typeof Platform & { isPad?: boolean };

type ResponsiveOptions = {
  platform?: PlatformWithPad;
  windowWidth?: number;
};

type RawResponsiveTokens = Record<string, string>;

const responsiveTokenMap: Record<string, RawResponsiveTokens> = wdsResponsiveTokens;

const getResponsiveTokensForVariant = (variant: ResponsiveVariant): RawResponsiveTokens => {
  const tokens = responsiveTokenMap[variant];
  if (!tokens) {
    throw new Error(`Missing responsive tokens for variant: ${variant}`);
  }
  return tokens;
};

const buildResponsiveVariant = (variant: ResponsiveVariant): ResponsiveVariantValues => {
  const tokens = getResponsiveTokensForVariant(variant);

  return {
    device: tokens['wds-responsive-device'],
    contentWidth: cssLengthToPx(tokens['wds-responsive-content-width']),
    textWidth: cssLengthToPx(tokens['wds-responsive-text-width']),
    marginHorizontal: cssLengthToPx(tokens['wds-responsive-margin-horizontal']),
    gap: cssLengthToPx(tokens['wds-responsive-top-level-gap']),
    rootFontSize: cssLengthToPx(tokens['wds-responsive-root-font-size']),
    scale: cssLengthToPx(tokens['wds-responsive-scale']),
    maxDeviceWidth: cssLengthToPx(tokens['wds-responsive-max-device-width']),
  };
};

const getCurrentWindowWidth = (): number | undefined => {
  // On web, window.innerWidth is the most reliable value; fall back to RN Dimensions elsewhere.
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
    return window.innerWidth;
  }

  try {
    const { width } = Dimensions.get?.('window') ?? {};
    // react-native-web's Dimensions module hardcodes {width: 0, height: 0}
    // and only ever updates it when canUseDOM is true — during SSR (no real
    // DOM in that Node process) this stub is exactly what comes back, and
    // 0 is a valid number that would otherwise sail past the "unknown
    // width" fallback below and get treated as an actual (phone-sized)
    // viewport. Treat non-positive width the same as unknown.
    return typeof width === 'number' && width > 0 ? width : undefined;
  } catch {
    return undefined;
  }
};

const pickDimensionVariant = (
  width: number | undefined,
  byDevice: ResponsiveByDevice,
): ResponsiveVariant => {
  // Breakpoints depend only on viewport width, independent of platform.
  // Unknown width happens during SSR (web output: 'server' — no `window`
  // there), where this guess gets baked into the initial HTML before the
  // client hydrates and re-measures the real viewport. Defaulting to
  // 'tablet' (i.e. "compact") means anything gated on
  // `breakpoint !== 'desktop'` — most commonly nav collapsing to a
  // hamburger menu — stays compact on first paint instead of flashing
  // full desktop content that then collapses, which is the more jarring
  // direction to get wrong (and phone visitors are the ones who'd see it).
  // This doesn't eliminate the SSR/hydration mismatch — see
  // ResponsiveResult.isKnownWidth for a component whose own bug needs the
  // opposite guess.
  if (typeof width !== 'number' || Number.isNaN(width)) {
    return 'tablet';
  }

  const { phone, tablet } = byDevice;
  const phoneMax =
    typeof phone.maxDeviceWidth === 'number' && !Number.isNaN(phone.maxDeviceWidth)
      ? phone.maxDeviceWidth
      : Number.POSITIVE_INFINITY;
  const tabletMax =
    typeof tablet.maxDeviceWidth === 'number' && !Number.isNaN(tablet.maxDeviceWidth)
      ? tablet.maxDeviceWidth
      : Number.POSITIVE_INFINITY;

  if (width <= phoneMax) {
    return 'phone';
  }

  if (width <= tabletMax) {
    return 'tablet';
  }

  return 'desktop';
};

export const getResponsive = ({ platform = Platform, windowWidth }: ResponsiveOptions = {}): ResponsiveResult => {
  const byDeviceEntries = responsiveVariants.map((variant) => [variant, buildResponsiveVariant(variant)] as const);
  const byDevice = Object.fromEntries(byDeviceEntries) as ResponsiveByDevice;

  const aggregations = {
    contentWidthByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.contentWidth])) as Record<ResponsiveVariant, number>,
    textWidthByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.textWidth])) as Record<ResponsiveVariant, number>,
    marginHorizontalByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.marginHorizontal])) as Record<ResponsiveVariant, number>,
    gapByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.gap])) as Record<ResponsiveVariant, number>,
    rootFontSizeByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.rootFontSize])) as Record<ResponsiveVariant, number>,
    scaleByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.scale])) as Record<ResponsiveVariant, number>,
    maxDeviceWidthByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.maxDeviceWidth])) as Record<ResponsiveVariant, number>,
  };

  const platformOS = platform.OS;
  if (!platformOS) {
    throw new Error('Missing platform OS in getResponsive()');
  }
  const runtime: ResponsiveRuntime = platformOS === 'web' ? 'web' : 'app';
  const resolvedWidth = windowWidth ?? getCurrentWindowWidth();
  const isKnownWidth = typeof resolvedWidth === 'number' && !Number.isNaN(resolvedWidth);
  const breakpoint = pickDimensionVariant(resolvedWidth, byDevice);
  const platformValues = byDevice[breakpoint];

  return {
    breakpoint,
    isKnownWidth,
    platformOS,
    runtime,
    device: platformValues.device,
    contentWidth: platformValues.contentWidth,
    textWidth: platformValues.textWidth,
    marginHorizontal: platformValues.marginHorizontal,
    gap: platformValues.gap,
    rootFontSize: platformValues.rootFontSize,
    scale: platformValues.scale,
    platformMaxDeviceWidth: platformValues.maxDeviceWidth,
    contentWidthByDevice: aggregations.contentWidthByDevice,
    textWidthByDevice: aggregations.textWidthByDevice,
    marginHorizontalByDevice: aggregations.marginHorizontalByDevice,
    gapByDevice: aggregations.gapByDevice,
    rootFontSizeByDevice: aggregations.rootFontSizeByDevice,
    scaleByDevice: aggregations.scaleByDevice,
    maxDeviceWidth: aggregations.maxDeviceWidthByDevice,
    byDevice,
  };
};
