import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { SpeciesOccurrence } from '@/data/types';
import { ThemedText } from '../../text/ThemedText';
import {
  buildLeafletHtml,
  mapTemplateFallback,
  type MapMarkerPalette,
  loadMapTemplate,
  setupWebHeatmapBridge,
  toHighlightMessagePayload,
  type ActiveHeatmapJob,
  type HighlightMessage,
} from './speciesOccurrenceMapHelpers';

type SpeciesOccurrenceMapProps = {
  occurrences: SpeciesOccurrence[];
  loading?: boolean;
  error?: string | null;
  height?: number;
  highlightedCatalogs?: (number | string)[];
  speciesKey?: number;
  showHeatmapOverlay?: boolean;
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
}: SpeciesOccurrenceMapProps) {
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
      markerFill: palette.background.brand.default,
      markerStroke: palette.border.brand.default,
      highlightFill: palette.background.danger.default,
      highlightStroke: palette.border.danger.default,
      heatmapLow: palette.background.positive.default,
      heatmapHigh: palette.background.danger.default,
    }),
    [
      palette.background.brand.default,
      palette.background.positive.default,
      palette.background.danger.default,
      palette.border.brand.default,
      palette.border.danger.default,
    ],
  );
  const highlightKeys = React.useMemo(
    () => highlightedCatalogs.map((id) => String(id)),
    [highlightedCatalogs],
  );
  const html = React.useMemo(
    () => buildLeafletHtml(mapTemplate, occurrences, markerPalette, speciesKey, showHeatmapOverlay),
    [mapTemplate, markerPalette, occurrences, showHeatmapOverlay, speciesKey],
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

  React.useEffect(
    () => setupWebHeatmapBridge(iframeRef, activeHeatmapJobRef),
    [],
  );

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
