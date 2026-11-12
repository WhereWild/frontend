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
import {
  COOLWARM_STOPS,
  CUSTOM_BOUNDS_F,
  globalHueObservedLumSatStops,
  type StudyScheme,
} from '@/components/sections/studyColors';
import { BACKEND_BASE } from '@/data/apiShared';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { useSpeciesOccurrences } from '@/hooks/species/useSpeciesOccurrences';
import React from 'react';
import { StyleSheet, View } from 'react-native';

type StudyMapProps = {
  taxonId: string;
  variable: EnvironmentVariableDefinition;
  units: string;
  height: number;
  /** Color configuration for the dots and legend (see StudyScheme). */
  scheme: StudyScheme;
  /** When set, clicking a dot records it as the participant's answer to
   * "where is this species' habitat the <target>?" and reports it, scored
   * against the true extreme observation. */
  target?: ExtremeTarget;
  onSelect?: (selection: StudySelection) => void;
  /** Fires once the map has loaded AND this species' occurrences and values
   * have arrived — i.e. the participant can actually see and use the map. */
  onReady?: () => void;
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
  target,
  onSelect,
  onReady,
}: StudyMapProps) {
  const { occurrences, loading, error } = useSpeciesOccurrences({ taxonId });
  const [mapLoaded, setMapLoaded] = React.useState(false);
  const [observedRange, setObservedRange] = React.useState<{
    min: number;
    max: number;
  } | null>(null);
  const [selectedPoint, setSelectedPoint] = React.useState<{
    lat: number;
    lon: number;
    catalogNumber: string;
  } | null>(null);
  const [observationValues, setObservationValues] = React.useState<Map<
    string,
    number
  > | null>(null);

  React.useEffect(() => {
    setObservationValues(null);
    setObservedRange(null);
    let cancelled = false;
    fetch(
      `${BACKEND_BASE}/species/${encodeURIComponent(taxonId)}/environment/${encodeURIComponent(variable.id)}/observation-values?unit_system=${units}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(
        (data: {
          observations?: { catalogNumber: string | number; value: number }[];
          min?: number | null;
          max?: number | null;
          q01?: number | null;
          q99?: number | null;
        }) => {
          if (cancelled) return;
          const map = new Map<string, number>();
          for (const obs of data.observations ?? []) {
            if (obs.catalogNumber != null && typeof obs.value === 'number') {
              map.set(String(obs.catalogNumber), obs.value);
            }
          }
          // Same robust range the species page colors dots by (q01/q99,
          // falling back to min/max).
          const lo = data.q01 ?? data.min;
          const hi = data.q99 ?? data.max;
          setObservedRange(
            typeof lo === 'number' && typeof hi === 'number' && lo < hi
              ? { min: lo, max: hi }
              : null,
          );
          setObservationValues(map);
        },
      )
      .catch(() => {
        if (!cancelled) setObservationValues(null);
      });
    return () => {
      cancelled = true;
    };
  }, [taxonId, variable.id, units]);

  const dataReady = !loading && observationValues != null;
  React.useEffect(() => {
    if (mapLoaded && dataReady) onReady?.();
  }, [mapLoaded, dataReady, onReady]);

  const handleMapReady = React.useCallback(() => setMapLoaded(true), []);

  const handlePin = React.useCallback(
    (catalogNumber: string, lat: number, lon: number) => {
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
    [target, onSelect, occurrences, observationValues],
  );

  const { renderMin, renderMax } = variable;
  const colormap = React.useMemo(() => {
    const baseStops =
      scheme.colormap === 'coolwarm' ? COOLWARM_STOPS : COLORMAPS.viridis.stops;
    const globalRange =
      renderMin != null && renderMax != null
        ? { min: renderMin, max: renderMax }
        : null;
    const fToDisplay = (f: number) =>
      units === 'metric' ? ((f - 32) * 5) / 9 : f;
    const range =
      scheme.bounds === 'observed'
        ? observedRange
        : scheme.bounds === 'custom' || scheme.bounds === 'custom2'
          ? {
              min: fToDisplay(CUSTOM_BOUNDS_F[scheme.bounds].min),
              max: fToDisplay(CUSTOM_BOUNDS_F[scheme.bounds].max),
            }
          : globalRange;
    if (!range) return null;
    if (!scheme.observedLumSat) {
      return { ...stopsColormap(baseStops), min: range.min, max: range.max };
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
        }),
      ),
      min: observedRange.min,
      max: observedRange.max,
    };
  }, [scheme, units, renderMin, renderMax, observedRange]);
  // Once the map has been shown, keep it mounted with the last good colors
  // while a new scheme's inputs (e.g. a refetched range) are in flight —
  // unmounting would rebuild the whole map instead of recoloring it.
  const lastColormapRef = React.useRef(colormap);
  if (colormap) lastColormapRef.current = colormap;
  const activeColormap = colormap ?? lastColormapRef.current;
  if (!activeColormap) return null;

  return (
    <View style={styles.wrap}>
      <SpeciesOccurrenceMap
        key={taxonId}
        occurrences={occurrences}
        loading={loading}
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
        variableDataLoading={observationValues == null}
        dotMin={activeColormap.min}
        dotMax={activeColormap.max}
        gradientStops={activeColormap.stops}
        varUnits={variable.units ?? null}
      />
      <MapVariableLegend
        min={activeColormap.min}
        max={activeColormap.max}
        units={variable.units}
        barSvgStops={activeColormap.barSvgStops}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', flex: 1, minWidth: 280 },
});
