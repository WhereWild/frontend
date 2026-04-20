import { useNativeTopAppBarConfig } from '@/context/NativeTopAppBarContext';
import { useWebPageHeaderConfig } from '@/context/WebPageHeaderContext';
import { useEffect, useLayoutEffect } from 'react';

type UseSearchPageChromeParams = {
  allowWebSearchControl: boolean;
  filterVisible: boolean;
  hasActiveFilters: boolean;
  isNative: boolean;
  isWeb: boolean;
  nativeSearchQuery: string;
  onFilterPress: () => void;
  onResetFilters: () => void;
  searchQuery: string;
  setNativeSearchQuery: (query: string) => void;
  setSearchQuery: (query: string) => void;
};

export function useSearchPageChrome({
  allowWebSearchControl,
  filterVisible,
  hasActiveFilters,
  isNative,
  isWeb,
  nativeSearchQuery,
  onFilterPress,
  onResetFilters,
  searchQuery,
  setNativeSearchQuery,
  setSearchQuery,
}: UseSearchPageChromeParams) {
  const { setConfig, resetConfig } = useWebPageHeaderConfig();
  const {
    setConfig: setNativeTopAppBarConfig,
    resetConfig: resetNativeTopAppBarConfig,
  } = useNativeTopAppBarConfig();

  useLayoutEffect(() => {
    setConfig({
      showSearchResultsDropdown: false,
      showFilterButton: true,
      onFilterPress,
      filterLabel: filterVisible ? 'Hide filter' : 'Filter',
      showResetFilterButton: hasActiveFilters,
      onResetFilterPress: onResetFilters,
      searchQuery: isWeb && allowWebSearchControl ? searchQuery : undefined,
      onSearchQueryChange:
        isWeb && allowWebSearchControl ? setSearchQuery : undefined,
    });

    return () => {
      resetConfig();
    };
  }, [
    allowWebSearchControl,
    filterVisible,
    hasActiveFilters,
    isWeb,
    onFilterPress,
    onResetFilters,
    resetConfig,
    searchQuery,
    setConfig,
    setSearchQuery,
  ]);

  useEffect(() => {
    if (!isNative) {
      return;
    }

    setNativeTopAppBarConfig({
      searchValue: nativeSearchQuery,
      onSearchValueChange: setNativeSearchQuery,
      onSubmitSearch: setNativeSearchQuery,
      primaryAction: {
        onPress: onFilterPress,
        buttonLabel: filterVisible ? 'Hide filter' : 'Filter',
        buttonAccessibilityLabel: filterVisible ? 'Hide filter' : 'Filter',
        iconAccessibilityLabel: filterVisible
          ? 'Hide filter panel'
          : 'Show filter panel',
      },
      secondaryAction: {
        isVisible: hasActiveFilters,
        onPress: onResetFilters,
        accessibilityLabel: 'Reset filters',
      },
    });

    return () => {
      resetNativeTopAppBarConfig();
    };
  }, [
    filterVisible,
    hasActiveFilters,
    isNative,
    nativeSearchQuery,
    onFilterPress,
    onResetFilters,
    resetNativeTopAppBarConfig,
    setNativeSearchQuery,
    setNativeTopAppBarConfig,
  ]);
}
