import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  createPredictHeatmapJob,
  deletePredictHeatmapJob,
  fetchSpeciesHeatmapMetadata,
  streamPredictHeatmapJob,
} from '@/data/api';
import { BACKEND_BASE } from '@/data/apiShared';
import type { SpeciesHeatmapMetadata } from '@/data/types';
import {
  canonicalizeRequestBounds,
  clampMaxCells,
  clampResolution,
} from './mapViewportUtils';

export const HIGHLIGHT_MESSAGE_TYPE = 'highlight';
export const HEATMAP_FETCH_MESSAGE_TYPE = 'heatmap-fetch';
export const HEATMAP_DATA_MESSAGE_TYPE = 'heatmap-data';
export const HEATMAP_ERROR_MESSAGE_TYPE = 'heatmap-error';
export const HEATMAP_SETTINGS_MESSAGE_TYPE = 'heatmap-settings';
export const MAP_DOCUMENT_BASE_URL = 'https://wherewild.net/';
export const MAP_REFERRER_POLICY = 'strict-origin-when-cross-origin';
const rawMapTileApiKey = Constants.expoConfig?.extra?.stadiaMapsApiKey;

export const MAP_TILE_API_KEY =
  typeof rawMapTileApiKey === 'string' && rawMapTileApiKey.trim().length > 0
    ? rawMapTileApiKey.trim()
    : null;
export const MAP_TILE_URL_TEMPLATE_LIGHT = 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';
export const MAP_TILE_URL_TEMPLATE_DARK = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';
export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
export const MAP_TILE_MAX_ZOOM = 20;
export const MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS = 5000;

export type MapTileMode = 'light' | 'dark';

const REQUIRED_MAP_TEMPLATE_MARKERS = ['<div id="map"></div>', '__POINTS_JSON__'] as const;

const MAP_TEMPLATE_PLACEHOLDERS = {
  documentBaseUrl: '__DOCUMENT_BASE_URL__',
  referrerPolicy: '__REFERRER_POLICY__',
  referrerPolicyJson: '__REFERRER_POLICY_JSON__',
  tileUrl: '__TILE_URL_JSON__',
  tileAttribution: '__TILE_ATTRIBUTION_JSON__',
  tileMaxZoom: '__TILE_MAX_ZOOM__',
  maxVisibleUnclusteredObservations: '__MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS__',
  points: '__POINTS_JSON__',
  palette: '__PALETTE_JSON__',
  speciesKey: '__SPECIES_KEY_JSON__',
  heatmapPolicy: '__HEATMAP_POLICY_JSON__',
  highlightType: '__HIGHLIGHT_MESSAGE_TYPE_JSON__',
  heatmapTileUrl: '__HEATMAP_TILE_URL_JSON__',
  heatmapOpacity: '__HEATMAP_OPACITY__',
  minZoom: '__MIN_ZOOM__',
  showMarkers: '__SHOW_MARKERS__',
  fetchType: '__HEATMAP_FETCH_MESSAGE_TYPE_JSON__',
  dataType: '__HEATMAP_DATA_MESSAGE_TYPE_JSON__',
  errorType: '__HEATMAP_ERROR_MESSAGE_TYPE_JSON__',
  settingsType: '__HEATMAP_SETTINGS_MESSAGE_TYPE_JSON__',
} as const;

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
};

export type HeatmapErrorMessage = {
  type: typeof HEATMAP_ERROR_MESSAGE_TYPE;
  requestId: number;
  queryKey: string;
  message?: string;
};

export type HeatmapSettingsMessage = {
  type: typeof HEATMAP_SETTINGS_MESSAGE_TYPE;
  enabled: boolean;
  speciesKey: number | null;
  overlayMode?: 'cells' | 'tiles';
  tileUrl?: string | null;
  tileSize?: number;
  maxNativeZoom?: number;
  featureMode?: 'prefer_cell_table' | 'cell_table_only';
  nativeResolution?: number;
};

export type HeatmapTileOverlayOptions = {
  tileSize: number;
  maxNativeZoom: number;
  featureMode: 'prefer_cell_table' | 'cell_table_only';
};

export const DEFAULT_HEATMAP_TILE_OVERLAY_OPTIONS: HeatmapTileOverlayOptions = {
  tileSize: 256,
  maxNativeZoom: 8,
  featureMode: 'prefer_cell_table',
};

export type MapMarkerPalette = {
  markerFill: string;
  markerStroke: string;
  highlightFill: string;
  highlightStroke: string;
  heatmapLow?: string;
  heatmapHigh?: string;
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
    { minZoom: 12, resolution: 0.0125 },
    { minZoom: 11, resolution: 0.025 },
    { minZoom: 10, resolution: 0.05 },
    { minZoom: 8, resolution: 0.1 },
    { minZoom: 6, resolution: 0.2 },
    { minZoom: 4, resolution: 1 },
    { minZoom: 2, resolution: 2 },
    { minZoom: -999, resolution: 4 },
  ],
};

