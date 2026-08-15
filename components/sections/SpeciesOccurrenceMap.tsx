// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import {
  ActivityIndicator,
  type DimensionValue,
  Linking,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { isBasemapMode, useOptionalSettings } from '@/context/SettingsContext';
import type { ViewportTileRange } from '@/data/api';
import type { SpeciesOccurrence } from '@/data/types';
import { ThemedText } from '../text/ThemedText';
import {
  buildGlobeHtml,
  buildLeafletHtml,
  getBackgroundTileUrl,
  getElevationTerrainTileUrl,
  getLabelsOverlayTileUrl,
  getMapTileUrlTemplate,
  getSatelliteTileUrlTemplate,
  loadFallbackMapTemplate,
  loadGlobeMapTemplate,
  loadGlobeMapTemplateOffline,
  loadMapTemplate,
  loadMapTemplateOffline,
  MAP_DOCUMENT_BASE_URL,
  MAP_REFERRER_POLICY,
  type HighlightMessage,
  type MapMarkerPalette,
  toHighlightMessagePayload,
  toSelectedPointMessagePayload,
  isOpenExternalUrlMessage,
  isPinObservationMessage,
  HEATMAP_UPDATE_MESSAGE_TYPE,
  LOCATION_PICKED_MESSAGE_TYPE,
  LOCAL_LOCATION_UPDATE_MESSAGE_TYPE,
  TOGGLE_GLOBE_VIEW_MESSAGE_TYPE,
  TOGGLE_TERRAIN_MESSAGE_TYPE,
  TOGGLE_BASEMAP_MODE_MESSAGE_TYPE,
  TOGGLE_FULLSCREEN_MESSAGE_TYPE,
  TOGGLE_AUTO_ADAPT_MESSAGE_TYPE,
  TILE_CLASSES_SYNC_MESSAGE_TYPE,
  POINT_STYLES_UPDATE_MESSAGE_TYPE,
  POINTS_UPDATE_MESSAGE_TYPE,
  POLYGON_CLEARED_MESSAGE_TYPE,
  POLYGON_DRAW_START_MESSAGE_TYPE,
  POLYGON_DRAW_END_MESSAGE_TYPE,
  computePointStyleUpdates,
  preparePointsForMapHtml,
  toggleFullscreenElement,
  isPolygonDrawnMessage,
  type SelectedPointMessage,
} from './speciesOccurrenceMap/speciesOccurrenceMapHelpers';

type TilesChangedMessage = {
  type: 'tilesChanged';
} & ViewportTileRange;

function isTilesChangedMessage(msg: unknown): msg is TilesChangedMessage {
  return (
    !!msg &&
    typeof msg === 'object' &&
    'type' in msg &&
    msg.type === 'tilesChanged' &&
    'z' in msg &&
    'x0' in msg &&
    'y0' in msg &&
    'x1' in msg &&
    'y1' in msg &&
    typeof msg.z === 'number' &&
    typeof msg.x0 === 'number' &&
    typeof msg.y0 === 'number' &&
    typeof msg.x1 === 'number' &&
    typeof msg.y1 === 'number'
  );
}

type TileClassEntry = { id: number; count: number };
// A full snapshot of every nominal class currently visible, recomputed from
// scratch by the map template each time it settles (see
// SpeciesOccurrenceMap.html's layer.syncClasses) — not an incremental
// add/remove delta. Replacing the whole set each time means there's no
// per-tile add/remove pairing to keep consistent, so nothing can drift.
type TileClassesMessage = {
  type: typeof TILE_CLASSES_SYNC_MESSAGE_TYPE;
  classes: TileClassEntry[];
};

function isTileClassesMessage(msg: unknown): msg is TileClassesMessage {
  return (
    !!msg &&
    typeof msg === 'object' &&
    'type' in msg &&
    msg.type === TILE_CLASSES_SYNC_MESSAGE_TYPE &&
    'classes' in msg &&
    Array.isArray((msg as TileClassesMessage).classes)
  );
}

type PointValueMessage = { type: 'pointValue'; value: number };

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};
type MapBoundsMessage = { type: 'mapBounds' } & MapBounds;

function isMapBoundsMessage(msg: unknown): msg is MapBoundsMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === 'mapBounds' &&
    typeof m.north === 'number' &&
    typeof m.south === 'number' &&
    typeof m.east === 'number' &&
    typeof m.west === 'number'
  );
}

function isPointValueMessage(msg: unknown): msg is PointValueMessage {
  return (
    !!msg &&
    typeof msg === 'object' &&
    'type' in msg &&
    msg.type === 'pointValue' &&
    'value' in msg &&
    typeof (msg as PointValueMessage).value === 'number'
  );
}

