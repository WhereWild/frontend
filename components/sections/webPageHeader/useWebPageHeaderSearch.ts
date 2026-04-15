import type { SearchTaxaQueryFilters } from '@/data/apiTaxaQueryHelpers';
import React from 'react';
import { useTaxaQuerySearch } from '@/hooks/search/useTaxaQuerySearch';

const SEARCH_BLUR_GRACE_MS = 100;

type UseWebPageHeaderSearchOptions = {
  enabled?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  filterParams?: SearchTaxaQueryFilters;
};

/**
 * Manages WebPageHeader search query lifecycle:
 * initial value syncing, debounce, loading/error states, API fetch, and blur grace timing.
 */
export function useWebPageHeaderSearch({
  enabled = true,
  query,
  onQueryChange,
  filterParams,
}: UseWebPageHeaderSearchOptions) {
  const isControlled = query !== undefined;
  const [uncontrolledQuery, setUncontrolledQuery] = React.useState('');
  const [isSearchBarFocused, setIsSearchBarFocused] = React.useState(false);
  const [isSearchBlurGraceActive, setIsSearchBlurGraceActive] =
    React.useState(false);
  const searchQuery = isControlled ? query : uncontrolledQuery;

  const searchBlurGraceTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const onQueryChangeRef = React.useRef(onQueryChange);

  React.useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  }, [onQueryChange]);

  const setSearchQuery = React.useCallback(
    (nextQuery: string) => {
      if (!isControlled) {
        setUncontrolledQuery(nextQuery);
      }

      onQueryChangeRef.current?.(nextQuery);
    },
    [isControlled],
  );

  const cancelSearchBlurGrace = React.useCallback(() => {
    if (searchBlurGraceTimerRef.current) {
      clearTimeout(searchBlurGraceTimerRef.current);
      searchBlurGraceTimerRef.current = null;
    }
    setIsSearchBlurGraceActive(false);
  }, []);

  const startSearchBlurGrace = React.useCallback(() => {
    if (searchBlurGraceTimerRef.current) {
      clearTimeout(searchBlurGraceTimerRef.current);
    }
    setIsSearchBlurGraceActive(true);
    searchBlurGraceTimerRef.current = setTimeout(() => {
      setIsSearchBlurGraceActive(false);
      searchBlurGraceTimerRef.current = null;
    }, SEARCH_BLUR_GRACE_MS);
  }, []);

  React.useEffect(() => {
    return () => {
      if (searchBlurGraceTimerRef.current) {
        clearTimeout(searchBlurGraceTimerRef.current);
      }
    };
  }, []);

  const { debouncedQuery, searchError, searchResults, searching } =
    useTaxaQuerySearch({
      enabled,
      query: searchQuery,
      filterParams,
    });

  return {
    isControlled,
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    searchResults,
    searching,
    searchError,
    isSearchBarFocused,
    setIsSearchBarFocused,
    isSearchBlurGraceActive,
    cancelSearchBlurGrace,
    startSearchBlurGrace,
  };
}
