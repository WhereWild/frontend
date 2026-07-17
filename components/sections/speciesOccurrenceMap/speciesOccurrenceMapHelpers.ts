// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Asset } from 'expo-asset';
import Constants from 'expo-constants';

export const HIGHLIGHT_MESSAGE_TYPE = 'highlight';
export const COLORMAP_UPDATE_MESSAGE_TYPE = 'colormapUpdate';
export const HEATMAP_UPDATE_MESSAGE_TYPE = 'heatmapUpdate';
export const LOCATE_MESSAGE_TYPE = 'locate';
export const PIN_OBSERVATION_MESSAGE_TYPE = 'pin_observation';
export const SELECTED_POINT_MESSAGE_TYPE = 'selected_point';
export const OPEN_EXTERNAL_URL_MESSAGE_TYPE = 'open_external_url';
export const LOCATION_PICKED_MESSAGE_TYPE = 'locationPicked';
export const LOCAL_LOCATION_UPDATE_MESSAGE_TYPE = 'localLocationUpdate';
export const MAP_DOCUMENT_BASE_URL = 'https://wherewild.net/';
export const MAP_REFERRER_POLICY = 'strict-origin-when-cross-origin';
const rawMapTileApiKey = Constants.expoConfig?.extra?.stadiaMapsApiKey;

export const MAP_TILE_API_KEY =
  typeof rawMapTileApiKey === 'string' && rawMapTileApiKey.trim().length > 0
    ? rawMapTileApiKey.trim()
    : null;
export const MAP_TILE_URL_TEMPLATE_LIGHT =
  'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png';
export const MAP_TILE_URL_TEMPLATE_DARK =
  'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png';
export const MAP_LABELS_TILE_URL_TEMPLATE =
  'https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png';
export const MAP_LINES_TILE_URL_TEMPLATE =
  'https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png';
export const MAP_BACKGROUND_TILE_URL_TEMPLATE =
  'https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}{r}.png';
export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
export const MAP_TILE_MAX_ZOOM = 20;
export const MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS = 20000;

export type MapTileMode = 'light' | 'dark';

const REQUIRED_MAP_TEMPLATE_MARKERS = [
  '<div id="map"></div>',
  '__POINTS_JSON__',
] as const;

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
  openExternalUrlType: '__OPEN_EXTERNAL_URL_MESSAGE_TYPE_JSON__',
  heatmapTileUrl: '__HEATMAP_TILE_URL_JSON__',
  heatmapOpacity: '__HEATMAP_OPACITY__',
  minZoom: '__MIN_ZOOM__',
  maxZoom: '__MAX_ZOOM__',
  maxBoundsJson: '__MAX_BOUNDS_JSON__',
  initialLat: '__INITIAL_LAT__',
  initialLon: '__INITIAL_LON__',
  initialZoom: '__INITIAL_ZOOM__',
  showMarkers: '__SHOW_MARKERS__',
  pinObservationType: '__PIN_OBSERVATION_MESSAGE_TYPE_JSON__',
  allowPinObservations: '__ALLOW_PIN_OBSERVATIONS__',
  linkObservations: '__LINK_OBSERVATIONS__',
  selectedPointType: '__SELECTED_POINT_MESSAGE_TYPE_JSON__',
  pointQueryUrl: '__POINT_QUERY_URL_JSON__',
  renderMin: '__RENDER_MIN_JSON__',
  renderMax: '__RENDER_MAX_JSON__',
  isCircular: '__IS_CIRCULAR__',
  dotMin: '__DOT_MIN_JSON__',
  dotMax: '__DOT_MAX_JSON__',
  disableObservationQuery: '__DISABLE_OBSERVATION_QUERY__',
  varUnits: '__VAR_UNITS_JSON__',
  gradientStops: '__GRADIENT_STOPS_JSON__',
  aspectStops: '__ASPECT_STOPS_JSON__',
  classColorsJson: '__CLASS_COLORS_JSON__',
  classLabelsJson: '__CLASS_LABELS_JSON__',
  classShapesJson: '__CLASS_SHAPES_JSON__',
  markerOutline: '__MARKER_OUTLINE__',
  circularShapesEnabled: '__CIRCULAR_SHAPES_ENABLED__',
  labelsOverlayUrl: '__LABELS_OVERLAY_URL_JSON__',
  linesOverlayUrl: '__LINES_OVERLAY_URL_JSON__',
  locationPickerMode: '__LOCATION_PICKER_MODE__',
  initialLocalLat: '__INITIAL_LOCAL_LAT_JSON__',
  initialLocalLon: '__INITIAL_LOCAL_LON_JSON__',
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

