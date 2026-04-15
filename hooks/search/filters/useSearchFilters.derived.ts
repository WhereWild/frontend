import type { SearchTaxaQueryFilters } from '@/data/api';
import type { SelectOption } from '@/components';
import {
  DEFAULT_QUANTITY,
  deriveLocationGid,
  toMetricLabel,
  toRankingFilterHint,
} from './useSearchFilters.helpers';
import type { SearchFiltersState } from './useSearchFilters.state';

export const toSortMetricOptions = (
  rankingSortOptions: SearchFiltersState['rankingSortOptions'],
  sortVariableValue: string,
  defaultOptions: SelectOption[],
): SelectOption[] => {
  if (!rankingSortOptions.length || !sortVariableValue) {
    return defaultOptions;
  }

  const metrics = Array.from(
    new Set(
      rankingSortOptions
        .filter((entry) => entry.variable === sortVariableValue)
        .map((entry) => entry.metric)
        .filter((value) => value.length > 0),
    ),
  );

  if (!metrics.length) {
    return defaultOptions;
  }

  return metrics.map((value) => ({
    label: toMetricLabel(value),
    value,
  }));
};

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
