// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SearchTaxaQueryFilters } from '@/data/api';
import type { UseSearchFiltersInitialState } from '@/hooks/search/filters/useSearchFilters';
import { DEFAULT_QUANTITY } from '@/hooks/search/filters/useSearchFilters.helpers';

export type SearchRouteParams = {
  query?: string | string[];
  location?: string | string[];
  withinTaxonId?: string | string[];
  descendantRank?: string | string[];
  includeSpeciesLike?: string | string[];
  sortVariable?: string | string[];
  sortMetric?: string | string[];
  sortOrder?: string | string[];
  sortReference?: string | string[];
  listOffset?: string | string[];
  minRbar?: string | string[];
  minSamples?: string | string[];
  limit?: string | string[];
};

type SearchHistoryState = {
  filterVisible: boolean;
};

const SEARCH_FILTER_VISIBILITY_STORAGE_KEY = 'wherewild.search.filterVisible';

const SEARCH_ROUTE_PARAM_KEYS = [
  'query',
  'location',
  'withinTaxonId',
  'descendantRank',
  'includeSpeciesLike',
  'sortVariable',
  'sortMetric',
  'sortOrder',
  'sortReference',
  'listOffset',
  'minRbar',
  'minSamples',
  'limit',
] as const;

export const toSingleRouteParamValue = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const parseSearchRouteParamsFromSearch = (search: string) => {
  const params = new URLSearchParams(search);
  const parsed: SearchRouteParams = {};

  SEARCH_ROUTE_PARAM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (typeof value === 'string' && value.length > 0) {
      parsed[key] = value;
    }
  });

  return parsed;
};

export const pickSearchRouteParams = (
  params: SearchRouteParams,
): SearchRouteParams => ({
  query: params.query,
  location: params.location,
  withinTaxonId: params.withinTaxonId,
  descendantRank: params.descendantRank,
  includeSpeciesLike: params.includeSpeciesLike,
  sortVariable: params.sortVariable,
  sortMetric: params.sortMetric,
  sortOrder: params.sortOrder,
  sortReference: params.sortReference,
  listOffset: params.listOffset,
  minRbar: params.minRbar,
  minSamples: params.minSamples,
  limit: params.limit,
});

export const toCurrentSearchRouteParams = (params: SearchRouteParams) => {
  const normalizedParams: Record<string, string> = {};

  SEARCH_ROUTE_PARAM_KEYS.forEach((key) => {
    const value = toSingleRouteParamValue(params[key]);
    if (typeof value === 'string' && value.length > 0) {
      normalizedParams[key] = value;
    }
  });

  return normalizedParams;
};

export const toSearchRouteParams = (
  query: string,
  filterParams: SearchTaxaQueryFilters,
) => {
  const trimmedQuery = query.trim();
  const routeParams: Record<string, string> = {};
  const hasScopedRankingContext =
    filterParams.withinTaxonId != null &&
    typeof filterParams.descendantRank === 'string' &&
    filterParams.descendantRank.length > 0;

  if (trimmedQuery.length > 0) {
    routeParams.query = trimmedQuery;
  }

  if (filterParams.location) {
    routeParams.location = filterParams.location;
  }

  if (filterParams.withinTaxonId != null) {
    routeParams.withinTaxonId = String(filterParams.withinTaxonId);
  }

  if (
    hasScopedRankingContext &&
    typeof filterParams.descendantRank === 'string' &&
    filterParams.descendantRank.length > 0
  ) {
    routeParams.descendantRank = filterParams.descendantRank;
  }

  if (
    hasScopedRankingContext &&
    filterParams.descendantRank === 'species' &&
    filterParams.includeSpeciesLike === false
  ) {
    routeParams.includeSpeciesLike = 'false';
  }

  if (hasScopedRankingContext && filterParams.sortVariable) {
    routeParams.sortVariable = filterParams.sortVariable;
  }

  if (
    hasScopedRankingContext &&
    filterParams.sortVariable &&
    filterParams.sortMetric
  ) {
    routeParams.sortMetric = filterParams.sortMetric;
  }

  if (hasScopedRankingContext && filterParams.sortOrder === 'desc') {
    routeParams.sortOrder = 'desc';
  }

  if (
    hasScopedRankingContext &&
    filterParams.sortMetric &&
    typeof filterParams.sortReference === 'number' &&
    filterParams.sortReference !== 0
  ) {
    routeParams.sortReference = String(filterParams.sortReference);
  }

  if (
    hasScopedRankingContext &&
    filterParams.sortMetric &&
    typeof filterParams.listOffset === 'number' &&
    filterParams.listOffset > 0
  ) {
    routeParams.listOffset = String(filterParams.listOffset);
  }

  if (
    hasScopedRankingContext &&
    filterParams.sortMetric &&
    typeof filterParams.minRbar === 'number' &&
    filterParams.minRbar > 0
  ) {
    routeParams.minRbar = filterParams.minRbar.toFixed(2);
  }

  if (typeof filterParams.minSamples === 'number' && filterParams.minSamples !== DEFAULT_QUANTITY.minimumSamples) {
    routeParams.minSamples = String(filterParams.minSamples);
  }

  if (
    typeof filterParams.limit === 'number' &&
    filterParams.limit !== DEFAULT_QUANTITY.numberOfResults
  ) {
    routeParams.limit = String(filterParams.limit);
  }

  return routeParams;
};

