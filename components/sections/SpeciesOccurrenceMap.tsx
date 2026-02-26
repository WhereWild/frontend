import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { SpeciesHeatmapCell, SpeciesOccurrence } from '@/data/types';
import { ThemedText } from '../text/ThemedText';

type SpeciesOccurrenceMapProps = {
  occurrences: SpeciesOccurrence[];
  heatmapCells?: SpeciesHeatmapCell[];
  showHeatmap?: boolean;
  onViewportChange?: (zoom: number, bbox: string) => void;
  loading?: boolean;
  error?: string | null;
  height?: number;
  highlightedCatalogs?: (number | string)[];
};

const HIGHLIGHT_MESSAGE_TYPE = 'highlight';
const VIEWPORT_MESSAGE_TYPE = 'viewport';
const HEATMAP_MESSAGE_TYPE = 'heatmap';

type HighlightMessage = {
  type: typeof HIGHLIGHT_MESSAGE_TYPE;
  catalogs: string[];
};

type HeatmapMessage = {
  type: typeof HEATMAP_MESSAGE_TYPE;
  showHeatmap: boolean;
  cells: SpeciesHeatmapCell[];
};

type ViewportMessage = {
  type: typeof VIEWPORT_MESSAGE_TYPE;
  mapId: string;
  zoom: number;
  bbox: string;
};

type MapBridgeMessage = HighlightMessage | HeatmapMessage;

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

const toHeatmapMessagePayload = (
  showHeatmap: boolean,
  cells: SpeciesHeatmapCell[],
): HeatmapMessage => ({
  type: HEATMAP_MESSAGE_TYPE,
  showHeatmap,
  cells,
});

