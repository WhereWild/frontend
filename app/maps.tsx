// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SpeciesOccurrenceMap } from '@/components';
import type { SelectOption } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { PageScrollContainer } from '@/components/PageScrollContainer';
import { Colors, Size } from '@/constants/theme';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { BACKEND_BASE, fetchEnvironmentVariables } from '@/data/api';
import { useDataSources } from '@/hooks/useDataSources';
import { SourceAttribution } from '@/components/sections/SourceAttribution';
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
const MAP_MIN_ZOOM = 0;

const FALLBACK_VARIABLES: EnvironmentVariableOption[] = [
  {
    id: 'landcover',
    label: 'Land Cover',
    valueType: 'categorical',
    category: 'Categorical',
  },
  {
    id: 'koppen_geiger',
    label: 'Köppen-Geiger',
    valueType: 'categorical',
    category: 'Categorical',
  },
  {
    id: 'bio_1',
    label: 'Annual Mean Temperature',
    units: 'C',
    valueType: 'continuous',
    category: 'Bioclim',
  },
];

const FORECAST_OPTIONS: SelectOption[] = [
  { value: 'now', label: 'Now' },
  { value: '1h', label: '+1 hour' },
  { value: '8h', label: '+8 hours' },
  { value: '24h', label: '+24 hours' },
  { value: '3d', label: '+3 days' },
  { value: '7d', label: '+7 days' },
];

const FORECAST_HOUR_MAP: Record<string, number> = {
  now: 0,
  '1h': 1,
  '8h': 8,
  '24h': 24,
  '3d': 72,
  '7d': 168,
};

const toVariableOption = (
  variables: Awaited<ReturnType<typeof fetchEnvironmentVariables>>,
): EnvironmentVariableOption[] =>
  variables.map((e) => ({
    id: e.id,
    label: e.name ?? normalizeLabel(e.id),
    units: e.units ?? null,
    valueType: e.valueType ?? null,
    category: e.category ?? 'Other',
    legendClasses: e.legendClasses ?? null,
    renderMin: e.renderMin ?? null,
    renderMax: e.renderMax ?? null,
    sourceIds: e.sourceIds ?? [],
    group: e.group ?? null,
    groupLabel: e.groupLabel ?? null,
  }));

