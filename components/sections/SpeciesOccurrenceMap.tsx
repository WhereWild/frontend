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

const buildLeafletHtml = (points: SpeciesOccurrence[]) => {
  const payload = JSON.stringify(points ?? []);
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
      const map = L.map('map');
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      const markerStyle = {
        radius: 4,
        fillColor: '#4CAF50',
        color: '#2E7D32',
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.9,
      };
      const highlightStyle = {
        radius: 5,
        fillColor: '#E53935',
        color: '#B71C1C',
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
        if (data && data.type === 'highlight') {
          applyHighlights(data.catalogs || []);
        }
      }
      document.addEventListener('message', (event) => handleHighlightMessage(event.data));
      window.addEventListener('message', (event) => handleHighlightMessage(event.data));
      if (Array.isArray(points) && points.length) {
        const bounds = [];
        const clusterGroup = L.markerClusterGroup({ spiderfyOnMaxZoom: false, disableClusteringAtZoom: 1 });
        points.forEach((pt) => {
          if (typeof pt.latitude === 'number' && typeof pt.longitude === 'number') {
            const catalog = pt.catalogNumber ? String(pt.catalogNumber) : '';
            const marker = L.circleMarker([pt.latitude, pt.longitude]).addTo(clusterGroup);
            if (catalog.length) {
              marker.bindPopup('<a href="https://www.inaturalist.org/observations/' + catalog + '" target="_blank">Observation #' + catalog + '</a>');
              markers.set(catalog, marker);
            } else {
              markers.set(String(Math.random()), marker);
            }
            bounds.push([pt.latitude, pt.longitude]);
          }
        });
        map.addLayer(clusterGroup);
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
  const highlightKeys = React.useMemo(
    () => highlightedCatalogs.map((id) => String(id)),
    [highlightedCatalogs],
  );
  const html = React.useMemo(() => buildLeafletHtml(occurrences), [occurrences]);

  React.useEffect(() => {
    setMapReady(false);
  }, [html]);

  const sendHighlightMessage = React.useCallback(
    (catalogs: string[]) => {
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'highlight',
            catalogs,
          },
          '*',
        );
      } else {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'highlight',
            catalogs,
          }),
        );
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!mapReady || !hasOccurrences) {
      return;
    }
    sendHighlightMessage(highlightKeys);
  }, [mapReady, highlightKeys, sendHighlightMessage, hasOccurrences]);

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
