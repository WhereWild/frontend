import type {
  RelativeRankingEntry,
  RelativeRankingOption,
  RelativeRankingOptionsResponse,
  RelativeRankingResponse,
  SpeciesApiDetail,
  SpeciesApiNormalized,
  SpeciesEnvironmentCategorySampleResponse,
  SpeciesEnvironmentSliceResponse,
  SpeciesEnvironmentStats,
  LocationSearchResult,
  SpeciesOccurrence,
  SpeciesHeatmapResponse,
} from './types';
import { normalizeCommonNames } from './commonNames';
import {
  parseEnvironmentCategorySampleResponse,
  parseEnvironmentSliceResponse,
  parseEnvironmentVariableDefinitions,
  parseSpeciesEnvironmentStats,
  toFiniteNumber,
} from './environmentParsers';

const ENV_BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export const BACKEND_BASE = ENV_BACKEND_BASE || 'http://localhost:8000';

type JsonRecord = Record<string, unknown>;

const LEVEL_NAME_TO_NUM: Record<string, number> = {
  continent: -1,
  country: 0,
  state: 1,
  county: 2,
};

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' ? (value as JsonRecord) : {};

const parseNumericTaxonId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toOptionalString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const toRequiredString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const toRequiredNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readErrorText = async (response: Response) => response.text().catch(() => '');

const fetchJsonOrThrow = async (url: string, failureLabel: string): Promise<unknown> => {
  const response = await fetch(url);
  if (!response.ok) {
    const txt = await readErrorText(response);
    throw new Error(`${failureLabel}: ${response.status} ${txt}`);
  }

  return response.json();
};

const toLocationSearchResult = (entry: unknown): LocationSearchResult | null => {
  const source = asRecord(entry);
  const gid = String(source.gid ?? '').trim();
  const name = typeof source.name === 'string' ? source.name : '';

  if (!gid.length || !name.length) {
    return null;
  }

  return {
    gid,
    name,
    level: typeof source.level === 'number' ? source.level : Number(source.level ?? -1),
    hierarchy: Array.isArray(source.hierarchy)
      ? source.hierarchy.map((item) => String(item ?? '')).filter(Boolean)
      : [],
  };
};

const mapLocationSearchResults = (payload: unknown): LocationSearchResult[] => {
  const source = asRecord(payload);
  const results = Array.isArray(source.results) ? source.results : [];

  return results
    .map(toLocationSearchResult)
    .filter((entry): entry is LocationSearchResult => Boolean(entry));
};

const setLocationLevelParam = (
  params: URLSearchParams,
  level?: 'continent' | 'country' | 'state' | 'county' | number,
) => {
  if (typeof level === 'string') {
    const maybe = LEVEL_NAME_TO_NUM[level.toLowerCase()];
    if (typeof maybe === 'number') {
      params.set('level', String(maybe));
    }
    return;
  }

  if (typeof level === 'number') {
    params.set('level', String(level));
  }
};

/**
 * Normalize a backend species item into the `SpeciesApiNormalized` shape,
 * ensuring `image_source` is a full URL to the static image (suitable for RN <Image>)
 * and normalizing name fields like `scientific_name`, `common_name`, and `common_names`.
 */
function normalizeToJsonShape(item: unknown): SpeciesApiNormalized {
  const source = asRecord(item);
  const normalizedTaxonId = parseNumericTaxonId(source.taxon_id);
  // prefer full URL returned by backend
  const imageUrlFromBackend =
    (typeof source.image_url === 'string' ? source.image_url : null) ??
    (typeof source.imageUrl === 'string' ? source.imageUrl : null);
  // fallback: try image_file (basename) and construct URL
  const imageFile =
    (typeof source.image_file === 'string' ? source.image_file : null) ??
    (typeof source.image_file_name === 'string' ? source.image_file_name : null);
  const imageFileName = imageFile
    ? imageFile
      .replace(/^images\//, '')
      .split(/[\\/]/)
      .filter(Boolean)
      .pop() ?? ''
    : '';
  const imageUrl = imageUrlFromBackend ?? (imageFile
    ? `${BACKEND_BASE}/static/species_images/${encodeURIComponent(imageFileName)}`
    : null);
  const sciName = typeof source.scientific_name === 'string' ? source.scientific_name.trim() : '';

  const commonNames = normalizeCommonNames(source.common_names ?? source.commonNames);

  const rawCommon = source.common_name ?? source.commonName ?? commonNames[0] ?? null;

  const commonName =
    typeof rawCommon === 'string' && rawCommon.trim().length > 0
      ? rawCommon.trim()
      : sciName;
  return {
    taxon_id: normalizedTaxonId,
    scientific_name: sciName,
    common_name: commonName,
    common_names: commonNames,
    image_source: imageUrl,
    _raw: item,
  };
}

export async function fetchLocationsByHierarchy(
  query: string,
  level?: 'continent' | 'country' | 'state' | 'county' | number,
  parent?: string, // parent name(s) or gid; for multiple parents use 'Country|State'
  limit = 50,
): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();

  const params = new URLSearchParams({ q: trimmed });
  setLocationLevelParam(params, level);
  if (parent) params.set('parent', parent);
  params.set('limit', String(limit));

  const payload = await fetchJsonOrThrow(
    `${BACKEND_BASE}/locations/search_hierarchy?${params.toString()}`,
    'Failed to search locations by hierarchy',
  );

  return mapLocationSearchResults(payload);
}

