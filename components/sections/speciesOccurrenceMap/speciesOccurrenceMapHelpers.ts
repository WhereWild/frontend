import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import {
  BACKEND_BASE,
  createPredictHeatmapJob,
  deletePredictHeatmapJob,
  streamPredictHeatmapJob,
} from '@/data/api';
import { canonicalizeRequestBounds, clampMaxCells, clampResolution } from './mapViewportUtils';

/**
 * Shared helpers for the species occurrence map iframe/WebView bridge.
 *
 * This module keeps transport and templating logic out of the render component
 * so `SpeciesOccurrenceMap` can stay focused on UI state and layout.
 */
export const HIGHLIGHT_MESSAGE_TYPE = 'highlight';
export const HEATMAP_FETCH_MESSAGE_TYPE = 'heatmap-fetch';
export const HEATMAP_DATA_MESSAGE_TYPE = 'heatmap-data';
export const HEATMAP_ERROR_MESSAGE_TYPE = 'heatmap-error';

export type HighlightMessage = {
  type: typeof HIGHLIGHT_MESSAGE_TYPE;
  catalogs: string[];
};

export type HeatmapFetchMessage = {
  type: typeof HEATMAP_FETCH_MESSAGE_TYPE;
  requestId: number;
  queryKey: string;
  query: Record<string, string>;
};

export type HeatmapDataMessage = {
  type: typeof HEATMAP_DATA_MESSAGE_TYPE;
  requestId: number;
  queryKey: string;
  resolution: number;
  cells: Record<string, unknown>[];
  append?: boolean;
  debugLines?: string[];
};

export type HeatmapErrorMessage = {
  type: typeof HEATMAP_ERROR_MESSAGE_TYPE;
  requestId: number;
  queryKey: string;
  debugLines?: string[];
};

export type MapMarkerPalette = {
  markerFill: string;
  markerStroke: string;
  highlightFill: string;
  highlightStroke: string;
  heatmapLow: string;
  heatmapHigh: string;
};

export type ActiveHeatmapJob = {
  requestId: number | null;
  jobId: string | null;
  abortController: AbortController | null;
};

export type HeatmapZoomResolutionBreakpoint = {
  minZoom: number;
  resolution: number;
};

export type HeatmapMapPolicy = {
  debounceMs: number;
  queryPrecision: number;
  featureMode: 'auto' | 'prefer_cell_table' | 'cell_table_only' | 'sampled_only';
  maxCells: number;
  zoomResolutionBreakpoints: HeatmapZoomResolutionBreakpoint[];
};

export const DEFAULT_HEATMAP_MAP_POLICY: HeatmapMapPolicy = {
  debounceMs: 320,
  queryPrecision: 4,
  featureMode: 'auto',
  maxCells: 250000,
  zoomResolutionBreakpoints: [
    { minZoom: 11, resolution: 0.0125 },
    { minZoom: 10, resolution: 0.025 },
    { minZoom: 8, resolution: 0.05 },
    { minZoom: 6, resolution: 0.1 },
    { minZoom: 4, resolution: 0.5 },
    { minZoom: 2, resolution: 1 },
    { minZoom: -999, resolution: 2 },
  ],
};

export const MAP_TEMPLATE_PLACEHOLDERS = {
  points: '__POINTS_JSON__',
  palette: '__PALETTE_JSON__',
  apiBase: '__API_BASE_JSON__',
  speciesKey: '__SPECIES_KEY_JSON__',
  heatmapPolicy: '__HEATMAP_POLICY_JSON__',
  highlightType: '__HIGHLIGHT_MESSAGE_TYPE_JSON__',
  fetchType: '__HEATMAP_FETCH_MESSAGE_TYPE_JSON__',
  dataType: '__HEATMAP_DATA_MESSAGE_TYPE_JSON__',
  errorType: '__HEATMAP_ERROR_MESSAGE_TYPE_JSON__',
} as const;

export const mapTemplateFallback = '<!doctype html><html><body><div id="map"></div></body></html>';

/** Creates a normalized highlight payload consumed by the map runtime. */
export const toHighlightMessagePayload = (catalogs: string[]): HighlightMessage => ({
  type: HIGHLIGHT_MESSAGE_TYPE,
  catalogs,
});

/**
 * Injects runtime data into the external HTML template used by Leaflet.
 *
 * Placeholder replacement is intentionally string-based so the template remains
 * plain HTML/JS and easy to edit with syntax highlighting.
 */