type SpeciesOccurrenceMapProps = {
  occurrences: SpeciesOccurrence[];
  // Identity-compared only, never read — lets a caller that swaps
  // `occurrences` for reasons OTHER than a genuine new fetch (e.g.
  // _species.tsx temporarily showing the unfiltered set while a region is
  // being drawn/erased, see onPolygonDrawStart/onPolygonDrawEnd) say so:
  // the map only refits the viewport to the new marker set when THIS
  // value's identity also changed since the last refit, not on every
  // `occurrences` change. Omit entirely to keep the old "always refit on
  // occurrences change" behavior (e.g. maps.tsx/UploadPreview.tsx, which
  // don't do this kind of same-data-different-view swapping).
  refitOnOccurrencesChange?: unknown;
  loading?: boolean;
  error?: string | null;
  height?: DimensionValue;
  highlightedCatalogs?: (number | string)[];
  heatmapTileUrl?: string | null;
  heatmapOpacity?: number;
  minZoom?: number;
  maxZoom?: number | null;
  initialLat?: number | null;
  initialLon?: number | null;
  initialZoom?: number | null;
  maxBounds?: [[number, number], [number, number]] | null;
  showMarkers?: boolean;
  linkObservations?: boolean;
  allowPinObservations?: boolean;
  onPinObservation?: (catalogNumber: string, lat: number, lon: number) => void;
  selectedPoint?: { lat: number; lon: number; catalogNumber?: string } | null;
  onBoundsChange?: (tiles: ViewportTileRange) => void;
  // A full snapshot of currently-visible nominal classes, not an
  // incremental delta — see TileClassesMessage's doc comment.
  onTileClasses?: (classes: { id: number; count: number }[]) => void;
  onPointValue?: (value: number) => void;
  pointQueryUrl?: string | null;
  renderMin?: number | null;
  renderMax?: number | null;
  isCircular?: boolean;
  observationValues?: Map<string, number> | null;
  classColors?: Map<string, string> | null;
  classLabels?: Map<string, string> | null;
  classShapes?: Map<string, string> | null;
  markerOutlineEnabled?: boolean;
  circularShapesEnabled?: boolean;
  dotMin?: number | null;
  dotMax?: number | null;
  // True while the currently-selected variable's per-observation values are
  // still being fetched (classColors/isCircular/dotMin/dotMax below already
  // reflect the NEW variable synchronously — they're derived straight from
  // variable metadata — but observationValues lags behind on an async
  // fetch). Recoloring markers with the new scheme before the matching
  // values arrive flashes every dot to a default/nodata style; holding the
  // old, still-self-consistent combination until this flips back to false
  // avoids that.
  variableDataLoading?: boolean;
  onMapBounds?: (bounds: MapBounds) => void;
  disableObservationQuery?: boolean;
  varUnits?: string | null;
  gradientStops?: [number, number, number][] | null;
  aspectStops?: [number, number, number][] | null;
  useLabelsOverlay?: boolean;
  // Defaults on — set false to omit the basemap-mode toggle control (which
  // cycles standard/satellite/variable-as-basemap) entirely (e.g. maps.tsx,
  // whose heatmap/labels overlays are tuned against the light basemap's
  // contrast and where a much higher-traffic page multiplies the ArcGIS
  // tile cost of leaving satellite available).
  enableBasemapModeToggle?: boolean;
  // Off by default — set true to build the ruler-icon "auto-adapt" toggle
  // control into the map (only maps.tsx wants it). autoAdaptApplicable
  // gates whether it's currently shown at all (only meaningful for a plain
  // numeric-gradient variable — see maps.tsx's isAutoAdaptApplicable) and
  // autoAdaptEnabled is its current on/off state, both owned by the
  // caller — the button itself is a dumb trigger that reports clicks via
  // onToggleAutoAdapt rather than tracking its own state, so there's only
  // ever one source of truth for it.
  enableAutoAdaptToggle?: boolean;
  autoAdaptApplicable?: boolean;
  autoAdaptEnabled?: boolean;
  onToggleAutoAdapt?: () => void;
  preserveMapPosition?: boolean;
  locationPickerMode?: boolean;
  onLocationPicked?: (lat: number, lon: number) => void;
  localLat?: number | null;
  localLon?: number | null;
  // Region-drawing (leaflet-geoman-free on Leaflet; not yet supported on
  // the globe renderer) is driven by an in-map icon control, not a prop —
  // the map owns its own idle/drawing button state and an internal stack
  // of drawn regions. onPolygonDrawn/onPolygonCleared report the current
  // result (onPolygonDrawn always carries the FULL current set of
  // regions, not just what was newly added; onPolygonCleared fires once
  // the stack empties back out). onPolygonDrawStart/onPolygonDrawEnd
  // bracket just the act of drawing itself — a caller that filters
  // `occurrences` by the drawn region(s) can use these to temporarily pass
  // the unfiltered set instead while a new region is being drawn, so
  // points hidden by an already-active region are visible again for
  // exactly as long as it takes to draw around them.
  onPolygonDrawn?: (polygons: [number, number][][]) => void;
  onPolygonCleared?: () => void;
  onPolygonDrawStart?: () => void;
  onPolygonDrawEnd?: () => void;
  // Whatever region(s) are already active (from a prior onPolygonDrawn)
  // when this map (re)builds — read once at build time (like occurrences,
  // heatmapTileUrl, etc. above) so switching between the Leaflet and globe
  // renderers reseeds the new one's drawn-region overlay instead of only
  // carrying the filter's effect over and dropping its visual.
  initialDrawnPolygons?: [number, number][][] | null;
  // Natural Earth offline background layer (land/water/roads/places, shown
  // only when tiles fail to load). Defaults to true: the offline-capable
  // template is now ~9MB (down from ~26MB after this dataset was trimmed —
  // dropped railroads/minor roads, density-pruned places, simplified
  // geometry), a small enough cost to always load eagerly rather than
  // gating it on useIsOnline(). Loading it unconditionally also sidesteps a
  // real gap that gating had: loadHtmlAsset does a genuine fetch() at
  // runtime, so a caller that only requested the offline template once
  // already offline would find nothing had ever been cached for it —
  // "works if you happened to browse it first" isn't good enough for a
  // visitor who goes straight to airplane mode. Set false to opt back into
  // the old online-only behavior for a specific instance.
  enableOfflineFallback?: boolean;
  // Called (web only) when the in-map fullscreen button is toggled, instead
  // of this component handling it internally. Fullscreening only ever
  // covers a single DOM element and its descendants — this component's own
  // WebView/iframe is a sibling of any legend/colormap-picker overlays the
  // consuming page renders alongside it (see maps.tsx, _species.tsx,
  // UploadPreview.tsx), so fullscreening the map alone would hide them.
  // Pass a callback that toggles fullscreen on a wider ancestor that
  // actually contains those overlays too. Omit to fall back to
  // fullscreening just this component (map-only, no overlays) — better
  // than nothing, but a page with its own overlays should provide this.
  onFullscreenToggle?: () => void;
};

