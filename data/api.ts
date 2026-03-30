import type {
  EnvironmentSliceParams,
  PredictHeatmapJobCancelResponse,
  PredictHeatmapJobCreateResponse,
  PredictHeatmapJobEvent,
  PredictHeatmapJobRequest,
  SpeciesApiDetail,
  SpeciesHeatmapMetadata,
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
  fetchSpeciesHeatmapMetadata as fetchSpeciesHeatmapMetadataHelper,
  fetchSpeciesPredictHeatmap as fetchSpeciesPredictHeatmapHelper,
  fetchSpeciesOccurrences as fetchSpeciesOccurrencesHelper,
  streamPredictHeatmapJob as streamPredictHeatmapJobHelper,
} from './apiEnvironmentHelpers';

export type UploadFileValue =
  | File
  | Blob
  | {
    uri: string;
    name: string;
    type?: string;
  };

export type UploadFileParams = {
  file: UploadFileValue;
  fieldName?: string;
  filename?: string;
  endpoint?: string;
};

export type UploadFileResponse = {
  blob: Blob;
  filename: string | null;
  contentType: string | null;
  status: number;
};

const resolveUploadEndpoint = (endpoint: string) =>
  endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${BACKEND_BASE}${endpoint}`;

const parseFilenameFromContentDisposition = (contentDisposition: string | null): string | null => {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
};

const appendUploadPayload = (
  formData: FormData,
  fieldName: string,
  file: UploadFileValue,
  filename?: string,
) => {
  if ('uri' in file) {
    formData.append(
      fieldName,
      {
        uri: file.uri,
        name: filename ?? file.name,
        type: file.type ?? 'application/octet-stream',
      } as unknown as Blob,
    );
    return;
  }

  if (typeof File !== 'undefined' && file instanceof File) {
    formData.append(fieldName, file, filename ?? file.name);
    return;
  }

  formData.append(fieldName, file, filename);
};

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
 * Fetches tile-backed heatmap metadata for a species.
 */
export async function fetchSpeciesHeatmapMetadata(
  speciesKey: string | number,
): Promise<SpeciesHeatmapMetadata> {
  return fetchSpeciesHeatmapMetadataHelper(speciesKey);
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

/**
 * Uploads a file to the backend upload endpoint and returns the binary file response.
 */
export async function uploadRawObservations(
  params: UploadFileParams,
): Promise<UploadFileResponse> {
  const fieldName = params.fieldName ?? 'file';
  const endpoint = resolveUploadEndpoint('/upload/raw-observations');
  const formData = new FormData();

  appendUploadPayload(formData, fieldName, params.file, params.filename);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Failed to upload file: ${response.status}${errorBody ? ` ${errorBody}` : ''}`);
  }

  return {
    blob: await response.blob(),
    filename: parseFilenameFromContentDisposition(response.headers.get('content-disposition')),
    contentType: response.headers.get('content-type'),
    status: response.status,
  };
}
