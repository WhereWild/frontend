// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { MapVariableLegend } from '@/components/sections/speciesOccurrenceMap/MapVariableLegend';
import { stopsColormap } from '@/components/sections/speciesOccurrenceMap/variableColors';
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
};

/** One species' occurrence map for the visualization study: dots colored by
 * `variable` using its catalog colormap override and its catalog render
 * min/max (global bounds), with a legend. Renders nothing until the variable
 * carries both. */
export function StudyMap({ taxonId, variable, units, height }: StudyMapProps) {
  const { occurrences, loading, error } = useSpeciesOccurrences({ taxonId });
  const [observationValues, setObservationValues] = React.useState<Map<
    string,
    number
  > | null>(null);

  React.useEffect(() => {
    setObservationValues(null);
    let cancelled = false;
    fetch(
      `${BACKEND_BASE}/species/${encodeURIComponent(taxonId)}/environment/${encodeURIComponent(variable.id)}/observation-values?unit_system=${units}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(
        (data: {
          observations?: { catalogNumber: string | number; value: number }[];
        }) => {
          if (cancelled) return;
          const map = new Map<string, number>();
          for (const obs of data.observations ?? []) {
            if (obs.catalogNumber != null && typeof obs.value === 'number') {
              map.set(String(obs.catalogNumber), obs.value);
            }
          }
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

  const { renderMin, renderMax, colormapOverride } = variable;
  if (renderMin == null || renderMax == null || !colormapOverride) return null;
  const colormap = stopsColormap(colormapOverride.stops);

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
        observationValues={observationValues}
        variableDataLoading={observationValues == null}
        dotMin={renderMin}
        dotMax={renderMax}
        gradientStops={colormap.stops}
        varUnits={variable.units ?? null}
      />
      <MapVariableLegend
        min={renderMin}
        max={renderMax}
        units={variable.units}
        barSvgStops={colormap.barSvgStops}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', flex: 1, minWidth: 280 },
});