const buildTileUrl = ({
  cacheKey,
  colormap,
  circularColormap,
  isCircular,
  cbMode,
  forecastH,
  variable,
  classFilter,
}: {
  cacheKey: number;
  colormap: string;
  circularColormap: string;
  isCircular: boolean;
  cbMode: string | null;
  forecastH: number;
  variable: string;
  classFilter: number | null;
}) => {
  const effectiveColormap = isCircular ? circularColormap : colormap;
  const cbParam = cbMode ? `&cb_mode=${encodeURIComponent(cbMode)}` : '';
  const fcParam = forecastH > 0 ? `&forecast_h=${forecastH}` : '';
  const cfParam = classFilter != null ? `&class_filter=${classFilter}` : '';
  return `${BACKEND_BASE}/api/variables/${encodeURIComponent(
    variable || 'landcover',
  )}/tiles/{z}/{x}/{y}.png?reproject=true&max_native_zoom=10&colormap=${encodeURIComponent(effectiveColormap)}${cbParam}&_cb=${cacheKey}${fcParam}${cfParam}`;
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
    markerOutlineEnabled: markerOutlineEnabledSetting,
    globeViewEnabled,
  } = useSettings();
  const markerOutlineEnabled =
    markerOutlineEnabledSetting || cbMode === 'achromatopsia';

  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  const dataSources = useDataSources();

  const [variables, setVariables] =
    useState<EnvironmentVariableOption[]>(FALLBACK_VARIABLES);
  const [visibleNominalCounts, setVisibleNominalCounts] = useState<
    Map<number, number>
  >(new Map());
  const [pinnedValue, setPinnedValue] = useState<number | null>(null);
  const [selectedForecast, setSelectedForecast] = useState('now');
  const [selectedClassFilter, setSelectedClassFilter] = useState<number | null>(
    null,
  );

  const selectedForecastH = FORECAST_HOUR_MAP[selectedForecast] ?? 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchEnvironmentVariables({
          units,
          forecastH: selectedForecastH,
        });
        if (cancelled || !fetched.length) return;
        const mapped = toVariableOption(fetched);
        if (mapped.length > 0) setVariables(mapped);
      } catch {
        // keep fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [units, selectedForecastH]);

  const {
    categories,
    selectedVariableCategory,
    setSelectedVariableCategory,
    filteredVariables,
    selectedVariable,
    setSelectedVariable,
    selectedVariableMeta,
  } = useEnvironmentVariableSelection({ variableId: 'landcover', variables });

  const isRecentWeather =
    (selectedVariableCategory ?? '').toLowerCase() === 'recent weather';
  const isCircular = isVariableCircular(selectedVariableMeta);
  const isCategorical = isVariableCategorical(selectedVariableMeta);

  const forecastH = isRecentWeather
    ? (FORECAST_HOUR_MAP[selectedForecast] ?? 0)
    : 0;

  const tileCacheKey = useMemo(() => Date.now(), []);

  const tileUrl = useMemo(
    () =>
      buildTileUrl({
        cacheKey: tileCacheKey,
        colormap: selectedColormap,
        circularColormap: selectedCircularColormap,
        isCircular,
        cbMode,
        forecastH,
        variable: selectedVariable,
        classFilter: isCategorical ? selectedClassFilter : null,
      }),
    [
      tileCacheKey,
      selectedColormap,
      selectedCircularColormap,
      isCircular,
      cbMode,
      forecastH,
      selectedVariable,
      isCategorical,
      selectedClassFilter,
    ],
  );

  useEffect(() => {
    // Also reset when the renderer changes (globe <-> flat map): swapping
    // templates discards the old WebView/iframe document outright, so any
    // tileClassesRemoved messages it still owed never get sent, and the new
    // renderer only ever adds to this map from then on.
    setVisibleNominalCounts(new Map());
    setPinnedValue(null);
    setSelectedClassFilter(null);
  }, [selectedVariable, globeViewEnabled]);

  const handlePointValue = useCallback(
    (value: number) => setPinnedValue(value),
    [],
  );

  const handleTileClasses = useCallback(
    (classes: { id: number; count: number }[], removed: boolean) => {
      setVisibleNominalCounts((prev) => {
        const next = new Map(prev);
        for (const { id, count } of classes) {
          if (removed) {
            const remaining = (next.get(id) ?? 0) - count;
            // Globe-mode counts are fractional (angle-weighted pixel
            // counts), so repeated add/subtract cycles as tiles enter and
            // leave view accumulate floating-point rounding error — a class
            // that should fully cancel out can land on something like
            // 1e-13 instead of exactly 0, which `remaining <= 0` never
            // catches, leaving it stuck in the map (and thus the legend)
            // forever. A small epsilon is safe here: real counts are pixel
            // counts scaled by a weight that's floored well above this.
            if (remaining <= 1e-6) next.delete(id);
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
      .sort(
        (a, b) =>
          (visibleNominalCounts.get(b.id as number) ?? 0) -
          (visibleNominalCounts.get(a.id as number) ?? 0),
      );
    return visible.length > 0 ? visible : null;
  }, [isCategorical, selectedVariableMeta, visibleNominalCounts]);

  const cbVisibleClasses = useMemo(
    () =>
      cbMode && visibleCategoricalClasses
        ? visibleCategoricalClasses.map((cls) => ({
            ...cls,
            color: getCbColor(
              selectedVariableMeta?.id ?? '',
              cls.id as number,
              cbMode,
              cls.color ?? '#888888',
            ),
          }))
        : visibleCategoricalClasses,
    [cbMode, selectedVariableMeta, visibleCategoricalClasses],
  );

  const classColors = useMemo(() => {
    if (!isCategorical || !selectedVariableMeta?.legendClasses?.length)
      return null;
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta.legendClasses) {
      if (cls.id != null && cls.color) {
        const color = cbMode
          ? getCbColor(
              selectedVariableMeta.id,
              cls.id as number,
              cbMode,
              cls.color,
            )
          : cls.color;
        map.set(String(cls.id), color);
      }
    }
    return map;
  }, [isCategorical, selectedVariableMeta, cbMode]);

  const classLabels = useMemo(() => {
    if (!isCategorical || !selectedVariableMeta?.legendClasses?.length)
      return null;
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta.legendClasses) {
      if (cls.id != null && cls.name) {
        map.set(String(cls.id), cls.name);
      }
    }
    return map;
  }, [isCategorical, selectedVariableMeta]);

  return (
    <>
      {/* @ts-ignore — Head is web-only */}
      <Head>
        <title>WhereWild | Maps</title>
      </Head>
      <PageSurface>
        <PageScrollContainer
          contentContainerStyle={getResponsiveContentContainerStyle(responsive)}
          bounces={false}
        >
          <View
            style={[
              styles.section,
              { backgroundColor: palette.background.default.default },
            ]}
          >
            <VariableSelectorHeader
              categories={categories}
              selectedVariableCategory={selectedVariableCategory}
              onCategoryChange={setSelectedVariableCategory}
              filteredVariables={filteredVariables}
              selectedVariable={selectedVariable}
              onVariableChange={setSelectedVariable}
              headingText={selectedVariableMeta?.label ?? 'Variable'}
              metaText={`id: ${selectedVariable}`}
              forecastOptions={isRecentWeather ? FORECAST_OPTIONS : undefined}
              selectedForecast={selectedForecast}
              onForecastChange={setSelectedForecast}
            />

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
                useLabelsOverlay
                preserveMapPosition
                onTileClasses={handleTileClasses}
                onPointValue={handlePointValue}
                pointQueryUrl={
                  selectedVariable
                    ? `${BACKEND_BASE}/gis/point?variable=${encodeURIComponent(selectedVariable)}&unit_system=${units}${forecastH > 0 ? `&forecast_h=${forecastH}` : ''}`
                    : null
                }
                isCircular={isCircular}
                renderMin={
                  !isCategorical && !isCircular
                    ? (selectedVariableMeta?.renderMin ?? null)
                    : null
                }
                renderMax={
                  !isCategorical && !isCircular
                    ? (selectedVariableMeta?.renderMax ?? null)
                    : null
                }
                gradientStops={
                  !isCategorical && !isCircular
                    ? COLORMAPS[selectedColormap].stops
                    : null
                }
                aspectStops={
                  isCircular
                    ? CIRCULAR_COLORMAPS[selectedCircularColormap].stops
                    : null
                }
                classColors={classColors}
                classLabels={classLabels}
                markerOutlineEnabled={markerOutlineEnabled}
              />

              {isCircular && (
                <>
                  <MapCircularLegend
                    pinnedValue={pinnedValue}
                    conicCss={
                      CIRCULAR_COLORMAPS[selectedCircularColormap].conicCss
                    }
                    arcSegmentColors={
                      CIRCULAR_COLORMAPS[selectedCircularColormap]
                        .arcSegmentColors
                    }
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
                    shapesEnabled={false}
                    markerOutlineEnabled={markerOutlineEnabled}
                    selectedClassId={selectedClassFilter}
                    onClassClick={(id) =>
                      setSelectedClassFilter((prev) =>
                        prev === id ? null : id,
                      )
                    }
                  />
                  <MapCbModePicker
                    selected={cbMode}
                    onChange={setCbMode}
                    topClasses={visibleCategoricalClasses?.slice(0, 3) ?? []}
                    variableId={selectedVariableMeta?.id ?? ''}
                    shapesEnabled={false}
                    dotsOnly
                    markerOutlineEnabled={markerOutlineEnabled}
                  />
                </>
              )}

              {!isCircular &&
                !isCategorical &&
                selectedVariableMeta?.renderMin != null &&
                selectedVariableMeta?.renderMax != null && (
                  <>
                    <MapVariableLegend
                      min={selectedVariableMeta.renderMin}
                      max={selectedVariableMeta.renderMax}
                      units={selectedVariableMeta.units}
                      pinnedValue={pinnedValue}
                      barSvgStops={COLORMAPS[selectedColormap].barSvgStops}
                    />
                    <MapColormapPicker
                      selected={selectedColormap}
                      onChange={setSelectedColormap}
                    />
                  </>
                )}
            </View>

            {selectedVariableMeta?.sourceIds &&
              selectedVariableMeta.sourceIds.length > 0 && (
                <SourceAttribution
                  sourceIds={
                    selectedVariableMeta.category?.toLowerCase() ===
                    'recent weather'
                      ? [...selectedVariableMeta.sourceIds, 'gfs']
                      : selectedVariableMeta.sourceIds
                  }
                  dataSources={dataSources}
                />
              )}
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