export async function fetchLocations(query: string, limit = 8): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed.length) {
    return [];
  }
  const params = new URLSearchParams({ q: trimmed });
  if (limit) {
    params.set('limit', String(limit));
  }
  const payload = await fetchJsonOrThrow(
    `${BACKEND_BASE}/locations/search?${params.toString()}`,
    'Failed to search locations',
  );

  return mapLocationSearchResults(payload);
}


export async function fetchSpeciesList(limit?: number, q?: string): Promise<SpeciesApiNormalized[]> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (q) params.set('q', q);
  const url = `${BACKEND_BASE}/api/species${params.toString() ? `?${params.toString()}` : ''}`;

  const data = await fetchJsonOrThrow(url, 'Failed to fetch species list');
  const rows = Array.isArray(data) ? data : [];
  return rows.map((it) => normalizeToJsonShape(it));
}

export async function fetchSpeciesByTaxonId(taxonId: string | number): Promise<SpeciesApiDetail> {
  const encoded = encodeURIComponent(String(taxonId));
  const url = `${BACKEND_BASE}/api/species/${encoded}`;
  const item = await fetchJsonOrThrow(url, `Failed to fetch species ${taxonId}`);
  const normalized = normalizeToJsonShape(item);
  const detailSource = asRecord(item);
  return {
    ...normalized,
    description:
      typeof detailSource.description === 'string'
        ? detailSource.description
        : 'description pending',
    image_license:
      typeof detailSource.image_license === 'string'
        ? detailSource.image_license
        : (typeof detailSource.imageLicense === 'string' ? detailSource.imageLicense : null),
    image_creator:
      typeof detailSource.image_creator === 'string'
        ? detailSource.image_creator
        : (typeof detailSource.imageCreator === 'string' ? detailSource.imageCreator : null),
    image_rights_holder:
      typeof detailSource.image_rights_holder === 'string'
        ? detailSource.image_rights_holder
        : (typeof detailSource.imageRightsHolder === 'string'
          ? detailSource.imageRightsHolder
          : null),
    image_references:
      typeof detailSource.image_references === 'string'
        ? detailSource.image_references
        : (typeof detailSource.imageReferences === 'string' ? detailSource.imageReferences : null),
    taxonomyPath:
      typeof detailSource.taxonomy_path === 'string'
        ? detailSource.taxonomy_path
        : typeof detailSource.taxonomyPath === 'string'
          ? detailSource.taxonomyPath
          : null,
  };
}

export async function fetchEnvironmentVariables() {
  const url = `${BACKEND_BASE}/variables`;
  const payload = await fetchJsonOrThrow(url, 'Failed to fetch variables');
  return parseEnvironmentVariableDefinitions(payload);
}

type LocationOptions = {
  location?: string | null;
};

type HeatmapOptions = LocationOptions & {
  bbox?: string;
  zoom?: number;
  maxCells?: number;
  timeSlice?: string;
};

const parseBboxCsv = (bbox: string): { minLon: number; minLat: number; maxLon: number; maxLat: number } | null => {
  const parts = bbox.split(',').map((value) => Number(value.trim()));
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLon >= maxLon || minLat >= maxLat) {
    return null;
  }
  return { minLon, minLat, maxLon, maxLat };
};

