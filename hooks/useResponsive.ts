import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Responsive } from '@/constants/theme';

export type ResponsiveInfo = ReturnType<typeof useResponsive>;

const computeFlags = (width: number) => {
  const mobileMax = Responsive.deviceWidth.mobile;
  const tabletMax = Responsive.deviceWidth.tablet;
  const isMobile = width <= mobileMax;
  const isTablet = width > mobileMax && width <= tabletMax;
  const isDesktop = width > tabletMax;

  return {
    isMobile,
    isTablet,
    isDesktop,
    // Compact mirrors the previous "mobile" breakpoint (tablet and below)
    isCompact: isMobile || isTablet,
  } as const;
};

export function useResponsive() {
  const windowDimensions = useWindowDimensions();

  const flags = useMemo(() => computeFlags(windowDimensions.width), [windowDimensions.width]);

  return {
    ...windowDimensions,
    ...flags,
  };
}

export function useIsCompact() {
  return useResponsive().isCompact;
}

export const __RESPONSIVE_TESTING__ = {
  computeFlags,
};