export type SelectedPointMessage = {
  type: typeof SELECTED_POINT_MESSAGE_TYPE;
  point: { latitude: number; longitude: number } | null;
};

export type OpenExternalUrlMessage = {
  type: typeof OPEN_EXTERNAL_URL_MESSAGE_TYPE;
  url: string;
};

export type MapInboundMessage =
  | HighlightMessage
  | PinObservationMessage
  | SelectedPointMessage
  | OpenExternalUrlMessage;

export const isPinObservationMessage = (
  msg: unknown,
): msg is PinObservationMessage => {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === PIN_OBSERVATION_MESSAGE_TYPE &&
    typeof m.catalogNumber === 'string' &&
    typeof m.latitude === 'number' &&
    typeof m.longitude === 'number'
  );
};

export const isOpenExternalUrlMessage = (
  msg: unknown,
): msg is OpenExternalUrlMessage => {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  return m.type === OPEN_EXTERNAL_URL_MESSAGE_TYPE && typeof m.url === 'string';
};

export const isPinObservationEventFromFrame = (
  event: Pick<MessageEvent, 'data' | 'source'>,
  frameWindow: Window | null | undefined,
): event is Pick<MessageEvent, 'data' | 'source'> & {
  data: PinObservationMessage;
} => {
  if (!frameWindow || event.source !== frameWindow) {
    return false;
  }

  return isPinObservationMessage(event.data);
};

export const isOpenExternalUrlEventFromFrame = (
  event: Pick<MessageEvent, 'data' | 'source'>,
  frameWindow: Window | null | undefined,
): event is Pick<MessageEvent, 'data' | 'source'> & {
  data: OpenExternalUrlMessage;
} => {
  if (!frameWindow || event.source !== frameWindow) {
    return false;
  }

  return isOpenExternalUrlMessage(event.data);
};

export type MapMarkerPalette = {
  markerFill: string;
  markerStroke: string;
  highlightFill: string;
  highlightStroke: string;
  selectedPointFill: string;
  selectedPointStroke: string;
  surfaceBackground: string;
  surfaceBorder: string;
  surfaceText: string;
  linkColor: string;
};

export const toHighlightMessagePayload = (
  catalogs: string[],
): HighlightMessage => ({
  type: HIGHLIGHT_MESSAGE_TYPE,
  catalogs,
});

export const toSelectedPointMessagePayload = (
  point: { latitude: number; longitude: number } | null,
): SelectedPointMessage => ({
  type: SELECTED_POINT_MESSAGE_TYPE,
  point,
});

export const getMapTileUrlTemplate = (mode: MapTileMode) => {
  const baseTemplate =
    mode === 'dark' ? MAP_TILE_URL_TEMPLATE_DARK : MAP_TILE_URL_TEMPLATE_LIGHT;
  return MAP_TILE_API_KEY
    ? `${baseTemplate}?api_key=${encodeURIComponent(MAP_TILE_API_KEY)}`
    : baseTemplate;
};

export const getLabelsOverlayTileUrl = () =>
  MAP_TILE_API_KEY
    ? `${MAP_LABELS_TILE_URL_TEMPLATE}?api_key=${encodeURIComponent(MAP_TILE_API_KEY)}`
    : MAP_LABELS_TILE_URL_TEMPLATE;

export const getLinesOverlayTileUrl = () =>
  MAP_TILE_API_KEY
    ? `${MAP_LINES_TILE_URL_TEMPLATE}?api_key=${encodeURIComponent(MAP_TILE_API_KEY)}`
    : MAP_LINES_TILE_URL_TEMPLATE;