export function SpeciesOccurrenceMap({
  occurrences,
  refitOnOccurrencesChange,
  loading = false,
  error = null,
  height,
  highlightedCatalogs = [],
  heatmapTileUrl = null,
  heatmapOpacity = 0.85,
  minZoom = 0,
  maxZoom = null,
  initialLat = null,
  initialLon = null,
  initialZoom = null,
  maxBounds = null,
  showMarkers = true,
  linkObservations = true,
  allowPinObservations = true,
  onPinObservation,
  selectedPoint = null,
  onBoundsChange,
  onTileClasses,
  onPointValue,
  pointQueryUrl = null,
  renderMin = null,
  renderMax = null,
  isCircular = false,
  observationValues = null,
  classColors = null,
  classLabels = null,
  classShapes = null,
  markerOutlineEnabled = false,
  circularShapesEnabled = false,
  dotMin = null,
  dotMax = null,
  variableDataLoading = false,
  onMapBounds,
  disableObservationQuery = false,
  varUnits = null,
  gradientStops = null,
  aspectStops = null,
  useLabelsOverlay = false,
  enableBasemapModeToggle = true,
  enableAutoAdaptToggle = false,
  autoAdaptApplicable = false,
  autoAdaptEnabled = false,
  onToggleAutoAdapt,
  preserveMapPosition = false,
  locationPickerMode = false,
  onLocationPicked,
  localLat = null,
  localLon = null,
  onPolygonDrawn,
  onPolygonCleared,
  onPolygonDrawStart,
  onPolygonDrawEnd,
  initialDrawnPolygons,
  enableOfflineFallback = true,
  onFullscreenToggle,
}: SpeciesOccurrenceMapProps) {
  const fallbackWarningMessage =
    'Unable to load the bundled map renderer. Showing the fallback map.';
  const rendererLoadErrorMessage = 'Unable to load the map renderer.';
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const webViewRef = React.useRef<WebView>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  // react-native-web forwards View refs to the underlying DOM node — used
  // as the default (map-only) fullscreen target when a page doesn't supply
  // onFullscreenToggle. Typed loosely since this only matters on web.
  const containerRef = React.useRef<View | null>(null);
  const [mapReady, setMapReady] = React.useState(false);
  // Even when a fixed `height` prop is set (the common case — most pages
  // give the map a set height in its normal layout), fullscreen should fill
  // the whole screen rather than leaving the map pinned at its original
  // pixel height with blank space below it. Fullscreen is toggled on some
  // ancestor of this component (see onFullscreenToggle), not on this
  // component's own root, so this can't just check "is my own node the
  // fullscreen element" — it checks containment instead.
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const fullscreenDoc = document as Document & {
      webkitFullscreenElement?: Element | null;
    };
    const updateIsFullscreen = () => {
      const fullscreenElement =
        fullscreenDoc.fullscreenElement ??
        fullscreenDoc.webkitFullscreenElement;
      const node = containerRef.current as unknown as Element | null;
      setIsFullscreen(
        !!fullscreenElement && !!node && fullscreenElement.contains(node),
      );
    };
    updateIsFullscreen();
    document.addEventListener('fullscreenchange', updateIsFullscreen);
    document.addEventListener('webkitfullscreenchange', updateIsFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', updateIsFullscreen);
      document.removeEventListener(
        'webkitfullscreenchange',
        updateIsFullscreen,
      );
    };
  }, []);
  const initialLocalLat = React.useRef(localLat);
  const initialLocalLon = React.useRef(localLon);
  const [mapTemplate, setMapTemplate] = React.useState<string | null>(null);
  const [templateLoadWarning, setTemplateLoadWarning] = React.useState<
    string | null
  >(null);
  const [templateLoadError, setTemplateLoadError] = React.useState<
    string | null
  >(null);

  const settings = useOptionalSettings();
  const globeViewSupported = Platform.OS === 'web';
  const globeView = globeViewSupported && !!settings?.globeViewEnabled;

  const handlePinObservation = React.useCallback(
    (catalogNumber: string, latitude: number, longitude: number) => {
      onPinObservation?.(catalogNumber, latitude, longitude);
    },
    [onPinObservation],
  );

  const openExternalUrl = React.useCallback((url: string) => {
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.open === 'function'
    ) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    void Linking.openURL(url);
  }, []);

  const handleNativeMapMessage = React.useCallback(
    (msg: unknown) => {
      if (isPinObservationMessage(msg)) {
        handlePinObservation(msg.catalogNumber, msg.latitude, msg.longitude);
        return;
      }

      if (isOpenExternalUrlMessage(msg)) {
        openExternalUrl(msg.url);
        return;
      }

      if (isTilesChangedMessage(msg)) {
        onBoundsChange?.(msg);
        return;
      }

      if (isTileClassesMessage(msg)) {
        onTileClasses?.(msg.classes);
        return;
      }

      if (isPointValueMessage(msg)) {
        onPointValue?.(msg.value);
        return;
      }

      if (isMapBoundsMessage(msg)) {
        onMapBounds?.({
          north: msg.north,
          south: msg.south,
          east: msg.east,
          west: msg.west,
        });
        return;
      }

      if (
        msg &&
        typeof msg === 'object' &&
        'type' in msg &&
        msg.type === LOCATION_PICKED_MESSAGE_TYPE &&
        'lat' in msg &&
        'lon' in msg &&
        typeof (msg as Record<string, unknown>).lat === 'number' &&
        typeof (msg as Record<string, unknown>).lon === 'number'
      ) {
        const m = msg as { lat: number; lon: number };
        onLocationPicked?.(m.lat, m.lon);
        return;
      }

      if (isPolygonDrawnMessage(msg)) {
        onPolygonDrawn?.(msg.polygons);
        return;
      }

      if (
        msg &&
        typeof msg === 'object' &&
        'type' in msg &&
        msg.type === POLYGON_CLEARED_MESSAGE_TYPE
      ) {
        onPolygonCleared?.();
        return;
      }

      if (
        msg &&
        typeof msg === 'object' &&
        'type' in msg &&
        msg.type === POLYGON_DRAW_START_MESSAGE_TYPE
      ) {
        onPolygonDrawStart?.();
        return;
      }

      if (
        msg &&
        typeof msg === 'object' &&
        'type' in msg &&
        msg.type === POLYGON_DRAW_END_MESSAGE_TYPE
      ) {
        onPolygonDrawEnd?.();
        return;
      }

      if (
        msg &&
        typeof msg === 'object' &&
        'type' in msg &&
        msg.type === TOGGLE_AUTO_ADAPT_MESSAGE_TYPE
      ) {
        onToggleAutoAdapt?.();
      }
    },
    [
      handlePinObservation,
      onBoundsChange,
      onTileClasses,
      onPointValue,
      onMapBounds,
      openExternalUrl,
      onLocationPicked,
      onPolygonDrawn,
      onPolygonCleared,
      onPolygonDrawStart,
      onPolygonDrawEnd,
      onToggleAutoAdapt,
    ],
  );

  const hasOccurrences = occurrences.length > 0;
  // Tracks which renderer the currently-loaded mapTemplate was fetched for.
  // heatmapTileUrl (and hasOccurrences/locationPickerMode) have to stay in
  // this effect's deps so it reacts the first time either becomes available
  // — on maps.tsx, occurrences is always [] and heatmapTileUrl is the only
  // signal that there's anything to show at all. But once a template is
  // already loaded for the current (globeView, enableOfflineFallback) pair,
  // re-running the fetch on every later heatmapTileUrl change (switching
  // colormap/variable/class filter/value range, all of which change the
  // tile URL) was refetching the same bytes into a new string instance,
  // which — since preserveMapPosition's whole point is to push those
  // changes via postMessage instead — pointlessly rebuilt the html memo and
  // fully reloaded the iframe. That reload silently destroys whatever the
  // old iframe was mid-tracking (in-flight tileClasses adds with no chance
  // to ever send the matching tileClassesRemoved), which is exactly what
  // made the nominal legend's live counts drift/stick.
  const loadedRendererKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (
      loading ||
      error ||
      (!hasOccurrences && !heatmapTileUrl && !locationPickerMode)
    ) {
      return;
    }

    const rendererKey = `${globeView}:${enableOfflineFallback}`;
    if (mapTemplate && loadedRendererKeyRef.current === rendererKey) {
      return;
    }

    let isMounted = true;

    void (async () => {
      const templateContent = globeView
        ? await (enableOfflineFallback
            ? loadGlobeMapTemplateOffline()
            : loadGlobeMapTemplate())
        : await (enableOfflineFallback
            ? loadMapTemplateOffline()
            : loadMapTemplate());
      if (!isMounted) {
        return;
      }

      if (templateContent) {
        loadedRendererKeyRef.current = rendererKey;
        setMapTemplate(templateContent);
        setTemplateLoadWarning(null);
        setTemplateLoadError(null);
        return;
      }

      const fallbackTemplate = await loadFallbackMapTemplate();
      if (!isMounted) {
        return;
      }

      if (fallbackTemplate) {
        loadedRendererKeyRef.current = rendererKey;
        setMapTemplate(fallbackTemplate);
        setTemplateLoadWarning(fallbackWarningMessage);
        setTemplateLoadError(null);
        return;
      }

      loadedRendererKeyRef.current = null;
      setMapTemplate(null);
      setTemplateLoadWarning(null);
      setTemplateLoadError(rendererLoadErrorMessage);
    })();

    return () => {
      isMounted = false;
    };
  }, [
    error,
    hasOccurrences,
    heatmapTileUrl,
    loading,
    locationPickerMode,
    globeView,
    enableOfflineFallback,
    mapTemplate,
  ]);

  const markerPalette = React.useMemo<MapMarkerPalette>(
    () => ({
      markerFill: palette.background.brand.default,
      markerStroke: palette.border.brand.default,
      highlightFill: palette.background.danger.default,
      highlightStroke: palette.border.danger.default,
      selectedPointFill: '#F59E0B',
      selectedPointStroke: '#F59E0B',
      surfaceBackground: palette.background.default.secondary,
      surfaceBorder: palette.background.default.tertiary,
      surfaceText: palette.text.default.default,
      linkColor: palette.text.brand.default,
    }),
    [
      palette.background.brand.default,
      palette.background.danger.default,
      palette.background.default.secondary,
      palette.background.default.tertiary,
      palette.border.brand.default,
      palette.border.danger.default,
      palette.text.brand.default,
      palette.text.default.default,
    ],
  );
  const highlightKeys = React.useMemo(
    () => highlightedCatalogs.map((id) => String(id)),
    [highlightedCatalogs],
  );
  const tileUrlTemplate = React.useMemo(
    () =>
      useLabelsOverlay ? getBackgroundTileUrl() : getMapTileUrlTemplate(mode),
    [mode, useLabelsOverlay],
  );
  // Pages with the 3-way basemap toggle (see enableBasemapModeToggle) also
  // want a labels overlay — but only shown in 'satellite'/'variable' modes
  // (see the in-template tileUrlForBasemapMode/applyBasemapMode), not
  // 'standard', which already has labels baked into tileUrlTemplate's own
  // style. useLabelsOverlay's simpler always-on case (maps.tsx, no toggle)
  // stays independent of that.
  const labelsOverlayTileUrl = React.useMemo(
    () =>
      useLabelsOverlay || enableBasemapModeToggle
        ? getLabelsOverlayTileUrl()
        : null,
    [useLabelsOverlay, enableBasemapModeToggle],
  );
  // 'variable' basemap mode's basemap tile — the same simpler background +
  // labels-overlay combo maps.tsx always uses (see getBackgroundTileUrl),
  // rather than the normal full-detail tileUrlTemplate used for 'standard'
  // mode. Only relevant on pages with the 3-way toggle at all.
  const variableModeBackgroundTileUrl = React.useMemo(
    () => (enableBasemapModeToggle ? getBackgroundTileUrl() : null),
    [enableBasemapModeToggle],
  );
  // Terrain is a MapLibre-only (globe) feature — always the same global DEM,
  // so no memo dependency beyond globeView itself. Whether it's actually
  // rendered is a runtime toggle inside the globe template itself (a
  // mountain-icon control next to the other map controls) rather than a
  // prop, since MapLibre logs "terrain is not fully supported on vertical
  // perspective projection" — flipping terrain on/off can be a real perf
  // lever on some devices, so users get a switch instead of us guessing.
  const terrainTileUrl = React.useMemo(
    () => (globeView ? getElevationTerrainTileUrl() : null),
    [globeView],
  );
  // Satellite basemap works on both renderers (unlike terrain, which is
  // MapLibre-only) — same backend proxy URL regardless of render, gated
  // only by the enableBasemapModeToggle prop (see its doc comment).
  const satelliteTileUrl = React.useMemo(
    () => (enableBasemapModeToggle ? getSatelliteTileUrlTemplate() : null),
    [enableBasemapModeToggle],
  );

  // When preserveMapPosition is true, the html memo is built once with initial
  // values for the "live" props. Subsequent changes are sent via postMessage so
  // Leaflet can update the tile layer without reloading the WebView.
  const initialHeatmapTileUrl = React.useRef(heatmapTileUrl);
  const initialPointQueryUrl = React.useRef(pointQueryUrl);
  const initialRenderMin = React.useRef(renderMin);
  const initialRenderMax = React.useRef(renderMax);
  const initialVarUnits = React.useRef(varUnits);
  // classColors/isCircular/dotMin/dotMax come straight from variable
  // metadata (synchronous), while observationValues lags behind an async
  // fetch — so at the exact instant this ref is born, it's possible for the
  // scale to already describe the new variable while there's no per-point
  // data yet to go with it. Baking that mismatch into the initial HTML
  // renders every dot as "nodata" (scale active, value null) instead of a
  // plain default until the first pointStylesUpdate corrects it. Freezing
  // the scale to a neutral, self-consistent state whenever
  // variableDataLoading is true at capture time (matching
  // observationValues, which is null in that state too) keeps the initial
  // paint a plain default instead of a broken-looking nodata flash.
  const initialDotMin = React.useRef(variableDataLoading ? null : dotMin);
  const initialDotMax = React.useRef(variableDataLoading ? null : dotMax);
  const initialGradientStops = React.useRef(gradientStops);
  const initialAspectStops = React.useRef(aspectStops);
  const initialIsCircular = React.useRef(
    variableDataLoading ? false : isCircular,
  );
  const initialClassColors = React.useRef(
    variableDataLoading ? null : classColors,
  );
  const initialClassLabels = React.useRef(
    variableDataLoading ? null : classLabels,
  );
  const initialClassShapes = React.useRef(
    variableDataLoading ? null : classShapes,
  );
  const initialMarkerOutlineEnabled = React.useRef(markerOutlineEnabled);
  // Freezing these too means a variable switch on the species/upload pages
  // (which changes observationValues — new per-observation values for
  // whatever's now selected — but not occurrences' positions) no longer
  // forces the html memo to rebuild the whole WebView/iframe. The new
  // per-point colors/shapes are instead pushed live via postMessage (see
  // the pointStylesUpdate effect below), the same way heatmap tile/legend
  // updates already work.
  const initialOccurrences = React.useRef(occurrences);
  const initialObservationValues = React.useRef(
    variableDataLoading ? null : observationValues,
  );
  const initialCircularShapesEnabled = React.useRef(circularShapesEnabled);
  // Same freeze-at-build-time treatment as the refs above: the terrain
  // toggle button (inside the globe template) applies itself instantly and
  // locally, then only tells settings.terrainEnabled about it for next
  // time — if the live setting were used directly here instead, clicking
  // the toggle would also change this html memo's inputs and force a full
  // iframe rebuild right after the map already updated itself, undoing the
  // whole point of preserveMapPosition.
  const initialTerrainEnabled = React.useRef(settings?.terrainEnabled ?? false);
  // Same freeze-at-build-time treatment, for the basemap mode toggle. When
  // the toggle itself is disabled (enableBasemapModeToggle=false, e.g.
  // maps.tsx), the template must NOT be driven by the shared/global
  // settings.basemapMode — that setting can be left on 'standard'/'satellite'
  // from a different page (e.g. the species page), and with no toggle button
  // rendered here there'd be no way to ever switch it back, permanently
  // hiding this map's heatmap overlay. 'variable' is the mode that shows the
  // heatmap without changing the basemap tile itself (see
  // tileUrlForBasemapMode in the map templates), matching this prop's
  // pre-toggle behavior of always showing the overlay whenever a
  // heatmapTileUrl is provided.
  const effectiveBasemapMode = enableBasemapModeToggle
    ? (settings?.basemapMode ?? 'standard')
    : 'variable';
  const initialBasemapMode = React.useRef(effectiveBasemapMode);
  const initialAutoAdaptApplicable = React.useRef(autoAdaptApplicable);
  const initialAutoAdaptEnabled = React.useRef(autoAdaptEnabled);
  // Same reasoning as initialTerrainEnabled above, for drawn regions:
  // drawing/erasing while staying on the SAME renderer already updates
  // that renderer's own DOM directly (no round trip needed) — only a
  // renderer switch (mapTemplate changing) should reseed from this.
  const initialDrawnPolygonsRef = React.useRef(initialDrawnPolygons ?? null);
  // Tracks the last occurrences reference actually pushed to the map via
  // pointsUpdate (see below) — deliberately separate from initialOccurrences
  // above, which must stay frozen for the html memo's sake. When a location/
  // phenology filter genuinely changes which occurrences were fetched (as
  // opposed to a variable switch, which only changes observationValues for
  // the same occurrences), the map needs a real marker-set swap + refit,
  // not just a recolor.
  const lastSyncedOccurrences = React.useRef(occurrences);
  // The refitOnOccurrencesChange identity as of the last time the map was
  // actually told to refit — see that prop's doc comment. Also frozen at
  // the live value on mount for the same reason as lastSyncedOccurrences:
  // the initial html build already reflects whatever's current.
  const lastRefitKey = React.useRef(refitOnOccurrencesChange);

  // The refs above are meant to capture "whatever was true when the current
  // WebView/iframe document was built," not "whatever was true on this
  // component's very first render ever" — but a plain useRef(initialValue)
  // only ever does the latter. Without this, switching renderers (e.g.
  // toggling globe view, which forces mapTemplate to reload) rebuilds the
  // iframe using props frozen from the original mount — on maps.tsx that's
  // always the landcover default — and the freshly built map would flash
  // that stale data until a live postMessage update corrects it. Resetting
  // these refs synchronously during render (an accepted React pattern for
  // "reset derived state when a key changes") whenever mapTemplate changes
  // — i.e. whenever the underlying document is genuinely about to be
  // rebuilt from scratch — makes the *next* html build start from current
  // truth instead of ancient history.
  const mapTemplateForInitialRefs = React.useRef(mapTemplate);
  if (mapTemplateForInitialRefs.current !== mapTemplate) {
    mapTemplateForInitialRefs.current = mapTemplate;
    initialHeatmapTileUrl.current = heatmapTileUrl;
    initialPointQueryUrl.current = pointQueryUrl;
    initialRenderMin.current = renderMin;
    initialRenderMax.current = renderMax;
    initialVarUnits.current = varUnits;
    // See the initial-ref comment above: keep the same neutral,
    // self-consistent freeze while a variable's data is still loading, so
    // toggling renderers (e.g. Leaflet/Globe) mid-fetch doesn't rebuild the
    // new template with a scale/values mismatch either.
    initialDotMin.current = variableDataLoading ? null : dotMin;
    initialDotMax.current = variableDataLoading ? null : dotMax;
    initialGradientStops.current = gradientStops;
    initialAspectStops.current = aspectStops;
    initialIsCircular.current = variableDataLoading ? false : isCircular;
    initialClassColors.current = variableDataLoading ? null : classColors;
    initialClassLabels.current = variableDataLoading ? null : classLabels;
    initialClassShapes.current = variableDataLoading ? null : classShapes;
    initialMarkerOutlineEnabled.current = markerOutlineEnabled;
    initialOccurrences.current = occurrences;
    initialObservationValues.current = variableDataLoading
      ? null
      : observationValues;
    initialCircularShapesEnabled.current = circularShapesEnabled;
    initialTerrainEnabled.current = settings?.terrainEnabled ?? false;
    initialBasemapMode.current = effectiveBasemapMode;
    initialAutoAdaptApplicable.current = autoAdaptApplicable;
    initialAutoAdaptEnabled.current = autoAdaptEnabled;
    initialDrawnPolygonsRef.current = initialDrawnPolygons ?? null;
  }

  // When preserving map position, freeze live props to their initial values so
  // the html memo stays stable and we update the map via postMessage instead.
  const memoHeatmapTileUrl = preserveMapPosition
    ? initialHeatmapTileUrl.current
    : heatmapTileUrl;
  const memoPointQueryUrl = preserveMapPosition
    ? initialPointQueryUrl.current
    : pointQueryUrl;
  const memoRenderMin = preserveMapPosition
    ? initialRenderMin.current
    : renderMin;
  const memoRenderMax = preserveMapPosition
    ? initialRenderMax.current
    : renderMax;
  const memoVarUnits = preserveMapPosition ? initialVarUnits.current : varUnits;
  const memoDotMin = preserveMapPosition ? initialDotMin.current : dotMin;
  const memoDotMax = preserveMapPosition ? initialDotMax.current : dotMax;
  const memoGradientStops = preserveMapPosition
    ? initialGradientStops.current
    : gradientStops;
  const memoAspectStops = preserveMapPosition
    ? initialAspectStops.current
    : aspectStops;
  const memoIsCircular = preserveMapPosition
    ? initialIsCircular.current
    : isCircular;
  const memoClassColors = preserveMapPosition
    ? initialClassColors.current
    : classColors;
  const memoClassLabels = preserveMapPosition
    ? initialClassLabels.current
    : classLabels;
  const memoClassShapes = preserveMapPosition
    ? initialClassShapes.current
    : classShapes;
  const memoMarkerOutlineEnabled = preserveMapPosition
    ? initialMarkerOutlineEnabled.current
    : markerOutlineEnabled;
  const memoOccurrences = preserveMapPosition
    ? initialOccurrences.current
    : occurrences;
  const memoObservationValues = preserveMapPosition
    ? initialObservationValues.current
    : observationValues;
  const memoCircularShapesEnabled = preserveMapPosition
    ? initialCircularShapesEnabled.current
    : circularShapesEnabled;
  const memoTerrainEnabled = preserveMapPosition
    ? initialTerrainEnabled.current
    : (settings?.terrainEnabled ?? false);
  const memoBasemapMode = preserveMapPosition
    ? initialBasemapMode.current
    : effectiveBasemapMode;
  const memoInitialDrawnPolygons = preserveMapPosition
    ? initialDrawnPolygonsRef.current
    : (initialDrawnPolygons ?? null);
  const memoAutoAdaptApplicable = preserveMapPosition
    ? initialAutoAdaptApplicable.current
    : autoAdaptApplicable;
  const memoAutoAdaptEnabled = preserveMapPosition
    ? initialAutoAdaptEnabled.current
    : autoAdaptEnabled;

  const html = React.useMemo(() => {
    if (!mapTemplate) {
      return null;
    }
    const buildHtml = globeView ? buildGlobeHtml : buildLeafletHtml;
    return buildHtml(
      mapTemplate,
      memoOccurrences,
      markerPalette,
      tileUrlTemplate,
      memoHeatmapTileUrl,
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
      memoPointQueryUrl,
      memoRenderMin,
      memoRenderMax,
      memoIsCircular,
      memoObservationValues,
      memoClassColors,
      memoClassLabels,
      memoDotMin,
      memoDotMax,
      disableObservationQuery,
      memoVarUnits,
      memoGradientStops,
      memoAspectStops,
      memoClassShapes,
      memoMarkerOutlineEnabled,
      memoCircularShapesEnabled,
      labelsOverlayTileUrl,
      null,
      locationPickerMode,
      initialLocalLat.current,
      initialLocalLon.current,
      mode,
      enableOfflineFallback,
      terrainTileUrl,
      memoTerrainEnabled,
      memoInitialDrawnPolygons,
      memoBasemapMode,
      satelliteTileUrl,
      variableModeBackgroundTileUrl,
      settings?.units,
      enableAutoAdaptToggle,
      memoAutoAdaptApplicable,
      memoAutoAdaptEnabled,
    );
  }, [
    allowPinObservations,
    memoObservationValues,
    memoCircularShapesEnabled,
    disableObservationQuery,
    heatmapOpacity,
    initialLat,
    initialLon,
    initialZoom,
    mapTemplate,
    markerPalette,
    maxBounds,
    maxZoom,
    minZoom,
    memoOccurrences,
    showMarkers,
    linkObservations,
    tileUrlTemplate,
    labelsOverlayTileUrl,
    locationPickerMode,
    memoHeatmapTileUrl,
    memoPointQueryUrl,
    memoRenderMin,
    memoRenderMax,
    memoVarUnits,
    memoDotMin,
    memoDotMax,
    memoGradientStops,
    memoAspectStops,
    memoIsCircular,
    memoClassColors,
    memoClassLabels,
    memoClassShapes,
    memoMarkerOutlineEnabled,
    mode,
    enableOfflineFallback,
    globeView,
    terrainTileUrl,
    memoTerrainEnabled,
    memoInitialDrawnPolygons,
    memoBasemapMode,
    satelliteTileUrl,
    variableModeBackgroundTileUrl,
    settings?.units,
    enableAutoAdaptToggle,
    memoAutoAdaptApplicable,
    memoAutoAdaptEnabled,
  ]);

  React.useEffect(() => {
    setMapReady(false);
  }, [html]);

  const highlightMessage = React.useMemo(
    () => toHighlightMessagePayload(highlightKeys),
    [highlightKeys],
  );
  const selectedPointMessage = React.useMemo<SelectedPointMessage>(
    () =>
      toSelectedPointMessagePayload(
        selectedPoint
          ? {
              latitude: selectedPoint.lat,
              longitude: selectedPoint.lon,
              catalogNumber: selectedPoint.catalogNumber,
            }
          : null,
      ),
    [selectedPoint],
  );
  const shouldFillAvailableHeight = height == null || isFullscreen;
  const feedbackContainerStyle = [
    styles.feedback,
    shouldFillAvailableHeight && styles.feedbackFill,
  ];
  const loadingMessage = loading
    ? 'Loading observations map…'
    : 'Loading map renderer…';

  const sendHighlightMessage = React.useCallback(
    (message: HighlightMessage | SelectedPointMessage) => {
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(message, '*');
      } else {
        webViewRef.current?.postMessage(JSON.stringify(message));
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!mapReady || !hasOccurrences) {
      return;
    }
    sendHighlightMessage(highlightMessage);
  }, [hasOccurrences, highlightMessage, mapReady, sendHighlightMessage]);

  React.useEffect(() => {
    if (!mapReady || (!hasOccurrences && !heatmapTileUrl)) {
      return;
    }
    sendHighlightMessage(selectedPointMessage);
  }, [
    hasOccurrences,
    heatmapTileUrl,
    mapReady,
    selectedPointMessage,
    sendHighlightMessage,
  ]);

  // Tile/legend-only concerns — nothing here feeds marker per-point color
  // resolution (see the single consolidated marker-style effect below),
  // so this can update independently without any risk of a scale/value
  // mismatch flashing on the markers themselves.
  React.useEffect(() => {
    if (!preserveMapPosition || !mapReady) return;
    const msg: Record<string, unknown> = {
      type: HEATMAP_UPDATE_MESSAGE_TYPE,
      heatmapTileUrl,
      pointQueryUrl,
      renderMin,
      renderMax,
      varUnits,
      classShapes: classShapes ? Object.fromEntries(classShapes) : null,
      markerOutline: markerOutlineEnabled,
      autoAdaptApplicable,
      autoAdaptEnabled,
    };
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    } else {
      webViewRef.current?.postMessage(JSON.stringify(msg));
    }
  }, [
    preserveMapPosition,
    mapReady,
    heatmapTileUrl,
    pointQueryUrl,
    renderMin,
    renderMax,
    varUnits,
    classShapes,
    markerOutlineEnabled,
    autoAdaptApplicable,
    autoAdaptEnabled,
  ]);

  // The single source of truth for "what color/shape does each marker get,
  // right now": both the color SCALE (dotMin/dotMax/isCircular/classColors/
  // classLabels/gradientStops/aspectStops — derived synchronously from
  // variable metadata) and the per-point VALUES (observationValues — loaded
  // async, behind variableDataLoading) are bundled into one message and
  // applied by one handler in the iframe. Splitting these across separate
  // messages/effects (as this used to do — a heatmapUpdate-carried scale, a
  // standalone colormapUpdate, and this point-values update, each on its
  // own timer) meant the iframe could receive a new scale before the
  // matching values arrived (or vice versa) and repaint with a mismatched
  // combination — every dot flashing nodata/default until the next message
  // caught it up. One message, one handler, one repaint removes that
  // ordering hazard structurally instead of by gating each one separately.
  React.useEffect(() => {
    if (!preserveMapPosition || !mapReady || variableDataLoading) return;
    // Deliberately NOT skipped when there are zero points to update (e.g.
    // maps.tsx, which always passes occurrences={[]} since it has no
    // occurrence markers at all) — this message is the only place the
    // color SCALE globals (isCircular/dotMin/dotMax/gradientStops/
    // aspectStops/classColors) get pushed live, and those are also read by
    // the point-query popup (formatPointValueHtml), which has nothing to
    // do with markers. Skipping the send here left them frozen at
    // whatever the iframe was first built with, so switching to e.g. a
    // circular variable on the no-markers map never updated IS_CIRCULAR —
    // the popup fell through to the plain value with no dot/unit.
    const updates = computePointStyleUpdates(
      occurrences,
      observationValues,
      classColors,
      classLabels,
      classShapes,
      circularShapesEnabled,
    );
    const msg: Record<string, unknown> = {
      type: POINT_STYLES_UPDATE_MESSAGE_TYPE,
      points: updates,
      dotMin,
      dotMax,
      isCircular,
      classColors: classColors ? Object.fromEntries(classColors) : null,
      classLabels: classLabels ? Object.fromEntries(classLabels) : null,
      gradientStops: gradientStops ?? null,
      aspectStops: aspectStops ?? null,
    };
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    } else {
      webViewRef.current?.postMessage(JSON.stringify(msg));
    }
  }, [
    preserveMapPosition,
    mapReady,
    variableDataLoading,
    occurrences,
    observationValues,
    classColors,
    classLabels,
    classShapes,
    circularShapesEnabled,
    dotMin,
    dotMax,
    isCircular,
    gradientStops,
    aspectStops,
  ]);

  // Fires only when occurrences itself changes (a genuinely different set
  // of points — e.g. a location/phenology filter refetching from the
  // backend, or the upload page's offline client-side filter), as opposed
  // to the pointStylesUpdate effect above, which fires when the same
  // occurrences just need new colors. Rebuilds the marker layer either
  // way; refits the viewport to the new results UNLESS refitOnOccurrences
  // Change says this particular swap isn't a "new dataset" (see that
  // prop's doc comment) — holding position wouldn't make sense for a
  // genuinely different dataset, but would for e.g. a region-filter toggle
  // over the same underlying data.
  React.useEffect(() => {
    if (!preserveMapPosition || !mapReady) return;
    if (occurrences === lastSyncedOccurrences.current) return;
    lastSyncedOccurrences.current = occurrences;
    const shouldRefit =
      refitOnOccurrencesChange === undefined ||
      refitOnOccurrencesChange !== lastRefitKey.current;
    lastRefitKey.current = refitOnOccurrencesChange;
    const newPoints = preparePointsForMapHtml(
      occurrences,
      observationValues,
      classColors,
      classLabels,
      classShapes,
      circularShapesEnabled,
    );
    const msg = {
      type: POINTS_UPDATE_MESSAGE_TYPE,
      points: newPoints,
      preserveViewport: !shouldRefit,
    };
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    } else {
      webViewRef.current?.postMessage(JSON.stringify(msg));
    }
  }, [
    preserveMapPosition,
    mapReady,
    occurrences,
    refitOnOccurrencesChange,
    observationValues,
    classColors,
    classLabels,
    classShapes,
    circularShapesEnabled,
  ]);

  React.useEffect(() => {
    if (!locationPickerMode || !mapReady) return;
    const msg = {
      type: LOCAL_LOCATION_UPDATE_MESSAGE_TYPE,
      lat: localLat,
      lon: localLon,
    };
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    } else {
      webViewRef.current?.postMessage(JSON.stringify(msg));
    }
  }, [locationPickerMode, mapReady, localLat, localLon]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    if (
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function'
    ) {
      return;
    }
    const handler = (event: MessageEvent) => {
      const frameWindow = iframeRef.current?.contentWindow;
      const { data, source } = event;

      if (
        frameWindow &&
        source === frameWindow &&
        isPinObservationMessage(data)
      ) {
        handlePinObservation(data.catalogNumber, data.latitude, data.longitude);
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        isOpenExternalUrlMessage(data)
      ) {
        openExternalUrl(data.url);
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        isTilesChangedMessage(data)
      ) {
        onBoundsChange?.(data);
        return;
      }

      if (frameWindow && source === frameWindow && isTileClassesMessage(data)) {
        onTileClasses?.(data.classes);
        return;
      }

      if (frameWindow && source === frameWindow && isPointValueMessage(data)) {
        onPointValue?.(data.value);
        return;
      }

      if (frameWindow && source === frameWindow && isMapBoundsMessage(data)) {
        onMapBounds?.({
          north: data.north,
          south: data.south,
          east: data.east,
          west: data.west,
        });
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === LOCATION_PICKED_MESSAGE_TYPE &&
        'lat' in data &&
        'lon' in data &&
        typeof (data as Record<string, unknown>).lat === 'number' &&
        typeof (data as Record<string, unknown>).lon === 'number'
      ) {
        const d = data as { lat: number; lon: number };
        onLocationPicked?.(d.lat, d.lon);
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        isPolygonDrawnMessage(data)
      ) {
        onPolygonDrawn?.(data.polygons);
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === POLYGON_CLEARED_MESSAGE_TYPE
      ) {
        onPolygonCleared?.();
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === POLYGON_DRAW_START_MESSAGE_TYPE
      ) {
        onPolygonDrawStart?.();
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === POLYGON_DRAW_END_MESSAGE_TYPE
      ) {
        onPolygonDrawEnd?.();
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === TOGGLE_GLOBE_VIEW_MESSAGE_TYPE
      ) {
        settings?.setGlobeViewEnabled(!settings.globeViewEnabled);
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === TOGGLE_TERRAIN_MESSAGE_TYPE
      ) {
        // The map already applied the toggle live and locally (see the
        // mountain-icon control in SpeciesOccurrenceGlobeMap.html) — this
        // only persists the choice to settings.terrainEnabled, the same
        // AsyncStorage-backed pattern as globeViewEnabled, so a later
        // reload starts with whatever the user last picked instead of
        // always defaulting on.
        settings?.setTerrainEnabled(!settings.terrainEnabled);
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === TOGGLE_BASEMAP_MODE_MESSAGE_TYPE &&
        'mode' in data &&
        typeof (data as { mode?: unknown }).mode === 'string' &&
        isBasemapMode((data as { mode: string }).mode)
      ) {
        // Same split as TOGGLE_TERRAIN_MESSAGE_TYPE above: the map already
        // cycled its basemap tiles live and locally (see the toggle control
        // in SpeciesOccurrenceMap.html/SpeciesOccurrenceGlobeMap.html) —
        // this only persists the choice to settings.basemapMode so a later
        // reload starts with whatever was last picked.
        settings?.setBasemapMode(
          (data as { mode: 'standard' | 'satellite' | 'variable' }).mode,
        );
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === TOGGLE_FULLSCREEN_MESSAGE_TYPE
      ) {
        if (onFullscreenToggle) {
          onFullscreenToggle();
        } else {
          toggleFullscreenElement(
            containerRef.current as unknown as Element | null,
          );
        }
        return;
      }

      if (
        frameWindow &&
        source === frameWindow &&
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === TOGGLE_AUTO_ADAPT_MESSAGE_TYPE
      ) {
        onToggleAutoAdapt?.();
      }
    };
    window.addEventListener('message', handler);
    return () => {
      if (typeof window.removeEventListener === 'function') {
        window.removeEventListener('message', handler);
      }
    };
  }, [
    handlePinObservation,
    onBoundsChange,
    onMapBounds,
    onTileClasses,
    onPointValue,
    openExternalUrl,
    onLocationPicked,
    onPolygonDrawn,
    onPolygonCleared,
    onPolygonDrawStart,
    onPolygonDrawEnd,
    settings,
    onFullscreenToggle,
    onToggleAutoAdapt,
  ]);

  if (error) {
    return (
      <View style={feedbackContainerStyle}>
        <ThemedText variant='bodySmall'>{error}</ThemedText>
      </View>
    );
  }

  if (!loading && !hasOccurrences && showMarkers && !heatmapTileUrl) {
    return (
      <View style={feedbackContainerStyle}>
        <ThemedText variant='bodySmall'>
          No precise observation coordinates available for this species.
        </ThemedText>
      </View>
    );
  }

  if (templateLoadError) {
    return (
      <View style={feedbackContainerStyle}>
        <ThemedText variant='bodySmall'>{templateLoadError}</ThemedText>
      </View>
    );
  }

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        shouldFillAvailableHeight && styles.containerFill,
      ]}
    >
      {templateLoadWarning ? (
        <View
          style={[
            styles.templateWarning,
            { backgroundColor: palette.background.default.secondary },
          ]}
        >
          <ThemedText variant='bodySmall'>{templateLoadWarning}</ThemedText>
        </View>
      ) : null}
      <View
        style={[
          styles.mapWrapper,
          shouldFillAvailableHeight
            ? [
                styles.mapWrapperFill,
                { backgroundColor: palette.background.default.tertiary },
              ]
            : { height, backgroundColor: palette.background.default.tertiary },
        ]}
      >
        {html && Platform.OS === 'web' ? (
          <NativeLeafletFrame
            ref={iframeRef}
            html={html}
            onLoad={() => setMapReady(true)}
          />
        ) : null}
        {html && Platform.OS !== 'web' ? (
          <WebView
            ref={webViewRef}
            style={styles.webview}
            originWhitelist={['*']}
            source={{ html, baseUrl: MAP_DOCUMENT_BASE_URL }}
            automaticallyAdjustContentInsets={false}
            scrollEnabled={false}
            overScrollMode='never'
            onLoadEnd={() => setMapReady(true)}
            onMessage={(event) => {
              try {
                const msg = JSON.parse(event.nativeEvent.data) as unknown;
                handleNativeMapMessage(msg);
              } catch {}
            }}
          />
        ) : null}
        {loading || !html ? (
          <View
            style={[
              styles.loadingOverlay,
              { backgroundColor: palette.background.default.tertiary },
            ]}
          >
            <View style={styles.loadingFeedback}>
              <ActivityIndicator color={palette.icon.brand.default} />
              <ThemedText variant='bodySmall'>{loadingMessage}</ThemedText>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type NativeLeafletFrameProps = {
  html: string;
  onLoad?: () => void;
};

const NativeLeafletFrame = React.forwardRef<
  HTMLIFrameElement,
  NativeLeafletFrameProps
>(({ html, onLoad }, forwardedRef) => {
  const internalRef = React.useRef<HTMLIFrameElement | null>(null);

  const setRef = React.useCallback(
    (el: HTMLIFrameElement | null) => {
      internalRef.current = el;
      if (typeof forwardedRef === 'function') {
        forwardedRef(el);
      } else if (forwardedRef) {
        (
          forwardedRef as React.MutableRefObject<HTMLIFrameElement | null>
        ).current = el;
      }
    },
    [forwardedRef],
  );

  React.useEffect(() => {
    const iframe = internalRef.current;
    if (!iframe || typeof window === 'undefined') return;

    // Clicking inside the iframe causes the browser to auto-scroll the outer
    // page to bring the iframe fully into view. We intercept pointerdown on
    // the iframe element (which fires in the outer document before focus
    // changes), snapshot the scroll position, and restore it in the next
    // animation frame after the browser has finished its auto-scroll.
    const onPointerDown = () => {
      const y = window.scrollY;
      const x = window.scrollX;
      setTimeout(() => {
        if (window.scrollY !== y || window.scrollX !== x) {
          window.scrollTo({
            top: y,
            left: x,
            behavior: 'instant',
          } as ScrollToOptions);
        }
      }, 0);
    };
    iframe.addEventListener('pointerdown', onPointerDown);
    return () => iframe.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return React.createElement(
    'div',
    {
      // overflow-anchor: none prevents the browser from treating this iframe
      // as a scroll anchor, which would lock the outer page in place when a
      // popup is open inside the map.
      style: { width: '100%', height: '100%', overflowAnchor: 'none' },
    },
    React.createElement('iframe', {
      ref: setRef,
      srcDoc: html,
      style: {
        width: '100%',
        height: '100%',
        border: '0',
      },
      title: 'Observation map',
      loading: 'eager',
      sandbox:
        'allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox',
      referrerPolicy: MAP_REFERRER_POLICY,
      onLoad,
    }),
  );
});
NativeLeafletFrame.displayName = 'NativeLeafletFrame';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Size.space['200'],
  },
  containerFill: {
    flex: 1,
    minHeight: 0,
  },
  mapWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  mapWrapperFill: {
    flex: 1,
    minHeight: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
  },
  templateWarning: {
    width: '100%',
    padding: Size.space['200'],
  },
  feedback: {
    width: '100%',
    padding: Size.space['300'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackFill: {
    flex: 1,
    minHeight: 0,
  },
  loadingFeedback: {
    gap: Size.space['200'],
  },
});
