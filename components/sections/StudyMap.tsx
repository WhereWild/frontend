// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { MapVariableLegend } from '@/components/sections/speciesOccurrenceMap/MapVariableLegend';
import { stopsColormap } from '@/components/sections/speciesOccurrenceMap/variableColors';
import {
  findTruth,
  scoreSelection,
  type ExtremeTarget,
  type StudySelection,
} from '@/components/sections/studyScoring';
import { globalHueObservedLumSatStops } from '@/components/sections/studyColors';
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
  /** Keep the global range for hue but let lightness/saturation span the
   * species' own observed range (see studyColors.ts). Off: the plain global
   * catalog colormap. */
  observedLumSat?: boolean;
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
 * `variable` using its catalog colormap override and its catalog render
 * min/max (global bounds), with a legend. Renders nothing until the variable
 * carries both. */
export function StudyMap({
  taxonId,
  variable,
  units,
  height,
  observedLumSat = false,
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

  const { renderMin, renderMax, colormapOverride } = variable;
  const colormap = React.useMemo(() => {
    if (renderMin == null || renderMax == null || !colormapOverride) {
      return null;
    }
    if (!observedLumSat) {
      return {
        ...stopsColormap(colormapOverride.stops),
        min: renderMin,
        max: renderMax,
      };
    }
    // Needs the species' observed range; hold the dots until it arrives.
    if (!observedRange) return null;
    return {
      ...stopsColormap(
        globalHueObservedLumSatStops({
          globalStops: colormapOverride.stops,
          globalMin: renderMin,
          globalMax: renderMax,
          observedMin: observedRange.min,
          observedMax: observedRange.max,
        }),
      ),
      min: observedRange.min,
      max: observedRange.max,
    };
  }, [renderMin, renderMax, colormapOverride, observedLumSat, observedRange]);
  if (!colormap) return null;

  return (
    <View style={styles.wrap}>
      <SpeciesOccurrenceMap
        key={taxonId}
        occurrences={occurrences}
        loading={loading}
        error={error}
        height={height}
        minZoom={0}
        enableBasemapModeToggle={false}
        onMapReady={handleMapReady}
        onPinObservation={handlePin}
        selectedPoint={selectedPoint}
        observationValues={observationValues}
        variableDataLoading={observationValues == null}
        dotMin={colormap.min}
        dotMax={colormap.max}
        gradientStops={colormap.stops}
        varUnits={variable.units ?? null}
      />
      <MapVariableLegend
        min={colormap.min}
        max={colormap.max}
        units={variable.units}
        barSvgStops={colormap.barSvgStops}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', flex: 1, minWidth: 280 },
});
