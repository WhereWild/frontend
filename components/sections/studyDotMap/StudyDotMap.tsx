// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildStudyDotMapHtml } from '@/components/sections/studyDotMap/studyDotMapHtml';
import {
  ensureBasemapBuildDateLoaded,
  getBasemapBuildDate,
  getMapTileUrlTemplate,
  MAP_REFERRER_POLICY,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_MAX_ZOOM,
} from '@/components/sections/speciesOccurrenceMap/speciesOccurrenceMapHelpers';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

export type StudyDot = {
  id: string;
  lat: number;
  lon: number;
  /** Ready-made CSS color for the dot. */
  color: string;
  /** Text shown in the dot's popup. */
  label: string;
};

type StudyDotMapProps = {
  dots: StudyDot[];
  /** Which dot is selected (ring + popup); null for none. */
  selectedId: string | null;
  height: number;
  /** A dot was clicked, or its popup's close button - the caller toggles. */
  onPin: (id: string, lat: number, lon: number) => void;
  /** The CURRENT `dots` are drawn and the basemap for the view has loaded. */
  onDrawn: () => void;
  /** A key was pressed while the map frame had focus (key events inside an
   * iframe never reach the page's own listeners). */
  onKey?: (key: string) => void;
};

/** Observation map for the visualization study: a small dedicated MapLibre
 * document (flat Mercator, raster basemap) that draws the dots itself from
 * ready-made colors - see studyDotMapHtml.ts for why this isn't the shared
 * SpeciesOccurrenceMap. Web only. */
export function StudyDotMap({
  dots,
  selectedId,
  height,
  onPin,
  onDrawn,
  onKey,
}: StudyDotMapProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [iframeLoaded, setIframeLoaded] = React.useState(false);
  const [basemapReady, setBasemapReady] = React.useState(
    () => getBasemapBuildDate() != null,
  );

  // The tile URL embeds the basemap build date, which loads asynchronously.
  React.useEffect(() => {
    let cancelled = false;
    void ensureBasemapBuildDateLoaded().then(() => {
      if (!cancelled) setBasemapReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const background = palette.background.default.tertiary;
  // Built once per basemap mode, so the iframe (and its WebGL map) persists
  // across species; swapping species only posts new dots.
  const html = React.useMemo(
    () =>
      basemapReady
        ? buildStudyDotMapHtml({
            tileUrl: getMapTileUrlTemplate(mode, 'default'),
            attribution: MAP_TILE_ATTRIBUTION,
            maxZoom: MAP_TILE_MAX_ZOOM,
            background,
          })
        : null,
    [basemapReady, mode, background],
  );
  React.useEffect(() => {
    setIframeLoaded(false);
  }, [html]);

  // Each dots change gets a token; only the newest token's "drawn" report is
  // forwarded, so a late report for a previous species can't release a newer
  // trial.
  const tokenRef = React.useRef(0);
  const onPinRef = React.useRef(onPin);
  onPinRef.current = onPin;
  const onDrawnRef = React.useRef(onDrawn);
  onDrawnRef.current = onDrawn;
  const onKeyRef = React.useRef(onKey);
  onKeyRef.current = onKey;

  const post = React.useCallback((message: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  }, []);

  React.useEffect(() => {
    if (!iframeLoaded || dots.length === 0) return;
    tokenRef.current += 1;
    post({
      type: 'studyPoints',
      token: tokenRef.current,
      points: dots.map((d) => [d.lon, d.lat, d.color, d.id, d.label]),
    });
  }, [iframeLoaded, dots, post]);

  React.useEffect(() => {
    if (iframeLoaded) post({ type: 'studySelect', id: selectedId });
  }, [iframeLoaded, selectedId, dots, post]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: MessageEvent) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow) return;
      const data = event.data as {
        type?: string;
        id?: string;
        key?: string;
        lat?: number;
        lon?: number;
        token?: number;
      } | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'studyKey' && typeof data.key === 'string') {
        onKeyRef.current?.(data.key);
      } else if (
        data.type === 'studyPin' &&
        typeof data.id === 'string' &&
        typeof data.lat === 'number' &&
        typeof data.lon === 'number'
      ) {
        onPinRef.current(data.id, data.lat, data.lon);
      } else if (
        data.type === 'studyDrawn' &&
        data.token === tokenRef.current
      ) {
        onDrawnRef.current();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (Platform.OS !== 'web' || !html) {
    return (
      <View
        style={[styles.frame, { height, backgroundColor: background }]}
        collapsable={false}
      />
    );
  }
  return (
    <View
      style={[styles.frame, { height, backgroundColor: background }]}
      collapsable={false}
    >
      {React.createElement('iframe', {
        ref: iframeRef,
        srcDoc: html,
        title: 'Observation map',
        style: { width: '100%', height: '100%', border: '0' },
        sandbox: 'allow-same-origin allow-scripts allow-popups',
        referrerPolicy: MAP_REFERRER_POLICY,
        onLoad: () => setIframeLoaded(true),
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden' },
});
