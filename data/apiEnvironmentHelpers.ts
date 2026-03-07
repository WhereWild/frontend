import type {
  EnvironmentSliceParams,
  PredictHeatmapJobCancelResponse,
  PredictHeatmapJobCreateResponse,
  PredictHeatmapJobEvent,
  PredictHeatmapJobRequest,
  SpeciesEnvironmentCategorySampleResponse,
  SpeciesPredictHeatmap,
  SpeciesEnvironmentStats,
  SpeciesOccurrence,
  SpeciesEnvironmentSliceResponse,
} from './types';
import {
  parseEnvironmentCategorySampleResponse,
  parseEnvironmentSliceResponse,
  parseSpeciesEnvironmentStats,
  toFiniteNumber,
} from './environmentParsers';
import { BACKEND_BASE, asRecord, fetchJsonOrThrow } from './apiShared';

type LocationOptions = {
  location?: string | null;
  units?: string | null;
};

type CategorySampleOptions = {
  limit?: number;
  location?: string | null;
  units?: string | null;
};

/**
 * Fetches species environment statistics and normalizes the response.
 */
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
  if (options?.units) {
    params.set('unit_system', options.units);
  }
  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}${query ? `?${query}` : ''}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch environment stats (${variableId}) for ${taxonId}`,
  );
  return parseSpeciesEnvironmentStats(payload, taxonId, variableId);
}

/**
 * Fetches observations for a variable constrained by a numeric value range.
 */
export async function fetchEnvironmentRangeSlice(
  params: EnvironmentSliceParams,
): Promise<SpeciesEnvironmentSliceResponse> {
  const { taxonId, variableId, min, max, limit, location, units } = params;
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
  if (units) {
    query.set('unit_system', units);
  }
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}/slice?${query.toString()}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch environment slice (${variableId}) for ${taxonId}`,
  );
  return parseEnvironmentSliceResponse(payload, { taxonId, variableId, min, max, limit });
}