export const buildLeafletHtml = (
  mapTemplate: string,
  points: Record<string, unknown>[],
  markerPalette: MapMarkerPalette,
  speciesKey?: number,
  showHeatmapOverlay = true,
  heatmapPolicy: HeatmapMapPolicy = DEFAULT_HEATMAP_MAP_POLICY,
) => {
  let html = mapTemplate;
  const payload = JSON.stringify(points ?? []);
  const palettePayload = JSON.stringify(markerPalette);
  const apiBasePayload = JSON.stringify(BACKEND_BASE);
  const speciesKeyPayload = showHeatmapOverlay && speciesKey != null ? String(speciesKey) : '';
  const heatmapPolicyPayload = JSON.stringify(heatmapPolicy);
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.points).join(payload);
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.palette).join(palettePayload);
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.apiBase).join(apiBasePayload);
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.speciesKey).join(JSON.stringify(speciesKeyPayload));
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.heatmapPolicy).join(heatmapPolicyPayload);
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.highlightType).join(JSON.stringify(HIGHLIGHT_MESSAGE_TYPE));
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.fetchType).join(JSON.stringify(HEATMAP_FETCH_MESSAGE_TYPE));
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.dataType).join(JSON.stringify(HEATMAP_DATA_MESSAGE_TYPE));
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.errorType).join(JSON.stringify(HEATMAP_ERROR_MESSAGE_TYPE));
  return html;
};

/**
 * Loads the standalone map template from the bundled HTML asset.
 *
 * Returns `null` when the asset cannot be resolved so callers can fall back to
 * a minimal inline template without breaking the map flow.
 */
export const loadMapTemplate = async (): Promise<string | null> => {
  try {
    const templateModule = require('./SpeciesOccurrenceMap.html');
    const templateAsset = Asset.fromModule(templateModule);
    if (!templateAsset.localUri) {
      await templateAsset.downloadAsync();
    }
    const templateUri = templateAsset.localUri ?? templateAsset.uri;
    if (!templateUri) {
      return null;
    }
    const response = await fetch(templateUri);
    const templateContent = await response.text();
    if (typeof templateContent !== 'string' || templateContent.trim().length === 0) {
      return null;
    }
    return templateContent;
  } catch {
    return null;
  }
};

/** Safely parses numeric query values with a fallback for invalid input. */
const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Returns a clean active-job shape used to reset bridge state. */
const createEmptyHeatmapJob = (): ActiveHeatmapJob => ({
  requestId: null,
  jobId: null,
  abortController: null,
});

/**
 * Cancels any in-flight heatmap stream and best-effort deletes its backend job.
 *
 * The bridge always calls this before starting a new request to prevent stale
 * stream events from racing with the latest viewport request.
 */
const cancelActiveHeatmapJob = async (
  activeHeatmapJobRef: { current: ActiveHeatmapJob },
) => {
  const active = activeHeatmapJobRef.current;
  if (active.abortController) {
    active.abortController.abort();
  }
  if (active.jobId) {
    try {
      await deletePredictHeatmapJob(active.jobId);
    } catch {
      // Best-effort stale job cancellation.
    }
  }
  activeHeatmapJobRef.current = createEmptyHeatmapJob();
};

/**
 * Validates and narrows incoming postMessage payloads for heatmap fetch requests.
 */
const parseHeatmapFetchMessage = (payload: unknown): HeatmapFetchMessage | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Partial<HeatmapFetchMessage>;
  if (candidate.type !== HEATMAP_FETCH_MESSAGE_TYPE) {
    return null;
  }
  if (!candidate.query || typeof candidate.query !== 'object') {
    return null;
  }
  if (!('species_key' in candidate.query)) {
    return null;
  }

  return candidate as HeatmapFetchMessage;
};

/**
 * Registers the top-frame web bridge for heatmap fetch/stream messages.
 *
 * On web we fetch in the parent frame so requests are visible in browser
 * network tooling, then post incremental cell batches back to the iframe.
 */
