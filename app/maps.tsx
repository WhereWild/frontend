// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SelectField, SpeciesOccurrenceMap } from '@/components';
import type { SelectOption } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { PageScrollContainer } from '@/components/PageScrollContainer';
import { Colors, Size } from '@/constants/theme';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { BACKEND_BASE, fetchEnvironmentVariables } from '@/data/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { StyleSheet, View } from 'react-native';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import {
  isVariableCategorical,
  isVariableCircular,
  normalizeLabel,
} from '@/components/sections/speciesEnvironment/model';
import { MapCategoricalLegend } from '@/components/sections/speciesOccurrenceMap/MapCategoricalLegend';
import { MapCbModePicker } from '@/components/sections/speciesOccurrenceMap/MapCbModePicker';
import { MapCircularColormapPicker } from '@/components/sections/speciesOccurrenceMap/MapCircularColormapPicker';
import { MapCircularLegend } from '@/components/sections/speciesOccurrenceMap/MapCircularLegend';
import { MapColormapPicker } from '@/components/sections/speciesOccurrenceMap/MapColormapPicker';
import { MapVariableLegend } from '@/components/sections/speciesOccurrenceMap/MapVariableLegend';
import { getCbColor } from '@/components/sections/speciesOccurrenceMap/cbColors';
import {
  CIRCULAR_COLORMAPS,
  COLORMAPS,
} from '@/components/sections/speciesOccurrenceMap/variableColors';
import { useEnvironmentVariableSelection } from '@/components/sections/speciesEnvironment/useEnvironmentVariableSelection';
import { VariableSelectorHeader } from '@/components/sections/speciesEnvironment/VariableSelectorHeader';

const MAP_HEIGHT = 520;
const MAP_MIN_ZOOM = 4;

const FALLBACK_VARIABLES: EnvironmentVariableOption[] = [
  { id: 'landcover', label: 'Land Cover', valueType: 'categorical', category: 'Categorical' },
  { id: 'koppen_geiger', label: 'Köppen-Geiger', valueType: 'categorical', category: 'Categorical' },
  { id: 'bio_1', label: 'Annual Mean Temperature', units: 'C', valueType: 'continuous', category: 'Bioclim' },
];

const EXCLUDED_CATEGORIES = new Set(['temporal']);

