// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { MapVariableLegend } from '@/components/sections/speciesOccurrenceMap/MapVariableLegend';
import {
  interpolateGradientStops,
  safeGradientT,
} from '@/components/sections/speciesOccurrenceMap/speciesOccurrenceMapHelpers';
import {
  StudyDotMap,
  type StudyDot,
} from '@/components/sections/studyDotMap/StudyDotMap';
import {
  buildStudyColormap,
  buildStudyLegend,
  type StudyColormap,
} from '@/components/sections/studyColormap';
import type { StudyScheme } from '@/components/sections/studyColors';
import type { StudyViewBox } from '@/components/sections/studyPool';
import {
  findTruth,
  scoreSelection,
  type ExtremeTarget,
  type StudySelection,
} from '@/components/sections/studyScoring';
import { mapDebugLog } from '@/components/sections/mapDebug';
import { useStudyData } from '@/components/sections/useStudyData';
import { ThemedText } from '@/components/text/ThemedText';
import { Colors } from '@/constants/theme';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Longest a trial waits for the map to report the new dots drawn and the
 * basemap loaded before proceeding anyway. */
const SETTLE_TIMEOUT_MS = 15000;

type StudyMapProps = {
  taxonId: string;
  variable: EnvironmentVariableDefinition;
  units: string;
  height: number;
  /** Color configuration for the dots and legend (see StudyScheme). */
  scheme: StudyScheme;
  /** What range the legend shows: the colormap's own range (default), or
   * just this species' observed range - the slice of the colormap its values
   * actually fall in - while the dots keep the colormap's full range. */
  legendRange?: 'colormap' | 'observed';
  /** Geographic crop: only observations inside it are displayed, scored
   * against, and used for the 'observed' bounds. */
  viewBox?: StudyViewBox;
  /** When set, clicking a dot records it as the participant's answer to
   * "where is this species' habitat the <target>?" and reports it, scored
   * against the true extreme observation. */
  target?: ExtremeTarget;
  /** Called with the new selection, or null when the participant clears it
   * (clicking the selected dot's popup 'x' sends the same pin again, which
   * the map treats as a toggle). */
  onSelect?: (selection: StudySelection | null) => void;
  /** Fires once THIS species' dots are drawn and the basemap has loaded - the
   * participant can actually see and use the map. `verified` is false when
   * that was never confirmed and the wait timed out instead. */
  onReady?: (verified: boolean) => void;
  /** Species to preload in the background (the upcoming trials). */
  prefetchTaxonIds?: readonly string[];
  /** A key was pressed while the map had focus. */
  onKey?: (key: string) => void;
};

const NO_DATA_COLOR = 'rgba(255,255,255,0.5)';

const formatValue = (value: number, units: string | null | undefined) => {
  const text =
    Math.abs(value) >= 1000
      ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return units ? `${text} ${units}` : text;
};

/** One species' occurrence map for the visualization study: dots colored by
 * `variable` according to `scheme`, with a legend. */
