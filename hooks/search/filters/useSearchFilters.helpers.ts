// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchTaxaQuery } from '@/data/api';
import { mapSpeciesApiNormalizedToSummary } from '@/data/speciesSummaryMapper';
import type { SpeciesSummary, TaxaQueryResult } from '@/data/types';
import type { SelectOption } from '@/components';

export const RANK_OPTIONS: SelectOption[] = [
  { label: 'All ranks', value: '' },
  { label: 'Species', value: 'species' },
  { label: 'Genus', value: 'genus' },
  { label: 'Family', value: 'family' },
  { label: 'Order', value: 'order' },
  { label: 'Class', value: 'class' },
  { label: 'Phylum', value: 'phylum' },
  { label: 'Kingdom', value: 'kingdom' },
];

export const SORT_METRIC_OPTIONS: SelectOption[] = [
  { label: 'Average', value: 'mean' },
  { label: 'Median', value: 'median' },
  { label: 'Minimum', value: 'min' },
  { label: 'Maximum', value: 'max' },
  { label: 'Standard deviation', value: 'std' },
];

export const DEFAULT_NUMBER_OF_RESULTS = 10;
export const DEFAULT_MINIMUM_SAMPLES = 0;
export const DEFAULT_QUANTITY = {
  numberOfResults: DEFAULT_NUMBER_OF_RESULTS,
  minimumSamples: DEFAULT_MINIMUM_SAMPLES,
};

export const SUGGESTION_DEBOUNCE_MS = 300;
export const SUGGESTION_LIMIT = 5;
export const BASE_TAXON_BLUR_GRACE_MS = 140;
export const QUANTITY_DEBOUNCE_MS = 300;

const METRIC_LABELS: Record<string, string> = {
  mean: 'Average',
  median: 'Median',
  min: 'Minimum',
  max: 'Maximum',
  std: 'Standard deviation',
  stddev: 'Standard deviation',
};

export const toMetricLabel = (metric: string) =>
  METRIC_LABELS[metric] ?? metric;

export const toVariableOptions = (
  variables: { id: string; name?: string }[],
): SelectOption[] =>
  variables.map((variable) => ({
    label: variable.name ?? variable.id,
    value: variable.id,
  }));

const normalizeOptionText = (value: string) => value.trim().toLowerCase();

export const getPreferredOptionValue = (
  options: SelectOption[],
  preferredValues: string[],
) => {
  const normalizedPreferredValues = preferredValues.map(normalizeOptionText);

  return options.find((option) => {
    const normalizedLabel = normalizeOptionText(option.label);
    const normalizedValue = normalizeOptionText(option.value);

    return (
      normalizedPreferredValues.includes(normalizedLabel) ||
      normalizedPreferredValues.includes(normalizedValue)
    );
  })?.value;
};

export const deriveLocationGid = (
  countryValue: string,
  stateValue: string,
  countyValue: string,
) => countyValue || stateValue || countryValue || null;

export const toRankingFilterHint = (
  ancestorTaxonId: number | null,
  rankValue: string,
  sortVariableValue: string,
  sortMetricValue: string,
) => {
  if (!ancestorTaxonId) {
    return 'Add a Scope taxon to limit search results to descendant taxa. Then choose Rank, Variable, and Metric to rank within that scope.';
  }

  if (!rankValue) {
    return 'Selecting a Scope taxon already limits search results to its descendant taxa. Choose a Rank to start ranking within that scope.';
  }

  if (!sortVariableValue) {
    return 'Choose a Sort variable to apply ranking-based filters.';
  }

  if (!sortMetricValue) {
    return 'Choose a Sorting metric to apply ranking-based filters.';
  }

  return null;
};

export const taxaQueryResultToSummary = (
  entry: TaxaQueryResult,
): SpeciesSummary | null => {
  return mapSpeciesApiNormalizedToSummary(entry, {
    includeRawDescription: false,
    fallbackDescription: '',
  });
};

export const resolveAncestorTaxonId = async (
  query: string,
): Promise<number | null> => {
  const trimmed = query.trim();
  if (!trimmed.length) {
    return null;
  }

  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    return asNumber;
  }

  const response = await fetchTaxaQuery({
    q: trimmed,
    limit: 1,
    offset: 0,
  });
  const top = response.results[0];
  const resolved =
    typeof top?.taxon_id === 'number' ? top.taxon_id : Number(top?.taxon_id);
  return Number.isFinite(resolved) ? resolved : null;
};
