import React from 'react';
import {
  fetchEnvironmentVariables,
  fetchRelativeRankingOptions,
  fetchSpeciesList,
} from '@/data/api';
import type { SearchFilterParams } from '@/data/api';
import type { RelativeRankingOption, SpeciesSummary } from '@/data/types';
import type { SelectOption } from '@/components';
import {
  fetchCountryHierarchyOptions,
  fetchHierarchyOptionsWithParentFallback,
  getOptionLabelForValue,
} from './searchFilterLocationHelpers';
import {
  BASE_TAXON_BLUR_GRACE_MS,
  DEFAULT_QUANTITY,
  deriveLocationGid,
  normalizedToSummary,
  QUANTITY_DEBOUNCE_MS,
  RANK_OPTIONS,
  resolveAncestorTaxonId,
  SORT_METRIC_OPTIONS,
  SUGGESTION_DEBOUNCE_MS,
  SUGGESTION_LIMIT,
  toMetricLabel,
  toRankingFilterHint,
  toVariableOptions,
} from './useSearchFilters.helpers';
import type { UseSearchFiltersResult } from './useSearchFilters.types';

/**
 * Manages all state for the Filters panel on the search page, including dynamic
 * loading of location options and environment variable options.
 * Returns the full set of props for the Filters component and a computed
 * `filterParams` object for the search API.
 */
