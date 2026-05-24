import type { SearchTaxaQueryFilters } from '@/data/api';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  getCurrentBrowserSearchUrl,
  scheduleBrowserSearchUrlReaffirmation,
} from './browserSearchUrlReaffirmation';
import {
  areRouteParamsEqual,
  getSearchHistoryState,
  getStoredSearchFilterVisibility,
  hasSearchHistoryFilterVisibility,
  mergeSearchHistoryState,
  parseSearchRouteParamsFromSearch,
  pickSearchRouteParams,
  setStoredSearchFilterVisibility,
  shouldPushSearchHistoryEntry,
  type SearchRouteParams,
  toCurrentSearchRouteParams,
  toInitialSearchFilterState,
  toSearchRouteParams,
  toSearchUrl,
} from './searchRouteState';

const getWebSearchRouteParams = (fallback: SearchRouteParams) => {
  if (
    typeof window === 'undefined' ||
    typeof window.location?.search !== 'string'
  ) {
    return fallback;
  }

  return parseSearchRouteParamsFromSearch(window.location.search);
};

const getSessionStorage = () => {
  if (typeof window === 'undefined' || !('sessionStorage' in window)) {
    return null;
  }

  return window.sessionStorage;
};

const getCurrentFilterVisibility = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return hasSearchHistoryFilterVisibility(window.history.state)
    ? getSearchHistoryState(window.history.state).filterVisible
    : getStoredSearchFilterVisibility(getSessionStorage());
};

export function useSearchRouteInitialState(isWeb: boolean) {
  const localSearchRouteParams = useLocalSearchParams<SearchRouteParams>();
  const searchRouteParams = isWeb
    ? getWebSearchRouteParams(localSearchRouteParams)
    : localSearchRouteParams;
  const routeSearchQuery =
    toCurrentSearchRouteParams(searchRouteParams).query ?? '';
  const initialFilterVisibleRef = useRef(
    isWeb ? getCurrentFilterVisibility() : false,
  );
  const initialSearchFiltersStateRef = useRef(
    toInitialSearchFilterState(searchRouteParams),
  );

  return {
    routeSearchQuery,
    initialFilterVisible: initialFilterVisibleRef.current,
    initialSearchFiltersState: initialSearchFiltersStateRef.current,
    searchRouteParams,
  };
}

type UseSearchRouteSyncParams = {
  isWeb: boolean;
  searchRouteParams: SearchRouteParams;
  initialFilterVisible: boolean;
  initialSearchQuery?: string;
  filterParams: SearchTaxaQueryFilters;
};

