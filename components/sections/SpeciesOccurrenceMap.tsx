import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
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
} from './speciesOccurrenceMap/speciesOccurrenceMapHelpers';

type SpeciesOccurrenceMapProps = {
  occurrences: SpeciesOccurrence[];
  loading?: boolean;
  error?: string | null;
  height?: number;
  highlightedCatalogs?: (number | string)[];
};

export function SpeciesOccurrenceMap({
  occurrences,
  loading = false,
  error = null,
  height = 360,
  highlightedCatalogs = [],
}: SpeciesOccurrenceMapProps) {
  const fallbackWarningMessage = 'Unable to load the bundled map renderer. Showing the fallback map.';
  const rendererLoadErrorMessage = 'Unable to load the map renderer.';
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const webViewRef = React.useRef<WebView>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const [mapTemplate, setMapTemplate] = React.useState<string | null>(null);
  const [templateLoadWarning, setTemplateLoadWarning] = React.useState<string | null>(null);
  const [templateLoadError, setTemplateLoadError] = React.useState<string | null>(null);

  const hasOccurrences = occurrences.length > 0;

  React.useEffect(() => {
    if (loading || error || !hasOccurrences) {
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
  }, [error, hasOccurrences, loading]);
  const markerPalette = React.useMemo<MapMarkerPalette>(
    () => ({
      markerFill: palette.background.brand.default,
      markerStroke: palette.border.brand.default,
      highlightFill: palette.background.danger.default,
      highlightStroke: palette.border.danger.default,
    }),
    [palette.background.brand.default, palette.background.danger.default, palette.border.brand.default, palette.border.danger.default],
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
    return buildLeafletHtml(mapTemplate, occurrences, markerPalette, tileUrlTemplate);
  }, [mapTemplate, markerPalette, occurrences, tileUrlTemplate]);

  React.useEffect(() => {
    setMapReady(false);
  }, [html]);

  const highlightMessage = React.useMemo(
    () => toHighlightMessagePayload(highlightKeys),
    [highlightKeys],
  );

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

  React.useEffect(() => {
    if (!mapReady || !hasOccurrences) {
      return;
    }
    sendHighlightMessage(highlightMessage);
  }, [hasOccurrences, highlightMessage, mapReady, sendHighlightMessage]);

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
