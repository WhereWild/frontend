import { fetchSpeciesList } from '@/data/api';
import { mapSpeciesApiNormalizedToSummary } from '@/data/speciesSummaryMapper';
import type { SpeciesApiNormalized, SpeciesSummary } from '@/data/types';
import type { SelectOption } from '@/components';

export const RANK_OPTIONS: SelectOption[] = [
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
export const DEFAULT_MINIMUM_SAMPLES = 10;
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

export const toMetricLabel = (metric: string) => METRIC_LABELS[metric] ?? metric;

export const toVariableOptions = (variables: { id: string; name?: string }[]): SelectOption[] =>
  variables.map((variable) => ({
    label: variable.name ?? variable.id,
    value: variable.id,
  }));

export const deriveLocationGid = (countryValue: string, stateValue: string, countyValue: string) =>
  countyValue || stateValue || countryValue || null;

export const toRankingFilterHint = (
  ancestorTaxonId: number | null,
  sortVariableValue: string,
  sortMetricValue: string,
) => {
  if (!ancestorTaxonId) {
    return 'Location, rank, and sort filters apply after choosing a Base taxon.';
  }

  if (!sortVariableValue) {
    return 'Choose a Sort variable to apply ranking-based filters.';
  }

  if (!sortMetricValue) {
    return 'Choose a Sorting metric to apply ranking-based filters.';
  }

  return null;
};

export const resolveAncestorTaxonId = async (query: string): Promise<number | null> => {
  const trimmed = query.trim();
  if (!trimmed.length) {
    return null;
  }

  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    return asNumber;
  }

  const matches = await fetchSpeciesList(1, trimmed);
  const top = matches[0];
  const resolved = typeof top?.taxon_id === 'number' ? top.taxon_id : Number(top?.taxon_id);
  return Number.isFinite(resolved) ? resolved : null;
};

export const normalizedToSummary = (entry: SpeciesApiNormalized): SpeciesSummary | null => {
  return mapSpeciesApiNormalizedToSummary(entry, {
    includeRawDescription: false,
    fallbackDescription: '',
  });
};