export function useSearchRouteSync({
  isWeb,
  searchRouteParams,
  initialFilterVisible,
  initialSearchQuery,
  filterParams,
}: UseSearchRouteSyncParams) {
  const pathname = usePathname();
  const isSearchPath = pathname === '/search';
  const [filterVisible, setFilterVisible] = useState(initialFilterVisible);
  const [, setPopStateVersion] = useState(0);
  const {
    descendantRank,
    includeSpeciesLike,
    limit,
    location,
    minSamples,
    minRbar,
    query,
    sortMetric,
    sortOrder,
    sortReference,
    sortVariable,
    withinTaxonId,
  } = searchRouteParams;
  const lastSyncedSearchUrlRef = useRef(
    isWeb
      ? (getCurrentBrowserSearchUrl() ?? '/search')
      : toSearchUrl(toCurrentSearchRouteParams(searchRouteParams)),
  );
  const externalRouteHydrationUrlRef = useRef<string | null>(null);

  const stableSearchRouteParams = useMemo(
    () =>
      pickSearchRouteParams({
        query,
        location,
        withinTaxonId,
        descendantRank,
        includeSpeciesLike,
        sortVariable,
        sortMetric,
        sortOrder,
        sortReference,
        minRbar,
        minSamples,
        limit,
      }),
    [
      descendantRank,
      includeSpeciesLike,
      limit,
      location,
      minRbar,
      minSamples,
      query,
      sortMetric,
      sortOrder,
      sortReference,
      sortVariable,
      withinTaxonId,
    ],
  );

  const currentRouteParams = useMemo(
    () =>
      toCurrentSearchRouteParams(
        isWeb
          ? getWebSearchRouteParams(stableSearchRouteParams)
          : stableSearchRouteParams,
      ),
    [isWeb, stableSearchRouteParams],
  );
  const [searchQuery, setSearchQuery] = useState(
    initialSearchQuery ?? currentRouteParams.query ?? '',
  );
  const currentRouteUrl = useMemo(
    () => toSearchUrl(currentRouteParams),
    [currentRouteParams],
  );

  const nextRouteParams = useMemo(
    () => toSearchRouteParams(searchQuery, filterParams),
    [filterParams, searchQuery],
  );
  const nextSearchUrl = useMemo(
    () => toSearchUrl(nextRouteParams),
    [nextRouteParams],
  );
  const routeParamsMatchLocalState = areRouteParamsEqual(
    currentRouteParams,
    nextRouteParams,
  );
  const routeChangedExternally =
    currentRouteUrl !== lastSyncedSearchUrlRef.current &&
    !routeParamsMatchLocalState;
  const routeStateHydrationPending =
    routeChangedExternally ||
    (externalRouteHydrationUrlRef.current === currentRouteUrl &&
      !routeParamsMatchLocalState);

  useEffect(() => {
    if (!isWeb || !isSearchPath) {
      externalRouteHydrationUrlRef.current = null;
      return;
    }

    if (routeChangedExternally) {
      externalRouteHydrationUrlRef.current = currentRouteUrl;
      return;
    }

    if (
      externalRouteHydrationUrlRef.current === currentRouteUrl &&
      routeParamsMatchLocalState
    ) {
      externalRouteHydrationUrlRef.current = null;
    }
  }, [
    currentRouteUrl,
    isSearchPath,
    isWeb,
    routeParamsMatchLocalState,
    routeChangedExternally,
  ]);

  useLayoutEffect(() => {
    if (!isWeb || !isSearchPath || !routeChangedExternally) {
      return;
    }

    const nextQuery = currentRouteParams.query ?? '';
    if (searchQuery !== nextQuery) {
      setSearchQuery(nextQuery);
    }
  }, [
    currentRouteParams,
    isSearchPath,
    isWeb,
    routeChangedExternally,
    searchQuery,
  ]);

  useEffect(() => {
    if (!isWeb || !isSearchPath) {
      return;
    }

    if (routeChangedExternally || routeStateHydrationPending) {
      lastSyncedSearchUrlRef.current = currentRouteUrl;
      return;
    }

    if (routeParamsMatchLocalState) {
      lastSyncedSearchUrlRef.current = nextSearchUrl;
      return;
    }

    if (typeof window === 'undefined' || !window.history?.replaceState) {
      return;
    }

    if (lastSyncedSearchUrlRef.current === nextSearchUrl) {
      return;
    }

    const nextHistoryState = mergeSearchHistoryState(window.history.state, {
      filterVisible,
    });
    const shouldPushEntry = shouldPushSearchHistoryEntry(
      currentRouteParams,
      nextRouteParams,
    );
    const currentBrowserSearchUrl = getCurrentBrowserSearchUrl();
    if (currentBrowserSearchUrl === nextSearchUrl) {
      lastSyncedSearchUrlRef.current = nextSearchUrl;
      return;
    }

    if (shouldPushEntry && typeof window.history.pushState === 'function') {
      window.history.pushState(nextHistoryState, '', nextSearchUrl);
    } else {
      window.history.replaceState(nextHistoryState, '', nextSearchUrl);
    }

    const cancelBrowserSearchUrlReaffirmation =
      scheduleBrowserSearchUrlReaffirmation(
        nextSearchUrl,
        currentRouteUrl,
        filterVisible,
      );

    lastSyncedSearchUrlRef.current = nextSearchUrl;

    return cancelBrowserSearchUrlReaffirmation;
  }, [
    currentRouteParams,
    currentRouteUrl,
    filterVisible,
    isSearchPath,
    isWeb,
    nextRouteParams,
    nextSearchUrl,
    routeParamsMatchLocalState,
    routeChangedExternally,
    routeStateHydrationPending,
  ]);

  useEffect(() => {
    if (!isWeb || !isSearchPath || typeof window === 'undefined') {
      return;
    }

    setStoredSearchFilterVisibility(getSessionStorage(), filterVisible);
  }, [filterVisible, isSearchPath, isWeb]);

  useEffect(() => {
    if (
      !isWeb ||
      !isSearchPath ||
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function' ||
      typeof window.removeEventListener !== 'function'
    ) {
      return;
    }

    const handlePopState = () => {
      setFilterVisible(getCurrentFilterVisibility());
      setPopStateVersion((version) => version + 1);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSearchPath, isWeb]);

  useEffect(() => {
    if (
      !isWeb ||
      !isSearchPath ||
      typeof window === 'undefined' ||
      !window.history?.replaceState
    ) {
      return;
    }

    const currentBrowserSearchUrl =
      getCurrentBrowserSearchUrl() ?? currentRouteUrl;
    const currentHistoryState = getSearchHistoryState(window.history.state);
    if (currentHistoryState.filterVisible === filterVisible) {
      return;
    }

    window.history.replaceState(
      mergeSearchHistoryState(window.history.state, { filterVisible }),
      '',
      currentBrowserSearchUrl,
    );
  }, [currentRouteUrl, filterVisible, isSearchPath, isWeb]);

  return {
    searchQuery,
    setSearchQuery,
    filterVisible,
    setFilterVisible,
    routeChangedExternally,
    routeStateHydrationPending,
  };
}