export type BuildLeafletHtmlOptions = {
  heatmapTileUrl?: string | null;
  heatmapOpacity?: number;
  minZoom?: number;
  showMarkers?: boolean;
  speciesKey?: number | null;
  heatmapPolicy?: HeatmapMapPolicy;
};

export const toHighlightMessagePayload = (catalogs: string[]): HighlightMessage => ({
  type: HIGHLIGHT_MESSAGE_TYPE,
  catalogs,
});

export const buildSpeciesHeatmapTileUrl = (
  tileUrlTemplate: string,
  options: HeatmapTileOverlayOptions = DEFAULT_HEATMAP_TILE_OVERLAY_OPTIONS,
) => {
  const absoluteTileUrlTemplate = /^https?:\/\//i.test(tileUrlTemplate)
    ? tileUrlTemplate
    : `${BACKEND_BASE.replace(/\/$/, '')}/${tileUrlTemplate.replace(/^\//, '')}`;
  const query = new URLSearchParams({
    tile_size: String(options.tileSize),
    feature_mode: options.featureMode,
    max_native_zoom: String(options.maxNativeZoom),
  });
  return `${absoluteTileUrlTemplate}${absoluteTileUrlTemplate.includes('?') ? '&' : '?'}${query.toString()}`;
};

export const resolveSpeciesHeatmapTileOverlay = async (
  speciesKey: number,
  options: HeatmapTileOverlayOptions = DEFAULT_HEATMAP_TILE_OVERLAY_OPTIONS,
): Promise<SpeciesHeatmapMetadata & { resolvedTileUrl: string | null }> => {
  const metadata = await fetchSpeciesHeatmapMetadata(speciesKey);
  return {
    ...metadata,
    resolvedTileUrl: metadata.tileUrl
      ? buildSpeciesHeatmapTileUrl(metadata.tileUrl, options)
      : null,
  };
};

export const getMapTileUrlTemplate = (mode: MapTileMode) => {
  const baseTemplate = mode === 'dark' ? MAP_TILE_URL_TEMPLATE_DARK : MAP_TILE_URL_TEMPLATE_LIGHT;
  return MAP_TILE_API_KEY
    ? `${baseTemplate}?api_key=${encodeURIComponent(MAP_TILE_API_KEY)}`
    : baseTemplate;
};

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const preparePointsForMapHtml = (points: Record<string, unknown>[]) => {
  return (points ?? []).map((point) => {
    const catalogNumber = point.catalogNumber;
    const catalog = typeof catalogNumber === 'number' || typeof catalogNumber === 'string'
      ? String(catalogNumber)
      : '';

    return {
      ...point,
      popupCatalogHref: encodeURIComponent(catalog),
      popupCatalogLabel: escapeHtml(catalog),
    };
  });
};

export const buildLeafletHtml = (
  mapTemplate: string,
  points: Record<string, unknown>[],
  markerPalette: MapMarkerPalette,
  tileUrlTemplate: string,
  options: BuildLeafletHtmlOptions = {},
) => {
  const {
    heatmapTileUrl = null,
    heatmapOpacity = 0.6,
    minZoom = 2,
    showMarkers = true,
    speciesKey = null,
    heatmapPolicy = DEFAULT_HEATMAP_MAP_POLICY,
  } = options;

  let html = mapTemplate;
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.documentBaseUrl).join(MAP_DOCUMENT_BASE_URL);
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.referrerPolicy).join(MAP_REFERRER_POLICY);
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.referrerPolicyJson)
    .join(JSON.stringify(MAP_REFERRER_POLICY));
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.tileUrl).join(JSON.stringify(tileUrlTemplate));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.tileAttribution)
    .join(JSON.stringify(MAP_TILE_ATTRIBUTION));
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.tileMaxZoom).join(String(MAP_TILE_MAX_ZOOM));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.maxVisibleUnclusteredObservations)
    .join(String(MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.points)
    .join(JSON.stringify(preparePointsForMapHtml(points)));
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.palette).join(JSON.stringify(markerPalette));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.speciesKey)
    .join(JSON.stringify(speciesKey != null ? String(speciesKey) : ''));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.heatmapPolicy)
    .join(JSON.stringify(heatmapPolicy));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.highlightType)
    .join(JSON.stringify(HIGHLIGHT_MESSAGE_TYPE));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.heatmapTileUrl)
    .join(heatmapTileUrl ? JSON.stringify(heatmapTileUrl) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.heatmapOpacity)
    .join(String(heatmapOpacity));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.minZoom)
    .join(String(minZoom));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.showMarkers)
    .join(showMarkers ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.fetchType)
    .join(JSON.stringify(HEATMAP_FETCH_MESSAGE_TYPE));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.dataType)
    .join(JSON.stringify(HEATMAP_DATA_MESSAGE_TYPE));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.errorType)
    .join(JSON.stringify(HEATMAP_ERROR_MESSAGE_TYPE));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.settingsType)
    .join(JSON.stringify(HEATMAP_SETTINGS_MESSAGE_TYPE));
  return html;
};

