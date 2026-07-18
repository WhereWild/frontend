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
import {
  createEmptyFilterPredicate,
  type FilterOperator,
  type FilterPredicate,
  type SearchFiltersState,
} from './useSearchFilters.state';

const FILTER_OPERATORS: ReadonlySet<string> = new Set([
  'gte',
  'gt',
  'lte',
  'lt',
  'eq',
  'ne',
]);

/**
 * Serializes one predicate row into the backend's "variable:metric:op:value[:count]"
 * filter-string grammar. Returns null for incomplete rows (still being edited) —
 * those are silently dropped rather than sent as a malformed filter.
 *
 * Category mode value: the UI collects a 0-100 percentage unless `asCount` is
 * set, in which case the value is a raw observation-count threshold and the
 * backend reconstructs the actual count from (fraction * total_samples) itself
 * — see util/rankings.py::_filter_tall. Percentage is converted to the 0-1
 * fraction the backend expects.
 */
export const serializeFilterPredicate = (
  predicate: FilterPredicate,
): string | null => {
  if (!predicate.variable || predicate.value == null || Number.isNaN(predicate.value)) {
    return null;
  }

  if (predicate.mode === 'category') {
    if (!predicate.categoryId) {
      return null;
    }
    const metric = `class_${predicate.categoryId}`;
    const value = predicate.asCount ? predicate.value : predicate.value / 100;
    const suffix = predicate.asCount ? ':count' : '';
    return `${predicate.variable}:${metric}:${predicate.op}:${value}${suffix}`;
  }

  if (!predicate.metric) {
    return null;
  }
  return `${predicate.variable}:${predicate.metric}:${predicate.op}:${predicate.value}`;
};

export const toSearchFilterStrings = (
  predicates: FilterPredicate[],
): string[] =>
  predicates
    .map(serializeFilterPredicate)
    .filter((value): value is string => value != null);

/**
 * Inverse of serializeFilterPredicate — reconstructs a predicate row from one
 * "variable:metric:op:value[:count]" filter string (e.g. when hydrating from
 * a shared/bookmarked URL). Returns null for anything that doesn't parse.
 */
export const parseFilterPredicateString = (
  raw: string,
): FilterPredicate | null => {
  const parts = raw.split(':');
  if (parts.length < 4 || parts.length > 5) {
    return null;
  }
  const [variable, metric, op, valueStr, modifier] = parts;
  if (!variable || !metric || !FILTER_OPERATORS.has(op)) {
    return null;
  }
  const rawValue = Number(valueStr);
  if (!Number.isFinite(rawValue)) {
    return null;
  }
  const asCount = modifier === 'count';
  if (modifier && !asCount) {
    return null;
  }

  const base = createEmptyFilterPredicate();
  if (metric.startsWith('class_')) {
    return {
      ...base,
      variable,
      mode: 'category',
      categoryId: metric.slice('class_'.length),
      asCount,
      op: op as FilterOperator,
      value: asCount ? rawValue : rawValue * 100,
    };
  }

  return {
    ...base,
    variable,
    mode: 'stat',
    metric,
    op: op as FilterOperator,
    value: rawValue,
  };
};

/** Splits the comma-joined `filters` route param and parses each entry. */
export const toFilterPredicatesFromRouteValue = (
  raw?: string,
): FilterPredicate[] => {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map(parseFilterPredicateString)
    .filter((predicate): predicate is FilterPredicate => predicate != null);
};

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
    // Every query mode (catalog browse, ranked-scoped, text, ranked-text)
    // accepts limit/offset generically on the backend, so pagination isn't
    // gated behind having a sort selected.
    listOffset: state.listOffset > 0 ? state.listOffset : null,
    minRbar: isAngularMetric && state.minRbar > 0 ? state.minRbar : null,
    minSamples:
      state.debouncedQuantity.minimumSamples > 0
        ? state.debouncedQuantity.minimumSamples
        : null,
    limit: state.debouncedQuantity.numberOfResults,
    filters: toSearchFilterStrings(state.predicates),
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
    state.minimumSamples !== DEFAULT_QUANTITY.minimumSamples ||
    state.predicates.length > 0,
  );
};
