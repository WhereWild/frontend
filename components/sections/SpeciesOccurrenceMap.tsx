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
import type { ViewportTileRange } from '@/data/api';
import type { SpeciesOccurrence } from '@/data/types';
import { ThemedText } from '../text/ThemedText';
import {
  buildLeafletHtml,
  getMapTileUrlTemplate,
  loadFallbackMapTemplate,
  loadMapTemplate,
  MAP_DOCUMENT_BASE_URL,
  MAP_REFERRER_POLICY,
  type HighlightMessage,
  type MapMarkerPalette,
  toHighlightMessagePayload,
  toSelectedPointMessagePayload,
  isOpenExternalUrlMessage,
  isPinObservationMessage,
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
};

export function SpeciesOccurrenceMap({
  occurrences,
  loading = false,
  error = null,
  height,
  highlightedCatalogs = [],
  heatmapTileUrl = null,
  heatmapOpacity = 0.6,
  minZoom = 2,
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
  const [mapTemplate, setMapTemplate] = React.useState<string | null>(null);
  const [templateLoadWarning, setTemplateLoadWarning] = React.useState<
    string | null
  >(null);
  const [templateLoadError, setTemplateLoadError] = React.useState<
    string | null
  >(null);

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
      }
    },
    [
      handlePinObservation,
      onBoundsChange,
      onTileClasses,
      onPointValue,
      openExternalUrl,
    ],
  );

  const hasOccurrences = occurrences.length > 0;

  React.useEffect(() => {
    if (loading || error || (!hasOccurrences && !heatmapTileUrl)) {
      return;
    }

    let isMounted = true;

    void (async () => {
      const templateContent = await loadMapTemplate();
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
  }, [error, hasOccurrences, heatmapTileUrl, loading]);

  const markerPalette = React.useMemo<MapMarkerPalette>(
    () => ({
      markerFill: palette.background.brand.default,
      markerStroke: palette.border.brand.default,
      highlightFill: palette.background.danger.default,
      highlightStroke: palette.border.danger.default,
      selectedPointFill: '#F59E0B',
      selectedPointStroke: '#F59E0B',
    }),
    [
      palette.background.brand.default,
      palette.background.danger.default,
      palette.border.brand.default,
      palette.border.danger.default,
    ],
  );
  const highlightKeys = React.useMemo(
    () => highlightedCatalogs.map((id) => String(id)),
    [highlightedCatalogs],
  );
  const tileUrlTemplate = React.useMemo(
    () => getMapTileUrlTemplate(mode),
    [mode],
  );
  const html = React.useMemo(() => {
    if (!mapTemplate) {
      return null;
    }
    return buildLeafletHtml(
      mapTemplate,
      occurrences,
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
    );
  }, [
    allowPinObservations,
    pointQueryUrl,
    renderMin,
    renderMax,
    isCircular,
    heatmapOpacity,
    heatmapTileUrl,
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
    onTileClasses,
    onPointValue,
    openExternalUrl,
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
>(({ html, onLoad }, ref) => {
  return React.createElement('iframe', {
    ref,
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
  });
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
