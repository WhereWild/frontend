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
      sortMetricValue === 'median' &&
      sortOrder === 'ascending'
    ) {
      return;
    }

    dispatch({ type: 'set-sort-variable', value: '' });

    if (sortMetricValue !== 'median') {
      dispatch({ type: 'set-sort-metric', value: 'median' });
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
      sortVariableOptions,
      sortVariableDisabled: !hasScopedRankingContext,
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
      onSortVariableChange,
      onStateChange,
      hasActiveFilters,
      hasScopedRankingContext,
      sortReference,
      listOffset,
      minRbar,
      rankValue,
      rankingFilterHint,
      sortMetricOptions,
      sortMetricValue,
      sortOrder,
      sortVariableOptions,
      sortVariableValue,
      stateOptions,
      stateValue,
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
    sortVariableOptions,
    sortVariableLoading,
    sortVariableSourceIds,
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
