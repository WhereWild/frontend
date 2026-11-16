// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { MapVariableLegend } from '@/components/sections/speciesOccurrenceMap/MapVariableLegend';
import {
  COLORMAPS,
  stopsColormap,
} from '@/components/sections/speciesOccurrenceMap/variableColors';
import {
  findTruth,
  scoreSelection,
  type ExtremeTarget,
  type StudySelection,
} from '@/components/sections/studyScoring';
import { cdfAt, VARIABLE_CDFS } from '@/components/sections/studyDistributions';
import {
  COOLWARM_STOPS,
  sampleStops,
  CUSTOM_BOUNDS_F,
  CENTER_F,
  DISTRIBUTION_STOP_COUNT,
  equalizedStops,
  TEMPERATURE_VARIABLE_IDS,
  THEMATIC_STOPS,
  globalHueObservedLumSatStops,
  type StudyScheme,
} from '@/components/sections/studyColors';
import type { StudyViewBox } from '@/components/sections/studyPool';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { mapDebugLog } from '@/components/sections/mapDebug';
import { useStudyData } from '@/components/sections/useStudyData';
import { ThemedText } from '@/components/text/ThemedText';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, View } from 'react-native';

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
   * the map expects to toggle the pin off). */
  onSelect?: (selection: StudySelection | null) => void;
  /** Fires once the map has loaded AND this species' occurrences and values
   * have arrived — i.e. the participant can actually see and use the map. */
  onReady?: () => void;
  /** Species to preload in the background (the upcoming trials). */
  prefetchTaxonIds?: readonly string[];
};

