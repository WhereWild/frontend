import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { SpeciesHeatmapMetadata, SpeciesOccurrence } from '@/data/types';
import { ThemedText } from '../text/ThemedText';
import {
  buildSpeciesHeatmapTileUrl,
  DEFAULT_HEATMAP_TILE_OVERLAY_OPTIONS,
  HEATMAP_SETTINGS_MESSAGE_TYPE,
  buildLeafletHtml,
  getMapTileUrlTemplate,
  loadFallbackMapTemplate,
  loadMapTemplate,
  MAP_DOCUMENT_BASE_URL,
  MAP_REFERRER_POLICY,
  resolveSpeciesHeatmapTileOverlay,
  setupWebHeatmapBridge,
  type ActiveHeatmapJob,
  type HeatmapSettingsMessage,
  type HighlightMessage,
  type MapMarkerPalette,
  toHighlightMessagePayload,
} from './speciesOccurrenceMap/speciesOccurrenceMapHelpers';

type SpeciesOccurrenceMapProps = {
  occurrences: SpeciesOccurrence[];
  loading?: boolean;
  error?: string | null;
  height?: number;
  highlightedCatalogs?: (number | string)[];
  heatmapTileUrl?: string | null;
  heatmapOpacity?: number;
  minZoom?: number;
  showMarkers?: boolean;
  speciesKey?: number;
  showHeatmapOverlay?: boolean;
  heatmapTileOverlayMetadata?: SpeciesHeatmapMetadata | null;
  showHeatmapTileOverlay?: boolean;
};

