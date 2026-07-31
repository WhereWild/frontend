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
export const TOGGLE_GLOBE_VIEW_MESSAGE_TYPE = 'toggleGlobeView';
export const TOGGLE_FULLSCREEN_MESSAGE_TYPE = 'toggleFullscreen';
export const TILE_CLASSES_SYNC_MESSAGE_TYPE = 'tileClassesSync';
export const POINT_STYLES_UPDATE_MESSAGE_TYPE = 'pointStylesUpdate';

type FullscreenCapableElement = Element & {
  webkitRequestFullscreen?: () => void;
};
type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

// Shared by SpeciesOccurrenceMap's own (map-only) fallback and by consuming
// pages that want to include their own overlay siblings (legends, colormap
// pickers) in the fullscreened area — see onFullscreenToggle's doc comment
// on SpeciesOccurrenceMapProps for why this can't just live inside the map's
// WebView/iframe.
export const toggleFullscreenElement = (el: Element | null | undefined) => {
  if (!el || typeof document === 'undefined') {
    return;
  }
  const doc = document as FullscreenCapableDocument;
  const isFullscreen = doc.fullscreenElement || doc.webkitFullscreenElement;
  if (isFullscreen) {
    (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
    return;
  }
  const target = el as FullscreenCapableElement;
  (target.requestFullscreen || target.webkitRequestFullscreen)?.call(target);
};
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
  mapTileMode: '__MAP_TILE_MODE_JSON__',
  enableOfflineFallback: '__ENABLE_OFFLINE_FALLBACK__',
  leafletResizeObserverScript: '__LEAFLET_RESIZE_OBSERVER_SCRIPT__',
  leafletHeatmapTrackingScript: '__LEAFLET_HEATMAP_TRACKING_SCRIPT__',
  globeTileClassTrackingScript: '__GLOBE_TILE_CLASS_TRACKING_SCRIPT__',
  globeResizeObserverScript: '__GLOBE_RESIZE_OBSERVER_SCRIPT__',
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

// Shared verbatim between SpeciesOccurrenceMap.html and SpeciesOccurrenceMapOffline.html —
// the only difference between the two templates is the offline vector basemap data,
// not this tracking/resize logic, so it's injected via placeholder rather than
// hand-duplicated in both files.
const LEAFLET_RESIZE_OBSERVER_SCRIPT = `
    // Leaflet caches its container's pixel size at init and never
    // re-measures on its own — without this, resizing the container (most
    // notably toggling fullscreen, which the parent page now drives — see
    // onFullscreenToggle — but also any other layout change) leaves Leaflet
    // working off a stale size. That desyncs which tiles it thinks are
    // in-view from what's actually rendered, which is exactly what corrupts
    // the tileClassesSync nominal-legend tracking, since it reads directly
    // off Leaflet's own (now-stale) tile registry.
    if (typeof ResizeObserver !== 'undefined') {
      var mapEl = document.getElementById('map');
      // Debounced: a fullscreen enter/exit CSS transition fires many
      // intermediate resize events, and invalidateSize on every one of them
      // would cause repeated (and inconsistent, since the container is
      // mid-transition) tile add/remove churn. Only the settled final size
      // matters.
      var invalidateSizeTimer = null;
      var mapResizeObserver = new ResizeObserver(function() {
        if (invalidateSizeTimer) clearTimeout(invalidateSizeTimer);
        invalidateSizeTimer = setTimeout(function() {
          invalidateSizeTimer = null;
          map.invalidateSize();
        }, 150);
      });
      mapResizeObserver.observe(mapEl);
    }
`;

const LEAFLET_HEATMAP_TRACKING_SCRIPT = `
    function supportsAbortableTileFetch() {
      return (
        typeof fetch === 'function'
        && typeof AbortController === 'function'
        && typeof URL !== 'undefined'
        && typeof URL.createObjectURL === 'function'
        && typeof URL.revokeObjectURL === 'function'
        && typeof document.createElement === 'function'
      );
    }

    function createAbortableHeatmapLayer(urlTemplate) {
      const layer = L.tileLayer(urlTemplate, {
        opacity: HEATMAP_OPACITY,
        tileSize: 256,
        maxZoom: TILE_MAX_ZOOM,
        // Matches the lines/labels overlay layers below: only request tiles
        // once panning/zooming has settled rather than continuously during
        // the gesture. This is the layer that emits tileClasses, so less
        // churn here also means fewer chances to hit the abort-vs-already-
        // resolved race the aborted-check above guards against.
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 4,
      });
      const controllers = new WeakMap();
      const objectUrls = new WeakMap();
      const tileClassData = new WeakMap();

      function releaseTile(tile) {
        const controller = controllers.get(tile);
        if (controller) {
          controller.abort();
          controllers.delete(tile);
        }
        const objectUrl = objectUrls.get(tile);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrls.delete(tile);
        }
        // No per-tile "removed" message to send: tileClassData isn't the
        // source of truth for what's currently visible, layer._tiles is
        // (see syncClasses) — once Leaflet actually discards a tile it drops
        // it from _tiles entirely, so a stale WeakMap entry for a
        // no-longer-referenced tile element just becomes unreachable and
        // gets garbage collected; nothing to explicitly clean up here.
      }

      layer.on('tileunload', function(event) {
        if (event && event.tile) {
          releaseTile(event.tile);
        }
      });

      // The only source of truth for "what nominal classes are visible right
      // now": rather than track add/remove deltas per tile (which depends on
      // every single add having an eventual matching remove — one dropped
      // message from any edge case, and a class sticks in the legend
      // forever with no way to self-correct), this recomputes the total
      // from scratch directly against Leaflet's own tile registry
      // (layer._tiles) every time the map settles. Only tiles Leaflet
      // itself currently considers "current" (still relevant to the view,
      // not yet pruned) are counted, so the result is always exactly
      // correct for whatever's on screen right now — nothing to drift.
      layer.syncClasses = function() {
        var totals = {};
        var tiles = layer._tiles || {};
        Object.keys(tiles).forEach(function(key) {
          var tile = tiles[key];
          if (!tile || tile.current === false || !tile.el) {
            return;
          }
          var classes = tileClassData.get(tile.el);
          if (!classes) {
            return;
          }
          classes.forEach(function(entry) {
            totals[entry.id] = (totals[entry.id] || 0) + entry.count;
          });
        });
        var synced = Object.keys(totals).map(function(id) {
          return { id: Number(id), count: totals[id] };
        });
        // Skip empty syncs — they're near-guaranteed to be a mid-transition
        // artifact (the old view's tiles just got marked no-longer-current
        // the instant a pan/zoom started, while the new view's tiles
        // haven't finished loading yet) rather than a real "nothing here"
        // state, since a genuinely empty view stays reachable the moment
        // the next real sync actually has data. Sending it anyway would
        // wipe the legend to nothing for that gap, then repopulate once the
        // next sync lands — better to just keep showing the last real data
        // until there's something new to replace it with.
        if (synced.length === 0) {
          return;
        }
        postToParent({ type: 'tileClassesSync', classes: synced });
      };

      layer.createTile = function(coords, done) {
        const tile = document.createElement('img');
        const controller = new AbortController();
        let finished = false;

        function finish(error) {
          if (finished) {
            return;
          }
          finished = true;
          done(error || null, tile);
        }

        function revokeObjectUrl() {
          const objectUrl = objectUrls.get(tile);
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrls.delete(tile);
          }
        }

        controllers.set(tile, controller);
        tile.alt = '';
        tile.referrerPolicy = TILE_REFERRER_POLICY;
        tile.setAttribute('role', 'presentation');
        tile.onload = function() {
          revokeObjectUrl();
          controllers.delete(tile);
          finish(null);
        };
        tile.onerror = function(error) {
          revokeObjectUrl();
          controllers.delete(tile);
          if (controller.signal.aborted) {
            finish(null);
            return;
          }
          finish(error || new Error('Heatmap tile image load failed'));
        };

        fetch(layer.getTileUrl(coords), {
          signal: controller.signal,
          referrerPolicy: TILE_REFERRER_POLICY,
        })
          .then(function(response) {
            if (!response.ok) {
              throw new Error('Heatmap tile request failed with status ' + response.status);
            }
            // Skip storing class data for a tile that's already been
            // released (controller.abort() only cancels a fetch that hasn't
            // settled yet, so this can still run after release if the
            // response had already fully arrived) — harmless either way
            // since syncClasses only reads tiles Leaflet's own registry
            // still lists, but no reason to do the parsing.
            if (!controller.signal.aborted) {
              var classesHeader = response.headers.get('X-Nominal-Classes');
              if (classesHeader) {
                var classes = classesHeader.split(',').reduce(function(acc, part) {
                  var sep = part.indexOf(':');
                  if (sep === -1) return acc;
                  var id = Number(part.slice(0, sep));
                  var count = Number(part.slice(sep + 1));
                  if (!isNaN(id) && !isNaN(count)) acc.push({ id: id, count: count });
                  return acc;
                }, []);
                tileClassData.set(tile, classes);
              }
            }
            return response.blob();
          })
          .then(function(blob) {
            if (controller.signal.aborted) {
              finish(null);
              return;
            }
            const objectUrl = URL.createObjectURL(blob);
            objectUrls.set(tile, objectUrl);
            tile.src = objectUrl;
          })
          .catch(function(error) {
            revokeObjectUrl();
            controllers.delete(tile);
            if (error && error.name === 'AbortError') {
              finish(null);
              return;
            }
            finish(error);
          });

        return tile;
      };

      return layer;
    }

    let heatmapLayer = null;
    if (HEATMAP_TILE_URL) {
      heatmapLayer = supportsAbortableTileFetch()
        ? createAbortableHeatmapLayer(HEATMAP_TILE_URL)
        : L.tileLayer(HEATMAP_TILE_URL, {
            opacity: HEATMAP_OPACITY,
            tileSize: 256,
            maxZoom: TILE_MAX_ZOOM,
          });
      heatmapLayer.addTo(map);

      if (typeof heatmapLayer.syncClasses === 'function') {
        // This vendored Leaflet (1.1.1) has no generic map-level "idle"
        // event (unlike MapLibre, used for the same purpose in the globe
        // template) — 'load' (GridLayer/TileLayer: fires once all of this
        // layer's tiles for the current view have finished loading) and
        // 'moveend' (Map: fires once a pan/zoom gesture settles, including
        // cases where nothing new needed to load) together cover "the map
        // has settled" here instead.
        var classSyncTimer = null;
        var scheduleClassSync = function() {
          if (classSyncTimer) clearTimeout(classSyncTimer);
          classSyncTimer = setTimeout(function() {
            classSyncTimer = null;
            heatmapLayer.syncClasses();
          }, 200);
        };
        heatmapLayer.on('load', scheduleClassSync);
        map.on('moveend', scheduleClassSync);
      }
    }
`;

// Shared verbatim between SpeciesOccurrenceGlobeMap.html and
// SpeciesOccurrenceGlobeMapOffline.html — same reasoning as the Leaflet
// scripts above.
const GLOBE_TILE_CLASS_TRACKING_SCRIPT = `
    // Tracks which categorical classes are present in the heatmap tiles
    // currently in view. Same self-healing full-recompute design as the
    // Leaflet template's layer.syncClasses (see there for why: a running
    // add/remove delta depends on every add having an eventual matching
    // remove, and any one dropped message leaks a class into the legend
    // forever with no way to self-correct) — generalized here to fractional
    // weights instead of a binary in/out toggle, because a globe has no
    // such thing as "80% of a tile" (a tile is either fully requested or
    // not at all), but a tile near the horizon can be almost entirely
    // curving out of view while still contributing its *full* per-tile
    // class histogram, which let distant, barely-visible tiles (e.g.
    // Siberian taiga while looking at the US) dominate the legend. So
    // instead of counting a tile as fully present or fully absent, each
    // tile's contribution is scaled by how close it is to dead center vs.
    // the actual horizon, and the whole weighted total is recomputed fresh
    // every time the camera moves — nothing here is carried over or
    // diffed against a previous state.
    var TILE_CLASS_CACHE = new Map(); // "z/x/y" -> raw [{id,count}] from the X-Nominal-Classes header
    var MAX_TRACKED_TILES = 512;
    var HEATMAP_TILE_KEY_RE = /\\/tiles\\/(\\d+)\\/(\\d+)\\/(\\d+)\\.[a-zA-Z0-9]+/;

    function tileKey(z, x, y) { return z + '/' + x + '/' + y; }

    // The zoom level MapLibre actually requests raster tiles at doesn't
    // necessarily equal Math.round(map.getZoom()) — using that as a guess
    // made the visible-tile bookkeeping race against reality (tiles arriving
    // "for the wrong z" as far as our own math was concerned), which showed
    // up as the legend flickering/going stale during pans and zooms. Instead
    // ask MapLibre's own Transform for the same "covering zoom level" it
    // uses internally for a tileSize:256 raster source (roundZoom matches
    // how raster sources — as opposed to vector, which use ceil — pick a
    // zoom), so our tile math always agrees with the tiles MapLibre is
    // actually fetching.
    function currentHeatmapTileZoom() {
      var z = null;
      try {
        if (map.transform && typeof map.transform.coveringZoomLevel === 'function') {
          var computed = map.transform.coveringZoomLevel({ tileSize: 256, roundZoom: true });
          if (typeof computed === 'number' && isFinite(computed)) z = computed;
        }
      } catch (e) {}
      if (z == null) z = Math.round(map.getZoom());
      z = Math.max(0, Math.round(z));
      if (CUSTOM_MAX_ZOOM !== null) z = Math.min(z, CUSTOM_MAX_ZOOM);
      return Math.min(z, TILE_MAX_ZOOM);
    }

    // The angular distance (from the map's center point) beyond which
    // MapLibre's own GPU clipping plane discards globe geometry as not
    // visible — ported from the clipping-plane math in maplibre-gl-js
    // v5.1.0's vertical_perspective_transform.ts (_computeClippingPlane) /
    // globe_utils.ts (getGlobeRadiusPixels). Shrinks toward 0 as zoom
    // increases (cameraToCenterDistance is fixed by viewport size, while the
    // globe's rendered radius grows with 2^zoom), which is mathematically
    // correct — at high zoom you're looking at a vanishingly small fraction
    // of the whole sphere's surface even though it fills the screen — and
    // is exactly what makes the weighting below self-adjust with zoom.
    function horizonHalfAngleRadians() {
      var t = map.transform;
      if (!t) return null;
      var globeRadiusPixels = t.worldSize / (2 * Math.PI) / Math.cos(t.center.lat * Math.PI / 180);
      var pitch = t.pitchInRadians || 0;
      var distanceCameraToB = t.cameraToCenterDistance / globeRadiusPixels;
      var distanceCameraToA = Math.sin(pitch) * distanceCameraToB;
      var distanceAtoC = Math.cos(pitch) * distanceCameraToB + 1;
      var distanceCameraToC = Math.sqrt(distanceCameraToA * distanceCameraToA + distanceAtoC * distanceAtoC);
      var camCTcosine = 1 / distanceCameraToC;
      return Math.acos(Math.max(-1, Math.min(1, camCTcosine)));
    }

    function angularDistanceRadians(lng1, lat1, lng2, lat2) {
      var phi1 = lat1 * Math.PI / 180;
      var phi2 = lat2 * Math.PI / 180;
      var dPhi = (lat2 - lat1) * Math.PI / 180;
      var dLambda = (lng2 - lng1) * Math.PI / 180;
      var a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2)
        + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
      return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function tileCenterLngLat(z, x, y) {
      var n = Math.pow(2, z);
      var lon = (x + 0.5) / n * 360 - 180;
      var latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n)));
      return [lon, latRad * 180 / Math.PI];
    }

    // Below this the horizon angle is numerically unstable to divide by (and
    // at that zoom the globe is effectively flat anyway), so the hard
    // sphere-occlusion gate below is skipped entirely in that regime.
    var MIN_MEANINGFUL_HORIZON_RADIANS = 1e-4;

    // How close a point is to the edge of the *actual* on-screen canvas —
    // not an assumed circle, the real rectangle, using its real current
    // pixel dimensions. This is what makes the weighting aspect-ratio- and
    // device-aware: a wide landscape viewport has a wider horizontal FOV
    // than vertical (mat4.perspective's aspect scales the horizontal FOV
    // off a fixed vertical one), so it actually crops the *top and bottom*
    // sooner in angular terms, not the sides — rather than assume either
    // direction, this measures real projected pixels against the real
    // container size and lets whichever dimension is narrower dominate.
    // 1 at dead center, falling to 0 exactly at the canvas edge (Chebyshev/
    // max distance, not Euclidean — correct for a rectangle, where a point
    // in the exact middle of an edge is just as "at the edge" as a corner).
    function screenEdgeWeight(lng, lat) {
      var point;
      try {
        point = map.project([lng, lat]);
      } catch (e) {
        return 1;
      }
      var width = (map.transform && map.transform.width) || (map.getContainer && map.getContainer().clientWidth);
      var height = (map.transform && map.transform.height) || (map.getContainer && map.getContainer().clientHeight);
      if (!width || !height || !point || !isFinite(point.x) || !isFinite(point.y)) return 1;
      var nx = Math.abs((point.x - width / 2) / (width / 2));
      var ny = Math.abs((point.y - height / 2) / (height / 2));
      var edgeDistance = Math.max(nx, ny);
      if (edgeDistance >= 1) return 0;
      return Math.cos(edgeDistance * Math.PI / 2);
    }

    function tileVisibilityWeight(z, x, y) {
      var tileCenter = tileCenterLngLat(z, x, y);
      var horizon = horizonHalfAngleRadians();
      if (horizon != null && horizon >= MIN_MEANINGFUL_HORIZON_RADIANS) {
        var center = map.getCenter();
        var angle = angularDistanceRadians(center.lng, center.lat, tileCenter[0], tileCenter[1]);
        // Hard gate: the sphere itself occludes this tile entirely — no
        // amount of screen-edge falloff matters if it's genuinely on the
        // far side. This check doesn't depend on map.project(), so it stays
        // correct even if projection behaves oddly for occluded points.
        if (angle >= horizon) return 0;
      }
      return screenEdgeWeight(tileCenter[0], tileCenter[1]);
    }

    function parseNominalClassesHeader(headerValue) {
      if (!headerValue) return [];
      return headerValue.split(',').reduce(function(acc, part) {
        var sep = part.indexOf(':');
        if (sep === -1) return acc;
        var id = Number(part.slice(0, sep));
        var count = Number(part.slice(sep + 1));
        if (!isNaN(id) && !isNaN(count)) acc.push({ id: id, count: count });
        return acc;
      }, []);
    }

    // Finds the MapLibre-internal cache tracking which tiles are currently
    // loaded for a given source. Not part of the public API (field names
    // have moved across versions), so every access here is defensive with a
    // bounds-based fallback below.
    function getSourceCache(sourceId) {
      try {
        var style = map.style;
        if (!style) return null;
        if (style.sourceCaches && style.sourceCaches[sourceId]) return style.sourceCaches[sourceId];
        if (style._otherSourceCaches && style._otherSourceCaches[sourceId]) return style._otherSourceCaches[sourceId];
        if (typeof style.getOwnSourceCache === 'function') {
          var cache = style.getOwnSourceCache(sourceId);
          if (cache) return cache;
        }
      } catch (e) {}
      return null;
    }

    // Rectangular lat/lng-bounds approximation of the viewport tile grid.
    // Used only as a fallback when the internal source cache (below) isn't
    // reachable — on a globe this overcounts (the visible area is a curved
    // cap, not a rectangle, so at low zoom this can include tiles on the far
    // side of the sphere that were never actually fetched) and can also
    // miss tiles MapLibre did fetch near the horizon, so it's best-effort
    // (the angular weighting above is what actually corrects for this now).
    function computeCandidateTileSetFromBounds() {
      var result = new Set();
      var z = currentHeatmapTileZoom();
      var b = map.getBounds();
      var n = Math.pow(2, z);
      function lonToX(lon) { return Math.floor((lon + 180) / 360 * n); }
      function latToY(lat) {
        var clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
        var latRad = clamped * Math.PI / 180;
        return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
      }
      var x0 = lonToX(b.getWest());
      var x1 = lonToX(b.getEast());
      var y0 = Math.max(0, Math.min(n - 1, latToY(b.getNorth())));
      var y1 = Math.max(0, Math.min(n - 1, latToY(b.getSouth())));
      if (x1 < x0) x1 += n;
      var tileCount = (x1 - x0 + 1) * (y1 - y0 + 1);
      if (!(tileCount > 0) || tileCount > MAX_TRACKED_TILES) return result;
      for (var x = x0; x <= x1; x++) {
        var wrappedX = ((x % n) + n) % n;
        for (var y = y0; y <= y1; y++) {
          result.add(tileKey(z, wrappedX, y));
        }
      }
      return result;
    }

    // The set of tiles to consider weighting at all — ground truth from
    // MapLibre's own loaded-tile cache when reachable, otherwise the
    // bounds-based approximation above.
    function computeCandidateTileSet() {
      var result = new Set();
      if (!HEATMAP_TILE_URL) return result;
      var cache = getSourceCache('heatmap');
      if (cache) {
        try {
          var tiles = cache._tiles || {};
          var keys = Object.keys(tiles);
          for (var i = 0; i < keys.length; i++) {
            var tile = tiles[keys[i]];
            var coord = tile && tile.tileID && tile.tileID.canonical;
            if (coord && tile.state === 'loaded') {
              result.add(tileKey(coord.z, coord.x, coord.y));
            }
          }
          return result;
        } catch (e) {}
      }
      return computeCandidateTileSetFromBounds();
    }

    // Recomputes the full weighted class total from scratch every time —
    // same self-healing design as the Leaflet template's layer.syncClasses:
    // a full snapshot means there's no per-tile add/remove pairing that can
    // ever drift out of sync, since absence from the snapshot already means
    // "not currently visible." The angular weighting itself (screen-edge
    // falloff, horizon occlusion) is unchanged — only the output step
    // changed, from diffing against the last-sent state to just summing and
    // sending the current totals directly.
    function refreshVisibleTileClasses() {
      if (!HEATMAP_TILE_URL) return;
      var candidates = computeCandidateTileSet();
      var totals = new Map();

      candidates.forEach(function(key) {
        var classes = TILE_CLASS_CACHE.get(key);
        if (!classes || !classes.length) return;
        var parts = key.split('/');
        var weight = tileVisibilityWeight(Number(parts[0]), Number(parts[1]), Number(parts[2]));
        if (weight <= 0) return;
        classes.forEach(function(c) {
          totals.set(c.id, (totals.get(c.id) || 0) + c.count * weight);
        });
      });

      var synced = [];
      totals.forEach(function(count, id) {
        if (count > 1e-6) synced.push({ id: id, count: count });
      });

      // Skip empty syncs — see the Leaflet template's layer.syncClasses for
      // why: a genuinely empty result is far more often a mid-transition
      // artifact (tiles not finished loading/weighting yet) than a real
      // "nothing here," and sending it anyway would blank the legend for
      // that gap instead of just leaving the last real data up until the
      // next sync actually has something to replace it with.
      if (!synced.length) return;
      postToParent({ type: 'tileClassesSync', classes: synced });
    }

    function resetTileClassTracking() {
      // No "remove" message needed here — the parent already independently
      // clears its own state on a real variable switch (see maps.tsx's
      // reset effect), and the next refreshVisibleTileClasses() call will
      // send a truthful full snapshot regardless. Just drop the cached
      // per-tile header data so stale entries can't leak into whatever the
      // new heatmap URL's tiles report at the same z/x/y coordinates.
      TILE_CLASS_CACHE.clear();
    }

    // refreshVisibleTileClasses() gets triggered from several independent
    // async sources — moveend, zoomend, idle, and every individual tile
    // finishing its fetch — each of which recomputes the candidate set fresh
    // from MapLibre's internal tile cache at that instant. If the user pans
    // away before an in-flight tile fetch from the *previous* view finishes,
    // that fetch's completion can trigger a recompute that still finds the
    // old tile momentarily retained in MapLibre's cache (eviction isn't
    // instant), re-adding something that was just correctly removed — a
    // real race between overlapping triggers, not just noise. Debouncing so
    // we only actually snapshot state once things have settled avoids
    // running the computation mid-churn.
    var REFRESH_DEBOUNCE_MS = 200;
    var refreshDebounceTimer = null;
    function scheduleRefreshVisibleTileClasses() {
      if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
      refreshDebounceTimer = setTimeout(function() {
        refreshDebounceTimer = null;
        refreshVisibleTileClasses();
      }, REFRESH_DEBOUNCE_MS);
    }

    if (HEATMAP_TILE_URL && typeof maplibregl.addProtocol === 'function') {
      // MapLibre GL JS v3+ addProtocol handlers are Promise-based:
      // (params, abortController) => Promise<{ data }>, not the older
      // (params, callback) => ({ cancel }) style.
      maplibregl.addProtocol('heatmap', function(params, abortController) {
        var realUrl = params.url.slice('heatmap://'.length);
        return fetch(realUrl, { signal: abortController.signal, referrerPolicy: TILE_REFERRER_POLICY })
          .then(function(response) {
            if (!response.ok) {
              throw new Error('Heatmap tile request failed with status ' + response.status);
            }
            var match = HEATMAP_TILE_KEY_RE.exec(realUrl);
            if (match) {
              var key = tileKey(Number(match[1]), Number(match[2]), Number(match[3]));
              var classes = parseNominalClassesHeader(response.headers.get('X-Nominal-Classes'));
              TILE_CLASS_CACHE.set(key, classes);
              scheduleRefreshVisibleTileClasses();
            }
            return response.arrayBuffer();
          })
          .then(function(data) {
            return { data: data };
          });
      });
    }
`;

const GLOBE_RESIZE_OBSERVER_SCRIPT = `
    // MapLibre caches its container's pixel size at init and never
    // re-measures on its own (same underlying gotcha as Leaflet's
    // invalidateSize, fixed the same way in SpeciesOccurrenceMap.html) —
    // without this, resizing the container (most notably toggling
    // fullscreen, which the parent page now drives — see
    // onFullscreenToggle) leaves MapLibre's transform working off a stale
    // size. The angular weighting in refreshVisibleTileClasses reads
    // map.transform.width/height directly, so a stale size there would
    // desync the legend the same way a stale Leaflet container size did.
    if (typeof ResizeObserver !== 'undefined') {
      var mapEl = document.getElementById('map');
      var resizeTimer = null;
      var mapResizeObserver = new ResizeObserver(function() {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
          resizeTimer = null;
          map.resize();
        }, 150);
      });
      mapResizeObserver.observe(mapEl);
    }
`;

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
  tileMode?: MapTileMode,
  enableOfflineFallback?: boolean,
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
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.mapTileMode)
    .join(JSON.stringify(tileMode === 'dark' ? 'dark' : 'light'));
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.enableOfflineFallback)
    .join(enableOfflineFallback ? 'true' : 'false');
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.leafletResizeObserverScript)
    .join(LEAFLET_RESIZE_OBSERVER_SCRIPT);
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.leafletHeatmapTrackingScript)
    .join(LEAFLET_HEATMAP_TRACKING_SCRIPT);
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.globeTileClassTrackingScript)
    .join(GLOBE_TILE_CLASS_TRACKING_SCRIPT);
  html = html
    .split(MAP_TEMPLATE_PLACEHOLDERS.globeResizeObserverScript)
    .join(GLOBE_RESIZE_OBSERVER_SCRIPT);
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
    tileMode,
    enableOfflineFallback,
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
    tileMode,
    enableOfflineFallback,
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

