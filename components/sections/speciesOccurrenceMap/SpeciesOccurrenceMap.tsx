import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { SpeciesOccurrence } from '@/data/types';
import { ThemedText } from '../../text/ThemedText';
import {
  buildLeafletHtml,
  mapTemplateFallback,
  type MapMarkerPalette,
  type HeatmapHeadVariant,
  type HeatmapSettingsMessage,
  loadMapTemplate,
  setupWebHeatmapBridge,
  toHighlightMessagePayload,
  type ActiveHeatmapJob,
  type HighlightMessage,
  HEATMAP_SETTINGS_MESSAGE_TYPE,
  MAP_CLICK_MESSAGE_TYPE,
  RL_MODE_MESSAGE_TYPE,
  FEEDBACK_DOTS_MESSAGE_TYPE,
  type RlModeMessage,
  type FeedbackDot,
  type FeedbackDotsMessage,
} from './speciesOccurrenceMapHelpers';

type SpeciesOccurrenceMapProps = {
  occurrences: SpeciesOccurrence[];
  loading?: boolean;
  error?: string | null;
  height?: number;
  highlightedCatalogs?: (number | string)[];
  speciesKey?: number;
  showHeatmapOverlay?: boolean;
  heatmapHeadVariant?: HeatmapHeadVariant;
  rlModeEnabled?: boolean;
  onMapClick?: (lat: number, lon: number) => void;
  feedbackDots?: FeedbackDot[];
};

/**
 * Renders occurrence points and optional prediction heatmap in a Leaflet surface.
 *
 * The component owns UI concerns (loading, empty, theme, highlight updates)
 * while transport/template work lives in `speciesOccurrenceMapHelpers`.
 */
