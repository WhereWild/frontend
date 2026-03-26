import { Asset } from 'expo-asset';
import Constants from 'expo-constants';

export const HIGHLIGHT_MESSAGE_TYPE = 'highlight';
export const PIN_OBSERVATION_MESSAGE_TYPE = 'pin_observation';
export const MAP_DOCUMENT_BASE_URL = 'https://wherewild.app/';
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
  highlightType: '__HIGHLIGHT_MESSAGE_TYPE_JSON__',
  heatmapTileUrl: '__HEATMAP_TILE_URL_JSON__',
  heatmapOpacity: '__HEATMAP_OPACITY__',
  minZoom: '__MIN_ZOOM__',
  showMarkers: '__SHOW_MARKERS__',
  pinObservationType: '__PIN_OBSERVATION_MESSAGE_TYPE_JSON__',
} as const;

export type HighlightMessage = {
  type: typeof HIGHLIGHT_MESSAGE_TYPE;
  catalogs: string[];
};

export type PinObservationMessage = {
  type: typeof PIN_OBSERVATION_MESSAGE_TYPE;
  catalogNumber: string;
  latitude: number;
  longitude: number;
};

export type MapInboundMessage = HighlightMessage | PinObservationMessage;

export const isPinObservationMessage = (msg: unknown): msg is PinObservationMessage => {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === PIN_OBSERVATION_MESSAGE_TYPE &&
    typeof m.latitude === 'number' &&
    typeof m.longitude === 'number'
  );
};

export type MapMarkerPalette = {
  markerFill: string;
  markerStroke: string;
  highlightFill: string;
  highlightStroke: string;
};

export const toHighlightMessagePayload = (catalogs: string[]): HighlightMessage => ({
  type: HIGHLIGHT_MESSAGE_TYPE,
  catalogs,
});

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
  heatmapTileUrl?: string | null,
  heatmapOpacity?: number,
  minZoom?: number,
  showMarkers?: boolean,
) => {
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
    .split(MAP_TEMPLATE_PLACEHOLDERS.highlightType)
    .join(JSON.stringify(HIGHLIGHT_MESSAGE_TYPE));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.heatmapTileUrl)
    .join(heatmapTileUrl ? JSON.stringify(heatmapTileUrl) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.heatmapOpacity)
    .join(String(typeof heatmapOpacity === 'number' ? heatmapOpacity : 0.6));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.minZoom)
    .join(String(typeof minZoom === 'number' ? minZoom : 2));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.showMarkers)
    .join(showMarkers !== false ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.pinObservationType)
    .join(JSON.stringify(PIN_OBSERVATION_MESSAGE_TYPE));
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

export const loadMapTemplate = async (): Promise<string | null> => {
  return loadHtmlAsset(require('./SpeciesOccurrenceMap.html'));
};

export const loadFallbackMapTemplate = async (): Promise<string | null> => {
  return loadHtmlAsset(require('./SpeciesOccurrenceMapFallback.html'));
};
