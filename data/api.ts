import type {
  EnvironmentSliceParams,
  PredictHeatmapJobCancelResponse,
  PredictHeatmapJobCreateResponse,
  PredictHeatmapJobEvent,
  PredictHeatmapJobRequest,
  SpeciesApiDetail,
} from './types';
import { parseSpeciesApiDetail } from './speciesDetailParser';
import { BACKEND_BASE, fetchJsonOrThrow } from './apiShared';
import {
  fetchRelativeRankingOptions as fetchRelativeRankingOptionsHelper,
  fetchRelativeRankings as fetchRelativeRankingsHelper,
  type RelativeRankingOptionsParams,
  type RelativeRankingParams,
} from './apiRankingHelpers';
import { fetchSpeciesList as fetchSpeciesListHelper, normalizeToJsonShape } from './apiSpeciesSearchHelpers';
import type { SearchFilterParams } from './apiSpeciesSearchHelpers';
import { fetchEnvironmentVariables as fetchEnvironmentVariablesHelper } from './apiVariableHelpers';
import {
  fetchLocations as fetchLocationsHelper,
  fetchLocationsByHierarchy as fetchLocationsByHierarchyHelper,
  fetchSpeciesLocations as fetchSpeciesLocationsHelper,
  type LocationLevel,
} from './apiLocationHelpers';
import {
  fetchEnvironmentRangeSlice as fetchEnvironmentRangeSliceHelper,
  createPredictHeatmapJob as createPredictHeatmapJobHelper,
  deletePredictHeatmapJob as deletePredictHeatmapJobHelper,
  fetchSpeciesEnvironment as fetchSpeciesEnvironmentHelper,
  fetchSpeciesEnvironmentCategorySamples as fetchSpeciesEnvironmentCategorySamplesHelper,
  fetchSpeciesPredictHeatmap as fetchSpeciesPredictHeatmapHelper,
  fetchSpeciesOccurrences as fetchSpeciesOccurrencesHelper,
  streamPredictHeatmapJob as streamPredictHeatmapJobHelper,
} from './apiEnvironmentHelpers';

/** Public backend base URL used by app-level data fetchers. */
export { BACKEND_BASE };

/**
 * Searches locations with optional hierarchy constraints.
 */
export async function fetchLocationsByHierarchy(
  query: string,
  level?: LocationLevel,
  parent?: string, // parent name(s) or gid; for multiple parents use 'Country|State'
  limit = 50,
) {
  return fetchLocationsByHierarchyHelper(query, level, parent, limit);
}

/**
 * Searches locations by free-text query.
 */
export async function fetchLocations(query: string, limit = 8) {
  return fetchLocationsHelper(query, limit);
}


/** Filter parameters for species list/search requests. */
export type { SearchFilterParams };

/**
 * Fetches species rows for search and list surfaces.
 */
export async function fetchSpeciesList(limit?: number, q?: string, filters?: SearchFilterParams) {
  return fetchSpeciesListHelper(limit, q, filters);
}

/**
 * Fetches and normalizes a single species detail payload.
 */
export async function fetchSpeciesByTaxonId(
  taxonId: string | number,
  options?: { units?: string | null },
): Promise<SpeciesApiDetail> {
  const encoded = encodeURIComponent(String(taxonId));
  const params = new URLSearchParams();
  if (options?.units) {
    params.set('unit_system', options.units);
  }
  const query = params.toString();
  const url = `${BACKEND_BASE}/api/species/${encoded}${query ? `?${query}` : ''}`;
  const item = await fetchJsonOrThrow(url, `Failed to fetch species ${taxonId}`);
  const normalized = normalizeToJsonShape(item);
  return parseSpeciesApiDetail(item, normalized);
}

/**
 * Lists environment variables and metadata.
 */
export async function fetchEnvironmentVariables(options?: { units?: string | null }) {
  return fetchEnvironmentVariablesHelper(options);
}

/**
 * Fetches environment stats for one species and variable.
 */
export async function fetchSpeciesEnvironment(
  taxonId: string | number,
  variableId: string,
  options?: { location?: string | null; units?: string | null },
) {
  return fetchSpeciesEnvironmentHelper(taxonId, variableId, options);
}

/** Public query params for ranking endpoints. */
export type { RelativeRankingParams, RelativeRankingOptionsParams };

/**
 * Lists available ranking options for a taxon/rank.
 */
export async function fetchRelativeRankingOptions(params: RelativeRankingOptionsParams) {
  return fetchRelativeRankingOptionsHelper(params);
}

/**
 * Fetches ranked descendants for a taxon/rank/metric query.
 */
export async function fetchRelativeRankings(params: RelativeRankingParams) {
  return fetchRelativeRankingsHelper(params);
}

/** Public query params for numeric environment slice requests. */
export type { EnvironmentSliceParams } from './types';

/**
 * Fetches observations constrained by numeric min/max bounds.
 */
export async function fetchEnvironmentRangeSlice(
  params: EnvironmentSliceParams,
) {
  return fetchEnvironmentRangeSliceHelper(params);
}


/**
 * Fetches observations for a categorical class value.
 */
export async function fetchSpeciesEnvironmentCategorySamples(
  taxonId: string | number,
  variableId: string,
  classValue: string | number,
  options?: { limit?: number; location?: string | null; units?: string | null },
) {
  return fetchSpeciesEnvironmentCategorySamplesHelper(taxonId, variableId, classValue, options);
}

/**
 * Fetches species occurrence coordinates with optional location filtering.
 */
export async function fetchSpeciesOccurrences(
  taxonId: string | number,
  options?: { location?: string | null; units?: string | null },
) {
  return fetchSpeciesOccurrencesHelper(taxonId, options);
}

/**
 * Fetches predicted heatmap cells for a species across a bounding box.
 */
export async function fetchSpeciesPredictHeatmap(
  speciesKey: string | number,
  bounds: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  },
) {
  return fetchSpeciesPredictHeatmapHelper(speciesKey, bounds);
}

/**
 * Creates a cancellable heatmap job resource.
 */
export async function createPredictHeatmapJob(
  request: PredictHeatmapJobRequest,
): Promise<PredictHeatmapJobCreateResponse> {
  return createPredictHeatmapJobHelper(request);
}

/**
 * Streams NDJSON events for a heatmap job.
 */
export async function streamPredictHeatmapJob(
  jobId: string,
  options?: {
    signal?: AbortSignal;
    onEvent?: (event: PredictHeatmapJobEvent) => void;
  },
) {
  return streamPredictHeatmapJobHelper(jobId, options);
}

/**
 * Cancels a heatmap job.
 */
export async function deletePredictHeatmapJob(
  jobId: string,
): Promise<PredictHeatmapJobCancelResponse> {
  return deletePredictHeatmapJobHelper(jobId);
}

/**
 * Fetches known locations for a species with optional level and parent filters.
 */
export async function fetchSpeciesLocations(
  taxonId: string | number,
  level?: LocationLevel,
  parent?: string,
  limit = 500,
) {
  return fetchSpeciesLocationsHelper(taxonId, level, parent, limit);
}
