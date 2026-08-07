// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import {
  fetchEnvironmentVariables,
  fetchRelativeRankingOptions,
  fetchTaxaQuery,
} from '@/data/api';
import { isAbortError } from '@/data/apiShared';
import {
  getPreferredOptionValue,
  QUANTITY_DEBOUNCE_MS,
  SORT_METRIC_OPTIONS,
  SUGGESTION_DEBOUNCE_MS,
  SUGGESTION_LIMIT,
  taxaQueryResultToSummary,
  toVariableOptions,
} from './useSearchFilters.helpers';
import {
  fetchCountryHierarchyOptions,
  fetchHierarchyOptionsWithParentFallback,
  fetchTaxonHierarchyOptions,
  getOptionLabelForValue,
} from './searchFilterLocationHelpers';
import { toSortMetricOptions } from './useSearchFilters.derived';
import type {
  SearchFiltersAction,
  SearchFiltersState,
} from './useSearchFilters.state';

const PREFERRED_SORT_METRICS = ['Median', 'median'];

type UseSearchFiltersEffectsParams = {
  state: SearchFiltersState;
  dispatch: React.Dispatch<SearchFiltersAction>;
  baseTaxonDismissTimeoutRef: React.MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>;
};

export function useSearchFiltersEffects({
  state,
  dispatch,
  baseTaxonDismissTimeoutRef,
}: UseSearchFiltersEffectsParams) {
  const latestAncestorTaxonIdRef = React.useRef(state.ancestorTaxonId);
  latestAncestorTaxonIdRef.current = state.ancestorTaxonId;
  const prevAncestorTaxonIdRef = React.useRef<string | null | undefined>(
    undefined,
  );
  const latestRankingSortOptionsRef = React.useRef(state.rankingSortOptions);
  latestRankingSortOptionsRef.current = state.rankingSortOptions;

  const sortMetricOptions = React.useMemo(() => {
    return toSortMetricOptions(
      state.rankingSortOptions,
      state.sortVariableValue,
    );
  }, [state.rankingSortOptions, state.sortVariableValue]);

  React.useEffect(() => {
    const dismissTimeout = baseTaxonDismissTimeoutRef.current;

    return () => {
      if (dismissTimeout) {
        clearTimeout(dismissTimeout);
      }
    };
  }, [baseTaxonDismissTimeoutRef]);

  React.useEffect(() => {
    const prevId = prevAncestorTaxonIdRef.current;
    prevAncestorTaxonIdRef.current = state.ancestorTaxonId;

    let cancelled = false;
    dispatch({ type: 'set-country-loading', value: true });

    const hasTaxonId = state.ancestorTaxonId != null;
    const prevWasValid = prevId != null;
    const taxonIdChanged = prevWasValid && prevId !== state.ancestorTaxonId;

    if (hasTaxonId && taxonIdChanged) {
      dispatch({ type: 'change-country', value: '' });
      dispatch({ type: 'change-state', value: '' });
      dispatch({ type: 'change-county', value: '' });
    }

    const loadFn = hasTaxonId
      ? fetchTaxonHierarchyOptions(state.ancestorTaxonId!, 'country')
      : fetchCountryHierarchyOptions();

    loadFn
      .then((options) => {
        if (!cancelled) {
          dispatch({ type: 'set-country-options', options });
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({ type: 'set-country-options', options: [] });
        }
      })
      .finally(() => {
        if (!cancelled) {
          dispatch({ type: 'set-country-loading', value: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, state.ancestorTaxonId]);

  const selectedCountryLabel = React.useMemo(
    () => getOptionLabelForValue(state.countryOptions, state.countryValue),
    [state.countryOptions, state.countryValue],
  );

  React.useEffect(() => {
    if (!state.countryValue) {
      return;
    }

    let cancelled = false;
    dispatch({ type: 'set-state-loading', value: true });

    const stateLoadFn =
      state.ancestorTaxonId != null
        ? fetchTaxonHierarchyOptions(
            state.ancestorTaxonId,
            'state',
            state.countryValue,
          )
        : fetchHierarchyOptionsWithParentFallback('state', [
            state.countryValue,
            selectedCountryLabel,
          ]);

    stateLoadFn
      .then((options) => {
        if (!cancelled) {
          dispatch({ type: 'set-state-options', options });
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({ type: 'set-state-options', options: [] });
        }
      })
      .finally(() => {
        if (!cancelled) {
          dispatch({ type: 'set-state-loading', value: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    selectedCountryLabel,
    state.countryValue,
    state.ancestorTaxonId,
  ]);

  const selectedStateLabel = React.useMemo(
    () => getOptionLabelForValue(state.stateOptions, state.stateValue),
    [state.stateOptions, state.stateValue],
  );

  React.useEffect(() => {
    if (!state.stateValue) {
      return;
    }

    let cancelled = false;
    dispatch({ type: 'set-county-loading', value: true });

    const countyLoadFn =
      state.ancestorTaxonId != null
        ? fetchTaxonHierarchyOptions(
            state.ancestorTaxonId,
            'county',
            state.stateValue,
          )
        : fetchHierarchyOptionsWithParentFallback('county', [
            state.stateValue,
            selectedStateLabel,
            selectedCountryLabel && selectedStateLabel
              ? `${selectedCountryLabel}|${selectedStateLabel}`
              : undefined,
          ]);

    countyLoadFn
      .then((options) => {
        if (!cancelled) {
          dispatch({ type: 'set-county-options', options });
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatch({ type: 'set-county-options', options: [] });
        }
      })
      .finally(() => {
        if (!cancelled) {
          dispatch({ type: 'set-county-loading', value: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    state.countryValue,
    state.stateValue,
    selectedCountryLabel,
    selectedStateLabel,
    state.ancestorTaxonId,
  ]);

  React.useEffect(() => {
    const trimmed = state.baseTaxonQuery.trim();
    if (!trimmed) {
      dispatch({ type: 'set-base-taxon-suggestions', suggestions: [] });
      dispatch({ type: 'set-base-taxon-suggestions-loading', value: false });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      dispatch({ type: 'set-base-taxon-suggestions-loading', value: true });
      fetchTaxaQuery({
        q: trimmed,
        limit: SUGGESTION_LIMIT,
        offset: 0,
        minSamples: 0,
      })
        .then((response) => {
          if (cancelled) {
            return;
          }

          const suggestions = response.results
            .map(taxaQueryResultToSummary)
            .filter(
              (summary): summary is NonNullable<typeof summary> =>
                summary !== null,
            );
          dispatch({ type: 'set-base-taxon-suggestions', suggestions });
        })
        .catch(() => {
          if (!cancelled) {
            dispatch({ type: 'set-base-taxon-suggestions', suggestions: [] });
          }
        })
        .finally(() => {
          if (!cancelled) {
            dispatch({
              type: 'set-base-taxon-suggestions-loading',
              value: false,
            });
          }
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dispatch, state.baseTaxonQuery]);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    dispatch({ type: 'set-sort-variable-loading', value: true });

    fetchEnvironmentVariables({ signal: controller.signal })
      .then((variables) => {
        if (cancelled) {
          return;
        }

        const options = toVariableOptions(variables);
        dispatch({ type: 'set-default-sort-variable-options', options });
        dispatch({
          type: 'set-sort-variable-definitions',
          definitions: variables,
        });

        const hasValidAncestorTaxonId =
          latestAncestorTaxonIdRef.current != null;

        if (!hasValidAncestorTaxonId) {
          dispatch({ type: 'set-sort-variable-options', options });
          return;
        }

        const scopedVariables = Array.from(
          new Set(
            latestRankingSortOptionsRef.current
              .map((entry) => entry.variable)
              .filter((value) => value.length > 0),
          ),
        );

        if (scopedVariables.length === 0) {
          dispatch({ type: 'set-sort-variable-options', options });
          return;
        }

        const labelByValue = new Map(
          options.map((option) => [option.value, option.label]),
        );

        dispatch({
          type: 'set-sort-variable-options',
          options: scopedVariables.map((value) => ({
            label: labelByValue.get(value) ?? value,
            value,
          })),
        });
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        if (!cancelled) {
          dispatch({ type: 'set-default-sort-variable-options', options: [] });
          dispatch({ type: 'set-sort-variable-definitions', definitions: [] });

          const hasValidAncestorTaxonId =
            latestAncestorTaxonIdRef.current != null;

          if (!hasValidAncestorTaxonId) {
            dispatch({ type: 'set-sort-variable-options', options: [] });
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          dispatch({ type: 'set-sort-variable-loading', value: false });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dispatch]);

  const hasValidAncestorTaxonId = state.ancestorTaxonId != null;

  React.useLayoutEffect(() => {
    if (hasValidAncestorTaxonId) {
      return;
    }

    if (state.rankingSortOptions.length > 0) {
      dispatch({ type: 'set-ranking-sort-options', options: [] });
    }

    const shouldResetSortVariableOptions =
      state.sortVariableOptions.length !==
        state.defaultSortVariableOptions.length ||
      state.sortVariableOptions.some((option, index) => {
        const other = state.defaultSortVariableOptions[index];
        return option.label !== other?.label || option.value !== other?.value;
      });

    if (shouldResetSortVariableOptions) {
      dispatch({
        type: 'set-sort-variable-options',
        options: state.defaultSortVariableOptions,
      });
    }

    if (state.sortVariableLoading) {
      dispatch({ type: 'set-sort-variable-loading', value: false });
    }
  }, [
    dispatch,
    hasValidAncestorTaxonId,
    state.defaultSortVariableOptions,
    state.rankingSortOptions.length,
    state.sortVariableLoading,
    state.sortVariableOptions,
  ]);

  React.useEffect(() => {
    if (!state.ancestorTaxonId || !state.rankValue) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    dispatch({ type: 'set-sort-variable-loading', value: true });

    fetchRelativeRankingOptions(
      {
        taxonId: state.ancestorTaxonId,
        rank: state.rankValue.toUpperCase(),
      },
      {
        signal: controller.signal,
      },
    )
      .then((response) => {
        if (cancelled) {
          return;
        }

        dispatch({
          type: 'set-ranking-sort-options',
          options: response.options,
        });

        const variables = Array.from(
          new Set(
            response.options
              .map((entry) => entry.variable)
              .filter((value) => value.length > 0),
          ),
        );

        if (variables.length > 0) {
          const labelByValue = new Map(
            state.defaultSortVariableOptions.map((option) => [
              option.value,
              option.label,
            ]),
          );
          dispatch({
            type: 'set-sort-variable-options',
            options: variables.map((value) => ({
              label: labelByValue.get(value) ?? value,
              value,
            })),
          });
          return;
        }

        dispatch({
          type: 'set-sort-variable-options',
          options: [],
        });
        dispatch({ type: 'set-sort-variable', value: '' });
        dispatch({ type: 'set-sort-metric', value: '' });
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        if (!cancelled) {
          dispatch({ type: 'set-ranking-sort-options', options: [] });
          dispatch({
            type: 'set-sort-variable-options',
            options: [],
          });
          dispatch({ type: 'set-sort-variable', value: '' });
          dispatch({ type: 'set-sort-metric', value: '' });
          dispatch({ type: 'set-sort-variable-loading', value: false });
        }
      })
      .finally(() => {
        if (!cancelled) {
          dispatch({ type: 'set-sort-variable-loading', value: false });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    dispatch,
    state.ancestorTaxonId,
    state.defaultSortVariableOptions,
    state.rankValue,
  ]);

  React.useEffect(() => {
    if (
      state.sortVariableValue &&
      state.sortVariableOptions.length > 0 &&
      !state.sortVariableOptions.some(
        (option) => option.value === state.sortVariableValue,
      )
    ) {
      dispatch({ type: 'set-sort-variable', value: '' });
    }
  }, [dispatch, state.sortVariableOptions, state.sortVariableValue]);

  React.useEffect(() => {
    if (!sortMetricOptions.length) return;

    const fallbackMetric =
      getPreferredOptionValue(sortMetricOptions, PREFERRED_SORT_METRICS) ??
      sortMetricOptions[0]?.value;

    if (!fallbackMetric) return;

    if (!state.sortMetricValue) {
      dispatch({ type: 'set-sort-metric', value: fallbackMetric });
      return;
    }

    if (
      !sortMetricOptions.some(
        (option) => option.value === state.sortMetricValue,
      )
    ) {
      dispatch({ type: 'set-sort-metric', value: fallbackMetric });
    }
  }, [dispatch, sortMetricOptions, state.sortMetricValue]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({
        type: 'set-debounced-quantity',
        value: {
          numberOfResults: state.numberOfResults,
          minimumSamples: state.minimumSamples,
        },
      });
    }, QUANTITY_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [dispatch, state.minimumSamples, state.numberOfResults]);

  return {
    sortMetricOptions,
  };
}
