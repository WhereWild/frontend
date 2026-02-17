import type { ResponsiveResult } from '@/constants/responsive';
import type { ViewStyle } from 'react-native';

type ResponsiveContainerSource = Pick<ResponsiveResult, 'gap' | 'marginHorizontal'>;

type ResponsiveContentContainerOptions = {
  includeWidth?: boolean;
  includeHorizontalPadding?: boolean;
  includeTopPadding?: boolean;
  includeBottomPadding?: boolean;
  includeGap?: boolean;
};

const defaultContentContainerOptions: Required<
  Pick<
    ResponsiveContentContainerOptions,
    'includeWidth' | 'includeHorizontalPadding' | 'includeTopPadding'
  >
> = {
  includeWidth: true,
  includeHorizontalPadding: true,
  includeTopPadding: true,
};

export const getResponsiveContentContainerStyle = (
  responsive: ResponsiveContainerSource,
  options: ResponsiveContentContainerOptions = {},
): ViewStyle => {
  const resolvedOptions = {
    ...defaultContentContainerOptions,
    ...options,
  };

  const style: ViewStyle = {};

  if (resolvedOptions.includeWidth) {
    style.width = '100%';
  }

  if (resolvedOptions.includeHorizontalPadding) {
    style.paddingHorizontal = responsive.marginHorizontal;
  }

  if (resolvedOptions.includeTopPadding) {
    style.paddingTop = responsive.gap;
  }

  if (resolvedOptions.includeBottomPadding) {
    style.paddingBottom = responsive.gap;
  }

  if (resolvedOptions.includeGap) {
    style.gap = responsive.gap;
  }

  return style;
};

export const getResponsiveGapStyle = (
  responsive: Pick<ResponsiveResult, 'gap'>,
): ViewStyle => ({
  gap: responsive.gap,
});
