import { Dimensions, Platform } from 'react-native';

import { cssLengthToPx } from './tokenHelpers';
import { wdsResponsiveTokens } from './wdsTokens';

const responsiveVariants = ['desktop', 'tablet', 'mobile'] as const;
export type ResponsiveVariant = (typeof responsiveVariants)[number];

export type ResponsiveVariantValues = {
  device: string;
  contentWidth: number;
  textWidth: number;
  marginHorizontal: number;
  rootFontSize: number;
  scale: number;
  maxDeviceWidth: number;
};

export type ResponsiveByDevice = Record<ResponsiveVariant, ResponsiveVariantValues>;

export type ResponsiveResult = {
  breakpoint: ResponsiveVariant;
  device: string;
  contentWidth: number;
  textWidth: number;
  marginHorizontal: number;
  rootFontSize: number;
  scale: number;
  platformMaxDeviceWidth: number;
  contentWidthByDevice: Record<ResponsiveVariant, number>;
  textWidthByDevice: Record<ResponsiveVariant, number>;
  marginHorizontalByDevice: Record<ResponsiveVariant, number>;
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

const buildResponsiveVariant = (variant: ResponsiveVariant): ResponsiveVariantValues => {
  const tokens = wdsResponsiveTokens[variant];
  return {
    device: tokens['wds-responsive-device'],
    contentWidth: cssLengthToPx(tokens['wds-responsive-content-width']),
    textWidth: cssLengthToPx(tokens['wds-responsive-text-width']),
    marginHorizontal: cssLengthToPx(tokens['wds-responsive-margin-horizontal']),
    rootFontSize: cssLengthToPx(tokens['wds-responsive-root-font-size']),
    scale: cssLengthToPx(tokens['wds-responsive-scale']),
    maxDeviceWidth: cssLengthToPx(tokens['wds-responsive-max-device-width']),
  };
};

const pickPlatformVariant = (platform: PlatformWithPad): ResponsiveVariant => {
  const isPad = platform.OS === 'ios' && platform.isPad;

  return (
    platform.select({
      ios: isPad ? 'tablet' : 'mobile',
      android: 'mobile',
      web: 'desktop',
      default: 'tablet',
    }) ?? 'mobile'
  );
};

const getCurrentWindowWidth = (): number | undefined => {
  // On web, window.innerWidth is the most reliable value; fall back to RN Dimensions elsewhere.
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
    return window.innerWidth;
  }

  try {
    const { width } = Dimensions.get?.('window') ?? {};
    return typeof width === 'number' ? width : undefined;
  } catch {
    return undefined;
  }
};

const pickDimensionVariant = (
  width: number | undefined,
  byDevice: ResponsiveByDevice,
): ResponsiveVariant | null => {
  // Bucket the current viewport width against the max-device-width thresholds so web can downshift
  // to tablet/mobile breakpoints while native still defaults to its platform variant.
  if (typeof width !== 'number') {
    return null;
  }

  const { mobile, tablet } = byDevice;
  const mobileMax =
    typeof mobile.maxDeviceWidth === 'number' && !Number.isNaN(mobile.maxDeviceWidth)
      ? mobile.maxDeviceWidth
      : Number.POSITIVE_INFINITY;
  const tabletMax =
    typeof tablet.maxDeviceWidth === 'number' && !Number.isNaN(tablet.maxDeviceWidth)
      ? tablet.maxDeviceWidth
      : Number.POSITIVE_INFINITY;

  if (width <= mobileMax) {
    return 'mobile';
  }

  if (width <= tabletMax) {
    return 'tablet';
  }

  return 'desktop';
};

const pickNarrowerVariant = (
  platformVariant: ResponsiveVariant,
  dimensionVariant: ResponsiveVariant | null,
): ResponsiveVariant => {
  // Platform variant reflects the OS preference (e.g., iOS/Android => mobile/tablet, web => desktop).
  // Dimension variant reflects the viewport width against max-device-width thresholds.
  // We pick the narrower of the two so native stays constrained even on wide viewports,
  // while desktop can still shrink to tablet/mobile when the window is small.
  if (!dimensionVariant) {
    return platformVariant;
  }

  const priority: Record<ResponsiveVariant, number> = {
    mobile: 0,
    tablet: 1,
    desktop: 2,
  };

  return priority[dimensionVariant] < priority[platformVariant] ? dimensionVariant : platformVariant;
};

export const getResponsive = ({ platform = Platform, windowWidth }: ResponsiveOptions = {}): ResponsiveResult => {
  const byDeviceEntries = responsiveVariants.map((variant) => [variant, buildResponsiveVariant(variant)] as const);
  const byDevice = Object.fromEntries(byDeviceEntries) as ResponsiveByDevice;

  const aggregations = {
    contentWidthByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.contentWidth])) as Record<ResponsiveVariant, number>,
    textWidthByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.textWidth])) as Record<ResponsiveVariant, number>,
    marginHorizontalByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.marginHorizontal])) as Record<ResponsiveVariant, number>,
    rootFontSizeByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.rootFontSize])) as Record<ResponsiveVariant, number>,
    scaleByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.scale])) as Record<ResponsiveVariant, number>,
    maxDeviceWidthByDevice: Object.fromEntries(byDeviceEntries.map(([variant, values]) => [variant, values.maxDeviceWidth])) as Record<ResponsiveVariant, number>,
  };

  const platformVariant = pickPlatformVariant(platform);
  const dimensionVariant = pickDimensionVariant(windowWidth ?? getCurrentWindowWidth(), byDevice);
  const breakpoint = pickNarrowerVariant(platformVariant, dimensionVariant);
  const platformValues = byDevice[breakpoint];

  return {
    breakpoint,
    device: platformValues.device,
    contentWidth: platformValues.contentWidth,
    textWidth: platformValues.textWidth,
    marginHorizontal: platformValues.marginHorizontal,
    rootFontSize: platformValues.rootFontSize,
    scale: platformValues.scale,
    platformMaxDeviceWidth: platformValues.maxDeviceWidth,
    contentWidthByDevice: aggregations.contentWidthByDevice,
    textWidthByDevice: aggregations.textWidthByDevice,
    marginHorizontalByDevice: aggregations.marginHorizontalByDevice,
    rootFontSizeByDevice: aggregations.rootFontSizeByDevice,
    scaleByDevice: aggregations.scaleByDevice,
    maxDeviceWidth: aggregations.maxDeviceWidthByDevice,
    byDevice,
  };
};
