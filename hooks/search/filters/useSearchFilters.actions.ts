// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import type { SpeciesSummary } from '@/data/types';
import {
  BASE_TAXON_BLUR_GRACE_MS,
  resolveAncestorTaxonId,
} from './useSearchFilters.helpers';
import type {
  SearchFilterLocationInitialState,
  SearchFiltersAction,
  SearchFiltersState,
  UseSearchFiltersInitialState,
} from './useSearchFilters.state';

type UseSearchFiltersActionsParams = {
  baseTaxonFocused: SearchFiltersState['baseTaxonFocused'];
  baseTaxonQuery: SearchFiltersState['baseTaxonQuery'];
  dispatch: React.Dispatch<SearchFiltersAction>;
  baseTaxonDismissTimeoutRef: React.MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>;
  baseTaxonSubmitRequestIdRef: React.MutableRefObject<number>;
};

export function useSearchFiltersActions({
  baseTaxonFocused,
  baseTaxonQuery,
  dispatch,
  baseTaxonDismissTimeoutRef,
  baseTaxonSubmitRequestIdRef,
}: UseSearchFiltersActionsParams) {
  const invalidateBaseTaxonSubmit = React.useCallback(() => {
    baseTaxonSubmitRequestIdRef.current += 1;
  }, [baseTaxonSubmitRequestIdRef]);

  const clearBaseTaxonDismissTimeout = React.useCallback(() => {
    if (baseTaxonDismissTimeoutRef.current) {
      clearTimeout(baseTaxonDismissTimeoutRef.current);
      baseTaxonDismissTimeoutRef.current = null;
    }
  }, [baseTaxonDismissTimeoutRef]);

  const onCountryChange = React.useCallback(
    (value: string) => {
      dispatch({ type: 'change-country', value });
    },
    [dispatch],
  );

  const onStateChange = React.useCallback(
    (value: string) => {
      dispatch({ type: 'change-state', value });
    },
    [dispatch],
  );

  const onCountyChange = React.useCallback(
    (value: string) => {
      dispatch({ type: 'change-county', value });
    },
    [dispatch],
  );

  const onBaseTaxonQueryChange = React.useCallback(
    (value: string) => {
      invalidateBaseTaxonSubmit();
      const trimmed = value.trim();
      dispatch({
        type: 'set-base-taxon-query',
        value,
        showSuggestions: baseTaxonFocused || trimmed.length > 0,
      });
    },
    [baseTaxonFocused, dispatch, invalidateBaseTaxonSubmit],
  );

  const onBaseTaxonSubmit = React.useCallback(
    async (value: string) => {
      const requestId = baseTaxonSubmitRequestIdRef.current + 1;
      baseTaxonSubmitRequestIdRef.current = requestId;
      dispatch({ type: 'set-base-taxon-focus', value: false });
      dispatch({ type: 'set-base-taxon-suggestions-visible', value: false });

      try {
        const resolved = await resolveAncestorTaxonId(value);
        if (requestId === baseTaxonSubmitRequestIdRef.current) {
          dispatch({
            type: 'submit-base-taxon-result',
            ancestorTaxonId: resolved,
          });
        }
      } catch {
        if (requestId === baseTaxonSubmitRequestIdRef.current) {
          dispatch({ type: 'submit-base-taxon-result', ancestorTaxonId: null });
        }
      }
    },
    [baseTaxonSubmitRequestIdRef, dispatch],
  );

  const onBaseTaxonFocus = React.useCallback(() => {
    clearBaseTaxonDismissTimeout();
    dispatch({ type: 'set-base-taxon-focus', value: true });
    if (baseTaxonQuery.trim().length > 0) {
      dispatch({ type: 'set-base-taxon-suggestions-visible', value: true });
    }
  }, [baseTaxonQuery, clearBaseTaxonDismissTimeout, dispatch]);

  const onBaseTaxonBlur = React.useCallback(() => {
    clearBaseTaxonDismissTimeout();
    baseTaxonDismissTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'set-base-taxon-focus', value: false });
      dispatch({ type: 'set-base-taxon-suggestions-visible', value: false });
    }, BASE_TAXON_BLUR_GRACE_MS);
  }, [baseTaxonDismissTimeoutRef, clearBaseTaxonDismissTimeout, dispatch]);

  const onBaseTaxonSelect = React.useCallback(
    (species: SpeciesSummary) => {
      invalidateBaseTaxonSubmit();
      clearBaseTaxonDismissTimeout();
      dispatch({
        type: 'select-base-taxon',
        query: species.commonName || species.scientificName,
        ancestorTaxonId: species.taxonId,
      });
    },
    [clearBaseTaxonDismissTimeout, dispatch, invalidateBaseTaxonSubmit],
  );

  const onHydrateRouteState = React.useCallback(
    (initialState?: UseSearchFiltersInitialState) => {
      invalidateBaseTaxonSubmit();
      clearBaseTaxonDismissTimeout();
      dispatch({ type: 'hydrate-route-state', initialState });
    },
    [clearBaseTaxonDismissTimeout, dispatch, invalidateBaseTaxonSubmit],
  );

  const onHydrateRouteLocation = React.useCallback(
    (initialState?: SearchFilterLocationInitialState) => {
      dispatch({ type: 'hydrate-route-location', initialState });
    },
    [dispatch],
  );

  const onRankChange = React.useCallback(
    (value: string) => {
      dispatch({ type: 'set-rank', value });
    },
    [dispatch],
  );

  const onIncludeSubspeciesChange = React.useCallback(
    (value: boolean) => {
      dispatch({ type: 'set-include-subspecies', value });
    },
    [dispatch],
  );

  const onSortVariableChange = React.useCallback(
    (value: string) => {
      dispatch({ type: 'set-sort-variable', value });
    },
    [dispatch],
  );

  const onSortMetricChange = React.useCallback(
    (value: string) => {
      dispatch({ type: 'set-sort-metric', value });
    },
    [dispatch],
  );

  const onSortOrderChange = React.useCallback(
    (value: 'ascending' | 'descending') => {
      dispatch({ type: 'set-sort-order', value });
    },
    [dispatch],
  );

  const onNumberOfResultsChange = React.useCallback(
    (value: number) => {
      dispatch({ type: 'set-number-of-results', value });
    },
    [dispatch],
  );

  const onMinimumSamplesChange = React.useCallback(
    (value: number) => {
      dispatch({ type: 'set-minimum-samples', value });
    },
    [dispatch],
  );

  const onSortReferenceChange = React.useCallback(
    (value: number) => {
      dispatch({ type: 'set-sort-reference', value });
    },
    [dispatch],
  );

  const onMinRbarChange = React.useCallback(
    (value: number) => {
      dispatch({ type: 'set-min-rbar', value });
    },
    [dispatch],
  );

  const onResetFilters = React.useCallback(() => {
    invalidateBaseTaxonSubmit();
    clearBaseTaxonDismissTimeout();
    dispatch({ type: 'reset-all' });
  }, [clearBaseTaxonDismissTimeout, dispatch, invalidateBaseTaxonSubmit]);

  return {
    onCountryChange,
    onStateChange,
    onCountyChange,
    onBaseTaxonQueryChange,
    onBaseTaxonSubmit,
    onBaseTaxonFocus,
    onBaseTaxonBlur,
    onHydrateRouteState,
    onHydrateRouteLocation,
    onBaseTaxonSelect,
    onRankChange,
    onIncludeSubspeciesChange,
    onSortVariableChange,
    onSortMetricChange,
    onSortOrderChange,
    onNumberOfResultsChange,
    onMinimumSamplesChange,
    onSortReferenceChange,
    onMinRbarChange,
    onResetFilters,
  };
}