const buildLeafletHtml = (
  points: SpeciesOccurrence[],
  markerPalette: MapMarkerPalette,
  mapId: string,
) => {
  const payload = JSON.stringify(points ?? []);
  const palettePayload = JSON.stringify(markerPalette);
  const mapIdPayload = JSON.stringify(mapId);
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
      const mapId = ${mapIdPayload};
      let heatCells = [];
      let showHeatmap = false;
      const MIN_VISIBLE_INTENSITY = 0.05;
      const WORLD_BOUNDS = [[-90, -180], [90, 180]];
      const map = L.map('map', {
        maxBounds: WORLD_BOUNDS,
        maxBoundsViscosity: 1.0,
        worldCopyJump: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        noWrap: true,
      }).addTo(map);
      let heatGridLayers = [];

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function emitViewport() {
        const bounds = map.getBounds();
        let west = clamp(bounds.getWest(), -180, 180);
        let south = clamp(bounds.getSouth(), -90, 90);
        let east = clamp(bounds.getEast(), -180, 180);
        let north = clamp(bounds.getNorth(), -90, 90);

        if (north < south) {
          const temp = north;
          north = south;
          south = temp;
        }
        if (east <= west) {
          west = -180;
          east = 180;
        }

        const payload = {
          type: '${VIEWPORT_MESSAGE_TYPE}',
          mapId,
          zoom: map.getZoom(),
          bbox: [
            west,
            south,
            east,
            north,
          ].map((v) => Number(v).toFixed(5)).join(','),
        };
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, '*');
        }
      }

      function estimateGridStep(values) {
        const uniq = Array.from(new Set(values)).sort((a, b) => a - b);
        if (uniq.length < 2) {
          return null;
        }
        let minDiff = null;
        for (let i = 1; i < uniq.length; i += 1) {
          const diff = Math.abs(uniq[i] - uniq[i - 1]);
          if (!diff || !Number.isFinite(diff)) {
            continue;
          }
          if (minDiff === null || diff < minDiff) {
            minDiff = diff;
          }
        }
        return minDiff;
      }

      function clearHeatGrid() {
        heatGridLayers.forEach((layer) => {
          map.removeLayer(layer);
        });
        heatGridLayers = [];
      }

      function lerp(a, b, t) {
        return a + ((b - a) * t);
      }

      function rgbToHex(r, g, b) {
        const rr = Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, '0');
        const gg = Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, '0');
        const bb = Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, '0');
        return '#' + rr + gg + bb;
      }

      function colorForIntensity(intensity) {
        const t = Math.max(0, Math.min(1, intensity));
        if (t <= 1 / 3) {
          const local = t / (1 / 3);
          return rgbToHex(0, lerp(0, 255, local), 255);
        }
        if (t <= 2 / 3) {
          const local = (t - (1 / 3)) / (1 / 3);
          return rgbToHex(lerp(0, 255, local), 255, lerp(255, 0, local));
        }
        const local = (t - (2 / 3)) / (1 / 3);
        return rgbToHex(255, lerp(255, 0, local), 0);
      }

      function renderHeatLayer() {
        clearHeatGrid();
        if (!showHeatmap || !Array.isArray(heatCells) || !heatCells.length) {
          return;
        }
        const lats = [];
        const lons = [];
        heatCells.forEach((cell) => {
          if (typeof cell.lat === 'number' && typeof cell.lon === 'number') {
            lats.push(cell.lat);
            lons.push(cell.lon);
          }
        });

        const latStep = estimateGridStep(lats);
        const lonStep = estimateGridStep(lons);
        const stepLat = latStep && Number.isFinite(latStep) ? latStep : 0.5;
        const stepLon = lonStep && Number.isFinite(lonStep) ? lonStep : 0.5;
        const halfLat = stepLat / 2;
        const halfLon = stepLon / 2;

        if (!lats.length || !lons.length) {
          return;
        }

        heatCells.forEach((cell) => {
          if (typeof cell.lat !== 'number' || typeof cell.lon !== 'number') {
            return;
          }
          const intensity = typeof cell.intensity === 'number'
            ? Math.max(0, Math.min(1, cell.intensity))
            : 0.0;
          const visibleIntensity = intensity <= MIN_VISIBLE_INTENSITY
            ? 0
            : (intensity - MIN_VISIBLE_INTENSITY) / (1 - MIN_VISIBLE_INTENSITY);
          if (visibleIntensity <= 0) {
            return;
          }

          const bounds = [
            [cell.lat - halfLat, cell.lon - halfLon],
            [cell.lat + halfLat, cell.lon + halfLon],
          ];
          const alpha = 0.08 + (0.72 * visibleIntensity);
          const fillColor = colorForIntensity(visibleIntensity);
          const layer = L.rectangle(bounds, {
            stroke: false,
            fillColor,
            fillOpacity: alpha,
            interactive: false,
          });
          layer.addTo(map);
          heatGridLayers.push(layer);
        });
      }
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
      function handleMapMessage(payload) {
        let data = payload;
        if (typeof payload === 'string') {
          try {
            data = JSON.parse(payload);
          } catch (err) {
            return;
          }
        }
        if (!data || typeof data !== 'object') {
          return;
        }
        if (data.type === '${HIGHLIGHT_MESSAGE_TYPE}') {
          applyHighlights(data.catalogs || []);
          return;
        }
        if (data.type === '${HEATMAP_MESSAGE_TYPE}') {
          showHeatmap = Boolean(data.showHeatmap);
          heatCells = Array.isArray(data.cells) ? data.cells : [];
          renderHeatLayer();
          return;
        }
      }
      document.addEventListener('message', (event) => handleMapMessage(event.data));
      window.addEventListener('message', (event) => handleMapMessage(event.data));

      if (Array.isArray(points) && points.length) {
        const bounds = [];
        const clusterGroup = L.markerClusterGroup({ spiderfyOnMaxZoom: false, disableClusteringAtZoom: 6 });
        const useCluster = points.length >= 10000;
        points.forEach((pt, idx) => {
          if (typeof pt.latitude === 'number' && typeof pt.longitude === 'number') {
            const catalog = pt.catalogNumber ? String(pt.catalogNumber) : '';
            const marker = L.circleMarker([pt.latitude, pt.longitude]);
            if (useCluster) {
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
        if (useCluster) {
          map.addLayer(clusterGroup);
        }
        if (bounds.length) {
          map.fitBounds(bounds, { padding: [20, 20] });
          renderHeatLayer();
          emitViewport();
        } else {
          map.setView([0, 0], 2);
          renderHeatLayer();
          emitViewport();
        }
      } else {
        map.setView([0, 0], 2);
        renderHeatLayer();
        emitViewport();
      }
      map.on('zoomend moveend', emitViewport);
      applyHighlights([]);
    </script>
  </body>
</html>`;
};

export function SpeciesOccurrenceMap({
  occurrences,
  heatmapCells = [],
  showHeatmap = false,
  onViewportChange,
  loading = false,
  error = null,
  height = 360,
  highlightedCatalogs = [],
}: SpeciesOccurrenceMapProps) {
  const scheme = useColorScheme();
  const colorMode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[colorMode];
  const webViewRef = React.useRef<WebView>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [mapReady, setMapReady] = React.useState(false);
  const mapInstanceId = React.useRef(`species-map-${Math.random().toString(36).slice(2)}`);

  const hasOccurrences = occurrences.length > 0;
  const markerPalette = React.useMemo<MapMarkerPalette>(
    () => ({
      markerFill: palette.background.brand.default,
      markerStroke: palette.border.brand.default,
      highlightFill: palette.background.danger.default,
      highlightStroke: palette.border.danger.default,
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
  const html = React.useMemo(
    () => buildLeafletHtml(occurrences, markerPalette, mapInstanceId.current),
    [markerPalette, occurrences],
  );

  const handleViewportMessage = React.useCallback(
    (raw: unknown) => {
      if (!onViewportChange) {
        return;
      }
      let data = raw;
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== 'object') {
        return;
      }
      const payload = data as Partial<ViewportMessage>;
      if (payload.type !== VIEWPORT_MESSAGE_TYPE) {
        return;
      }
      if (payload.mapId !== mapInstanceId.current) {
        return;
      }
      if (typeof payload.zoom !== 'number' || typeof payload.bbox !== 'string') {
        return;
      }
      onViewportChange(payload.zoom, payload.bbox);
    },
    [onViewportChange],
  );

  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const listener = (event: MessageEvent) => {
      handleViewportMessage(event.data);
    };
    window.addEventListener('message', listener);
    return () => {
      window.removeEventListener('message', listener);
    };
  }, [handleViewportMessage]);

  React.useEffect(() => {
    setMapReady(false);
  }, [html]);

  const highlightMessage = React.useMemo(
    () => toHighlightMessagePayload(highlightKeys),
    [highlightKeys],
  );

  const heatmapMessage = React.useMemo(
    () => toHeatmapMessagePayload(showHeatmap, heatmapCells),
    [heatmapCells, showHeatmap],
  );

  const sendMapMessage = React.useCallback(
    (message: MapBridgeMessage) => {
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
    sendMapMessage(highlightMessage);
  }, [hasOccurrences, highlightMessage, mapReady, sendMapMessage]);

  React.useEffect(() => {
    if (!mapReady || !hasOccurrences) {
      return;
    }
    sendMapMessage(heatmapMessage);
  }, [hasOccurrences, heatmapMessage, mapReady, sendMapMessage]);

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
          onMessage={(event: WebViewMessageEvent) => handleViewportMessage(event.nativeEvent.data)}
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
