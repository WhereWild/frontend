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
import {
  ParentTaxonSearchField,
  type ParentTaxonSelection,
} from '@/components/upload/ParentTaxonSearchField';
import { Colors } from '@/constants/theme';
import { setMapDebug } from '@/components/sections/mapDebug';
import { fetchEnvironmentVariables } from '@/data/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { StyleSheet, View } from 'react-native';
import React from 'react';

const VARIABLE_OPTIONS = [
  { value: 'bio1', label: 'Annual mean temp (bio1)' },
  { value: 'bio5', label: 'Max temp of warmest month (bio5)' },
  { value: 'bio6', label: 'Min temp of coldest month (bio6)' },
  { value: 'bio12', label: 'Annual mean precip (bio12)' },
  { value: 'direct_sun', label: 'Direct sunlight' },
  { value: 'scdur', label: 'Total snow duration (scdur)' },
];
const MAP_HEIGHT = 480;

const DEFAULT_SPECIES: ParentTaxonSelection = {
  taxonId: '6SRLS',
  label: 'Opuntia fragilis',
};

type Option<T extends string> = { value: T; label: string };

const COLORMAPS_OPTIONS: Option<StudyScheme['colormap']>[] = [
  { value: 'coolwarm', label: 'Coolwarm' },
  { value: 'thematic', label: 'Thematic (per variable)' },
  { value: 'magma', label: 'Magma' },
];
const BOUNDS_OPTIONS: Option<StudyScheme['bounds']>[] = [
  { value: 'global', label: 'Global render min/max' },
  { value: 'observed', label: "Species' observed range" },
  { value: 'custom', label: 'Custom (-10 to 80 °F)' },
  { value: 'custom2', label: 'Custom 2 (10 to 70 °F)' },
];
const DISTRIBUTION_OPTIONS: Option<'on' | 'off'>[] = [
  { value: 'off', label: 'Off (linear)' },
  { value: 'on', label: 'On (equal-area)' },
];
const CENTER_OPTIONS: Option<StudyScheme['center']>[] = [
  { value: 'none', label: 'Default (range midpoint)' },
  { value: 'zeroF', label: 'Pin middle at 0 °F' },
  { value: 'freezingF', label: 'Pin middle at 32 °F' },
  { value: 'fiftyF', label: 'Pin middle at 50 °F' },
];
const LUM_SAT_CHANNEL_OPTIONS: Option<StudyScheme['lumSatChannels']>[] = [
  { value: 'both', label: 'Luminance + saturation' },
  { value: 'saturation', label: 'Saturation only' },
];
const LUM_SAT_SHAPE_OPTIONS: Option<StudyScheme['lumSatShape']>[] = [
  { value: 'sequential', label: 'Sequential (observed min → max)' },
  { value: 'diverging', label: 'Diverging (from midpoint of Bounds)' },
];
const LEGEND_OPTIONS: Option<'colormap' | 'observed'>[] = [
  { value: 'colormap', label: "Colormap's range" },
  { value: 'observed', label: "Species' observed range" },
];
const UNITS_OPTIONS: Option<'imperial' | 'metric'>[] = [
  { value: 'imperial', label: 'Imperial' },
  { value: 'metric', label: 'Metric' },
];
const LUM_SAT_OPTIONS: Option<'on' | 'off'>[] = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
];

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
  React.useEffect(() => {
    setMapDebug(true);
    return () => setMapDebug(false);
  }, []);
  const [scheme, setScheme] = React.useState<StudyScheme>({
    colormap: 'coolwarm',
    bounds: 'global',
    observedLumSat: false,
    distributionAware: false,
    center: 'none',
    lumSatChannels: 'both',
    lumSatShape: 'sequential',
  });
  const [legendRange, setLegendRange] = React.useState<'colormap' | 'observed'>(
    'colormap',
  );
  const [units, setUnits] = React.useState<'imperial' | 'metric'>('imperial');
  const [variableId, setVariableId] = React.useState(VARIABLE_OPTIONS[0].value);
  const [species, setSpecies] = React.useState<ParentTaxonSelection | null>(
    DEFAULT_SPECIES,
  );
  const [compare, setCompare] = React.useState<ParentTaxonSelection | null>(
    null,
  );
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
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
  const shown = [species, compare].filter(
    (s): s is ParentTaxonSelection => s != null,
  );

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
            title='Center (temperature variables; sides run linearly to the bounds)'
            options={CENTER_OPTIONS}
            value={scheme.center}
            onChange={(center) => setScheme((s) => ({ ...s, center }))}
          />
          <OptionRow
            title='Distribution-aware (color share proportional to global area)'
            options={DISTRIBUTION_OPTIONS}
            value={scheme.distributionAware ? 'on' : 'off'}
            onChange={(v) =>
              setScheme((s) => ({ ...s, distributionAware: v === 'on' }))
            }
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
            title='Channels varied (when the above is On)'
            options={LUM_SAT_CHANNEL_OPTIONS}
            value={scheme.lumSatChannels}
            onChange={(lumSatChannels) =>
              setScheme((s) => ({ ...s, lumSatChannels }))
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
            title='Legend shows'
            options={LEGEND_OPTIONS}
            value={legendRange}
            onChange={setLegendRange}
          />
          <OptionRow
            title='Units'
            options={UNITS_OPTIONS}
            value={units}
            onChange={setUnits}
          />
          <View style={styles.row}>
            <ThemedText>Species (search)</ThemedText>
            <ParentTaxonSearchField
              value={species}
              onChange={setSpecies}
              palette={palette}
            />
          </View>
          <View style={styles.row}>
            <ThemedText>Compare with (side by side; search)</ThemedText>
            <ParentTaxonSearchField
              value={compare}
              onChange={setCompare}
              palette={palette}
            />
          </View>
          {loaded && variable ? (
            <View style={styles.maps}>
              {shown.map((s, i) => (
                <StudyMap
                  key={i}
                  taxonId={s.taxonId}
                  variable={variable}
                  units={loaded.units}
                  height={MAP_HEIGHT}
                  scheme={scheme}
                  legendRange={legendRange}
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