export function SpeciesOccurrenceMap({
  occurrences,
  loading = false,
  error = null,
  height = 360,
  highlightedCatalogs = [],
  speciesKey,
  showHeatmapOverlay = false,
  heatmapHeadVariant = 'original',
  rlModeEnabled = false,
  onMapClick,
  feedbackDots = [],
}: SpeciesOccurrenceMapProps) {
  const isFocused = useIsFocused();
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const mapColorMode: keyof typeof Colors = 'light';
  const mapPalette = Colors[mapColorMode];
  const webViewRef = React.useRef<WebView>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const activeHeatmapJobRef = React.useRef<ActiveHeatmapJob>({
    requestId: null,
    jobId: null,
    abortController: null,
  });
  const [mapReady, setMapReady] = React.useState(false);
  const [mapTemplate, setMapTemplate] = React.useState<string>(mapTemplateFallback);

  /** Loads the standalone HTML template once and falls back when unavailable. */
  React.useEffect(() => {
    let isMounted = true;

    (async () => {
      const templateContent = await loadMapTemplate();
      if (isMounted && templateContent) {
        setMapTemplate(templateContent);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasOccurrences = occurrences.length > 0;
  const markerPalette = React.useMemo<MapMarkerPalette>(
    () => ({
      markerFill: mapPalette.background.brand.default,
      markerStroke: mapPalette.border.brand.default,
      highlightFill: mapPalette.background.danger.default,
      highlightStroke: mapPalette.border.danger.default,
      heatmapLow: mapPalette.background.neutral.secondary,
      heatmapHigh: mapPalette.background.brand.default,
      feedbackPositiveFill: mapPalette.background.positive.default,
      feedbackPositiveStroke: mapPalette.border.positive.default,
      feedbackNegativeFill: mapPalette.background.warning.default,
      feedbackNegativeStroke: mapPalette.border.warning.default,
    }),
    [
      mapPalette.background.brand.default,
      mapPalette.background.positive.default,
      mapPalette.background.danger.default,
      mapPalette.background.neutral.secondary,
      mapPalette.background.warning.default,
      mapPalette.border.brand.default,
      mapPalette.border.positive.default,
      mapPalette.border.danger.default,
      mapPalette.border.warning.default,
    ],
  );
  const highlightKeys = React.useMemo(
    () => highlightedCatalogs.map((id) => String(id)),
    [highlightedCatalogs],
  );
  const html = React.useMemo(
    () =>
      buildLeafletHtml(
        mapTemplate,
        occurrences,
        markerPalette,
        speciesKey,
      ),
    // Heatmap visibility/head variant are pushed via postMessage to avoid
    // remounting the map and losing pan/zoom state.
    [mapTemplate, markerPalette, occurrences, speciesKey],
  );
  React.useEffect(() => {
    setMapReady(false);
  }, [html]);

  const highlightMessage = React.useMemo(
    () => toHighlightMessagePayload(highlightKeys),
    [highlightKeys],
  );

  /** Sends highlight updates to whichever runtime is active (iframe/WebView). */
  const sendHighlightMessage = React.useCallback(
    (message: HighlightMessage) => {
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(message, '*');
      } else {
        webViewRef.current?.postMessage(JSON.stringify(message));
      }
    },
    [],
  );

  /** Replays highlight state after map reloads or highlight changes. */
  React.useEffect(() => {
    if (!mapReady || !hasOccurrences) {
      return;
    }
    sendHighlightMessage(highlightMessage);
  }, [hasOccurrences, highlightMessage, mapReady, sendHighlightMessage]);

  React.useEffect(() => {
    if (!isFocused) {
      return () => {};
    }
    return setupWebHeatmapBridge(iframeRef, activeHeatmapJobRef);
  }, [isFocused]);

  /** Sends RL mode state to the map runtime so it can change cursor and behaviour. */
  React.useEffect(() => {
    if (!mapReady) return;
    const rlMessage: RlModeMessage = { type: RL_MODE_MESSAGE_TYPE, enabled: rlModeEnabled };
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(rlMessage, '*');
    } else {
      webViewRef.current?.postMessage(JSON.stringify(rlMessage));
    }
  }, [mapReady, rlModeEnabled]);

  /** Sends feedback dots to the map so they render as info/warning circleMarkers. */
  React.useEffect(() => {
    if (!mapReady) return;
    const dotsMessage: FeedbackDotsMessage = { type: FEEDBACK_DOTS_MESSAGE_TYPE, dots: feedbackDots };
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(dotsMessage, '*');
    } else {
      webViewRef.current?.postMessage(JSON.stringify(dotsMessage));
    }
  }, [mapReady, feedbackDots]);

  /** Updates heatmap runtime settings without remounting the map (preserves view/zoom). */
  React.useEffect(() => {
    if (!mapReady) return;
    const settingsMessage: HeatmapSettingsMessage = {
      type: HEATMAP_SETTINGS_MESSAGE_TYPE,
      enabled: showHeatmapOverlay && speciesKey != null,
      speciesKey: speciesKey ?? null,
      headVariant: heatmapHeadVariant,
    };

    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(settingsMessage, '*');
    } else {
      webViewRef.current?.postMessage(JSON.stringify(settingsMessage));
    }
  }, [heatmapHeadVariant, mapReady, showHeatmapOverlay, speciesKey]);

  /** Listens for map-click messages from the iframe when RL mode is active. */
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !onMapClick) return () => {};

    const handleMapClick = (event: MessageEvent<unknown>) => {
      const expectedSource = iframeRef.current?.contentWindow;
      if (expectedSource && event.source && event.source !== expectedSource) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.type !== MAP_CLICK_MESSAGE_TYPE) return;
      const lat = Number(data.lat);
      const lon = Number(data.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        onMapClick(lat, lon);
      }
    };

    window.addEventListener('message', handleMapClick);
    return () => window.removeEventListener('message', handleMapClick);
  }, [onMapClick]);

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

  if (!hasOccurrences) {
    return (
      <View style={styles.feedback}>
        <ThemedText variant="bodySmall">
          No precise observation coordinates available for this species.
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.mapWrapper,
        { height, backgroundColor: mapPalette.background.default.tertiary },
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
          source={{ html }}
          automaticallyAdjustContentInsets={false}
          scrollEnabled={false}
          onLoadEnd={() => setMapReady(true)}
        />
      )}
    </View>
  );
}

type NativeLeafletFrameProps = {
  html: string;
  onLoad?: () => void;
};

/** Web-only iframe wrapper that mirrors the native WebView contract. */
const NativeLeafletFrame = React.forwardRef<HTMLIFrameElement, NativeLeafletFrameProps>(
  ({ html, onLoad }, ref) =>
    React.createElement('iframe', {
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
      onLoad,
    }),
);
NativeLeafletFrame.displayName = 'NativeLeafletFrame';

const styles = StyleSheet.create({
  mapWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
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