export async function fetchSpeciesEnvironment(
  taxonId: string | number,
  variableId: string,
  options?: LocationOptions,
): Promise<SpeciesEnvironmentStats> {
  const encodedId = encodeURIComponent(String(taxonId));
  const encodedVariable = encodeURIComponent(variableId);
  const params = new URLSearchParams();
  if (options?.location) {
    params.set('location', options.location);
  }
  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}${query ? `?${query}` : ''}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch environment stats (${variableId}) for ${taxonId}`,
  );
  return parseSpeciesEnvironmentStats(payload, taxonId, variableId);
}

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
    rank: toOptionalString(source.rank ?? source.taxon_rank),
    value: toFiniteNumber(source.value),
    position: toRequiredNumber(source.position, 0),
    percentile: toFiniteNumber(source.percentile),
    count: toRequiredNumber(source.count, 0),
    sampleCount: toFiniteNumber(sampleCountRaw),
  };
};

export type RelativeRankingParams = {
  taxonId: number | string;
  rank: string;
  variableId: string;
  metric: string;
  limit?: number;
  order?: 'asc' | 'desc';
  minSamples?: number;
  includeSpeciesLike?: boolean;
  location?: string | null;
};

export type RelativeRankingOptionsParams = {
  taxonId: number | string;
  rank: string;
};

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

export async function fetchRelativeRankings(
  params: RelativeRankingParams,
): Promise<RelativeRankingResponse> {
  const {
    taxonId,
    rank,
    variableId,
    metric,
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

export type EnvironmentSliceParams = {
  taxonId: number | string;
  variableId: string;
  min: number;
  max: number;
  limit?: number;
  location?: string | null;
};

export async function fetchEnvironmentRangeSlice(
  params: EnvironmentSliceParams,
): Promise<SpeciesEnvironmentSliceResponse> {
  const { taxonId, variableId, min, max, limit, location } = params;
  const encodedId = encodeURIComponent(String(taxonId));
  const encodedVariable = encodeURIComponent(variableId);
  const query = new URLSearchParams({
    min: String(min),
    max: String(max),
  });
  if (typeof limit === 'number') {
    query.set('limit', String(limit));
  }
  if (location) {
    query.set('location', location);
  }
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}/slice?${query.toString()}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch environment slice (${variableId}) for ${taxonId}`,
  );
  return parseEnvironmentSliceResponse(payload, { taxonId, variableId, min, max, limit });
}

type CategorySampleOptions = {
  limit?: number;
  location?: string | null;
};

export async function fetchSpeciesEnvironmentCategorySamples(
  taxonId: string | number,
  variableId: string,
  classValue: string | number,
  options?: CategorySampleOptions,
): Promise<SpeciesEnvironmentCategorySampleResponse> {
  const encodedId = encodeURIComponent(String(taxonId));
  const encodedVariable = encodeURIComponent(variableId);
  const encodedClass = encodeURIComponent(String(classValue));
  const query = new URLSearchParams();
  if (typeof options?.limit === 'number') {
    query.set('limit', String(options.limit));
  }
  if (options?.location) {
    query.set('location', options.location);
  }
  const queryString = query.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}/class/${encodedClass}/samples${queryString ? `?${queryString}` : ''}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch samples for ${variableId}=${classValue}`,
  );
  return parseEnvironmentCategorySampleResponse(payload, { taxonId, variableId, classValue });
}

export async function fetchSpeciesOccurrences(
  taxonId: string | number,
  options?: LocationOptions,
): Promise<SpeciesOccurrence[]> {
  const encodedId = encodeURIComponent(String(taxonId));
  const params = new URLSearchParams();
  if (options?.location) {
    params.set('location', options.location);
  }
  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/occurrences${query ? `?${query}` : ''}`;
  const payload = asRecord(await fetchJsonOrThrow(url, `Failed to fetch occurrences for ${taxonId}`));
  const rows = Array.isArray(payload.occurrences) ? payload.occurrences : [];
  return rows
    .map((entry) => {
      const source = asRecord(entry);

      return {
        catalogNumber:
          source.catalogNumber ??
          source.catalog_number ??
          source.id ??
          source.catalog ??
          null,
        latitude: toFiniteNumber(source.latitude),
        longitude: toFiniteNumber(source.longitude),
      };
    })
    .filter(
      (entry): entry is { catalogNumber: string | number; latitude: number; longitude: number } =>
        typeof entry.latitude === 'number' && typeof entry.longitude === 'number',
    )
    .map((entry) => ({
      catalogNumber: entry.catalogNumber ?? '',
      latitude: entry.latitude,
      longitude: entry.longitude,
    }));
}