export function StudyMap({
  taxonId,
  variable,
  units,
  height,
  scheme,
  legendRange = 'colormap',
  viewBox,
  target,
  onSelect,
  onReady,
  prefetchTaxonIds,
  onKey,
}: StudyMapProps) {
  const { data, error } = useStudyData({
    taxonId,
    variableId: variable.id,
    units,
    prefetch: prefetchTaxonIds,
  });
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // `shown`: this taxon's data (cropped to its viewBox), once it has loaded.
  const shown = React.useMemo(() => {
    if (!data || data.taxonId !== taxonId) return null;
    return {
      values: data.values,
      occurrences: viewBox
        ? data.occurrences.filter(
            (o) =>
              o.longitude >= viewBox.lonMin &&
              o.longitude < viewBox.lonMax &&
              o.latitude >= viewBox.latMin &&
              o.latitude < viewBox.latMax,
          )
        : data.occurrences,
    };
  }, [data, taxonId, viewBox]);
  // The map stays mounted across species; until the next one loads it keeps
  // showing the previous dots under a loading cover.
  const lastShownRef = React.useRef(shown);
  if (shown) lastShownRef.current = shown;
  const display = shown ?? lastShownRef.current;
  const occurrences = React.useMemo(
    () => display?.occurrences ?? [],
    [display],
  );
  const observationValues = display?.values ?? null;

  const [selectedPoint, setSelectedPoint] = React.useState<{
    lat: number;
    lon: number;
    catalogNumber: string;
  } | null>(null);
  // A new species starts with nothing selected.
  React.useEffect(() => {
    setSelectedPoint(null);
  }, [taxonId]);

  // The 'observed' range is the min..max of what is actually displayed (after
  // the geographic crop), not a percentile range.
  const observedRange = React.useMemo(() => {
    if (!observationValues) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const occ of occurrences) {
      const v = observationValues.get(String(occ.catalogNumber));
      if (v == null) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return min < max ? { min, max } : null;
  }, [occurrences, observationValues]);

  const colormap = React.useMemo(
    () => buildStudyColormap(scheme, variable, units, observedRange),
    [scheme, variable, units, observedRange],
  );
  // Keep the last good colors while a scheme's inputs are in flight.
  const lastColormapRef = React.useRef<StudyColormap | null>(colormap);
  if (colormap) lastColormapRef.current = colormap;
  const activeColormap = colormap ?? lastColormapRef.current;

  const dots = React.useMemo<StudyDot[]>(() => {
    if (!activeColormap || !observationValues) return [];
    return occurrences.map((occ) => {
      const id = String(occ.catalogNumber);
      const value = observationValues.get(id);
      return {
        id,
        lat: occ.latitude,
        lon: occ.longitude,
        color:
          value == null
            ? NO_DATA_COLOR
            : interpolateGradientStops(
                safeGradientT(value, activeColormap.min, activeColormap.max),
                activeColormap.stops,
              ),
        label: value == null ? 'No data' : formatValue(value, variable.units),
      };
    });
  }, [occurrences, observationValues, activeColormap, variable.units]);

  // Settled = the map reported THIS species' dots drawn and its basemap
  // loaded. The trial only starts, and the cover only lifts, once settled,
  // with a fallback so a stalled map can't block a participant forever.
  const [settled, setSettled] = React.useState<'verified' | 'timeout' | null>(
    null,
  );
  React.useEffect(() => {
    setSettled(null);
  }, [shown]);
  React.useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => {
      mapDebugLog('settle TIMEOUT - proceeding without verification', {
        taxonId,
      });
      setSettled((current) => current ?? 'timeout');
    }, SETTLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // `shown` already changes with the taxon.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  const handleDrawn = React.useCallback(() => setSettled('verified'), []);

  React.useEffect(() => {
    mapDebugLog('StudyMap state', {
      taxonId,
      shown: shown ? shown.occurrences.length : null,
      settled: settled ?? 'no',
    });
    if (shown && settled) onReady?.(settled === 'verified');
  }, [shown, settled, onReady, taxonId]);

  const handlePin = React.useCallback(
    (catalogNumber: string, lat: number, lon: number) => {
      if (selectedPoint?.catalogNumber === catalogNumber) {
        setSelectedPoint(null);
        if (target) onSelect?.(null);
        return;
      }
      setSelectedPoint({ lat, lon, catalogNumber });
      if (!target || !onSelect) return;
      onSelect(
        scoreSelection(
          {
            catalogNumber,
            lat,
            lon,
            value: observationValues?.get(catalogNumber) ?? null,
          },
          findTruth(occurrences, observationValues, target),
        ),
      );
    },
    [selectedPoint, target, onSelect, occurrences, observationValues],
  );

  if (error) {
    return <ThemedText>{error}</ThemedText>;
  }
  if (!activeColormap) return null;
  const legend = buildStudyLegend(activeColormap, legendRange, observedRange);

  return (
    <View style={styles.wrap}>
      <StudyDotMap
        dots={dots}
        selectedId={selectedPoint?.catalogNumber ?? null}
        height={height}
        onPin={handlePin}
        onDrawn={handleDrawn}
        onKey={onKey}
      />
      {/* Hidden until the map is ready: the legend must not show over a
          loading or half-drawn map. The wrapper fills the map area because the
          legend positions itself absolutely against its parent. */}
      <View
        style={[
          styles.legendLayer,
          {
            opacity: settled != null ? 1 : 0,
            pointerEvents: settled != null ? 'box-none' : 'none',
          },
        ]}
      >
        <MapVariableLegend
          min={legend.min}
          max={legend.max}
          units={variable.units}
          barSvgStops={legend.barSvgStops}
        />
      </View>
      {settled == null && display ? (
        <View
          style={[
            styles.cover,
            { backgroundColor: palette.background.default.secondary },
          ]}
        >
          <ThemedText>Loading…</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', flex: 1, minWidth: 280 },
  legendLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
