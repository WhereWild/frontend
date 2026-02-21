import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { SpeciesOccurrence } from '@/data/types';
import { ThemedText } from '../text/ThemedText';

type SpeciesOccurrenceMapProps = {
  occurrences: SpeciesOccurrence[];
  loading?: boolean;
  error?: string | null;
  height?: number;
  highlightedCatalogs?: (number | string)[];
};

const HIGHLIGHT_MESSAGE_TYPE = 'highlight';

type HighlightMessage = {
  type: typeof HIGHLIGHT_MESSAGE_TYPE;
  catalogs: string[];
};

type MapMarkerPalette = {
  markerFill: string;
  markerStroke: string;
  highlightFill: string;
  highlightStroke: string;
};

const toHighlightMessagePayload = (catalogs: string[]): HighlightMessage => ({
  type: HIGHLIGHT_MESSAGE_TYPE,
  catalogs,
});

const buildLeafletHtml = (points: SpeciesOccurrence[], markerPalette: MapMarkerPalette) => {
  const payload = JSON.stringify(points ?? []);
  const palettePayload = JSON.stringify(markerPalette);
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
    <style>
      html, body, #map {
        height: 100%;
        width: 100%;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
    <script>
      const points = ${payload};
      const palette = ${palettePayload};
      const map = L.map('map');
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      const markerStyle = {
        radius: 4,
        fillColor: palette.markerFill,
        color: palette.markerStroke,
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.9,
      };
      const highlightStyle = {
        radius: 5,
        fillColor: palette.highlightFill,
        color: palette.highlightStroke,
        weight: 1,
        opacity: 0.95,
        fillOpacity: 0.95,
      };
      const markers = new Map();
      function applyHighlights(list) {
        const highlightSet = new Set(
          Array.isArray(list) ? list.map((item) => String(item)) : [],
        );
        markers.forEach((marker, catalog) => {
          if (highlightSet.has(catalog)) {
            marker.setStyle(highlightStyle);
          } else {
            marker.setStyle(markerStyle);
          }
        });
      }
      function handleHighlightMessage(payload) {
        let data = payload;
        if (typeof payload === 'string') {
          try {
            data = JSON.parse(payload);
          } catch (err) {
            return;
          }
        }
        if (data && data.type === '${HIGHLIGHT_MESSAGE_TYPE}') {
          applyHighlights(data.catalogs || []);
        }
      }
      document.addEventListener('message', (event) => handleHighlightMessage(event.data));
      window.addEventListener('message', (event) => handleHighlightMessage(event.data));
      if (Array.isArray(points) && points.length) {
        const bounds = [];
        const clusterGroup = L.markerClusterGroup({ spiderfyOnMaxZoom: false, disableClusteringAtZoom: 6 });
        let cluster = false;
        if (points.length >= 10000) {
          cluster = true;
        }
        points.forEach((pt, idx) => {
          if (typeof pt.latitude === 'number' && typeof pt.longitude === 'number') {
            const catalog = pt.catalogNumber ? String(pt.catalogNumber) : '';
            const marker = L.circleMarker([pt.latitude, pt.longitude]);
            if (cluster) {
              clusterGroup.addLayer(marker);
            } else {
              map.addLayer(marker);  
            }
            if (catalog.length) {
              marker.bindPopup('<a href="https://www.inaturalist.org/observations/' + catalog + '" target="_blank">Observation #' + catalog + '</a>');
              markers.set(catalog, marker);
            } else {
              markers.set('fallback-' + String(idx), marker);
            }
            bounds.push([pt.latitude, pt.longitude]);
          }
        });
        if (cluster) {
          map.addLayer(clusterGroup);
        }
        if (bounds.length) {
          map.fitBounds(bounds, { padding: [20, 20] });
        } else {
          map.setView([0, 0], 2);
        }
      } else {
        map.setView([0, 0], 2);
      }
      applyHighlights([]);
    </script>
  </body>
</html>`;
};

export function SpeciesOccurrenceMap({
  occurrences,
  loading = false,
  error = null,
  height = 360,
  highlightedCatalogs = [],
}: SpeciesOccurrenceMapProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const webViewRef = React.useRef<WebView>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [mapReady, setMapReady] = React.useState(false);

  const hasOccurrences = occurrences.length > 0;
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
  const html = React.useMemo(
    () => buildLeafletHtml(occurrences, markerPalette),
    [markerPalette, occurrences],
  );

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
      <View style={styles.feedback}>
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
    borderRadius: Size.radius['300'],
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
});