export const areRouteParamsEqual = (
  left: Record<string, string>,
  right: Record<string, string>,
) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
};

const toRouteParamsWithoutQuery = (params: Record<string, string>) => {
  const { query: _query, ...rest } = params;
  return rest;
};

export const shouldPushSearchHistoryEntry = (
  currentParams: Record<string, string>,
  nextParams: Record<string, string>,
) => {
  const currentQuery = currentParams.query?.trim() ?? '';
  const nextQuery = nextParams.query?.trim() ?? '';

  if (currentQuery.length > 0 !== nextQuery.length > 0) {
    return true;
  }

  return !areRouteParamsEqual(
    toRouteParamsWithoutQuery(currentParams),
    toRouteParamsWithoutQuery(nextParams),
  );
};

export const toSearchUrl = (params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  return query.length > 0 ? `/search?${query}` : '/search';
};

const toObjectRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

export const getSearchHistoryState = (
  historyState: unknown,
): SearchHistoryState => {
  const root = toObjectRecord(historyState);
  const searchState = toObjectRecord(root.search);

  return {
    filterVisible: searchState.filterVisible === true,
  };
};

export const hasSearchHistoryFilterVisibility = (historyState: unknown) => {
  const root = toObjectRecord(historyState);
  const searchState = toObjectRecord(root.search);

  return typeof searchState.filterVisible === 'boolean';
};

export const mergeSearchHistoryState = (
  historyState: unknown,
  updates: Partial<SearchHistoryState>,
) => {
  const root = toObjectRecord(historyState);
  const searchState = toObjectRecord(root.search);

  return {
    ...root,
    search: {
      ...searchState,
      ...updates,
    },
  };
};

export const getStoredSearchFilterVisibility = (storage?: Storage | null) => {
  if (!storage) {
    return false;
  }

  return storage.getItem(SEARCH_FILTER_VISIBILITY_STORAGE_KEY) === 'true';
};

export const setStoredSearchFilterVisibility = (
  storage: Storage | null | undefined,
  filterVisible: boolean,
) => {
  if (!storage) {
    return;
  }

  storage.setItem(
    SEARCH_FILTER_VISIBILITY_STORAGE_KEY,
    filterVisible ? 'true' : 'false',
  );
};

const toNumberParam = (value?: string) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toLocationHierarchyState = (location: string) => {
  const [countryValue] = location.split('.');

  if (location.startsWith('county-')) {
    return { countyValue: location };
  }

  if (location.startsWith('state-')) {
    return { stateValue: location };
  }

  const depth = location.split('.').length;

  if (depth >= 3) {
    const parentStateValue = `${location.slice(0, location.lastIndexOf('.'))}_1`;

    return {
      countryValue,
      stateValue: parentStateValue,
      countyValue: location,
    };
  }

  if (depth === 2) {
    return {
      countryValue,
      stateValue: location,
    };
  }

  return { countryValue: location };
};

const toLocationInitialState = (location?: string) => {
  if (typeof location !== 'string' || location.length === 0) {
    return undefined;
  }

  return toLocationHierarchyState(location);
};

export const toInitialSearchFilterState = (
  params: SearchRouteParams,
): UseSearchFiltersInitialState => {
  const location = toLocationInitialState(
    toSingleRouteParamValue(params.location),
  );
  const withinTaxonId = toNumberParam(
    toSingleRouteParamValue(params.withinTaxonId),
  );
  const rawDescendantRank = toSingleRouteParamValue(params.descendantRank);
  const includeSpeciesLike = toSingleRouteParamValue(params.includeSpeciesLike);
  const descendantRank =
    typeof rawDescendantRank === 'string' && rawDescendantRank.length > 0
      ? rawDescendantRank
      : includeSpeciesLike === 'false'
        ? 'species'
        : '';
  const sortVariable = toSingleRouteParamValue(params.sortVariable);
  const sortMetric = toSingleRouteParamValue(params.sortMetric);
  const sortOrder = toSingleRouteParamValue(params.sortOrder);
  const sortReferenceRaw = toNumberParam(toSingleRouteParamValue(params.sortReference));
  const listOffsetRaw = toNumberParam(toSingleRouteParamValue(params.listOffset));
  const minRbarRaw = toNumberParam(toSingleRouteParamValue(params.minRbar));
  const minSamples = toNumberParam(toSingleRouteParamValue(params.minSamples));
  const limit = toNumberParam(toSingleRouteParamValue(params.limit));

  return {
    location,
    taxon: {
      ancestorTaxonId: withinTaxonId ?? null,
      baseTaxonQuery: withinTaxonId != null ? String(withinTaxonId) : '',
    },
    ranking: {
      rankValue: descendantRank,
      includeSubspecies:
        descendantRank === 'species' ? includeSpeciesLike !== 'false' : true,
      sortVariableValue: sortVariable ?? '',
      sortMetricValue: sortMetric ?? '',
      sortOrder: sortOrder === 'desc' ? 'descending' : 'ascending',
      sortReference: sortReferenceRaw,
      listOffset: listOffsetRaw,
      minRbar: minRbarRaw,
    },
    quantity: {
      minimumSamples: minSamples,
      numberOfResults: limit,
    },
  };
};