/** One species' occurrence map for the visualization study: dots colored by
 * `variable` according to `scheme`, with a legend. Renders nothing until the
 * data the scheme needs (e.g. the variable's catalog bounds, the species'
 * observed range) is available. */
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
    const inView = viewBox
      ? data.occurrences.filter(
          (o) =>
            o.longitude >= viewBox.lonMin &&
            o.longitude < viewBox.lonMax &&
            o.latitude >= viewBox.latMin &&
            o.latitude < viewBox.latMax,
        )
      : data.occurrences;
    return {
      values: data.values,
      // Clicking a dot shows only its value - no observation number, photo
      // or attribution (which would identify the species/observation).
      occurrences: inView.map((o) => ({ ...o, valueOnlyPopup: true })),
    };
  }, [data, taxonId, viewBox]);
  // The map stays mounted across species; until the next one loads it keeps
  // the previous dots (hidden under a loading cover) instead of rebuilding.
  const lastShownRef = React.useRef(shown);
  if (shown) lastShownRef.current = shown;
  const display = shown ?? lastShownRef.current;
  const stale = shown == null;
  const occurrences = React.useMemo(
    () => display?.occurrences ?? [],
    [display],
  );
  const observationValues = display?.values ?? null;
  const [mapLoaded, setMapLoaded] = React.useState(false);
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

  // Ready = the map is loaded and THIS species' data is in (not the previous
  // species' still showing).
  React.useEffect(() => {
    mapDebugLog('StudyMap state', {
      taxonId,
      mapLoaded,
      shown: shown ? shown.occurrences.length : null,
      stale,
    });
    if (mapLoaded && shown) onReady?.();
  }, [mapLoaded, shown, onReady, taxonId, stale]);

  const handleMapReady = React.useCallback(() => setMapLoaded(true), []);

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

  const { renderMin, renderMax } = variable;
  const colormap = React.useMemo(() => {
    const baseStops =
      scheme.colormap === 'magma'
        ? COLORMAPS.magma.stops
        : scheme.colormap === 'thematic'
          ? (THEMATIC_STOPS[variable.id] ?? COOLWARM_STOPS)
          : COOLWARM_STOPS;
    const globalRange =
      renderMin != null && renderMax != null
        ? { min: renderMin, max: renderMax }
        : null;
    const fToDisplay = (f: number) =>
      units === 'metric' ? ((f - 32) * 5) / 9 : f;
    const range =
      scheme.bounds === 'observed'
        ? observedRange
        : (scheme.bounds === 'custom' || scheme.bounds === 'custom2') &&
            TEMPERATURE_VARIABLE_IDS.includes(variable.id)
          ? {
              min: fToDisplay(CUSTOM_BOUNDS_F[scheme.bounds].min),
              max: fToDisplay(CUSTOM_BOUNDS_F[scheme.bounds].max),
            }
          : globalRange;
    if (!range) return null;
    // Distribution-aware: position = the value's share of global area within
    // `range` (needs this variable's CDF; falls back to linear without it).
    const cdf = scheme.distributionAware ? VARIABLE_CDFS[variable.id] : null;
    const toC = (v: number) => (units === 'metric' ? v : ((v - 32) * 5) / 9);
    // Base 0..1 position of a value within `range`: linear, or equal-area.
    const base = cdf
      ? (() => {
          const lo = cdfAt(cdf, toC(range.min));
          const span = cdfAt(cdf, toC(range.max)) - lo || 1;
          return (v: number) => (cdfAt(cdf, toC(v)) - lo) / span;
        })()
      : (v: number) => (v - range.min) / (range.max - range.min || 1);
    // Center pin: the colormap's middle lands on a fixed temperature, each
    // side interpolated linearly (in base position) out to the range ends.
    const centerValue =
      scheme.center !== 'none' && TEMPERATURE_VARIABLE_IDS.includes(variable.id)
        ? fToDisplay(CENTER_F[scheme.center])
        : null;
    const centerPos = centerValue != null ? base(centerValue) : null;
    const pinned = centerPos != null && centerPos > 0 && centerPos < 1;
    const position =
      cdf || pinned
        ? (v: number) => {
            const u = base(v);
            if (!pinned) return u;
            return u <= centerPos
              ? (0.5 * u) / centerPos
              : 0.5 + (0.5 * (u - centerPos)) / (1 - centerPos);
          }
        : null;
    if (!scheme.observedLumSat) {
      return {
        ...stopsColormap(
          position
            ? equalizedStops(baseStops, range.min, range.max, position)
            : baseStops,
        ),
        min: range.min,
        max: range.max,
      };
    }
    // Hue spans `range`; lightness/saturation span the observed range.
    if (!observedRange) return null;
    return {
      ...stopsColormap(
        globalHueObservedLumSatStops({
          globalStops: baseStops,
          globalMin: range.min,
          globalMax: range.max,
          observedMin: observedRange.min,
          observedMax: observedRange.max,
          shape: scheme.lumSatShape,
          channels: scheme.lumSatChannels,
          hueAtValue: position ?? undefined,
          stopCount: position ? DISTRIBUTION_STOP_COUNT : undefined,
        }),
      ),
      min: observedRange.min,
      max: observedRange.max,
    };
  }, [scheme, units, variable.id, renderMin, renderMax, observedRange]);
  // Once the map has been shown, keep it mounted with the last good colors
  // while a new scheme's inputs (e.g. a refetched range) are in flight —
  // unmounting would rebuild the whole map instead of recoloring it.
  const lastColormapRef = React.useRef(colormap);
  if (colormap) lastColormapRef.current = colormap;
  const activeColormap = colormap ?? lastColormapRef.current;
  if (!activeColormap) return null;

  // Legend: either the colormap's own range, or only the part of it the
  // species' values cover (labelled with its local min/max) - the dots are
  // colored the same either way.
  const legend =
    legendRange === 'observed' && observedRange
      ? (() => {
          const count = 101;
          const span = activeColormap.max - activeColormap.min || 1;
          const slice = Array.from({ length: count }, (_, i) => {
            const v =
              observedRange.min +
              (i / (count - 1)) * (observedRange.max - observedRange.min);
            return sampleStops(
              activeColormap.stops,
              (v - activeColormap.min) / span,
            );
          });
          return {
            min: observedRange.min,
            max: observedRange.max,
            barSvgStops: stopsColormap(slice).barSvgStops,
          };
        })()
      : {
          min: activeColormap.min,
          max: activeColormap.max,
          barSvgStops: activeColormap.barSvgStops,
        };

  return (
    <View style={styles.wrap}>
      <SpeciesOccurrenceMap
        occurrences={occurrences}
        loading={stale}
        error={error}
        height={height}
        minZoom={0}
        // Recolor dots via the map's live update message instead of
        // rebuilding the whole map when the scheme/values change.
        preserveMapPosition
        enableBasemapModeToggle={false}
        onMapReady={handleMapReady}
        onPinObservation={handlePin}
        selectedPoint={selectedPoint}
        observationValues={observationValues}
        variableDataLoading={display == null}
        dotMin={activeColormap.min}
        dotMax={activeColormap.max}
        gradientStops={activeColormap.stops}
        varUnits={variable.units ?? null}
      />
      <MapVariableLegend
        min={legend.min}
        max={legend.max}
        units={variable.units}
        barSvgStops={legend.barSvgStops}
      />
      {stale && display ? (
        <View
          style={[
            styles.cover,
            { backgroundColor: palette.background.default.secondary },
          ]}
        >
          <ThemedText>Loading next species…</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', flex: 1, minWidth: 280 },
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
