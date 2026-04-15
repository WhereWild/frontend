import type {
  DataSource,
  EnvironmentSliceParams,
  SpeciesApiDetail,
  SpeciesApiNormalized,
} from './types';
import { parseSpeciesApiDetail } from './speciesDetailParser';
import { BACKEND_BASE, fetchJsonOrThrow } from './apiShared';
import {
  fetchRelativeRankingOptions as fetchRelativeRankingOptionsHelper,
  type FetchRelativeRankingOptionsOptions,
  type RelativeRankingOptionsParams,
} from './apiRankingHelpers';
import {
  buildTaxaQuerySearchParams,
  fetchTaxaQuery as fetchTaxaQueryHelper,
  type FetchTaxaQueryOptions,
  type SearchTaxaQueryFilters,
  type TaxaQueryParams,
} from './apiTaxaQueryHelpers';
import { normalizeToJsonShape } from './apiSpeciesSearchHelpers';
import { fetchEnvironmentVariables as fetchEnvironmentVariablesHelper } from './apiVariableHelpers';
import type { FetchEnvironmentVariablesOptions } from './apiVariableHelpers';
import {
  fetchLocationByGid as fetchLocationByGidHelper,
  fetchLocations as fetchLocationsHelper,
  fetchLocationsByHierarchy as fetchLocationsByHierarchyHelper,
  fetchSpeciesLocations as fetchSpeciesLocationsHelper,
  type LocationLevel,
} from './apiLocationHelpers';
import {
  fetchEnvironmentRangeSlice as fetchEnvironmentRangeSliceHelper,
  fetchSpeciesEnvironment as fetchSpeciesEnvironmentHelper,
  fetchSpeciesEnvironmentCategorySamples as fetchSpeciesEnvironmentCategorySamplesHelper,
  fetchSpeciesOccurrences as fetchSpeciesOccurrencesHelper,
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

const parseFilenameFromContentDisposition = (
  contentDisposition: string | null,
): string | null => {
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
    formData.append(fieldName, {
      uri: file.uri,
      name: filename ?? file.name,
      type: file.type ?? 'application/octet-stream',
    } as unknown as Blob);
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
export { fetchPointEnvironmentValue } from './apiPointLookup';
export type { PointEnvironmentResult } from './apiPointLookup';

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

/**
 * Fetches canonical hierarchy metadata for a single location gid.
 */
export async function fetchLocationByGid(
  gid: string,
  options?: { signal?: AbortSignal },
) {
  return fetchLocationByGidHelper(gid, options);
}

/** Shared filter parameters forwarded to the unified taxa query endpoint. */
export type { SearchTaxaQueryFilters };
export type { TaxaQueryParams };
export type { FetchTaxaQueryOptions };
export { buildTaxaQuerySearchParams };

/**
 * Returns per-taxon average probability scores for the given viewport bbox.
 */
export interface ViewportScoresResult {
  scores: Record<string, number>;
  reasons: Record<string, string[]>;
}

export interface ViewportTileRange {
  z: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export async function fetchViewportScores(
  bounds: ViewportTileRange,
): Promise<ViewportScoresResult> {
  const { z, x0, y0, x1, y1 } = bounds;
  const url = `${BACKEND_BASE}/api/heatmap/homepage/scores?z=${z}&x0=${x0}&y0=${y0}&x1=${x1}&y1=${y1}`;
  const data = await fetchJsonOrThrow(url, 'Failed to fetch viewport scores');
  return {
    scores: (data as any).scores ?? {},
    reasons: (data as any).reasons ?? {},
  };
}

/**
 * Returns basic species info for every taxon that has a trained SDM model.
 */
export async function fetchSpeciesWithModels(): Promise<
  SpeciesApiNormalized[]
> {
  const url = `${BACKEND_BASE}/api/species/with-models`;
  const items = await fetchJsonOrThrow(
    url,
    'Failed to fetch species with models',
  );
  return (items as unknown[]).map((item) => normalizeToJsonShape(item));
}

/**
 * Fetches unified taxa query results for text search and ranked search surfaces.
 */
export async function fetchTaxaQuery(
  params: TaxaQueryParams,
  options?: FetchTaxaQueryOptions,
) {
  return fetchTaxaQueryHelper(params, options);
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
  const item = await fetchJsonOrThrow(
    url,
    `Failed to fetch species ${taxonId}`,
  );
  const normalized = normalizeToJsonShape(item);
  return parseSpeciesApiDetail(item, normalized);
}

/**
 * Lists environment variables and metadata.
 */
export async function fetchEnvironmentVariables(
  options?: FetchEnvironmentVariablesOptions,
) {
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

/** Public query params for ranking option endpoints. */
export type { RelativeRankingOptionsParams };
export type {
  FetchEnvironmentVariablesOptions,
  FetchRelativeRankingOptionsOptions,
};

/**
 * Lists available ranking options for a taxon/rank.
 */
export async function fetchRelativeRankingOptions(
  params: RelativeRankingOptionsParams,
  options?: FetchRelativeRankingOptionsOptions,
) {
  return fetchRelativeRankingOptionsHelper(params, options);
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
  return fetchSpeciesEnvironmentCategorySamplesHelper(
    taxonId,
    variableId,
    classValue,
    options,
  );
}

/**
 * Fetches structured citation metadata for all environmental data sources.
 */
export async function fetchDataSources(): Promise<Record<string, DataSource>> {
  const url = `${BACKEND_BASE}/data-sources`;
  const data = await fetchJsonOrThrow(url, 'Failed to fetch data sources');
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, DataSource>;
  }
  return {};
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
    throw new Error(
      `Failed to upload file: ${response.status}${errorBody ? ` ${errorBody}` : ''}`,
    );
  }

  return {
    blob: await response.blob(),
    filename: parseFilenameFromContentDisposition(
      response.headers.get('content-disposition'),
    ),
    contentType: response.headers.get('content-type'),
    status: response.status,
  };
}