const loadHtmlAsset = async (templateModule: number): Promise<string | null> => {
  try {
    const templateAsset = Asset.fromModule(templateModule);
    if (!templateAsset.localUri && typeof templateAsset.downloadAsync === 'function') {
      await templateAsset.downloadAsync();
    }
    const templateUri = templateAsset.localUri ?? templateAsset.uri;
    if (!templateUri) {
      return null;
    }
    const response = await fetch(templateUri);
    if (!response.ok) {
      return null;
    }
    const templateContent = await response.text();
    const hasRequiredMarkers = REQUIRED_MAP_TEMPLATE_MARKERS.every((marker) =>
      templateContent.includes(marker),
    );
    if (
      typeof templateContent !== 'string'
      || templateContent.trim().length === 0
      || !hasRequiredMarkers
    ) {
      return null;
    }
    return templateContent;
  } catch {
    return null;
  }
};

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const createEmptyHeatmapJob = (): ActiveHeatmapJob => ({
  requestId: null,
  jobId: null,
  abortController: null,
});

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

export const setupWebHeatmapBridge = (
  iframeRef: { current: HTMLIFrameElement | null },
  activeHeatmapJobRef: { current: ActiveHeatmapJob },
) => {
  if (Platform.OS !== 'web') {
    return () => {};
  }
  if (
    typeof window === 'undefined'
    || typeof window.addEventListener !== 'function'
    || typeof window.removeEventListener !== 'function'
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
            | 'sampled_only') || 'auto',
        maxCells: clampMaxCells(toNumber(payload.query.max_cells, 20000), 20000),
      });

      const streamSignalController = new AbortController();
      activeHeatmapJobRef.current = {
        requestId: payload.requestId,
        jobId: createdJob.jobId,
        abortController: streamSignalController,
      };

      let resolvedResolution = Number(payload.query.resolution || 0);
      const streamBatch: Record<string, unknown>[] = [];
      let hasPostedCells = false;
      const streamBatchSize = 200;

      const flushBatch = (force: boolean) => {
        if (!streamBatch.length) {
          return;
        }
        if (!force && streamBatch.length < streamBatchSize) {
          return;
        }
        const nextCells = streamBatch.splice(0, streamBatch.length);
        postData({
          type: HEATMAP_DATA_MESSAGE_TYPE,
          requestId: payload.requestId,
          queryKey: payload.queryKey,
          resolution: resolvedResolution,
          cells: nextCells,
          append: hasPostedCells,
        });
        hasPostedCells = true;
      };

      await streamPredictHeatmapJob(createdJob.jobId, {
        signal: streamSignalController.signal,
        onEvent: (streamEvent) => {
          if (activeHeatmapJobRef.current.requestId !== payload.requestId) {
            return;
          }
          if (streamEvent.type === 'meta' && typeof streamEvent.resolution === 'number') {
            resolvedResolution = streamEvent.resolution;
            return;
          }
          if (streamEvent.type === 'cell') {
            streamBatch.push({
              lat: streamEvent.lat,
              lon: streamEvent.lon,
              score: streamEvent.score,
              nNative: streamEvent.nNative,
              source: streamEvent.source,
            });
            flushBatch(false);
            return;
          }
          if (streamEvent.type === 'done' || streamEvent.type === 'cancelled') {
            flushBatch(true);
          }
        },
      });

      flushBatch(true);
      if (!hasPostedCells) {
        postData({
          type: HEATMAP_DATA_MESSAGE_TYPE,
          requestId: payload.requestId,
          queryKey: payload.queryKey,
          resolution: resolvedResolution,
          cells: [],
          append: false,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      postData({
        type: HEATMAP_ERROR_MESSAGE_TYPE,
        requestId: payload.requestId,
        queryKey: payload.queryKey,
        message: error instanceof Error ? error.message : 'Heatmap request failed',
      });
    } finally {
      activeHeatmapJobRef.current = createEmptyHeatmapJob();
    }
  };

  const handleHeatmapFetchEvent: EventListener = (event) => {
    void handleHeatmapFetchMessage(event as MessageEvent<unknown>);
  };

  window.addEventListener('message', handleHeatmapFetchEvent);

  return () => {
    if (typeof window.removeEventListener === 'function') {
      window.removeEventListener('message', handleHeatmapFetchEvent);
    }
    void cancelActiveHeatmapJob(activeHeatmapJobRef);
  };
};

export const loadMapTemplate = async (): Promise<string | null> => {
  return loadHtmlAsset(require('./SpeciesOccurrenceMap.html'));
};

export const loadFallbackMapTemplate = async (): Promise<string | null> => {
  return loadHtmlAsset(require('./SpeciesOccurrenceMapFallback.html'));
};