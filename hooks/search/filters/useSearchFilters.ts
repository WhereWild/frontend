// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fetchSpeciesByTaxonId } from '@/data/api';
import { RANK_OPTIONS } from './useSearchFilters.helpers';
import {
  getHasActiveSearchFilters,
  toSearchFilterParams,
  toSearchRankingFilterHint,
} from './useSearchFilters.derived';
import { useSearchFiltersActions } from './useSearchFilters.actions';
import { useSearchFiltersEffects } from './useSearchFilters.effects';
import {
  createInitialSearchFiltersState,
  searchFiltersReducer,
  type UseSearchFiltersInitialState,
} from './useSearchFilters.state';
import { getCachedHierarchyOptionsForValue } from './searchFilterLocationHelpers';
import type {
  SearchFiltersPanelProps,
  UseSearchFiltersResult,
} from './useSearchFilters.types';

const baseTaxonLabelCache = new Map<number, string>();

const areOptionsEqual = (
  left: { label: string; value: string }[] = [],
  right: { label: string; value: string }[] = [],
) => {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (option, index) =>
      option.label === right[index]?.label &&
      option.value === right[index]?.value,
  );
};

const withCachedLocationOptions = (
  initialState?: UseSearchFiltersInitialState,
): UseSearchFiltersInitialState | undefined => {
  const location = initialState?.location;
  if (!location) {
    return initialState;
  }

  const nextCountryOptions =
    location.countryOptions && location.countryOptions.length > 0
      ? location.countryOptions
      : location.countryValue
        ? getCachedHierarchyOptionsForValue('country', location.countryValue)
        : [];
  const nextStateOptions =
    location.stateOptions && location.stateOptions.length > 0
      ? location.stateOptions
      : location.countryValue && location.stateValue
        ? getCachedHierarchyOptionsForValue(
            'state',
            location.stateValue,
            location.countryValue,
          )
        : [];
  const nextCountyOptions =
    location.countyOptions && location.countyOptions.length > 0
      ? location.countyOptions
      : location.stateValue && location.countyValue
        ? getCachedHierarchyOptionsForValue(
            'county',
            location.countyValue,
            location.stateValue,
          )
        : [];

  if (
    areOptionsEqual(location.countryOptions, nextCountryOptions) &&
    areOptionsEqual(location.stateOptions, nextStateOptions) &&
    areOptionsEqual(location.countyOptions, nextCountyOptions)
  ) {
    return initialState;
  }

  return {
    ...initialState,
    location: {
      ...location,
      countryOptions: nextCountryOptions,
      stateOptions: nextStateOptions,
      countyOptions: nextCountyOptions,
    },
  };
};

const withCachedBaseTaxonLabel = (
  initialState?: UseSearchFiltersInitialState,
): UseSearchFiltersInitialState | undefined => {
  const ancestorTaxonId = initialState?.taxon?.ancestorTaxonId;
  if (ancestorTaxonId == null) {
    return initialState;
  }

  const cachedLabel = baseTaxonLabelCache.get(ancestorTaxonId);
  if (!cachedLabel) {
    return initialState;
  }

  const currentQuery = initialState?.taxon?.baseTaxonQuery?.trim() ?? '';
  const rawTaxonId = String(ancestorTaxonId);
  if (currentQuery.length > 0 && currentQuery !== rawTaxonId) {
    return initialState;
  }

  return {
    ...initialState,
    taxon: {
      ...initialState?.taxon,
      ancestorTaxonId,
      baseTaxonQuery: cachedLabel,
    },
  };
};

export const resetSearchFilterTaxonLabelCache = () => {
  baseTaxonLabelCache.clear();
};

export type {
  SearchFilterLocationInitialState,
  SearchFilterQuantityInitialState,
  SearchFilterRankingInitialState,
  SearchFilterTaxonInitialState,
  UseSearchFiltersInitialState,
} from './useSearchFilters.state';

/**
 * Manages all state for the Filters panel on the search page, including dynamic
 * loading of location options and environment variable options.
 * Returns the full set of props for the Filters component and a computed
 * `filterParams` object for the unified taxa query API.
 */
