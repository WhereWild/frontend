// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BACKEND_BASE } from '@/data/apiShared';
import type { SearchTaxaQueryFilters } from '@/data/apiTaxaQueryHelpers';
import type {
  SpeciesSummary,
  TaxaQueryResponse,
  TaxaQueryResult,
} from '@/data/types';
import { mapSpeciesApiNormalizedToSummary } from '@/data/speciesSummaryMapper';

export const hasValidQueryParams = (
  filterParams?: SearchTaxaQueryFilters,
  hasQuery = false,
) => {
  const withinTaxonId = filterParams?.withinTaxonId;
  const descendantRank = filterParams?.descendantRank;
  const hasSortFields =
    typeof filterParams?.sortVariable === 'string' &&
    filterParams.sortVariable.length > 0 &&
    typeof filterParams?.sortMetric === 'string' &&
    filterParams.sortMetric.length > 0;
  const hasScopedRank =
    typeof descendantRank === 'string' && descendantRank.trim().length > 0;

  return (
    hasSortFields &&
    ((typeof withinTaxonId === 'number' &&
      Number.isFinite(withinTaxonId) &&
      hasScopedRank) ||
      hasQuery)
  );
};

const toNonEmptyTrimmedString = (value?: string | null) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDisplayName = (value?: string | null) => {
  const trimmed = toNonEmptyTrimmedString(value);
  return trimmed ? trimmed.replace(/_/g, ' ') : null;
};

const formatMetricNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return Number(value.toFixed(3)).toString();
};


const normalizeUnitLabel = (units?: string | null) => {
  const raw = toNonEmptyTrimmedString(units);
  if (!raw) {
    return null;
  }

  const lowered = raw.toLowerCase();
  if (lowered === 'c' || lowered === 'degc' || lowered === 'celsius') {
    return 'degC';
  }
  if (lowered === 'f' || lowered === 'degf' || lowered === 'fahrenheit') {
    return 'degF';
  }
  return raw;
};

const buildRankedDescription = (
  entry: {
    value?: number | null;
    position?: number | null;
    count?: number | null;
    sampleCount?: number | null;
  },
  totalResults?: number | null,
  units?: string | null,
  sortOrder?: string | null,
) => {
  const normalizedUnits = normalizeUnitLabel(units);
  const valuePart =
    typeof entry.value === 'number' && Number.isFinite(entry.value)
      ? `${formatMetricNumber(entry.value)}${normalizedUnits ? ` ${normalizedUnits}` : ''}`
      : null;

  const rankPart =
    typeof entry.position === 'number' &&
    Number.isFinite(entry.position) &&
    typeof totalResults === 'number' &&
    Number.isFinite(totalResults) &&
    totalResults > 0
      ? `Rank ${Math.trunc(entry.position)} of ${Math.trunc(totalResults)}`
      : null;

  const percentilePercentage =
    rankPart &&
    typeof entry.position === 'number' &&
    typeof totalResults === 'number' &&
    totalResults > 0
      ? sortOrder === 'desc'
        ? Math.max(0, Math.min(100, ((totalResults - entry.position) / totalResults) * 100))
        : Math.max(0, Math.min(100, ((entry.position - 1) / totalResults) * 100))
      : null;
  const percentilePart =
    typeof percentilePercentage === 'number'
      ? `Percentile ${Number(percentilePercentage.toFixed(2))}%`
      : null;

  const sampleValue =
    typeof entry.sampleCount === 'number' && Number.isFinite(entry.sampleCount)
      ? entry.sampleCount
      : typeof entry.count === 'number' && Number.isFinite(entry.count)
        ? entry.count
        : null;
  const samplePart =
    typeof sampleValue === 'number'
      ? `${formatMetricNumber(sampleValue)} samples`
      : null;

  const parts = [valuePart, rankPart, percentilePart, samplePart].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(' | ') : 'Tap to view species details';
};

