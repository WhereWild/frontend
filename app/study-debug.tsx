// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Debug page for the visualization study: toggle each color setting
// (colormap, bounds, observed luminance/saturation), the units and the
// species, and see the resulting map live. Nothing is recorded.

import { Button, PageScrollContainer } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { ThemedText } from '@/components/text/ThemedText';
import { StudyMap } from '@/components/sections/StudyMap';
import type { StudyScheme } from '@/components/sections/studyColors';
import { fetchEnvironmentVariables } from '@/data/api';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { StyleSheet, View } from 'react-native';
import React from 'react';

const VARIABLE_OPTIONS = [
  { value: 'bio1', label: 'Annual mean temp (bio1)' },
  { value: 'bio5', label: 'Max temp of warmest month (bio5)' },
  { value: 'bio6', label: 'Min temp of coldest month (bio6)' },
];
const MAP_HEIGHT = 480;

const SPECIES = [
  { taxonId: '6SRLS', label: 'Opuntia fragilis' },
  { taxonId: '3ZLRB', label: 'Melocactus macracanthos' },
  { taxonId: '74RNL', label: 'Opuntia polyacantha' },
];

type Option<T extends string> = { value: T; label: string };

const COLORMAPS_OPTIONS: Option<StudyScheme['colormap']>[] = [
  { value: 'coolwarm', label: 'Coolwarm' },
  { value: 'viridis', label: 'Viridis' },
];
const BOUNDS_OPTIONS: Option<StudyScheme['bounds']>[] = [
  { value: 'global', label: 'Global render min/max' },
  { value: 'observed', label: "Species' observed range" },
  { value: 'custom', label: 'Custom (-10 to 80 °F)' },
  { value: 'custom2', label: 'Custom 2 (10 to 70 °F)' },
];
const LUM_SAT_SHAPE_OPTIONS: Option<StudyScheme['lumSatShape']>[] = [
  { value: 'sequential', label: 'Sequential (observed min → max)' },
  { value: 'diverging', label: 'Diverging (from midpoint of Bounds)' },
];
const UNITS_OPTIONS: Option<'imperial' | 'metric'>[] = [
  { value: 'imperial', label: 'Imperial' },
  { value: 'metric', label: 'Metric' },
];
const LUM_SAT_OPTIONS: Option<'on' | 'off'>[] = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
];
const COMPARE_NONE = 'none';

type OptionRowProps<T extends string> = {
  title: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

function OptionRow<T extends string>({
  title,
  options,
  value,
  onChange,
}: OptionRowProps<T>) {
  return (
    <View style={styles.row}>
      <ThemedText>{title}</ThemedText>
      <View style={styles.buttons}>
        {options.map((option) => (
          <Button
            key={option.value}
            size='small'
            variant={option.value === value ? 'primary' : 'neutral'}
            label={option.label}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

export default function StudyDebugPage() {
  const [scheme, setScheme] = React.useState<StudyScheme>({
    colormap: 'coolwarm',
    bounds: 'global',
    observedLumSat: false,
    lumSatShape: 'sequential',
  });
  const [units, setUnits] = React.useState<'imperial' | 'metric'>('imperial');
  const [variableId, setVariableId] = React.useState(VARIABLE_OPTIONS[0].value);
  const [taxonId, setTaxonId] = React.useState(SPECIES[0].taxonId);
  const [compareId, setCompareId] = React.useState<string>(COMPARE_NONE);
  // The variable (whose bounds are in `units`) and the units it was fetched
  // for change together, and the old pair stays until the new one arrives, so
  // the maps keep their state and a units switch never pairs new-unit values
  // with old-unit bounds.
  const [loaded, setLoaded] = React.useState<{
    variables: EnvironmentVariableDefinition[];
    units: 'imperial' | 'metric';
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchEnvironmentVariables({ units })
      .then((vars) => {
        if (!cancelled) setLoaded({ variables: vars, units });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [units]);

  const variable = loaded?.variables.find((v) => v.id === variableId) ?? null;
  const speciesOptions = SPECIES.map((s) => ({
    value: s.taxonId,
    label: s.label,
  }));
  const shown = [taxonId, ...(compareId === COMPARE_NONE ? [] : [compareId])];

  return (
    <PageSurface>
      <PageScrollContainer>
        <View style={styles.container}>
          <OptionRow
            title='Variable'
            options={VARIABLE_OPTIONS}
            value={variableId}
            onChange={setVariableId}
          />
          <OptionRow
            title='Colormap'
            options={COLORMAPS_OPTIONS}
            value={scheme.colormap}
            onChange={(colormap) => setScheme((s) => ({ ...s, colormap }))}
          />
          <OptionRow
            title='Bounds'
            options={BOUNDS_OPTIONS}
            value={scheme.bounds}
            onChange={(bounds) => setScheme((s) => ({ ...s, bounds }))}
          />
          <OptionRow
            title='Observed luminance/saturation (hue from Bounds)'
            options={LUM_SAT_OPTIONS}
            value={scheme.observedLumSat ? 'on' : 'off'}
            onChange={(v) =>
              setScheme((s) => ({ ...s, observedLumSat: v === 'on' }))
            }
          />
          <OptionRow
            title='Luminance/saturation shape (when the above is On)'
            options={LUM_SAT_SHAPE_OPTIONS}
            value={scheme.lumSatShape}
            onChange={(lumSatShape) =>
              setScheme((s) => ({ ...s, lumSatShape }))
            }
          />
          <OptionRow
            title='Units'
            options={UNITS_OPTIONS}
            value={units}
            onChange={setUnits}
          />
          <OptionRow
            title='Species'
            options={speciesOptions}
            value={taxonId}
            onChange={setTaxonId}
          />
          <OptionRow
            title='Compare with (side by side)'
            options={[
              { value: COMPARE_NONE, label: 'None' },
              ...speciesOptions,
            ]}
            value={compareId}
            onChange={setCompareId}
          />
          {loaded && variable ? (
            <View style={styles.maps}>
              {shown.map((id, i) => (
                <StudyMap
                  key={`${i}-${id}`}
                  taxonId={id}
                  variable={variable}
                  units={loaded.units}
                  height={MAP_HEIGHT}
                  scheme={scheme}
                />
              ))}
            </View>
          ) : (
            <ThemedText>Loading…</ThemedText>
          )}
        </View>
      </PageScrollContainer>
    </PageSurface>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, padding: 16 },
  row: { gap: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  maps: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
});
