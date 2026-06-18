// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SearchTaxaQueryFilters } from '@/data/api';
import type { SelectOption } from '@/components';
import {
  DEFAULT_QUANTITY,
  deriveLocationGid,
  toRankingFilterHint,
} from './useSearchFilters.helpers';
import type { SearchFiltersState } from './useSearchFilters.state';

const METRIC_SORT_ORDER: Record<string, number> = {
  median: 0,
  mean: 1,
  min: 2,
  max: 3,
  std: 4,
  stddev: 4,
  circular_mean: 5,
  mode: 6,
};

export const toSortMetricOptions = (
  rankingSortOptions: SearchFiltersState['rankingSortOptions'],
  sortVariableValue: string,
): SelectOption[] => {
  if (!rankingSortOptions.length || !sortVariableValue) {
    return [];
  }

  const seen = new Set<string>();
  const metricOptions = rankingSortOptions
    .filter(
      (entry) =>
        entry.variable === sortVariableValue && entry.metric.length > 0,
    )
    .filter((entry) => {
      if (seen.has(entry.metric)) return false;
      seen.add(entry.metric);
      return true;
    })
    .map((entry) => ({ label: entry.label, value: entry.metric }));

  metricOptions.sort(
    (a, b) =>
      (METRIC_SORT_ORDER[a.value] ?? 99) - (METRIC_SORT_ORDER[b.value] ?? 99),
  );

  return metricOptions;
};

const ANGULAR_METRICS = new Set(['circular_mean', 'mode']);

export const toSearchFilterParams = (
  state: SearchFiltersState,
): SearchTaxaQueryFilters => {
  const location = deriveLocationGid(
    state.countryValue,
    state.stateValue,
    state.countyValue,
  );
  const hasScopedRankingContext =
    state.ancestorTaxonId != null && state.rankValue.length > 0;
  const hasCompleteSortSelection =
    state.sortVariableValue.length > 0 && state.sortMetricValue.length > 0;
  const includeSpeciesLike =
    hasScopedRankingContext && state.rankValue === 'species'
      ? state.includeSubspecies
      : null;
  const isCircularVariable =
    state.sortVariableDefinitions.find(
      (v) => v.id === state.sortVariableValue,
    )?.valueType === 'circular';
  const isAngularMetric =
    hasScopedRankingContext &&
    hasCompleteSortSelection &&
    isCircularVariable &&
    ANGULAR_METRICS.has(state.sortMetricValue);

  return {
    location,
    withinTaxonId: state.ancestorTaxonId ?? null,
    descendantRank: hasScopedRankingContext ? state.rankValue : null,
    includeSpeciesLike,
    sortVariable:
      hasScopedRankingContext && hasCompleteSortSelection
        ? state.sortVariableValue
        : null,
    sortMetric:
      hasScopedRankingContext && hasCompleteSortSelection
        ? state.sortMetricValue
        : null,
    sortOrder:
      hasScopedRankingContext && hasCompleteSortSelection
        ? state.sortOrder === 'ascending'
          ? 'asc'
          : 'desc'
        : null,
    sortReference: isAngularMetric ? state.sortReference : null,
    listOffset: !isAngularMetric && hasScopedRankingContext && hasCompleteSortSelection && state.listOffset > 0 ? state.listOffset : null,
    minRbar: isAngularMetric && state.minRbar > 0 ? state.minRbar : null,
    minSamples:
      state.debouncedQuantity.minimumSamples > 0
        ? state.debouncedQuantity.minimumSamples
        : null,
    limit: state.debouncedQuantity.numberOfResults,
  };
};

export const toSearchRankingFilterHint = (state: SearchFiltersState) => {
  if (
    state.ancestorTaxonId != null &&
    state.rankValue.length > 0 &&
    !state.sortVariableLoading &&
    state.sortVariableOptions.length === 0
  ) {
    return 'No ranking variables are available for the selected Scope taxon and Rank.';
  }

  return toRankingFilterHint(
    state.ancestorTaxonId,
    state.rankValue,
    state.sortVariableValue,
    state.sortMetricValue,
  );
};

export const getHasActiveSearchFilters = (state: SearchFiltersState) => {
  const hasBaseTaxonSelection = state.ancestorTaxonId != null;
  const hasScopedRankingContext =
    hasBaseTaxonSelection && state.rankValue.length > 0;
  const hasCompleteSortSelection =
    hasScopedRankingContext &&
    state.sortVariableValue.length > 0 &&
    state.sortMetricValue.length > 0;

  return Boolean(
    state.countryValue ||
    state.stateValue ||
    state.countyValue ||
    hasBaseTaxonSelection ||
    hasScopedRankingContext ||
    hasCompleteSortSelection ||
    (hasCompleteSortSelection && state.sortOrder !== 'ascending') ||
    state.numberOfResults !== DEFAULT_QUANTITY.numberOfResults ||
    state.minimumSamples !== DEFAULT_QUANTITY.minimumSamples,
  );
};