const resolveImageUri = (entry: {
  image_source?: string | null;
  image_url?: string | null;
  image_file?: string | null;
}) => {
  const directImageSource = toNonEmptyTrimmedString(entry.image_source);
  if (directImageSource) {
    return directImageSource;
  }

  const directImageUrl = toNonEmptyTrimmedString(entry.image_url);
  if (directImageUrl) {
    return directImageUrl;
  }

  if (typeof entry.image_file !== 'string') {
    return null;
  }

  const imageFileName =
    entry.image_file
      .trim()
      .replace(/^images\//, '')
      .split(/[\\/]/)
      .filter(Boolean)
      .pop() ?? '';
  if (!imageFileName) {
    return null;
  }

  return `${BACKEND_BASE}/static/species_images/${encodeURIComponent(imageFileName)}`;
};

const isRankedTaxaQuery = (payload: TaxaQueryResponse) => {
  return (
    typeof payload.sort.variable === 'string' &&
    payload.sort.variable.length > 0 &&
    typeof payload.sort.metric === 'string' &&
    payload.sort.metric.length > 0
  );
};

export const hasExplicitMinimumSamplesFilter = (
  filterParams?: SearchTaxaQueryFilters,
) => {
  return (
    typeof filterParams?.minSamples === 'number' && filterParams.minSamples > 0
  );
};

const appendSampleCountToDescription = (
  description: string,
  sampleCount?: number | null,
) => {
  if (typeof sampleCount !== 'number' || !Number.isFinite(sampleCount)) {
    return description;
  }

  const samplePart = `${formatMetricNumber(sampleCount)} samples`;
  return description ? `${description} | ${samplePart}` : samplePart;
};

export const buildEmptyStateContext = (
  payload: TaxaQueryResponse,
  query: string,
  hasMinSamples = false,
) => {
  const minSamplesHint = hasMinSamples
    ? ' Some species may be hidden by the minimum sample count.'
    : '';
  switch (payload.emptyReason) {
    case 'ranking_ineligible':
      return query
        ? `Taxa matched "${query}", but none were eligible for ranking with the selected filters.${minSamplesHint}`
        : `No ranked taxa matched the selected filters.${minSamplesHint}`;
    case 'filtered_out':
      return query
        ? `No taxa matched "${query}" after applying the selected filters.${minSamplesHint}`
        : `No taxa matched the selected filters.${minSamplesHint}`;
    case 'no_text_matches':
      return query ? `No taxa matched "${query}".` : null;
    case 'no_query':
      return null;
    default:
      return query ? `No taxa matched "${query}".` : null;
  }
};

export const mapTaxaQueryResultToSummary = (
  entry: TaxaQueryResult,
  payload: TaxaQueryResponse,
  hasMinimumSamplesFilter = false,
): SpeciesSummary | null => {
  const taxonId =
    typeof entry.taxon_id === 'number'
      ? entry.taxon_id
      : Number(entry.taxon_id);
  if (!Number.isFinite(taxonId)) {
    return null;
  }

  const scientificName =
    normalizeDisplayName(entry.scientific_name) ?? `Taxon #${taxonId}`;
  const commonName = normalizeDisplayName(entry.common_name) ?? scientificName;
  const description = isRankedTaxaQuery(payload)
    ? buildRankedDescription(
        {
          value: entry.sort_value,
          count: entry.count,
          position: entry.position,
          sampleCount: entry.sample_count,
        },
        payload.eligibleTotal,
        payload.sort.units,
        payload.sort.order,
      )
    : appendSampleCountToDescription(
        mapSpeciesApiNormalizedToSummary(entry, {
          includeRawDescription: false,
          fallbackDescription: '',
        })?.description ?? '',
        hasMinimumSamplesFilter ? entry.sample_count : null,
      );

  const imageUri = resolveImageUri({
    image_source: entry.image_source,
    image_url: entry.image_url,
    image_file: entry.image_file,
  });

  return {
    taxonId,
    commonName,
    commonNames: [commonName],
    scientificName,
    description,
    imageSource: imageUri ? { uri: imageUri } : undefined,
  };
};