export function SpeciesOccurrenceMap({
  occurrences,
  loading = false,
  error = null,
  height = 360,
  highlightedCatalogs = [],
  heatmapTileUrl = null,
  heatmapOpacity = 0.6,
  minZoom = 2,
  showMarkers = true,
  speciesKey,
  showHeatmapOverlay = false,
  heatmapTileOverlayMetadata = null,
  showHeatmapTileOverlay = false,
}: SpeciesOccurrenceMapProps) {
  const fallbackWarningMessage = 'Unable to load the bundled map renderer. Showing the fallback map.';
  const rendererLoadErrorMessage = 'Unable to load the map renderer.';
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const webViewRef = React.useRef<WebView>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const activeHeatmapJobRef = React.useRef<ActiveHeatmapJob>({
    requestId: null,
    jobId: null,
    abortController: null,
  });
  const [mapReady, setMapReady] = React.useState(false);
  const [mapTemplate, setMapTemplate] = React.useState<string | null>(null);
  const [templateLoadWarning, setTemplateLoadWarning] = React.useState<string | null>(null);
  const [templateLoadError, setTemplateLoadError] = React.useState<string | null>(null);
  const [heatmapTileOverlayUrl, setHeatmapTileOverlayUrl] = React.useState<string | null>(null);
  const [heatmapTileNativeResolution, setHeatmapTileNativeResolution] = React.useState<number>(0);
  const [heatmapTileOverlayNotice, setHeatmapTileOverlayNotice] = React.useState<string | null>(null);

  const hasOccurrences = occurrences.length > 0;
  const hasHeatmapLayer = Boolean(heatmapTileUrl)
    || (showHeatmapOverlay && speciesKey != null)
    || (showHeatmapTileOverlay && heatmapTileOverlayMetadata?.available && Boolean(heatmapTileOverlayMetadata.tileUrl));

  React.useEffect(() => {
    if (loading || error || (!hasOccurrences && !hasHeatmapLayer)) {
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
  }, [error, hasHeatmapLayer, hasOccurrences, loading]);
  const markerPalette = React.useMemo<MapMarkerPalette>(
    () => ({
      markerFill: palette.background.brand.default,
      markerStroke: palette.border.brand.default,
      highlightFill: palette.background.danger.default,
      highlightStroke: palette.border.danger.default,
      heatmapLow: palette.background.neutral.secondary,
      heatmapHigh: palette.background.brand.default,
    }),
    [
      palette.background.brand.default,
      palette.background.danger.default,
      palette.background.neutral.secondary,
      palette.border.brand.default,
      palette.border.danger.default,
    ],
  );
  const highlightKeys = React.useMemo(
    () => highlightedCatalogs.map((id) => String(id)),
    [highlightedCatalogs],
  );
  const tileUrlTemplate = React.useMemo(() => getMapTileUrlTemplate(mode), [mode]);
  const html = React.useMemo(() => {
    if (!mapTemplate) {
      return null;
    }
    return buildLeafletHtml(mapTemplate, occurrences, markerPalette, tileUrlTemplate, {
      heatmapTileUrl,
      heatmapOpacity,
      minZoom,
      showMarkers,
      speciesKey,
    });
  }, [heatmapOpacity, heatmapTileUrl, mapTemplate, markerPalette, minZoom, occurrences, showMarkers, speciesKey, tileUrlTemplate]);

  React.useEffect(() => {
    setMapReady(false);
  }, [html]);

  React.useEffect(() => {
    if (!showHeatmapTileOverlay || speciesKey == null) {
      setHeatmapTileOverlayUrl(null);
      setHeatmapTileNativeResolution(0);
      setHeatmapTileOverlayNotice(null);
      return;
    }

    if (heatmapTileOverlayMetadata) {
      const resolvedTileUrl = heatmapTileOverlayMetadata.available && heatmapTileOverlayMetadata.tileUrl
        ? buildSpeciesHeatmapTileUrl(heatmapTileOverlayMetadata.tileUrl, DEFAULT_HEATMAP_TILE_OVERLAY_OPTIONS)
        : null;
      setHeatmapTileOverlayUrl(resolvedTileUrl);
      setHeatmapTileNativeResolution(heatmapTileOverlayMetadata.nativeResolution);
      setHeatmapTileOverlayNotice(
        resolvedTileUrl
          ? null
          : 'Prediction tiles are not available for this species yet. Falling back to the streamed prediction overlay when enabled.',
      );
      return;
    }

    let isMounted = true;

    void resolveSpeciesHeatmapTileOverlay(speciesKey, DEFAULT_HEATMAP_TILE_OVERLAY_OPTIONS)
      .then((metadata) => {
        if (!isMounted) {
          return;
        }
        const resolvedTileUrl = metadata.available ? metadata.resolvedTileUrl : null;
        setHeatmapTileOverlayUrl(resolvedTileUrl);
        setHeatmapTileNativeResolution(metadata.nativeResolution);
        setHeatmapTileOverlayNotice(
          resolvedTileUrl
            ? null
            : 'Prediction tiles are not available for this species yet. Falling back to the streamed prediction overlay when enabled.',
        );
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setHeatmapTileOverlayUrl(null);
        setHeatmapTileNativeResolution(0);
        setHeatmapTileOverlayNotice(
          'Unable to load prediction tiles right now. Falling back to the streamed prediction overlay when enabled.',
        );
      });

    return () => {
      isMounted = false;
    };
  }, [heatmapTileOverlayMetadata, showHeatmapTileOverlay, speciesKey]);

  const highlightMessage = React.useMemo(
    () => toHighlightMessagePayload(highlightKeys),
    [highlightKeys],
  );

  const postRuntimeMessage = React.useCallback(
    (message: HighlightMessage | HeatmapSettingsMessage) => {
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
    postRuntimeMessage(highlightMessage);
  }, [hasOccurrences, highlightMessage, mapReady, postRuntimeMessage]);

  React.useEffect(() => {
    return setupWebHeatmapBridge(iframeRef, activeHeatmapJobRef);
  }, []);

  React.useEffect(() => {
    if (!mapReady) {
      return;
    }
    const tileOverlayEnabled = Boolean(showHeatmapTileOverlay && speciesKey != null && heatmapTileOverlayUrl);
    const cellOverlayEnabled = Boolean(showHeatmapOverlay && speciesKey != null && !tileOverlayEnabled);
    postRuntimeMessage({
      type: HEATMAP_SETTINGS_MESSAGE_TYPE,
      enabled: cellOverlayEnabled || tileOverlayEnabled,
      speciesKey: speciesKey ?? null,
      overlayMode: tileOverlayEnabled ? 'tiles' : 'cells',
      tileUrl: tileOverlayEnabled ? heatmapTileOverlayUrl : null,
      tileSize: DEFAULT_HEATMAP_TILE_OVERLAY_OPTIONS.tileSize,
      maxNativeZoom: DEFAULT_HEATMAP_TILE_OVERLAY_OPTIONS.maxNativeZoom,
      featureMode: DEFAULT_HEATMAP_TILE_OVERLAY_OPTIONS.featureMode,
      nativeResolution: heatmapTileNativeResolution,
    });
  }, [
    heatmapTileNativeResolution,
    heatmapTileOverlayUrl,
    mapReady,
    postRuntimeMessage,
    showHeatmapOverlay,
    showHeatmapTileOverlay,
    speciesKey,
  ]);

  if (loading) {
    return (
      <View style={[styles.feedback, styles.loadingFeedback]}>
        <ActivityIndicator color={palette.icon.brand.default} />
        <ThemedText variant="bodySmall">Loading observations map…</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.feedback}>
        <ThemedText variant="bodySmall">{error}</ThemedText>
      </View>
    );
  }

  if (!hasOccurrences && showMarkers && !hasHeatmapLayer) {
    return (
      <View style={styles.feedback}>
        <ThemedText variant="bodySmall">
          No precise observation coordinates available for this species.
        </ThemedText>
      </View>
    );
  }

  if (templateLoadError) {
    return (
      <View style={styles.feedback}>
        <ThemedText variant="bodySmall">{templateLoadError}</ThemedText>
      </View>
    );
  }

  if (!html) {
    return (
      <View style={[styles.feedback, styles.loadingFeedback]}>
        <ActivityIndicator color={palette.icon.brand.default} />
        <ThemedText variant="bodySmall">Loading map renderer…</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {templateLoadWarning ? (
        <View
          style={[
            styles.templateWarning,
            { backgroundColor: palette.background.default.secondary },
          ]}
        >
          <ThemedText variant="bodySmall">{templateLoadWarning}</ThemedText>
        </View>
      ) : null}
      {heatmapTileOverlayNotice ? (
        <View
          style={[
            styles.templateWarning,
            { backgroundColor: palette.background.default.secondary },
          ]}
        >
          <ThemedText variant="bodySmall">{heatmapTileOverlayNotice}</ThemedText>
        </View>
      ) : null}
      <View
        style={[
          styles.mapWrapper,
          { height, backgroundColor: palette.background.default.tertiary },
        ]}
      >
        {Platform.OS === 'web' ? (
          <NativeLeafletFrame
            ref={iframeRef}
            html={html}
            onLoad={() => setMapReady(true)}
          />
        ) : (
          <WebView
            ref={webViewRef}
            style={styles.webview}
            originWhitelist={['*']}
            source={{ html, baseUrl: MAP_DOCUMENT_BASE_URL }}
            automaticallyAdjustContentInsets={false}
            scrollEnabled={false}
            onLoadEnd={() => setMapReady(true)}
          />
        )}
      </View>
    </View>
  );
}

type NativeLeafletFrameProps = {
  html: string;
  onLoad?: () => void;
};

const NativeLeafletFrame = React.forwardRef<HTMLIFrameElement, NativeLeafletFrameProps>(
  ({ html, onLoad }, ref) => {
    return React.createElement('iframe', {
      ref,
      srcDoc: html,
      style: {
        width: '100%',
        height: '100%',
        border: '0',
      },
      title: 'Observation map',
      loading: 'lazy',
      sandbox: 'allow-scripts allow-popups',
      referrerPolicy: MAP_REFERRER_POLICY,
      onLoad,
    });
  },
);
NativeLeafletFrame.displayName = 'NativeLeafletFrame';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Size.space['200'],
  },
  mapWrapper: {
    width: '100%',
    overflow: 'hidden',
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
  loadingFeedback: {
    gap: Size.space['200'],
  },
});