export const getBackgroundTileUrl = () =>
  MAP_TILE_API_KEY
    ? `${MAP_BACKGROUND_TILE_URL_TEMPLATE}?api_key=${encodeURIComponent(MAP_TILE_API_KEY)}`
    : MAP_BACKGROUND_TILE_URL_TEMPLATE;

const NSWE_SHAPES = {
  N: 'triangle',
  E: 'arrow',
  S: 'triangle-down',
  W: 'diamond',
} as const;

const aspectToCardinalShape = (deg: number): string => {
  const d = ((deg % 360) + 360) % 360;
  if (d >= 315 || d < 45) return NSWE_SHAPES.N;
  if (d < 135) return NSWE_SHAPES.E;
  if (d < 225) return NSWE_SHAPES.S;
  return NSWE_SHAPES.W;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const preparePointsForMapHtml = (
  points: Record<string, unknown>[],
  observationValues?: Map<string, number> | null,
  classColors?: Map<string, string> | null,
  classLabels?: Map<string, string> | null,
  classShapes?: Map<string, string> | null,
  circularShapesEnabled?: boolean,
) => {
  return (points ?? []).map((point) => {
    const catalogNumber = point.catalogNumber;
    const catalog =
      typeof catalogNumber === 'number' || typeof catalogNumber === 'string'
        ? String(catalogNumber)
        : '';
    const varValue =
      catalog && observationValues
        ? (observationValues.get(catalog) ?? null)
        : null;
    const classKey = varValue != null ? String(Math.round(varValue)) : null;
    const varColor =
      classKey && classColors ? (classColors.get(classKey) ?? null) : null;
    const varLabel =
      classKey && classLabels ? (classLabels.get(classKey) ?? null) : null;
    const varShape =
      classKey && classShapes
        ? (classShapes.get(classKey) ?? null)
        : circularShapesEnabled && varValue != null
          ? aspectToCardinalShape(varValue)
          : null;

    const autoGenerated = Boolean(point.catalogAutoGenerated);
    return {
      ...point,
      popupCatalogValue: catalog,
      popupCatalogHref: autoGenerated ? '' : encodeURIComponent(catalog),
      popupCatalogLabel: autoGenerated ? '' : escapeHtml(catalog),
      varValue,
      varColor,
      varLabel,
      varShape,
    };
  });
};

const fillMapTemplatePlaceholders = (
  mapTemplate: string,
  points: Record<string, unknown>[],
  markerPalette: MapMarkerPalette,
  tileUrlTemplate: string,
  heatmapTileUrl?: string | null,
  heatmapOpacity?: number,
  minZoom?: number,
  showMarkers?: boolean,
  maxZoom?: number | null,
  initialLat?: number | null,
  initialLon?: number | null,
  initialZoom?: number | null,
  maxBounds?: [[number, number], [number, number]] | null,
  linkObservations?: boolean,
  allowPinObservations?: boolean,
  pointQueryUrl?: string | null,
  renderMin?: number | null,
  renderMax?: number | null,
  isCircular?: boolean,
  observationValues?: Map<string, number> | null,
  classColors?: Map<string, string> | null,
  classLabels?: Map<string, string> | null,
  dotMin?: number | null,
  dotMax?: number | null,
  disableObservationQuery?: boolean,
  varUnits?: string | null,
  gradientStops?: [number, number, number][] | null,
  aspectStops?: [number, number, number][] | null,
  classShapes?: Map<string, string> | null,
  markerOutlineEnabled?: boolean,
  circularShapesEnabled?: boolean,
  labelsOverlayUrl?: string | null,
  linesOverlayUrl?: string | null,
  locationPickerMode?: boolean,
  initialLocalLat?: number | null,
  initialLocalLon?: number | null,
) => {
  let html = mapTemplate;
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.documentBaseUrl)
    .join(MAP_DOCUMENT_BASE_URL);
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.referrerPolicy)
    .join(MAP_REFERRER_POLICY);
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.referrerPolicyJson)
    .join(JSON.stringify(MAP_REFERRER_POLICY));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.tileUrl)
    .join(JSON.stringify(tileUrlTemplate));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.tileAttribution)
    .join(JSON.stringify(MAP_TILE_ATTRIBUTION));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.tileMaxZoom)
    .join(String(MAP_TILE_MAX_ZOOM));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.maxVisibleUnclusteredObservations)
    .join(String(MAX_VISIBLE_UNCLUSTERED_OBSERVATIONS));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.points)
    .join(
      JSON.stringify(
        preparePointsForMapHtml(
          points,
          observationValues,
          classColors,
          classLabels,
          classShapes,
          circularShapesEnabled,
        ),
      ),
    );
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.palette)
    .join(JSON.stringify(markerPalette));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.highlightType)
    .join(JSON.stringify(HIGHLIGHT_MESSAGE_TYPE));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.openExternalUrlType)
    .join(JSON.stringify(OPEN_EXTERNAL_URL_MESSAGE_TYPE));
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
    .split(MAP_TEMPLATE_PLACEHOLDERS.maxZoom)
    .join(typeof maxZoom === 'number' ? String(maxZoom) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.maxBoundsJson)
    .join(maxBounds ? JSON.stringify(maxBounds) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.initialLat)
    .join(String(typeof initialLat === 'number' ? initialLat : 0));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.initialLon)
    .join(String(typeof initialLon === 'number' ? initialLon : 0));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.initialZoom)
    .join(String(typeof initialZoom === 'number' ? initialZoom : 2));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.showMarkers)
    .join(showMarkers !== false ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.pinObservationType)
    .join(JSON.stringify(PIN_OBSERVATION_MESSAGE_TYPE));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.allowPinObservations)
    .join(allowPinObservations !== false ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.linkObservations)
    .join(linkObservations !== false ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.selectedPointType)
    .join(JSON.stringify(SELECTED_POINT_MESSAGE_TYPE));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.pointQueryUrl)
    .join(pointQueryUrl ? JSON.stringify(pointQueryUrl) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.renderMin)
    .join(typeof renderMin === 'number' ? String(renderMin) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.renderMax)
    .join(typeof renderMax === 'number' ? String(renderMax) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.isCircular)
    .join(isCircular ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.dotMin)
    .join(typeof dotMin === 'number' ? String(dotMin) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.dotMax)
    .join(typeof dotMax === 'number' ? String(dotMax) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.disableObservationQuery)
    .join(disableObservationQuery ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.varUnits)
    .join(
      typeof varUnits === 'string' && varUnits.length > 0
        ? JSON.stringify(varUnits)
        : 'null',
    );
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.gradientStops).join(
    Array.isArray(gradientStops) && gradientStops.length > 0
      ? JSON.stringify(gradientStops)
      : JSON.stringify([
          [68, 1, 84],
          [72, 26, 108],
          [71, 47, 125],
          [65, 68, 135],
          [57, 86, 140],
          [49, 104, 142],
          [42, 120, 142],
          [35, 136, 142],
          [31, 152, 139],
          [34, 168, 132],
          [53, 183, 121],
          [84, 197, 104],
          [122, 209, 81],
          [165, 219, 54],
          [210, 226, 27],
          [253, 231, 37],
        ]),
  );
  html = html.split(MAP_TEMPLATE_PLACEHOLDERS.aspectStops).join(
    Array.isArray(aspectStops) && aspectStops.length > 0
      ? JSON.stringify(aspectStops)
      : JSON.stringify([
          [40, 95, 220],
          [45, 175, 65],
          [240, 195, 15],
          [220, 50, 50],
        ]),
  );
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.classColorsJson)
    .join(
      classColors ? JSON.stringify(Object.fromEntries(classColors)) : 'null',
    );
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.classLabelsJson)
    .join(
      classLabels ? JSON.stringify(Object.fromEntries(classLabels)) : 'null',
    );
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.classShapesJson)
    .join(
      classShapes ? JSON.stringify(Object.fromEntries(classShapes)) : 'null',
    );
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.markerOutline)
    .join(markerOutlineEnabled ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.circularShapesEnabled)
    .join(circularShapesEnabled ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.labelsOverlayUrl)
    .join(labelsOverlayUrl ? JSON.stringify(labelsOverlayUrl) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.linesOverlayUrl)
    .join(linesOverlayUrl ? JSON.stringify(linesOverlayUrl) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.locationPickerMode)
    .join(locationPickerMode ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.initialLocalLat)
    .join(initialLocalLat != null ? String(initialLocalLat) : 'null');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.initialLocalLon)
    .join(initialLocalLon != null ? String(initialLocalLon) : 'null');
  return html;
};