export function useSearchFilters(
  initialState?: UseSearchFiltersInitialState,
): UseSearchFiltersResult {
  const resolvedInitialState = withCachedBaseTaxonLabel(
    withCachedLocationOptions(initialState),
  );
  const [state, dispatch] = React.useReducer(
    searchFiltersReducer,
    resolvedInitialState,
    createInitialSearchFiltersState,
  );
  const baseTaxonDismissTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const baseTaxonSubmitRequestIdRef = React.useRef(0);
  const [sortVariableCategoryValue, setSortVariableCategoryValue] =
    React.useState<string | null>(null);

  const {
    countryValue,
    countryOptions,
    countryLoading,
    stateValue,
    stateOptions,
    stateLoading,
    countyValue,
    countyOptions,
    countyLoading,
    ancestorTaxonId,
    baseTaxonQuery,
    baseTaxonFocused,
    baseTaxonSuggestions,
    baseTaxonSuggestionsLoading,
    baseTaxonSuggestionsVisible,
    rankValue,
    includeSubspecies,
    sortVariableValue,
    sortVariableOptions,
    sortVariableLoading,
    sortMetricValue,
    sortOrder,
    sortReference,
    listOffset,
    minRbar,
    predicates,
    numberOfResults,
    minimumSamples,
  } = state;
  const hasBaseTaxonSelection = ancestorTaxonId != null;
  const hasScopedRankingContext = hasBaseTaxonSelection && rankValue.length > 0;

  const { sortMetricOptions } = useSearchFiltersEffects({
    state,
    dispatch,
    baseTaxonDismissTimeoutRef,
  });

  const {
    onCountryChange,
    onStateChange,
    onCountyChange,
    onBaseTaxonQueryChange,
    onBaseTaxonSubmit,
    onBaseTaxonFocus,
    onBaseTaxonBlur,
    onHydrateRouteState: handleHydrateRouteState,
    onHydrateRouteLocation: handleHydrateRouteLocation,
    onBaseTaxonSelect: handleBaseTaxonSelect,
    onRankChange,
    onIncludeSubspeciesChange,
    onSortVariableChange,
    onSortMetricChange,
    onSortOrderChange,
    onNumberOfResultsChange,
    onMinimumSamplesChange,
    onSortReferenceChange,
    onListOffsetChange,
    onMinRbarChange,
    onAddFilterPredicate,
    onRemoveFilterPredicate,
    onUpdateFilterPredicate,
    onResetFilters,
  } = useSearchFiltersActions({
    baseTaxonFocused,
    baseTaxonQuery,
    dispatch,
    baseTaxonDismissTimeoutRef,
    baseTaxonSubmitRequestIdRef,
  });

  const onBaseTaxonSelect = React.useCallback(
    (species: Parameters<typeof handleBaseTaxonSelect>[0]) => {
      const label =
        species.commonName?.trim() ||
        species.scientificName?.trim() ||
        String(species.taxonId);
      baseTaxonLabelCache.set(species.taxonId, label);
      handleBaseTaxonSelect(species);
    },
    [handleBaseTaxonSelect],
  );

  const onHydrateRouteState = React.useCallback(
    (nextInitialState?: UseSearchFiltersInitialState) => {
      handleHydrateRouteState(withCachedBaseTaxonLabel(nextInitialState));
    },
    [handleHydrateRouteState],
  );

  const onHydrateRouteLocation = React.useCallback(
    (nextInitialState?: Parameters<typeof handleHydrateRouteLocation>[0]) => {
      handleHydrateRouteLocation(nextInitialState);
    },
    [handleHydrateRouteLocation],
  );

  const filterParams = React.useMemo(
    () => toSearchFilterParams(state),
    [state],
  );

  const rankingFilterHint = React.useMemo(
    () => toSearchRankingFilterHint(state),
    [state],
  );
  const sortVariableSourceIds = React.useMemo(
    () =>
      state.sortVariableDefinitions.find(
        (variable) => variable.id === state.sortVariableValue,
      )?.sourceIds ?? [],
    [state.sortVariableDefinitions, state.sortVariableValue],
  );
  const sortVariableIsCircular = React.useMemo(
    () =>
      state.sortVariableDefinitions.find(
        (variable) => variable.id === state.sortVariableValue,
      )?.valueType === 'circular',
    [state.sortVariableDefinitions, state.sortVariableValue],
  );

  const sortVariableCategoryOptions = React.useMemo(() => {
    const categoriesWithData = new Set(
      state.sortVariableDefinitions
        .filter(
          (d) => d.category && sortVariableOptions.some((o) => o.value === d.id),
        )
        .map((d) => d.category!),
    );
    const seen = new Set<string>();
    const options: { label: string; value: string }[] = [
      { label: 'All', value: '' },
    ];
    for (const def of state.sortVariableDefinitions) {
      if (def.category && !seen.has(def.category) && categoriesWithData.has(def.category)) {
        seen.add(def.category);
        const label = def.category
          .replace(/_/g, ' ')
          .replace(/^./, (c) => c.toUpperCase());
        options.push({ label, value: def.category });
      }
    }
    return options;
  }, [state.sortVariableDefinitions, sortVariableOptions]);

  // null = user has never explicitly chosen; default to first available category.
  // Only apply the default when a base taxon is set (matching rank/variable/metric).
  const effectiveSortVariableCategoryValue = React.useMemo(
    () =>
      hasScopedRankingContext
        ? (sortVariableCategoryValue ?? sortVariableCategoryOptions[1]?.value ?? '')
        : '',
    [hasScopedRankingContext, sortVariableCategoryValue, sortVariableCategoryOptions],
  );

  const filteredSortVariableDefinitions = React.useMemo(() => {
    if (!effectiveSortVariableCategoryValue) return state.sortVariableDefinitions;
    return state.sortVariableDefinitions.filter(
      (d) => d.category === effectiveSortVariableCategoryValue,
    );
  }, [state.sortVariableDefinitions, effectiveSortVariableCategoryValue]);

  const filteredSortVariableOptions = React.useMemo(() => {
    if (!effectiveSortVariableCategoryValue) return sortVariableOptions;
    const inCategory = new Set(filteredSortVariableDefinitions.map((d) => d.id));
    return sortVariableOptions.filter((o) => inCategory.has(o.value));
  }, [sortVariableOptions, effectiveSortVariableCategoryValue, filteredSortVariableDefinitions]);

  const onSortVariableCategoryChange = React.useCallback(
    (value: string) => {
      setSortVariableCategoryValue(value);
      if (state.sortVariableValue) {
        const currentDef = state.sortVariableDefinitions.find(
          (d) => d.id === state.sortVariableValue,
        );
        if (value && currentDef?.category !== value) {
          dispatch({ type: 'set-sort-variable', value: '' });
          dispatch({ type: 'set-sort-metric', value: 'median' });
        }
      }
    },
    [state.sortVariableValue, state.sortVariableDefinitions, dispatch],
  );

  const hasActiveFilters = React.useMemo(
    () => getHasActiveSearchFilters(state),
    [state],
  );

  React.useEffect(() => {
    if (hasScopedRankingContext) {
      return;
    }

    if (
      sortVariableValue.length === 0 &&
      sortMetricValue === '' &&
      sortOrder === 'ascending'
    ) {
      return;
    }

    dispatch({ type: 'set-sort-variable', value: '' });

    if (sortMetricValue !== '') {
      dispatch({ type: 'set-sort-metric', value: '' });
    }

    if (sortOrder !== 'ascending') {
      dispatch({ type: 'set-sort-order', value: 'ascending' });
    }
  }, [
    dispatch,
    hasScopedRankingContext,
    sortMetricValue,
    sortOrder,
    sortVariableValue,
  ]);

  React.useEffect(() => {
    if (!hasScopedRankingContext || rankValue) return;
    const firstRank = RANK_OPTIONS.find((o) => o.value !== '')?.value;
    if (firstRank) dispatch({ type: 'set-rank', value: firstRank });
  }, [hasScopedRankingContext, rankValue, dispatch]);

  React.useEffect(() => {
    if (!hasScopedRankingContext || sortVariableValue || !filteredSortVariableOptions.length) return;
    const firstId = filteredSortVariableOptions[0]?.value;
    if (firstId) dispatch({ type: 'set-sort-variable', value: firstId });
  }, [hasScopedRankingContext, sortVariableValue, filteredSortVariableOptions, dispatch]);

  const panelProps = React.useMemo<SearchFiltersPanelProps>(
    () => ({
      countryValue,
      countryOptions,
      onCountryChange,
      stateValue,
      stateOptions,
      onStateChange,
      countyValue,
      countyOptions,
      onCountyChange,
      baseTaxonQuery,
      onBaseTaxonQueryChange,
      onBaseTaxonSubmit,
      onBaseTaxonFocus,
      onBaseTaxonBlur,
      baseTaxonSuggestions,
      baseTaxonSuggestionsLoading,
      baseTaxonSuggestionsVisible,
      onBaseTaxonSelect,
      rankValue,
      rankOptions: RANK_OPTIONS,
      onRankChange,
      includeSubspecies,
      onIncludeSubspeciesChange,
      sortVariableValue,
      sortVariableOptions: filteredSortVariableOptions,
      sortVariableDefinitions: filteredSortVariableDefinitions,
      sortVariableCategoryValue: effectiveSortVariableCategoryValue,
      sortVariableCategoryOptions,
      onSortVariableCategoryChange,
      sortVariableDisabled: !hasScopedRankingContext,
      onSortVariableChange,
      sortVariableSourceIds,
      sortVariableIsCircular,
      sortMetricValue,
      sortMetricOptions,
      onSortMetricChange,
      sortOrder,
      onSortOrderChange,
      sortReference,
      onSortReferenceChange,
      listOffset,
      onListOffsetChange,
      minRbar,
      onMinRbarChange,
      predicates,
      filterVariableDefinitions: state.sortVariableDefinitions,
      onAddFilterPredicate,
      onRemoveFilterPredicate,
      onUpdateFilterPredicate,
      rankingFilterHint,
      numberOfResults,
      onNumberOfResultsChange,
      minimumSamples,
      onMinimumSamplesChange,
      onResetFilters,
      hasActiveFilters,
    }),
    [
      baseTaxonQuery,
      baseTaxonSuggestions,
      baseTaxonSuggestionsLoading,
      baseTaxonSuggestionsVisible,
      countryOptions,
      countryValue,
      countyOptions,
      countyValue,
      includeSubspecies,
      minimumSamples,
      numberOfResults,
      onBaseTaxonBlur,
      onBaseTaxonFocus,
      onBaseTaxonQueryChange,
      onBaseTaxonSelect,
      onBaseTaxonSubmit,
      onCountryChange,
      onCountyChange,
      onIncludeSubspeciesChange,
      onMinimumSamplesChange,
      onNumberOfResultsChange,
      onRankChange,
      onResetFilters,
      onSortMetricChange,
      onSortOrderChange,
      onSortReferenceChange,
      onListOffsetChange,
      onMinRbarChange,
      onAddFilterPredicate,
      onRemoveFilterPredicate,
      onUpdateFilterPredicate,
      onSortVariableChange,
      onStateChange,
      hasActiveFilters,
      hasScopedRankingContext,
      sortReference,
      listOffset,
      minRbar,
      predicates,
      state.sortVariableDefinitions,
      rankValue,
      rankingFilterHint,
      sortMetricOptions,
      sortMetricValue,
      sortOrder,
      filteredSortVariableOptions,
      sortVariableValue,
      stateOptions,
      stateValue,
      filteredSortVariableDefinitions,
      effectiveSortVariableCategoryValue,
      sortVariableCategoryOptions,
      onSortVariableCategoryChange,
      sortVariableSourceIds,
      sortVariableIsCircular,
    ],
  );

  React.useEffect(() => {
    if (ancestorTaxonId == null) {
      return;
    }

    const label = baseTaxonQuery.trim();
    if (label.length === 0 || label === String(ancestorTaxonId)) {
      return;
    }

    baseTaxonLabelCache.set(ancestorTaxonId, label);
  }, [ancestorTaxonId, baseTaxonQuery]);

  React.useEffect(() => {
    if (ancestorTaxonId == null) {
      return;
    }

    const rawTaxonId = String(ancestorTaxonId);
    if (baseTaxonQuery.trim() !== rawTaxonId) {
      return;
    }

    const cachedLabel = baseTaxonLabelCache.get(ancestorTaxonId);
    if (cachedLabel) {
      dispatch({
        type: 'select-base-taxon',
        query: cachedLabel,
        ancestorTaxonId,
      });
      return;
    }

    let cancelled = false;

    void fetchSpeciesByTaxonId(ancestorTaxonId)
      .then((species) => {
        if (cancelled) {
          return;
        }

        const label =
          species.common_name?.trim() ||
          species.scientific_name?.trim() ||
          rawTaxonId;

        baseTaxonLabelCache.set(ancestorTaxonId, label);

        dispatch({
          type: 'select-base-taxon',
          query: label,
          ancestorTaxonId,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [ancestorTaxonId, baseTaxonQuery, dispatch]);

  return {
    panelProps,
    countryValue,
    countryOptions,
    countryLoading,
    onCountryChange,
    stateValue,
    stateOptions,
    stateLoading,
    onStateChange,
    countyValue,
    countyOptions,
    countyLoading,
    onCountyChange,
    baseTaxonQuery,
    onBaseTaxonQueryChange,
    onBaseTaxonSubmit,
    onBaseTaxonFocus,
    onBaseTaxonBlur,
    onHydrateRouteState,
    onHydrateRouteLocation,
    baseTaxonSuggestions,
    baseTaxonSuggestionsLoading,
    baseTaxonSuggestionsVisible,
    onBaseTaxonSelect,
    rankValue,
    rankOptions: RANK_OPTIONS,
    onRankChange,
    includeSubspecies,
    onIncludeSubspeciesChange,
    sortVariableValue,
    sortVariableOptions: filteredSortVariableOptions,
    sortVariableLoading,
    sortVariableSourceIds,
    sortVariableIsCircular,
    sortVariableCategoryValue: effectiveSortVariableCategoryValue,
    sortVariableCategoryOptions,
    onSortVariableCategoryChange,
    onSortVariableChange,
    sortMetricValue,
    sortMetricOptions,
    onSortMetricChange,
    sortOrder,
    onSortOrderChange,
    sortReference,
    onSortReferenceChange,
    listOffset,
    onListOffsetChange,
    minRbar,
    onMinRbarChange,
    predicates,
    filterVariableDefinitions: state.sortVariableDefinitions,
    onAddFilterPredicate,
    onRemoveFilterPredicate,
    onUpdateFilterPredicate,
    numberOfResults,
    onNumberOfResultsChange,
    minimumSamples,
    onMinimumSamplesChange,
    onResetFilters,
    filterParams,
    rankingFilterHint,
    hasActiveFilters,
  };
}