// Same problem, same fix, as loadGlobeMapTemplateOffline below: the offline
// Natural Earth basemap + place-label data adds ~26MB to this template, and
// every variable switch re-runs fillMapTemplatePlaceholders' ~40
// .split()/.join() passes over the whole string — a measured ~300ms+ per
// switch, independent of zoom, entirely from that one template being this
// big. enableOfflineFallback is only ever true on the upload page, so keep
// that weight out of every other Leaflet map (species pages, maps page) by
// splitting it into its own asset.
export const loadMapTemplateOffline = async (): Promise<string | null> => {
  return loadHtmlAsset(require('./SpeciesOccurrenceMapOffline.html'));
};

export const loadGlobeMapTemplate = async (): Promise<string | null> => {
  return loadHtmlAsset(require('./SpeciesOccurrenceGlobeMap.html'));
};

// The offline vector basemap + place-label data adds ~25MB to the globe
// template — every extra .split()/.join() pass in fillMapTemplatePlaceholders
// copies that whole string, which is enough to visibly stall the globe on
// every load. Since enableOfflineFallback is only ever true on the upload
// page, keep that weight out of the template every other globe view loads by
// splitting it into its own asset, loaded only when actually needed.
export const loadGlobeMapTemplateOffline = async (): Promise<string | null> => {
  return loadHtmlAsset(require('./SpeciesOccurrenceGlobeMapOffline.html'));
};

export const loadFallbackMapTemplate = async (): Promise<string | null> => {
  return loadHtmlAsset(require('./SpeciesOccurrenceMapFallback.html'));
};