type FillMapTemplateArgs = Parameters<typeof fillMapTemplatePlaceholders>;

export const buildLeafletHtml = (...args: FillMapTemplateArgs): string =>
  fillMapTemplatePlaceholders(...args);

// MapLibre raster sources don't understand Leaflet's `{r}` retina-tile
// placeholder — left in, it produces a literal `{r}` in the request URL,
// which 404s (and shows up in-browser as a misleading CORS error since the
// 404 response has no CORS headers).
export const stripRetinaPlaceholder = (url: string): string =>
  url.replaceAll('{r}', '');

export const buildGlobeHtml = (...args: FillMapTemplateArgs): string => {
  const [
    mapTemplate,
    points,
    markerPalette,
    tileUrlTemplate,
    heatmapTileUrl,
    heatmapOpacity,
    minZoom,
    showMarkers,
    maxZoom,
    initialLat,
    initialLon,
    initialZoom,
    maxBounds,
    linkObservations,
    allowPinObservations,
    pointQueryUrl,
    renderMin,
    renderMax,
    isCircular,
    observationValues,
    classColors,
    classLabels,
    dotMin,
    dotMax,
    disableObservationQuery,
    varUnits,
    gradientStops,
    aspectStops,
    classShapes,
    markerOutlineEnabled,
    circularShapesEnabled,
    labelsOverlayUrl,
    linesOverlayUrl,
    locationPickerMode,
    initialLocalLat,
    initialLocalLon,
  ] = args;
  return fillMapTemplatePlaceholders(
    mapTemplate,
    points,
    markerPalette,
    stripRetinaPlaceholder(tileUrlTemplate),
    heatmapTileUrl,
    heatmapOpacity,
    minZoom,
    showMarkers,
    maxZoom,
    initialLat,
    initialLon,
    initialZoom,
    maxBounds,
    linkObservations,
    allowPinObservations,
    pointQueryUrl,
    renderMin,
    renderMax,
    isCircular,
    observationValues,
    classColors,
    classLabels,
    dotMin,
    dotMax,
    disableObservationQuery,
    varUnits,
    gradientStops,
    aspectStops,
    classShapes,
    markerOutlineEnabled,
    circularShapesEnabled,
    labelsOverlayUrl
      ? stripRetinaPlaceholder(labelsOverlayUrl)
      : labelsOverlayUrl,
    linesOverlayUrl ? stripRetinaPlaceholder(linesOverlayUrl) : linesOverlayUrl,
    locationPickerMode,
    initialLocalLat,
    initialLocalLon,
  );
};

const loadHtmlAsset = async (
  templateModule: number,
): Promise<string | null> => {
  try {
    const templateAsset = Asset.fromModule(templateModule);
    if (
      !templateAsset.localUri &&
      typeof templateAsset.downloadAsync === 'function'
    ) {
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
      typeof templateContent !== 'string' ||
      templateContent.trim().length === 0 ||
      !hasRequiredMarkers
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

export const loadGlobeMapTemplate = async (): Promise<string | null> => {
  return loadHtmlAsset(require('./SpeciesOccurrenceGlobeMap.html'));
};

export const loadFallbackMapTemplate = async (): Promise<string | null> => {
  return loadHtmlAsset(require('./SpeciesOccurrenceMapFallback.html'));
};