export const setupWebHeatmapBridge = (
  iframeRef: { current: HTMLIFrameElement | null },
  activeHeatmapJobRef: { current: ActiveHeatmapJob },
) => {
  if (Platform.OS !== 'web') {
    return () => {};
  }
  if (
    typeof window === 'undefined' ||
    typeof window.addEventListener !== 'function' ||
    typeof window.removeEventListener !== 'function'
  ) {
    return () => {};
  }

  const handleHeatmapFetchMessage = async (event: MessageEvent<unknown>) => {
    const expectedSource = iframeRef.current?.contentWindow;
    if (expectedSource && event.source && event.source !== expectedSource) {
      return;
    }

    const payload = parseHeatmapFetchMessage(event.data);
    if (!payload) {
      return;
    }

    const postData = (message: HeatmapDataMessage | HeatmapErrorMessage) => {
      iframeRef.current?.contentWindow?.postMessage(message, '*');
    };

    try {
      await cancelActiveHeatmapJob(activeHeatmapJobRef);

      const canonicalBounds = canonicalizeRequestBounds(
        toNumber(payload.query.min_lat, -90),
        toNumber(payload.query.min_lon, -180),
        toNumber(payload.query.max_lat, 90),
        toNumber(payload.query.max_lon, 180),
      );

      const createdJob = await createPredictHeatmapJob({
        speciesKey: payload.query.species_key,
        minLat: canonicalBounds.minLat,
        minLon: canonicalBounds.minLon,
        maxLat: canonicalBounds.maxLat,
        maxLon: canonicalBounds.maxLon,
        resolution: clampResolution(toNumber(payload.query.resolution, 0.25), 0.25),
        includeSource: String(payload.query.include_source || '').toLowerCase() === 'true',
        featureMode:
          (payload.query.feature_mode as
            | 'auto'
            | 'prefer_cell_table'
            | 'cell_table_only'
            | 'sampled_only') || 'prefer_cell_table',
        maxCells: clampMaxCells(toNumber(payload.query.max_cells, 20000), 20000),
      });

      const streamSignalController = new AbortController();
      activeHeatmapJobRef.current = {
        requestId: payload.requestId,
        jobId: createdJob.jobId,
        abortController: streamSignalController,
      };

      const streamUrl = `${BACKEND_BASE}${createdJob.streamUrl}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('[heatmap-top-frame] stream fetch', streamUrl, 'job', createdJob.jobId);
      }
      let resolvedResolution = Number(payload.query.resolution || 0);
      const cells: Record<string, unknown>[] = [];
      const streamBatch: Record<string, unknown>[] = [];
      let streamedCount = 0;
      const streamPostBatchSize = 200;

      /** Posts batched stream cells to reduce postMessage overhead. */
      const postStreamBatch = (force: boolean, includeDebug: boolean) => {
        if (!streamBatch.length) {
          return;
        }
        if (!force && streamBatch.length < streamPostBatchSize) {
          return;
        }

        let sampledCount = 0;
        let cellTableCount = 0;
        let unknownSourceCount = 0;
        cells.forEach((cell) => {
          const source = String(cell.source || '').toLowerCase();
          if (source === 'sampled') {
            sampledCount += 1;
            return;
          }
          if (source === 'cell_table') {
            cellTableCount += 1;
            return;
          }
          unknownSourceCount += 1;
        });

        postData({
          type: HEATMAP_DATA_MESSAGE_TYPE,
          requestId: payload.requestId,
          queryKey: payload.queryKey,
          resolution: resolvedResolution,
          cells: [...streamBatch],
          append: true,
          debugLines: includeDebug
            ? [
                'Heatmap debug: parent fetch stream',
                `resolution req/ret: ${String(payload.query.resolution || '')} / ${String(resolvedResolution)}`,
                `cells streamed/parsed: ${String(streamedCount)} / ${String(cells.length)}`,
                `source sampled/cell_table/other: ${String(sampledCount)} / ${String(cellTableCount)} / ${String(unknownSourceCount)}`,
              ]
            : undefined,
        });
        streamBatch.length = 0;
      };

      await streamPredictHeatmapJob(createdJob.jobId, {
        signal: streamSignalController.signal,
        onEvent: (eventPayload) => {
          if (activeHeatmapJobRef.current.requestId !== payload.requestId) {
            return;
          }
          if (eventPayload.type === 'meta') {
            if (typeof eventPayload.resolution === 'number' && Number.isFinite(eventPayload.resolution)) {
              resolvedResolution = eventPayload.resolution;
            }
            return;
          }
          if (eventPayload.type === 'cell') {
            const cellEntry = {
              lat: eventPayload.lat,
              lon: eventPayload.lon,
              score: eventPayload.score,
              n_native: eventPayload.nNative,
              source: eventPayload.source,
            };
            cells.push(cellEntry);
            streamBatch.push(cellEntry);
            streamedCount += 1;
            postStreamBatch(false, false);
          }
        },
      });

      if (activeHeatmapJobRef.current.requestId !== payload.requestId) {
        return;
      }

      postStreamBatch(true, true);

      try {
        await deletePredictHeatmapJob(createdJob.jobId);
      } catch {
        // Best-effort cleanup after completed stream.
      }
      if (activeHeatmapJobRef.current.requestId === payload.requestId) {
        activeHeatmapJobRef.current = createEmptyHeatmapJob();
      }
    } catch {
      const active = activeHeatmapJobRef.current;
      const isAborted = Boolean(active.abortController?.signal.aborted);
      if (isAborted) {
        return;
      }
      postData({
        type: HEATMAP_ERROR_MESSAGE_TYPE,
        requestId: payload.requestId,
        queryKey: payload.queryKey,
        debugLines: ['Heatmap debug: parent request error'],
      });
    }
  };

  window.addEventListener('message', handleHeatmapFetchMessage);

  return () => {
    window.removeEventListener('message', handleHeatmapFetchMessage);
    const active = activeHeatmapJobRef.current;
    if (active.abortController) {
      active.abortController.abort();
    }
    if (active.jobId) {
      void deletePredictHeatmapJob(active.jobId);
    }
  };
};
