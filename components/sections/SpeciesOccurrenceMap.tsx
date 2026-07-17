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
import { useOptionalSettings } from '@/context/SettingsContext';
import type { ViewportTileRange } from '@/data/api';
import type { SpeciesOccurrence } from '@/data/types';
import { ThemedText } from '../text/ThemedText';
import { SwitchField } from '../inputs/SwitchField';
import {
  buildGlobeHtml,
  buildLeafletHtml,
  getBackgroundTileUrl,
  getLabelsOverlayTileUrl,
  getMapTileUrlTemplate,
  loadFallbackMapTemplate,
  loadGlobeMapTemplate,
  loadMapTemplate,
  MAP_DOCUMENT_BASE_URL,
  MAP_REFERRER_POLICY,
  type HighlightMessage,
  type MapMarkerPalette,
  toHighlightMessagePayload,
  toSelectedPointMessagePayload,
  isOpenExternalUrlMessage,
  isPinObservationMessage,
  COLORMAP_UPDATE_MESSAGE_TYPE,
  HEATMAP_UPDATE_MESSAGE_TYPE,
  LOCATION_PICKED_MESSAGE_TYPE,
  LOCAL_LOCATION_UPDATE_MESSAGE_TYPE,
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
type TileClassesMessage = {
  type: 'tileClasses' | 'tileClassesRemoved';
  classes: TileClassEntry[];
};

function isTileClassesMessage(msg: unknown): msg is TileClassesMessage {
  return (
    !!msg &&
    typeof msg === 'object' &&
    'type' in msg &&
    (msg.type === 'tileClasses' || msg.type === 'tileClassesRemoved') &&
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
  selectedPoint?: { lat: number; lon: number } | null;
  onBoundsChange?: (tiles: ViewportTileRange) => void;
  onTileClasses?: (
    classes: { id: number; count: number }[],
    removed: boolean,
  ) => void;
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
  onMapBounds?: (bounds: MapBounds) => void;
  disableObservationQuery?: boolean;
  varUnits?: string | null;
  gradientStops?: [number, number, number][] | null;
  aspectStops?: [number, number, number][] | null;
  useLabelsOverlay?: boolean;
  preserveMapPosition?: boolean;
  locationPickerMode?: boolean;
  onLocationPicked?: (lat: number, lon: number) => void;
  localLat?: number | null;
  localLon?: number | null;
};

export function SpeciesOccurrenceMap({
  occurrences,
  loading = false,
  error = null,
  height,
  highlightedCatalogs = [],
  heatmapTileUrl = null,
  heatmapOpacity = 0.6,
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
  onMapBounds,
  disableObservationQuery = false,
  varUnits = null,
  gradientStops = null,
  aspectStops = null,
  useLabelsOverlay = false,
  preserveMapPosition = false,
  locationPickerMode = false,
  onLocationPicked,
  localLat = null,
  localLon = null,
}: SpeciesOccurrenceMapProps) {
  const fallbackWarningMessage =
    'Unable to load the bundled map renderer. Showing the fallback map.';
  const rendererLoadErrorMessage = 'Unable to load the map renderer.';
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const webViewRef = React.useRef<WebView>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [mapReady, setMapReady] = React.useState(false);
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
        onTileClasses?.(msg.classes, msg.type === 'tileClassesRemoved');
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
    ],
  );

  const hasOccurrences = occurrences.length > 0;

  React.useEffect(() => {
    if (
      loading ||
      error ||
      (!hasOccurrences && !heatmapTileUrl && !locationPickerMode)
    ) {
      return;
    }

    let isMounted = true;

    void (async () => {
      const templateContent = globeView
        ? await loadGlobeMapTemplate()
        : await loadMapTemplate();
      if (!isMounted) {
        return;
      }

      if (templateContent) {
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
        setMapTemplate(fallbackTemplate);
        setTemplateLoadWarning(fallbackWarningMessage);
        setTemplateLoadError(null);
        return;
      }

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
  const labelsOverlayTileUrl = React.useMemo(
    () => (useLabelsOverlay ? getLabelsOverlayTileUrl() : null),
    [useLabelsOverlay],
  );

  // When preserveMapPosition is true, the html memo is built once with initial
  // values for the "live" props. Subsequent changes are sent via postMessage so
  // Leaflet can update the tile layer without reloading the WebView.
  const initialHeatmapTileUrl = React.useRef(heatmapTileUrl);
  const initialPointQueryUrl = React.useRef(pointQueryUrl);
  const initialRenderMin = React.useRef(renderMin);
  const initialRenderMax = React.useRef(renderMax);
  const initialVarUnits = React.useRef(varUnits);
  const initialDotMin = React.useRef(dotMin);
  const initialDotMax = React.useRef(dotMax);
  const initialGradientStops = React.useRef(gradientStops);
  const initialAspectStops = React.useRef(aspectStops);
  const initialIsCircular = React.useRef(isCircular);
  const initialClassColors = React.useRef(classColors);
  const initialClassLabels = React.useRef(classLabels);
  const initialClassShapes = React.useRef(classShapes);
  const initialMarkerOutlineEnabled = React.useRef(markerOutlineEnabled);

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
    initialDotMin.current = dotMin;
    initialDotMax.current = dotMax;
    initialGradientStops.current = gradientStops;
    initialAspectStops.current = aspectStops;
    initialIsCircular.current = isCircular;
    initialClassColors.current = classColors;
    initialClassLabels.current = classLabels;
    initialClassShapes.current = classShapes;
    initialMarkerOutlineEnabled.current = markerOutlineEnabled;
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

  const html = React.useMemo(() => {
    if (!mapTemplate) {
      return null;
    }
    const buildHtml = globeView ? buildGlobeHtml : buildLeafletHtml;
    return buildHtml(
      mapTemplate,
      occurrences,
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
      observationValues,
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
      circularShapesEnabled,
      labelsOverlayTileUrl,
      null,
      locationPickerMode,
      initialLocalLat.current,
      initialLocalLon.current,
    );
  }, [
    allowPinObservations,
    observationValues,
    circularShapesEnabled,
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
    occurrences,
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
    globeView,
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
          ? { latitude: selectedPoint.lat, longitude: selectedPoint.lon }
          : null,
      ),
    [selectedPoint],
  );
  const shouldFillAvailableHeight = height == null;
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

  React.useEffect(() => {
    if (!mapReady || (!gradientStops && !aspectStops)) {
      return;
    }
    const msg: Record<string, unknown> = { type: COLORMAP_UPDATE_MESSAGE_TYPE };
    if (gradientStops) msg.stops = gradientStops;
    if (aspectStops) msg.circularStops = aspectStops;
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
    } else {
      webViewRef.current?.postMessage(JSON.stringify(msg));
    }
  }, [gradientStops, aspectStops, mapReady]);

  React.useEffect(() => {
    if (!preserveMapPosition || !mapReady) return;
    const msg: Record<string, unknown> = {
      type: HEATMAP_UPDATE_MESSAGE_TYPE,
      heatmapTileUrl,
      pointQueryUrl,
      renderMin,
      renderMax,
      varUnits,
      dotMin,
      dotMax,
      isCircular,
      circularStops: aspectStops ?? null,
      classColors: classColors ? Object.fromEntries(classColors) : null,
      classLabels: classLabels ? Object.fromEntries(classLabels) : null,
      classShapes: classShapes ? Object.fromEntries(classShapes) : null,
      markerOutline: markerOutlineEnabled,
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
    dotMin,
    dotMax,
    isCircular,
    aspectStops,
    classColors,
    classLabels,
    classShapes,
    markerOutlineEnabled,
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
        onTileClasses?.(data.classes, data.type === 'tileClassesRemoved');
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
      style={[
        styles.container,
        shouldFillAvailableHeight && styles.containerFill,
      ]}
    >
      {globeViewSupported && settings ? (
        <SwitchField
          label='Globe view'
          value={settings.globeViewEnabled}
          onValueChange={settings.setGlobeViewEnabled}
        />
      ) : null}
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
          height == null
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