/**
 * Fetches observations that belong to a categorical class.
 */
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
  if (options?.units) {
    query.set('unit_system', options.units);
  }
  const queryString = query.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}/class/${encodedClass}/samples${queryString ? `?${queryString}` : ''}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch samples for ${variableId}=${classValue}`,
  );
  return parseEnvironmentCategorySampleResponse(payload, { taxonId, variableId, classValue });
}

/**
 * Fetches occurrence points for a species.
 */
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

/**
 * Fetches model heatmap cells for a species over a bounding box.
 */
export async function fetchSpeciesPredictHeatmap(
  speciesKey: string | number,
  bounds: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  },
): Promise<SpeciesPredictHeatmap> {
  const query = new URLSearchParams({
    species_key: String(speciesKey),
    min_lat: String(bounds.minLat),
    min_lon: String(bounds.minLon),
    max_lat: String(bounds.maxLat),
    max_lon: String(bounds.maxLon),
  });
  const payload = asRecord(
    await fetchJsonOrThrow(
      `${BACKEND_BASE}/api/predict/heatmap?${query.toString()}`,
      `Failed to fetch prediction heatmap for ${speciesKey}`,
    ),
  );
  const bboxSource = Array.isArray(payload.bbox) ? payload.bbox : [];
  const bbox: [number, number, number, number] = [
    toFiniteNumber(bboxSource[0]) ?? bounds.minLat,
    toFiniteNumber(bboxSource[1]) ?? bounds.minLon,
    toFiniteNumber(bboxSource[2]) ?? bounds.maxLat,
    toFiniteNumber(bboxSource[3]) ?? bounds.maxLon,
  ];
  const rows = Array.isArray(payload.cells) ? payload.cells : [];

  return {
    speciesKey: toFiniteNumber(payload.species_key) ?? Number(speciesKey),
    bbox,
    resolution: toFiniteNumber(payload.resolution) ?? 0,
    nativeResolution: toFiniteNumber(payload.native_resolution) ?? 0,
    nCells: toFiniteNumber(payload.n_cells) ?? rows.length,
    cells: rows
      .map((entry) => {
        const source = asRecord(entry);
        return {
          lat: toFiniteNumber(source.lat),
          lon: toFiniteNumber(source.lon),
          score: toFiniteNumber(source.score),
          nNative: toFiniteNumber(source.n_native),
        };
      })
      .filter(
        (
          entry,
        ): entry is { lat: number; lon: number; score: number; nNative: number } =>
          typeof entry.lat === 'number' &&
          typeof entry.lon === 'number' &&
          typeof entry.score === 'number' &&
          typeof entry.nNative === 'number',
      ),
  };
}

/**
 * Creates a cancellable heatmap job resource.
 */
export async function createPredictHeatmapJob(
  request: PredictHeatmapJobRequest,
): Promise<PredictHeatmapJobCreateResponse> {
  const payload = {
    species_key: Number(request.speciesKey),
    min_lat: request.minLat,
    min_lon: request.minLon,
    max_lat: request.maxLat,
    max_lon: request.maxLon,
    resolution: request.resolution,
    head_variant: request.headVariant,
    include_source: request.includeSource,
    feature_mode: request.featureMode,
    max_cells: request.maxCells,
  };
  const response = await fetch(`${BACKEND_BASE}/api/predict/heatmap-jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Failed to create heatmap job: ${response.status} ${detail}`);
  }
  const source = asRecord(await response.json());
  return {
    jobId: String(source.job_id ?? ''),
    status: String(source.status ?? ''),
    streamUrl: String(source.stream_url ?? ''),
    cancelUrl: String(source.cancel_url ?? ''),
  };
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
): Promise<void> {
  const encodedJobId = encodeURIComponent(jobId);
  const response = await fetch(`${BACKEND_BASE}/api/predict/heatmap-jobs/${encodedJobId}/stream`, {
    method: 'GET',
    signal: options?.signal,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Failed to stream heatmap job ${jobId}: ${response.status} ${detail}`);
  }
  if (!response.body || !response.body.getReader) {
    throw new Error(`Streaming unsupported for heatmap job ${jobId}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const parseEvent = (line: string): PredictHeatmapJobEvent | null => {
    if (!line) {
      return null;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      return null;
    }
    const source = asRecord(raw);
    const eventType = String(source.type ?? '');
    if (eventType === 'cell') {
      return {
        type: 'cell',
        lat: Number(source.lat ?? 0),
        lon: Number(source.lon ?? 0),
        score: Number(source.score ?? 0),
        nNative: Number(source.n_native ?? 0),
        source: typeof source.source === 'string' ? source.source : undefined,
      };
    }
    if (eventType === 'meta') {
      const bboxValues = Array.isArray(source.bbox)
        ? source.bbox.map((value) => Number(value))
        : [];
      const bbox = bboxValues.length === 4
        ? ([bboxValues[0], bboxValues[1], bboxValues[2], bboxValues[3]] as [number, number, number, number])
        : undefined;
      return {
        type: 'meta',
        jobId: typeof source.job_id === 'string' ? source.job_id : undefined,
        speciesKey: Number.isFinite(Number(source.species_key)) ? Number(source.species_key) : undefined,
        bbox,
        resolution: Number.isFinite(Number(source.resolution)) ? Number(source.resolution) : undefined,
        nativeResolution: Number.isFinite(Number(source.native_resolution))
          ? Number(source.native_resolution)
          : undefined,
        requestedCells: Number.isFinite(Number(source.requested_cells))
          ? Number(source.requested_cells)
          : undefined,
      };
    }
    if (eventType === 'done') {
      return {
        type: 'done',
        jobId: typeof source.job_id === 'string' ? source.job_id : undefined,
        nCells: Number(source.n_cells ?? 0),
      };
    }
    if (eventType === 'cancelled') {
      return {
        type: 'cancelled',
        jobId: typeof source.job_id === 'string' ? source.job_id : undefined,
        nCells: Number(source.n_cells ?? 0),
      };
    }
    return null;
  };

  while (true) {
    const readResult = await reader.read();
    if (readResult.done) {
      break;
    }
    buffer += decoder.decode(readResult.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach((line) => {
      const event = parseEvent(line.trim());
      if (event) {
        options?.onEvent?.(event);
      }
    });
  }
  buffer += decoder.decode();
  const trailing = buffer.trim();
  if (trailing.length) {
    const event = parseEvent(trailing);
    if (event) {
      options?.onEvent?.(event);
    }
  }
}

/**
 * Cancels a heatmap job.
 */
export async function deletePredictHeatmapJob(
  jobId: string,
): Promise<PredictHeatmapJobCancelResponse> {
  const encodedJobId = encodeURIComponent(jobId);
  const response = await fetch(`${BACKEND_BASE}/api/predict/heatmap-jobs/${encodedJobId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Failed to delete heatmap job ${jobId}: ${response.status} ${detail}`);
  }
  const source = asRecord(await response.json());
  return {
    jobId: typeof source.job_id === 'string' ? source.job_id : undefined,
    status: typeof source.status === 'string' ? source.status : undefined,
  };
}