export function useSearchFilters(): UseSearchFiltersResult {
  const baseTaxonDismissTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseTaxonSubmitRequestIdRef = React.useRef(0);

  // --- Location ---
  const [countryValue, setCountryValue] = React.useState('');
  const [stateValue, setStateValue] = React.useState('');
  const [countyValue, setCountyValue] = React.useState('');

  const [countryOptions, setCountryOptions] = React.useState<SelectOption[]>([]);
  const [stateOptions, setStateOptions] = React.useState<SelectOption[]>([]);
  const [countyOptions, setCountyOptions] = React.useState<SelectOption[]>([]);

  const [countryLoading, setCountryLoading] = React.useState(false);
  const [stateLoading, setStateLoading] = React.useState(false);
  const [countyLoading, setCountyLoading] = React.useState(false);

  // --- Taxon ---
  const [baseTaxonQuery, setBaseTaxonQuery] = React.useState('');
  const [baseTaxonFocused, setBaseTaxonFocused] = React.useState(false);
  const [baseTaxonSuggestions, setBaseTaxonSuggestions] = React.useState<SpeciesSummary[]>([]);
  const [baseTaxonSuggestionsLoading, setBaseTaxonSuggestionsLoading] = React.useState(false);
  const [baseTaxonSuggestionsVisible, setBaseTaxonSuggestionsVisible] = React.useState(false);
  const [ancestorTaxonId, setAncestorTaxonId] = React.useState<number | null>(null);
  const [rankValue, setRankValue] = React.useState('species');
  const [includeSubspecies, setIncludeSubspecies] = React.useState(true);

  // --- Sort ---
  const [sortVariableValue, setSortVariableValue] = React.useState('');
  const [sortVariableOptions, setSortVariableOptions] = React.useState<SelectOption[]>([]);
  const [defaultSortVariableOptions, setDefaultSortVariableOptions] = React.useState<SelectOption[]>([]);
  const [rankingSortOptions, setRankingSortOptions] = React.useState<RelativeRankingOption[]>([]);
  const [sortVariableLoading, setSortVariableLoading] = React.useState(false);
  const [sortMetricValue, setSortMetricValue] = React.useState('mean');
  const [sortOrder, setSortOrder] = React.useState<'ascending' | 'descending'>('ascending');

  // --- Quantity ---
  const [numberOfResults, setNumberOfResults] = React.useState(DEFAULT_QUANTITY.numberOfResults);
  const [minimumSamples, setMinimumSamples] = React.useState(DEFAULT_QUANTITY.minimumSamples);
  const [debouncedQuantity, setDebouncedQuantity] = React.useState(DEFAULT_QUANTITY);

  React.useEffect(() => {
    return () => {
      if (baseTaxonDismissTimeoutRef.current) {
        clearTimeout(baseTaxonDismissTimeoutRef.current);
      }
    };
  }, []);

  // Load countries on mount
  React.useEffect(() => {
    let cancelled = false;
    setCountryLoading(true);

    fetchCountryHierarchyOptions()
      .then((options) => {
        if (cancelled) return;
        setCountryOptions(options);
      })
      .catch(() => {
        if (!cancelled) setCountryOptions([]);
      })
      .finally(() => {
        if (!cancelled) setCountryLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Load states when country changes
  React.useEffect(() => {
    if (!countryValue) {
      setStateOptions([]);
      setStateValue('');
      setStateLoading(false);
      setCountyOptions([]);
      setCountyValue('');
      setCountyLoading(false);
      return;
    }

    let cancelled = false;
    setStateLoading(true);
    setStateValue('');
    setCountyOptions([]);
    setCountyValue('');

    const selectedCountryLabel = getOptionLabelForValue(countryOptions, countryValue);

    fetchHierarchyOptionsWithParentFallback('state', [countryValue, selectedCountryLabel])
      .then((options) => {
        if (cancelled) return;
        setStateOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setStateOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setStateLoading(false);
      });

    return () => { cancelled = true; };
  }, [countryOptions, countryValue]);

  // Load counties when state changes
  React.useEffect(() => {
    if (!stateValue) {
      setCountyOptions([]);
      setCountyValue('');
      setCountyLoading(false);
      return;
    }

    let cancelled = false;
    setCountyLoading(true);
    setCountyValue('');

    const selectedStateLabel = getOptionLabelForValue(stateOptions, stateValue);
    const selectedCountryLabel = getOptionLabelForValue(countryOptions, countryValue);

    fetchHierarchyOptionsWithParentFallback('county', [
      stateValue,
      selectedStateLabel,
      selectedCountryLabel && selectedStateLabel
        ? `${selectedCountryLabel}|${selectedStateLabel}`
        : undefined,
    ])
      .then((options) => {
        if (cancelled) return;
        setCountyOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setCountyOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setCountyLoading(false);
      });

    return () => { cancelled = true; };
  }, [countryOptions, countryValue, stateOptions, stateValue]);

  // Load sort variable options from environment variables API
  React.useEffect(() => {
    let cancelled = false;
    setSortVariableLoading(true);

    fetchEnvironmentVariables()
      .then((variables) => {
        if (cancelled) return;
        const options = toVariableOptions(variables);
        setDefaultSortVariableOptions(options);
        setSortVariableOptions(options);
      })
      .catch(() => {
        if (!cancelled) {
          setDefaultSortVariableOptions([]);
          setSortVariableOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setSortVariableLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Debounced fetch of base-taxon suggestions as user types.
  React.useEffect(() => {
    const trimmed = baseTaxonQuery.trim();
    if (!trimmed) {
      setBaseTaxonSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setBaseTaxonSuggestionsLoading(true);
      fetchSpeciesList(SUGGESTION_LIMIT, trimmed)
        .then((rows) => {
          if (cancelled) return;
          const summaries = rows
            .map(normalizedToSummary)
            .filter((s): s is SpeciesSummary => s !== null);
          setBaseTaxonSuggestions(summaries);
        })
        .catch(() => {
          if (!cancelled) setBaseTaxonSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setBaseTaxonSuggestionsLoading(false);
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [baseTaxonQuery]);

  // Debounce quantity spinner values before forwarding to search params.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuantity({
        numberOfResults,
        minimumSamples,
      });
    }, QUANTITY_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [minimumSamples, numberOfResults]);

  React.useEffect(() => {
    if (!ancestorTaxonId || !Number.isFinite(ancestorTaxonId)) {
      setRankingSortOptions([]);
      setSortVariableOptions(defaultSortVariableOptions);
      return;
    }

    let cancelled = false;
    setSortVariableLoading(true);

    fetchRelativeRankingOptions({
      taxonId: ancestorTaxonId,
      rank: rankValue.toUpperCase(),
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        const options = response.options;
        setRankingSortOptions(options);

        // Prefer backend-supported ranking variables once a base taxon is known.
        const variables = Array.from(
          new Set(options.map((entry) => entry.variable).filter((value) => value.length > 0)),
        );
        if (variables.length > 0) {
          const labelByValue = new Map(
            defaultSortVariableOptions.map((option) => [option.value, option.label]),
          );
          setSortVariableOptions(
            variables.map((value) => ({
              label: labelByValue.get(value) ?? value,
              value,
            })),
          );
          return;
        }

        setSortVariableOptions(defaultSortVariableOptions);
      })
      .catch(() => {
        if (!cancelled) {
          setRankingSortOptions([]);
          setSortVariableOptions(defaultSortVariableOptions);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSortVariableLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ancestorTaxonId, defaultSortVariableOptions, rankValue]);

  React.useEffect(() => {
    // If the current variable is no longer valid for this ranking context, clear it.
    if (!sortVariableOptions.some((option) => option.value === sortVariableValue)) {
      setSortVariableValue('');
    }
  }, [sortVariableOptions, sortVariableValue]);

  React.useEffect(() => {
    if (!ancestorTaxonId || sortVariableValue || sortVariableOptions.length === 0) {
      return;
    }

    const firstVariable = sortVariableOptions[0]?.value;
    if (firstVariable) {
      // Auto-select to make ranking filters actionable without extra clicks.
      setSortVariableValue(firstVariable);
    }
  }, [ancestorTaxonId, sortVariableOptions, sortVariableValue]);

  const sortMetricOptions = React.useMemo<SelectOption[]>(() => {
    if (!rankingSortOptions.length || !sortVariableValue) {
      return SORT_METRIC_OPTIONS;
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
      return SORT_METRIC_OPTIONS;
    }

    return metrics.map((value) => ({
      label: toMetricLabel(value),
      value,
    }));
  }, [rankingSortOptions, sortVariableValue]);

  React.useEffect(() => {
    if (!sortMetricOptions.some((option) => option.value === sortMetricValue)) {
      const fallback = sortMetricOptions[0]?.value;
      setSortMetricValue(fallback ?? 'mean');
    }
  }, [sortMetricOptions, sortMetricValue]);

  // --- Location handlers ---
  const handleCountryChange = React.useCallback((value: string) => {
    setCountryValue(value);
  }, []);

  const handleStateChange = React.useCallback((value: string) => {
    setStateValue(value);
  }, []);

  const handleCountyChange = React.useCallback((value: string) => {
    setCountyValue(value);
  }, []);

  // --- Sort handlers ---
  const handleSortVariableChange = React.useCallback((value: string) => {
    setSortVariableValue(value);
  }, []);

  const handleSortMetricChange = React.useCallback((value: string) => {
    setSortMetricValue(value);
  }, []);

  const handleSortOrderChange = React.useCallback((value: 'ascending' | 'descending') => {
    setSortOrder(value);
  }, []);

  // --- Quantity handlers ---
  const handleNumberOfResultsChange = React.useCallback((value: number) => {
    setNumberOfResults(value);
  }, []);

  const handleMinimumSamplesChange = React.useCallback((value: number) => {
    setMinimumSamples(value);
  }, []);

  // --- Taxon handlers ---
  const clearBaseTaxonDismissTimeout = React.useCallback(() => {
    if (baseTaxonDismissTimeoutRef.current) {
      clearTimeout(baseTaxonDismissTimeoutRef.current);
      baseTaxonDismissTimeoutRef.current = null;
    }
  }, []);

  const handleBaseTaxonQueryChange = React.useCallback((value: string) => {
    const trimmed = value.trim();
    setBaseTaxonQuery(value);
    // Clear the confirmed ancestor whenever the user edits the field.
    setAncestorTaxonId(null);
    // Keep suggestions visible while focused or when there is active text.
    setBaseTaxonSuggestionsVisible(baseTaxonFocused || trimmed.length > 0);
  }, [baseTaxonFocused]);

  const handleBaseTaxonSubmit = React.useCallback(async (value: string) => {
    const requestId = baseTaxonSubmitRequestIdRef.current + 1;
    baseTaxonSubmitRequestIdRef.current = requestId;
    setBaseTaxonFocused(false);
    setBaseTaxonSuggestionsVisible(false);
    try {
      const resolved = await resolveAncestorTaxonId(value);
      if (requestId !== baseTaxonSubmitRequestIdRef.current) {
        return;
      }
      setAncestorTaxonId(resolved);
    } catch {
      if (requestId !== baseTaxonSubmitRequestIdRef.current) {
        return;
      }
      setAncestorTaxonId(null);
    }
  }, []);

  const handleBaseTaxonSelect = React.useCallback((species: SpeciesSummary) => {
    clearBaseTaxonDismissTimeout();
    setBaseTaxonQuery(species.commonName || species.scientificName);
    setAncestorTaxonId(species.taxonId);
    setBaseTaxonFocused(false);
    setBaseTaxonSuggestionsVisible(false);
  }, [clearBaseTaxonDismissTimeout]);

  const handleBaseTaxonFocus = React.useCallback(() => {
    clearBaseTaxonDismissTimeout();
    setBaseTaxonFocused(true);
    if (baseTaxonQuery.trim().length > 0) {
      setBaseTaxonSuggestionsVisible(true);
    }
  }, [baseTaxonQuery, clearBaseTaxonDismissTimeout]);

  const handleBaseTaxonBlur = React.useCallback(() => {
    clearBaseTaxonDismissTimeout();
    baseTaxonDismissTimeoutRef.current = setTimeout(() => {
      setBaseTaxonFocused(false);
      setBaseTaxonSuggestionsVisible(false);
    }, BASE_TAXON_BLUR_GRACE_MS);
  }, [clearBaseTaxonDismissTimeout]);

  const handleResetFilters = React.useCallback(() => {
    setCountryValue('');
    setStateValue('');
    setCountyValue('');
    setBaseTaxonQuery('');
    setBaseTaxonFocused(false);
    setAncestorTaxonId(null);
    setBaseTaxonSuggestions([]);
    setBaseTaxonSuggestionsVisible(false);
    setRankValue('species');
    setIncludeSubspecies(true);
    setSortVariableValue('');
    setSortMetricValue('mean');
    setSortOrder('ascending');
    setNumberOfResults(DEFAULT_QUANTITY.numberOfResults);
    setMinimumSamples(DEFAULT_QUANTITY.minimumSamples);
    setDebouncedQuantity(DEFAULT_QUANTITY);
  }, []);

  const filterParams = React.useMemo<SearchFilterParams>(() => {
    const locationGid = deriveLocationGid(countryValue, stateValue, countyValue);
    return {
      locationGid: locationGid || null,
      ancestorTaxonId: ancestorTaxonId ?? null,
      rank: rankValue || null,
      includeSubspecies,
      sortVariable: sortVariableValue || null,
      sortMetric: sortVariableValue ? sortMetricValue : null,
      sortOrder: sortOrder === 'ascending' ? 'asc' : 'desc',
      minimumSamples: debouncedQuantity.minimumSamples,
      numberOfResults: debouncedQuantity.numberOfResults,
    };
  }, [
    countyValue,
    stateValue,
    countryValue,
    ancestorTaxonId,
    rankValue,
    includeSubspecies,
    sortVariableValue,
    sortMetricValue,
    sortOrder,
    debouncedQuantity,
  ]);

  const rankingFilterHint = React.useMemo(() => {
    return toRankingFilterHint(ancestorTaxonId, sortVariableValue, sortMetricValue);
  }, [ancestorTaxonId, sortMetricValue, sortVariableValue]);

  const hasActiveFilters = React.useMemo(() => {
    return Boolean(
      countryValue
      || stateValue
      || countyValue
      || ancestorTaxonId != null
      || rankValue !== 'species'
      || includeSubspecies !== true
      || sortVariableValue
      || sortOrder !== 'ascending'
      || numberOfResults !== DEFAULT_QUANTITY.numberOfResults
      || minimumSamples !== DEFAULT_QUANTITY.minimumSamples,
    );
  }, [
    countryValue,
    stateValue,
    countyValue,
    ancestorTaxonId,
    rankValue,
    includeSubspecies,
    sortVariableValue,
    sortOrder,
    numberOfResults,
    minimumSamples,
  ]);

  return {
    countryValue,
    countryOptions,
    countryLoading,
    onCountryChange: handleCountryChange,
    stateValue,
    stateOptions,
    stateLoading,
    onStateChange: handleStateChange,
    countyValue,
    countyOptions,
    countyLoading,
    onCountyChange: handleCountyChange,
    baseTaxonQuery,
    onBaseTaxonQueryChange: handleBaseTaxonQueryChange,
    onBaseTaxonSubmit: handleBaseTaxonSubmit,
    onBaseTaxonFocus: handleBaseTaxonFocus,
    onBaseTaxonBlur: handleBaseTaxonBlur,
    baseTaxonSuggestions,
    baseTaxonSuggestionsLoading,
    baseTaxonSuggestionsVisible,
    onBaseTaxonSelect: handleBaseTaxonSelect,
    rankValue,
    rankOptions: RANK_OPTIONS,
    onRankChange: setRankValue,
    includeSubspecies,
    onIncludeSubspeciesChange: setIncludeSubspecies,
    sortVariableValue,
    sortVariableOptions,
    sortVariableLoading,
    onSortVariableChange: handleSortVariableChange,
    sortMetricValue,
    sortMetricOptions,
    onSortMetricChange: handleSortMetricChange,
    sortOrder,
    onSortOrderChange: handleSortOrderChange,
    numberOfResults,
    onNumberOfResultsChange: handleNumberOfResultsChange,
    minimumSamples,
    onMinimumSamplesChange: handleMinimumSamplesChange,
    onResetFilters: handleResetFilters,
    filterParams,
    rankingFilterHint,
    hasActiveFilters,
  };
}