export async function fetchSpeciesHeatmap(
  taxonId: string | number,
  options?: HeatmapOptions,
): Promise<SpeciesHeatmapResponse> {
  const encodedId = encodeURIComponent(String(taxonId));
  const params = new URLSearchParams();
  if (options?.location) {
    params.set('location', options.location);
  }
  if (options?.bbox) {
    params.set('bbox', options.bbox);
  }
  if (typeof options?.zoom === 'number') {
    params.set('zoom', String(options.zoom));
  }
  if (typeof options?.maxCells === 'number') {
    params.set('max_cells', String(options.maxCells));
  }
  if (options?.timeSlice) {
    params.set('time_slice', options.timeSlice);
  }

  const query = params.toString();
  const parsedBbox = options?.bbox ? parseBboxCsv(options.bbox) : null;

  let dynamicUrl: string | null = null;
  if (parsedBbox) {
    const centerLat = (parsedBbox.minLat + parsedBbox.maxLat) / 2;
    const centerLon = (parsedBbox.minLon + parsedBbox.maxLon) / 2;
    const viewportWidthDeg = parsedBbox.maxLon - parsedBbox.minLon;
    const viewportHeightDeg = parsedBbox.maxLat - parsedBbox.minLat;

    const densityBase = Math.sqrt(Math.max(16, options?.maxCells ?? 4096));
    const density = Math.max(8, Math.min(220, Math.round(densityBase)));

    const dynamicParams = new URLSearchParams({
      center_lat: centerLat.toFixed(6),
      center_lon: centerLon.toFixed(6),
      viewport_width_deg: viewportWidthDeg.toFixed(6),
      viewport_height_deg: viewportHeightDeg.toFixed(6),
      density: String(density),
    });
    if (options?.timeSlice) {
      dynamicParams.set('time_slice', options.timeSlice);
    }
    dynamicUrl = `${BACKEND_BASE}/species/${encodedId}/inference-heatmap-dynamic?${dynamicParams.toString()}`;
  }

  const inferenceUrl = `${BACKEND_BASE}/species/${encodedId}/inference-heatmap${query ? `?${query}` : ''}`;
  const fallbackUrl = `${BACKEND_BASE}/species/${encodedId}/heatmap${query ? `?${query}` : ''}`;

  let payload: JsonRecord;
  try {
    if (dynamicUrl) {
      payload = asRecord(await fetchJsonOrThrow(dynamicUrl, `Failed to fetch heatmap for ${taxonId}`));
    } else {
      payload = asRecord(await fetchJsonOrThrow(inferenceUrl, `Failed to fetch heatmap for ${taxonId}`));
    }
  } catch {
    try {
      payload = asRecord(await fetchJsonOrThrow(inferenceUrl, `Failed to fetch heatmap for ${taxonId}`));
    } catch {
      payload = asRecord(await fetchJsonOrThrow(fallbackUrl, `Failed to fetch heatmap for ${taxonId}`));
    }
  }
  const cellsRaw = Array.isArray(payload.cells) ? payload.cells : [];

  const speciesId = toRequiredNumber(payload.speciesId, Number(taxonId) || 0);
  const zoom = toRequiredNumber(payload.zoom, options?.zoom ?? 5);
  const cellSizeDeg = toRequiredNumber(payload.cellSizeDeg, 1);
  const totalPoints = toRequiredNumber(payload.totalPoints, 0);
  const boundedPoints = toRequiredNumber(payload.boundedPoints, 0);
  const maxIntensity = toRequiredNumber(payload.maxIntensity, 0);

  const bboxSource = asRecord(payload.bbox);
  const bbox = Object.keys(bboxSource).length
    ? {
      minLon: toRequiredNumber(bboxSource.minLon, -180),
      minLat: toRequiredNumber(bboxSource.minLat, -90),
      maxLon: toRequiredNumber(bboxSource.maxLon, 180),
      maxLat: toRequiredNumber(bboxSource.maxLat, 90),
    }
    : undefined;

  const cells = cellsRaw
    .map((entry) => {
      const source = asRecord(entry);
      return {
        lat: toFiniteNumber(source.lat),
        lon: toFiniteNumber(source.lon),
        count: toRequiredNumber(source.count, 0),
        intensity: toRequiredNumber(source.intensity, 0),
      };
    })
    .filter(
      (entry): entry is { lat: number; lon: number; count: number; intensity: number } =>
        typeof entry.lat === 'number' &&
        typeof entry.lon === 'number' &&
        Number.isFinite(entry.lat) &&
        Number.isFinite(entry.lon),
    );

  return {
    speciesId,
    zoom,
    cellSizeDeg,
    totalPoints,
    boundedPoints,
    maxIntensity,
    bbox,
    cells,
  };
}

export async function fetchSpeciesLocations(
  taxonId: string | number,
  level?: 'continent' | 'country' | 'state' | 'county' | number,
  parent?: string,
  limit = 500,
): Promise<LocationSearchResult[]> {
  const encodedId = encodeURIComponent(String(taxonId));
  const params = new URLSearchParams();
  setLocationLevelParam(params, level);
  if (parent) {
    params.set('parent', parent);
  }
  if (limit) {
    params.set('limit', String(limit));
  }

  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/locations${query ? `?${query}` : ''}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch species locations for ${taxonId}`,
  );
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(asRecord(payload).results)
      ? (asRecord(payload).results as unknown[])
      : [];

  return rows
    .map(toLocationSearchResult)
    .filter((entry): entry is LocationSearchResult => Boolean(entry));
}
