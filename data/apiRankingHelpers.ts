import type {
  RelativeRankingEntry,
  RelativeRankingOption,
  RelativeRankingOptionsResponse,
  RelativeRankingResponse,
} from './types';
import { toFiniteNumber } from './environmentParsers';
import {
  BACKEND_BASE,
  asRecord,
  fetchJsonOrThrow,
  toOptionalString,
  toRequiredNumber,
  toRequiredString,
} from './apiShared';

/** Normalizes a raw relative-ranking row into the typed client entry shape. */
const normalizeRelativeRankingEntry = (entry: unknown): RelativeRankingEntry => {
  const source = asRecord(entry);
  const taxonIdRaw = source.taxon_id ?? source.taxonId ?? source.id;
  const sampleCountRaw = source.sample_count ?? source.sampleCount ?? source.count;

  return {
    taxonId:
      typeof taxonIdRaw === 'number' || typeof taxonIdRaw === 'string'
        ? taxonIdRaw
        : String(taxonIdRaw ?? ''),
    scientificName: toOptionalString(source.scientific_name ?? source.scientificName),
    commonName: toOptionalString(source.common_name ?? source.commonName),
    imageUrl: toOptionalString(source.image_url ?? source.imageUrl),
    imageFile: toOptionalString(
      source.image_file ?? source.imageFile ?? source.image_file_name ?? source.imageFileName,
    ),
    imageSource: toOptionalString(source.image_source ?? source.imageSource),
    rank: toOptionalString(source.rank ?? source.taxon_rank),
    value: toFiniteNumber(source.value),
    position: toRequiredNumber(source.position, 0),
    percentile: toFiniteNumber(source.percentile),
    count: toRequiredNumber(source.count, 0),
    sampleCount: toFiniteNumber(sampleCountRaw),
  };
};

/** Query params for relative rankings requests. */
export type RelativeRankingParams = {
  taxonId: number | string;
  rank: string;
  variableId: string;
  metric: string;
  units?: string | null;
  limit?: number;
  order?: 'asc' | 'desc';
  minSamples?: number;
  includeSpeciesLike?: boolean;
  location?: string | null;
};

/** Query params for ranking options requests. */
export type RelativeRankingOptionsParams = {
  taxonId: number | string;
  rank: string;
};

/**
 * Fetches available ranking variable/metric combinations for a taxon and rank.
 */
export async function fetchRelativeRankingOptions(
  params: RelativeRankingOptionsParams,
): Promise<RelativeRankingOptionsResponse> {
  const { taxonId, rank } = params;
  const encoded = encodeURIComponent(String(taxonId));
  const query = new URLSearchParams({ rank });
  const url = `${BACKEND_BASE}/relative-rankings/${encoded}/options?${query.toString()}`;
  const payload = asRecord(await fetchJsonOrThrow(url, 'Failed to fetch relative ranking options'));
  const options: RelativeRankingOption[] = Array.isArray(payload.options)
    ? payload.options
      .map((entry) => {
        const source = asRecord(entry);

        return {
          variable:
            typeof source.variable === 'string' ? source.variable : String(source.variable ?? '').trim(),
          metric:
            typeof source.metric === 'string' ? source.metric : String(source.metric ?? '').trim(),
          column:
            typeof source.column === 'string' && source.column.length
              ? source.column
              : `${source.variable ?? ''}::${source.metric ?? ''}`,
          count: typeof source.count === 'number' ? source.count : Number(source.count ?? 0) || 0,
        };
      })
      .filter((entry) => entry.variable.length > 0 && entry.metric.length > 0)
    : [];
  return {
    ancestorTaxonId: toRequiredNumber(payload.ancestor_taxon_id, Number(taxonId)),
    rank: toRequiredString(payload.rank, rank),
    options,
  };
}

/**
 * Fetches ranked descendant rows for a variable/metric query.
 */
export async function fetchRelativeRankings(
  params: RelativeRankingParams,
): Promise<RelativeRankingResponse> {
  const {
    taxonId,
    rank,
    variableId,
    metric,
    units,
    limit,
    order,
    minSamples,
    includeSpeciesLike,
    location,
  } = params;
  const encoded = encodeURIComponent(String(taxonId));
  const query = new URLSearchParams({
    rank,
    variable: variableId,
    metric,
  });
  if (limit) {
    query.set('limit', String(limit));
  }
  if (order) {
    query.set('order', order);
  }
  if (minSamples) {
    query.set('min_samples', String(minSamples));
  }
  if (includeSpeciesLike) {
    query.set('include_species_like', 'true');
  }
  if (location) {
    query.set('location', location);
  }
  if (units) {
    query.set('unit_system', units);
  }
  const url = `${BACKEND_BASE}/relative-rankings/${encoded}?${query.toString()}`;
  const payload = asRecord(await fetchJsonOrThrow(url, 'Failed to fetch relative rankings'));
  const entries = Array.isArray(payload.entries)
    ? payload.entries.map(normalizeRelativeRankingEntry)
    : [];
  const distributionSource = asRecord(payload.distribution);
  const distribution =
    Array.isArray(distributionSource.points) &&
      Array.isArray(distributionSource.density)
      ? {
        points: distributionSource.points,
        density: distributionSource.density,
      }
      : null;
  return {
    ancestorTaxonId: toRequiredNumber(payload.ancestor_taxon_id, Number(taxonId)),
    rank: toRequiredString(payload.rank, rank),
    variable: toRequiredString(payload.variable, variableId),
    units: toOptionalString(payload.units ?? payload.variable_units ?? payload.unit),
    metric: toRequiredString(payload.metric, metric),
    total: typeof payload.total === 'number' ? payload.total : entries.length,
    limit: typeof payload.limit === 'number' ? payload.limit : limit ?? entries.length,
    entries,
    order: payload.order === 'desc' ? 'desc' : 'asc',
    minSamples: typeof payload.min_samples === 'number' ? payload.min_samples : minSamples,
    includeSpeciesLike:
      typeof payload.include_species_like === 'boolean'
        ? payload.include_species_like
        : includeSpeciesLike ?? false,
    distribution,
  };
}