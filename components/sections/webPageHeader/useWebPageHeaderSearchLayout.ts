import { Size } from '@/constants/theme';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

type SearchVariant = 'mobile' | 'desktop';

type UseWebPageHeaderSearchLayoutOptions = {
  marginHorizontal: number;
  hasQuery: boolean;
  showSearchResultsDropdown: boolean;
  isSearchBarFocused: boolean;
  isSearchBlurGraceActive: boolean;
  isSearchPreviewDismissed?: boolean;
};

/**
 * Computes visibility and absolute positioning for the search preview overlay
 * in both desktop and compact header variants.
 */
export function useWebPageHeaderSearchLayout({
  marginHorizontal,
  hasQuery,
  showSearchResultsDropdown,
  isSearchBarFocused,
  isSearchBlurGraceActive,
  isSearchPreviewDismissed = false,
}: UseWebPageHeaderSearchLayoutOptions) {
  const [wrapperHeight, setWrapperHeight] = React.useState<number | null>(null);
  const [mobileHeaderLayout, setMobileHeaderLayout] = React.useState<{
    y: number;
    height: number;
  } | null>(null);

  const searchResultsVisible = Boolean(
    wrapperHeight &&
    hasQuery &&
    showSearchResultsDropdown &&
    !isSearchPreviewDismissed &&
    (isSearchBarFocused || isSearchBlurGraceActive)
  );

  const searchResultsTop = wrapperHeight ? wrapperHeight + Size.space['200'] : undefined;
  const mobileSearchResultsTop = mobileHeaderLayout
    ? mobileHeaderLayout.y + mobileHeaderLayout.height + Size.space['200']
    : undefined;

  const getSearchResultsStyle = React.useCallback((variant: SearchVariant): StyleProp<ViewStyle> => {
    const mobileSearchResultsStyle: StyleProp<ViewStyle> = [
      {
        left: marginHorizontal,
        right: marginHorizontal,
      },
      mobileSearchResultsTop ? { top: mobileSearchResultsTop } : null,
    ];

    const desktopSearchResultsStyle: StyleProp<ViewStyle> =
      searchResultsTop ? { top: searchResultsTop } : undefined;

    return variant === 'mobile' ? mobileSearchResultsStyle : desktopSearchResultsStyle;
  }, [mobileSearchResultsTop, marginHorizontal, searchResultsTop]);

  return {
    searchResultsVisible,
    getSearchResultsStyle,
    setWrapperHeight,
    setMobileHeaderLayout,
  };
}