const WINDOW_OPTIONS: SelectOption[] = [
  { value: 'live', label: 'Live (current)' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '8h', label: 'Last 8 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '3d', label: 'Last 3 days' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const FORECAST_OPTIONS: SelectOption[] = [
  { value: 'now', label: 'Now' },
  { value: '1h', label: '+1 hour' },
  { value: '8h', label: '+8 hours' },
  { value: '24h', label: '+24 hours' },
  { value: '3d', label: '+3 days' },
  { value: '7d', label: '+7 days' },
];

const toVariableOption = (
  variables: Awaited<ReturnType<typeof fetchEnvironmentVariables>>,
): EnvironmentVariableOption[] =>
  variables
    .filter((e) => !EXCLUDED_CATEGORIES.has((e.category ?? '').toLowerCase()))
    .map((e) => ({
      id: e.id,
      label: e.name ?? normalizeLabel(e.id),
      units: e.units ?? null,
      valueType: e.valueType ?? null,
      category: e.category ?? 'Other',
      legendClasses: e.legendClasses ?? null,
      renderMin: e.renderMin ?? null,
      renderMax: e.renderMax ?? null,
    }));

const buildTileUrl = ({
  cacheKey,
  colormap,
  circularColormap,
  isCircular,
  cbMode,
  forecast,
  isLiveWeather,
  variable,
  window,
  units,
}: {
  cacheKey: number;
  colormap: string;
  circularColormap: string;
  isCircular: boolean;
  cbMode: string | null;
  forecast: string;
  isLiveWeather: boolean;
  variable: string;
  window: string;
  units: string;
}) => {
  const effectiveColormap = isCircular ? circularColormap : colormap;
  const cbParam = cbMode ? `&cb_mode=${encodeURIComponent(cbMode)}` : '';
  const base = `${BACKEND_BASE}/api/variables/${encodeURIComponent(
    variable || 'landcover',
  )}/tiles/{z}/{x}/{y}.png?reproject=true&max_native_zoom=10&colormap=${encodeURIComponent(effectiveColormap)}${cbParam}&_cb=${cacheKey}`;
  if (!isLiveWeather) return base;
  const withWindow = window !== 'live' ? `${base}&window=${window}` : base;
  return forecast !== 'now' ? `${withWindow}&forecast=${forecast}` : withWindow;
};

export default function Maps() {
  const {
    units,
    colormap: selectedColormap,
    setColormap: setSelectedColormap,
    circularColormap: selectedCircularColormap,
    setCircularColormap: setSelectedCircularColormap,
    cbMode,
    setCbMode,
    shapesEnabled,
    markerOutlineEnabled: markerOutlineEnabledSetting,
  } = useSettings();
  const markerOutlineEnabled = markerOutlineEnabledSetting || cbMode === 'achromatopsia';

  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  const [variables, setVariables] = useState<EnvironmentVariableOption[]>(FALLBACK_VARIABLES);
  const [visibleNominalCounts, setVisibleNominalCounts] = useState<Map<number, number>>(new Map());
  const [pinnedValue, setPinnedValue] = useState<number | null>(null);
  const [selectedWindow, setSelectedWindow] = useState('live');
  const [selectedForecast, setSelectedForecast] = useState('now');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchEnvironmentVariables({ units });
        if (cancelled || !fetched.length) return;
        const mapped = toVariableOption(fetched);
        if (mapped.length > 0) setVariables(mapped);
      } catch {
        // keep fallback
      }
    })();
    return () => { cancelled = true; };
  }, [units]);

  const {
    categories,
    selectedVariableCategory,
    setSelectedVariableCategory,
    filteredVariables,
    selectedVariable,
    setSelectedVariable,
    selectedVariableMeta,
  } = useEnvironmentVariableSelection({ variableId: 'landcover', variables });

  const isLiveWeather = (selectedVariableCategory ?? '').toLowerCase() === 'live weather';
  const isCircular = isVariableCircular(selectedVariableMeta);
  const isCategorical = isVariableCategorical(selectedVariableMeta);

  const tileCacheKey = useMemo(() => Date.now(), []);

  const tileUrl = useMemo(
    () =>
      buildTileUrl({
        cacheKey: tileCacheKey,
        colormap: selectedColormap,
        circularColormap: selectedCircularColormap,
        isCircular,
        cbMode,
        forecast: selectedForecast,
        isLiveWeather,
        variable: selectedVariable,
        window: selectedWindow,
        units,
      }),
    [
      tileCacheKey,
      selectedColormap,
      selectedCircularColormap,
      isCircular,
      cbMode,
      selectedForecast,
      isLiveWeather,
      selectedVariable,
      selectedWindow,
      units,
    ],
  );

  useEffect(() => {
    setVisibleNominalCounts(new Map());
    setPinnedValue(null);
  }, [selectedVariable]);

  const handlePointValue = useCallback((value: number) => setPinnedValue(value), []);

  const handleTileClasses = useCallback(
    (classes: { id: number; count: number }[], removed: boolean) => {
      setVisibleNominalCounts((prev) => {
        const next = new Map(prev);
        for (const { id, count } of classes) {
          if (removed) {
            const remaining = (next.get(id) ?? 0) - count;
            if (remaining <= 0) next.delete(id);
            else next.set(id, remaining);
          } else {
            next.set(id, (next.get(id) ?? 0) + count);
          }
        }
        return next;
      });
    },
    [],
  );

  const visibleCategoricalClasses = useMemo(() => {
    if (!isCategorical || visibleNominalCounts.size === 0) return null;
    const isLandcover = selectedVariableMeta?.id === 'landcover';
    const allClasses = (selectedVariableMeta?.legendClasses ?? []).filter(
      (cls) => !(isLandcover && cls.id === 0),
    );
    const visible = allClasses
      .filter((cls) => visibleNominalCounts.has(cls.id as number))
      .sort((a, b) => (visibleNominalCounts.get(b.id as number) ?? 0) - (visibleNominalCounts.get(a.id as number) ?? 0));
    return visible.length > 0 ? visible : null;
  }, [isCategorical, selectedVariableMeta, visibleNominalCounts]);

  const cbVisibleClasses = useMemo(
    () =>
      cbMode && visibleCategoricalClasses
        ? visibleCategoricalClasses.map((cls) => ({
            ...cls,
            color: getCbColor(selectedVariableMeta?.id ?? '', cls.id as number, cbMode, cls.color ?? '#888888'),
          }))
        : visibleCategoricalClasses,
    [cbMode, selectedVariableMeta, visibleCategoricalClasses],
  );

  return (
    <>
      {/* @ts-ignore — Head is web-only */}
      <Head><title>WhereWild | Maps</title></Head>
      <PageSurface>
        <PageScrollContainer
          contentContainerStyle={getResponsiveContentContainerStyle(responsive)}
          bounces={false}
        >
          <View style={[styles.section, { backgroundColor: palette.background.default.default }]}>
            <VariableSelectorHeader
              categories={categories}
              selectedVariableCategory={selectedVariableCategory}
              onCategoryChange={setSelectedVariableCategory}
              filteredVariables={filteredVariables}
              selectedVariable={selectedVariable}
              onVariableChange={setSelectedVariable}
              headingText={selectedVariableMeta?.label ?? 'Variable'}
              metaText={`id: ${selectedVariable}`}
            />

            {isLiveWeather && (
              <SelectField
                variant='tertiary'
                options={WINDOW_OPTIONS}
                value={selectedWindow}
                onValueChange={(v) => { setSelectedWindow(v); setSelectedForecast('now'); }}
                placeholder='Aggregation window'
              />
            )}
            {isLiveWeather && (
              <SelectField
                variant='tertiary'
                options={FORECAST_OPTIONS}
                value={selectedForecast}
                onValueChange={setSelectedForecast}
                placeholder='Forecast offset'
              />
            )}

            <View style={styles.mapContainer}>
              <SpeciesOccurrenceMap
                occurrences={[]}
                loading={false}
                error={null}
                height={MAP_HEIGHT}
                heatmapTileUrl={tileUrl}
                heatmapOpacity={0.85}
                minZoom={MAP_MIN_ZOOM}
                showMarkers={false}
                onTileClasses={handleTileClasses}
                onPointValue={handlePointValue}
                pointQueryUrl={
                  selectedVariable
                    ? `${BACKEND_BASE}/gis/point?variable=${encodeURIComponent(selectedVariable)}&unit_system=${units}`
                    : null
                }
                isCircular={isCircular}
                renderMin={!isCategorical && !isCircular ? (selectedVariableMeta?.renderMin ?? null) : null}
                renderMax={!isCategorical && !isCircular ? (selectedVariableMeta?.renderMax ?? null) : null}
                gradientStops={!isCategorical && !isCircular ? COLORMAPS[selectedColormap].stops : null}
                aspectStops={isCircular ? CIRCULAR_COLORMAPS[selectedCircularColormap].stops : null}
                markerOutlineEnabled={markerOutlineEnabled}
              />

              {isCircular && (
                <>
                  <MapCircularLegend
                    pinnedValue={pinnedValue}
                    conicCss={CIRCULAR_COLORMAPS[selectedCircularColormap].conicCss}
                    nativeColor={`rgb(${CIRCULAR_COLORMAPS[selectedCircularColormap].stops[Math.floor(CIRCULAR_COLORMAPS[selectedCircularColormap].stops.length / 4)].join(',')})`}
                  />
                  <MapCircularColormapPicker
                    selected={selectedCircularColormap}
                    onChange={setSelectedCircularColormap}
                  />
                </>
              )}

              {cbVisibleClasses && (
                <>
                  <MapCategoricalLegend
                    classes={cbVisibleClasses}
                    variableId={selectedVariableMeta?.id}
                    cbMode={cbMode}
                    shapesEnabled={shapesEnabled}
                    markerOutlineEnabled={markerOutlineEnabled}
                  />
                  <MapCbModePicker
                    selected={cbMode}
                    onChange={setCbMode}
                    topClasses={visibleCategoricalClasses?.slice(0, 3) ?? []}
                    variableId={selectedVariableMeta?.id ?? ''}
                    shapesEnabled={shapesEnabled}
                    markerOutlineEnabled={markerOutlineEnabled}
                  />
                </>
              )}

              {!isCircular && !isCategorical &&
                selectedVariableMeta?.renderMin != null &&
                selectedVariableMeta?.renderMax != null && (
                  <>
                    <MapVariableLegend
                      min={selectedVariableMeta.renderMin}
                      max={selectedVariableMeta.renderMax}
                      units={selectedVariableMeta.units}
                      pinnedValue={pinnedValue}
                      barCss={COLORMAPS[selectedColormap].barCss}
                      barColors={COLORMAPS[selectedColormap].stops
                        .slice()
                        .reverse()
                        .map((s) => `rgb(${s[0]},${s[1]},${s[2]})`)}
                    />
                    <MapColormapPicker selected={selectedColormap} onChange={setSelectedColormap} />
                  </>
                )}
            </View>
          </View>
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Size.space['250'],
    padding: Size.space['400'],
  },
  mapContainer: {
    position: 'relative',
  },
});
