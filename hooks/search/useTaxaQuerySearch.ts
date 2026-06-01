import { isAbortError } from '@/data/apiShared';
import {
  fetchTaxaQuery,
  type SearchTaxaQueryFilters,
  type TaxaQueryParams,
} from '@/data/apiTaxaQueryHelpers';
import type { SpeciesSummary } from '@/data/types';
import { useOptionalSettings } from '@/context/SettingsContext';
import React from 'react';
import {
  buildTaxaQueryCacheKey,
  readCachedTaxaQuery,
  writeCachedTaxaQuery,
} from './taxaQuerySearchCache';
import {
  buildEmptyStateContext,
  hasExplicitMinimumSamplesFilter,
  hasValidQueryParams,
  mapTaxaQueryResultToSummary,
} from './taxaQuerySearchHelpers';

const SEARCH_RESULT_LIMIT = 9;
const SEARCH_DEBOUNCE_MS = 300;

type UseTaxaQuerySearchOptions = {
  enabled?: boolean;
  query?: string;
  filterParams?: SearchTaxaQueryFilters;
};

export function useTaxaQuerySearch({
  enabled = true,
  query,
  filterParams,
}: UseTaxaQuerySearchOptions) {
  const settings = useOptionalSettings();
  const units = settings?.units;
  const normalizedQuery = query ?? '';
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SpeciesSummary[]>(
    [],
  );
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchContext, setSearchContext] = React.useState<string | null>(null);

  const debouncedQueryRef = React.useRef(debouncedQuery);
  const isMountedRef = React.useRef(true);
  const activeRequestControllerRef = React.useRef<AbortController | null>(null);
  const latestRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    debouncedQueryRef.current = debouncedQuery;
  }, [debouncedQuery]);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
      activeRequestControllerRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      if (debouncedQueryRef.current !== '') {
        setDebouncedQuery('');
      }
      return;
    }

    const handle = setTimeout(() => {
      const trimmedQuery = normalizedQuery.trim();
      if (trimmedQuery !== debouncedQueryRef.current) {
        setDebouncedQuery(trimmedQuery);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [enabled, normalizedQuery]);

  const withinTaxonId = filterParams?.withinTaxonId ?? null;
  const descendantRank = filterParams?.descendantRank ?? null;
  const sortVariable = filterParams?.sortVariable ?? null;
  const sortMetric = filterParams?.sortMetric ?? null;
  const sortOrder = filterParams?.sortOrder ?? null;
  const sortReference = filterParams?.sortReference ?? null;
  const minRbar = filterParams?.minRbar ?? null;
  const limit = filterParams?.limit ?? SEARCH_RESULT_LIMIT;
  const minSamples = filterParams?.minSamples ?? 0;
  const includeSpeciesLike = filterParams?.includeSpeciesLike ?? null;
  const location = filterParams?.location ?? null;
  const hasMinimumSamplesFilter = hasExplicitMinimumSamplesFilter({
    minSamples,
  });

  const abortActiveRequest = React.useCallback(() => {
    activeRequestControllerRef.current?.abort();
    activeRequestControllerRef.current = null;
  }, []);

  const clearSearchState = React.useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
    setSearchContext(null);
    setSearching(false);
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      abortActiveRequest();
      clearSearchState();
      return;
    }

    const hasQuery = debouncedQuery.length > 0;
    const canUseUnifiedQuery =
      hasValidQueryParams(
        {
          withinTaxonId,
          descendantRank,
          sortVariable,
          sortMetric,
        },
        hasQuery,
      ) || hasQuery;

    if (!canUseUnifiedQuery) {
      abortActiveRequest();
      clearSearchState();
      return;
    }

    const requestParams: TaxaQueryParams = {
      q: debouncedQuery,
      withinTaxonId,
      descendantRank,
      sortVariable,
      sortMetric,
      sortOrder,
      sortReference,
      minRbar,
      limit,
      offset: 0,
      minSamples,
      includeSpeciesLike,
      location,
      units,
    };
    const requestKey = buildTaxaQueryCacheKey(requestParams);
    const cachedPayload = readCachedTaxaQuery(requestKey);

    if (cachedPayload) {
      abortActiveRequest();
      latestRequestIdRef.current += 1;

      const mapped = cachedPayload.results
        .map((entry) =>
          mapTaxaQueryResultToSummary(
            entry,
            cachedPayload,
            hasMinimumSamplesFilter,
          ),
        )
        .filter((result): result is SpeciesSummary => Boolean(result))
        .slice(0, limit);

      setSearchError(null);
      setSearchResults(mapped);
      setSearchContext(
        mapped.length === 0
          ? buildEmptyStateContext(cachedPayload, debouncedQuery, hasMinimumSamplesFilter)
          : null,
      );
      setSearching(false);
      return;
    }

    abortActiveRequest();

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const controller = new AbortController();
    activeRequestControllerRef.current = controller;

    setSearching(true);
    setSearchError(null);
    setSearchContext(null);

    void (async () => {
      try {
        const payload = await fetchTaxaQuery(requestParams, {
          signal: controller.signal,
        });

        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }

        writeCachedTaxaQuery(requestKey, payload);

        const mapped = payload.results
          .map((entry) =>
            mapTaxaQueryResultToSummary(
              entry,
              payload,
              hasMinimumSamplesFilter,
            ),
          )
          .filter((result): result is SpeciesSummary => Boolean(result))
          .slice(0, limit);

        setSearchContext(
          mapped.length === 0
            ? buildEmptyStateContext(payload, debouncedQuery, hasMinimumSamplesFilter)
            : null,
        );
        setSearchResults(mapped);
      } catch (err) {
        if (
          !isMountedRef.current ||
          requestId !== latestRequestIdRef.current ||
          isAbortError(err)
        ) {
          return;
        }

        const message = err instanceof Error ? err.message : 'Search failed';
        setSearchError(message);
        setSearchResults([]);
        setSearchContext(
          message === 'Search failed'
            ? 'Search failed. Please try again.'
            : `Search failed: ${message}`,
        );
      } finally {
        if (isMountedRef.current && requestId === latestRequestIdRef.current) {
          activeRequestControllerRef.current = null;
          setSearching(false);
        }
      }
    })();

    return () => {
      if (latestRequestIdRef.current === requestId) {
        controller.abort();
      }
    };
  }, [
    abortActiveRequest,
    clearSearchState,
    debouncedQuery,
    descendantRank,
    enabled,
    hasMinimumSamplesFilter,
    includeSpeciesLike,
    limit,
    location,
    minRbar,
    minSamples,
    sortMetric,
    sortOrder,
    sortReference,
    sortVariable,
    units,
    withinTaxonId,
  ]);

  return {
    debouncedQuery,
    searchContext,
    searchError,
    searchResults,
    searching,
  };
}
