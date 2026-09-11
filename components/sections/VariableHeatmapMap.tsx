// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The interactive GIS-variable heatmap map: the `<SpeciesOccurrenceMap>`
// pane plus every overlay (colormap picker, gradient/circular/categorical
// legend with drag-to-slice, colorblind-mode picker), auto-adapt, and the
// layer-filter chain. Extracted verbatim from app/maps.tsx so the maps page
// and the GIS editor render the exact same thing.
//
// The ONLY thing that varies between callers is `tileSource`: `remote`
// (real /api/variables/.../tiles) vs `local` (a frontend tile renderer, for
// the GIS editor's browser-parsed GeoTIFF). Path + query are identical
// either way — see data/variableTileUrl.ts + LOCAL_TILE_BRIDGE in
// speciesOccurrenceMapHelpers.ts.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SpeciesOccurrenceMap } from '@/components';
import { toggleFullscreenElement } from '@/components/sections/speciesOccurrenceMap/speciesOccurrenceMapHelpers';
import { BACKEND_BASE } from '@/data/api';
import { buildVariableTileUrl } from '@/data/variableTileUrl';
import { useAutoAdaptRange } from '@/hooks/useAutoAdaptRange';
import { useResponsive } from '@/hooks/useResponsive';
import { useRangeSelectionAccumulator } from '@/hooks/useRangeSelectionAccumulator';
import { useSettings } from '@/context/SettingsContext';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import {
  isVariableCategorical,
  isVariableCircular,
} from '@/components/sections/speciesEnvironment/model';
import { MapCategoricalLegend } from '@/components/sections/speciesOccurrenceMap/MapCategoricalLegend';
import { MapCbModePicker } from '@/components/sections/speciesOccurrenceMap/MapCbModePicker';
import { MapCircularColormapPicker } from '@/components/sections/speciesOccurrenceMap/MapCircularColormapPicker';
import { MapCircularLegend } from '@/components/sections/speciesOccurrenceMap/MapCircularLegend';
import { MapColormapPicker } from '@/components/sections/speciesOccurrenceMap/MapColormapPicker';
import { MapVariableLegend } from '@/components/sections/speciesOccurrenceMap/MapVariableLegend';
import type { LegendRange } from '@/components/sections/speciesOccurrenceMap/legendRangeSelection';
import { getCbColor } from '@/components/sections/speciesOccurrenceMap/cbColors';
import {
  CIRCULAR_COLORMAPS,
  COLORMAPS,
} from '@/components/sections/speciesOccurrenceMap/variableColors';
import {
  useMapLayerChain,
  type ChainedLayerFilter,
} from '@/components/sections/speciesOccurrenceMap/useMapLayerChain';
import { popRestorable } from '@/hooks/useVariableFilterChain';

export type MapTileSource =
  | { kind: 'remote' }
  | {
      kind: 'local';
      /** Return PNG bytes for the tile (plus, for nominal/ordinal data, a
       * per-class pixel count so the legend's visible-classes tracking works
       * the same as it does for remote tiles' X-Nominal-Classes header), or
       * null for a transparent tile. `url` is the full `localtiles://...`
       * URL with the query string. */
      renderTile: (
        z: number,
        x: number,
        y: number,
        url: string,
      ) => Promise<{
        data: ArrayBuffer;
        classes?: { id: number; count: number }[];
      } | null>;
    };

export type HeatmapSelection = {
  classIds: number[];
  valueRanges: LegendRange[];
  angleRanges: LegendRange[];
};

type VariableHeatmapMapProps = {
  /** The raw selection id — what the tile endpoint + filter chain are keyed
   * on. May differ from `variableMeta.id` (e.g. a temporal variable that
   * resolves to a forecast-specific variant). Defaults to `variableMeta.id`. */
  variableId?: string;
  variableMeta: EnvironmentVariableOption | null;
  tileSource: MapTileSource;
  height: number;
  /** Full static catalog — used only to resolve chained-filter labels. */
  allVariables?: EnvironmentVariableOption[];
  /** Chain hydrated from a route param (unsplit — this component pops the
   * entry for the currently-selected variable and applies it live). */
  initialChain?: ChainedLayerFilter[];
  /** Recent-weather forecast horizon in hours; 0 otherwise. */
  forecastH?: number;
  /** Opening camera position. Omitted on /maps (opens at the world view). */
  initialLat?: number | null;
  initialLon?: number | null;
  initialZoom?: number | null;
  /** Live class/range selection, for the caller's header "Selected range:" text. */
  onSelectionChange?: (selection: HeatmapSelection) => void;
  /** Committed chain + full chain (chain + current live selection), for the
   * caller's `?slice=` URL sync + "And filtering…" text. */
  onChainChange?: (chains: {
    chain: ChainedLayerFilter[];
    fullChain: ChainedLayerFilter[];
  }) => void;
};

const EMPTY_VARIABLES: EnvironmentVariableOption[] = [];
const EMPTY_CHAIN: ChainedLayerFilter[] = [];

export function VariableHeatmapMap({
  variableId,
  variableMeta,
  tileSource,
  height,
  allVariables = EMPTY_VARIABLES,
  initialChain = EMPTY_CHAIN,
  forecastH = 0,
  initialLat = null,
  initialLon = null,
  initialZoom = null,
  onSelectionChange,
  onChainChange,
}: VariableHeatmapMapProps) {
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
  const responsive = useResponsive();

  const selectedVariable = variableId ?? variableMeta?.id ?? '';
  const selectedVariableMeta = variableMeta;
  const isCircular = isVariableCircular(selectedVariableMeta);
  const isCategorical = isVariableCategorical(selectedVariableMeta);
  const isLocal = tileSource.kind === 'local';

  // Split the hydrated chain once: any entry naming the variable selected at
  // mount is popped off and applied as the live selection instead of a
  // chained filter. isCircular/isCategorical come from the catalog-resolved
  // meta here, so no post-hoc correction is needed.
  const initialChainSplitRef = React.useRef<{
    chain: ChainedLayerFilter[];
    restored: ChainedLayerFilter | null;
  } | null>(null);
  if (initialChainSplitRef.current === null) {
    const split = popRestorable(
      initialChain,
      selectedVariable,
      (entry: ChainedLayerFilter) => entry.layerId,
    );
    initialChainSplitRef.current = {
      chain: split.chain,
      restored: split.restored
        ? { ...split.restored, isCategorical, isCircular }
        : null,
    };
  }
  const initialChainSplit = initialChainSplitRef.current;

  const [visibleNominalCounts, setVisibleNominalCounts] = React.useState<
    Map<number, number>
  >(new Map());
  const [pinnedValue, setPinnedValue] = React.useState<number | null>(null);
  const [selectedClassIds, setSelectedClassIds] = React.useState<number[]>(
    () =>
      initialChainSplit.restored?.isCategorical
        ? (initialChainSplit.restored.originalClassIds ?? [])
        : [],
  );
  const toggleSelectedClassId = React.useCallback((id: number) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const valueRangeSelection = useRangeSelectionAccumulator(
    initialChainSplit.restored &&
      !initialChainSplit.restored.isCategorical &&
      !initialChainSplit.restored.isCircular
      ? (initialChainSplit.restored.originalRanges ?? []).map((r) => ({
          start: r.min,
          end: r.max,
        }))
      : undefined,
  );
  const selectedValueRanges: LegendRange[] = valueRangeSelection.ranges.map(
    (r) => ({ min: r.start, max: r.end }),
  );
  const handleValueRangeChange = React.useCallback(
    (
      range: LegendRange | null,
      options?: { additive?: boolean; sessionId?: number; final?: boolean },
    ) =>
      valueRangeSelection.applyRangeChange(
        range ? { start: range.min, end: range.max } : null,
        options,
      ),
    [valueRangeSelection],
  );
  const setSelectedValueRanges = React.useCallback(
    (ranges: LegendRange[]) =>
      valueRangeSelection.setAll(
        ranges.map((r) => ({ start: r.min, end: r.max })),
      ),
    [valueRangeSelection],
  );

  const angleRangeSelection = useRangeSelectionAccumulator(
    initialChainSplit.restored &&
      !initialChainSplit.restored.isCategorical &&
      initialChainSplit.restored.isCircular
      ? (initialChainSplit.restored.originalRanges ?? []).map((r) => ({
          start: r.min,
          end: r.max,
        }))
      : undefined,
  );
  const selectedAngleRanges: LegendRange[] = angleRangeSelection.ranges.map(
    (r) => ({ min: r.start, max: r.end }),
  );
  const handleAngleRangeChange = React.useCallback(
    (
      range: LegendRange | null,
      options?: { additive?: boolean; sessionId?: number; final?: boolean },
    ) =>
      angleRangeSelection.applyRangeChange(
        range ? { start: range.min, end: range.max } : null,
        options,
      ),
    [angleRangeSelection],
  );
  const setSelectedAngleRanges = React.useCallback(
    (ranges: LegendRange[]) =>
      angleRangeSelection.setAll(
        ranges.map((r) => ({ start: r.min, end: r.max })),
      ),
    [angleRangeSelection],
  );

  // Fullscreens the map + its legend/colormap-picker overlays together.
  const mapContainerRef = React.useRef<View | null>(null);

  const isAutoAdaptApplicable =
    tileSource.kind === 'remote' && !isCategorical && !isCircular;

  const tileCacheKey = selectedVariableMeta?.version ?? 0;

  React.useEffect(() => {
    setVisibleNominalCounts(new Map());
    setPinnedValue(null);
  }, [selectedVariable, globeViewEnabled]);

  const {
    autoAdaptEnabled,
    toggleAutoAdapt,
    handleBoundsChange,
    renderRange: autoAdaptRenderRange,
    effectiveRenderMin,
    effectiveRenderMax,
  } = useAutoAdaptRange({
    selectedVariable,
    isApplicable: isAutoAdaptApplicable,
    units,
    forecastH,
    catalogRenderMin: selectedVariableMeta?.renderMin,
    catalogRenderMax: selectedVariableMeta?.renderMax,
    resetKey: globeViewEnabled,
  });

  const {
    chain: layerChain,
    fullChain: fullLayerChain,
    clearChain: clearLayerChain,
  } = useMapLayerChain({
    selectedVariable,
    isCategorical,
    isCircular,
    allVariables,
    selectedClassIds,
    selectedValueRanges,
    selectedAngleRanges,
    setSelectedClassIds,
    setSelectedValueRanges,
    setSelectedAngleRanges,
    initialChain: initialChainSplit.chain,
  });

  // Renderer swap (globe <-> flat) discards the iframe outright — a harder
  // reset than a plain variable switch, so clear the whole chain too.
  const previousGlobeViewRef = React.useRef(globeViewEnabled);
  React.useEffect(() => {
    if (previousGlobeViewRef.current === globeViewEnabled) {
      return;
    }
    previousGlobeViewRef.current = globeViewEnabled;
    setSelectedClassIds([]);
    valueRangeSelection.clear();
    angleRangeSelection.clear();
    clearLayerChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    globeViewEnabled,
    clearLayerChain,
    valueRangeSelection.clear,
    angleRangeSelection.clear,
  ]);

  // Debounced mirrors of the drag-selected ranges — used only for the tile
  // URL, so dragging across the legend doesn't re-fetch the whole viewport
  // every frame. The legends read the LIVE undebounced values.
  const TILE_RANGE_DEBOUNCE_MS = 200;
  const [debouncedValueRanges, setDebouncedValueRanges] =
    React.useState(selectedValueRanges);
  React.useEffect(() => {
    if (valueRangeSelection.ranges.length === 0) {
      setDebouncedValueRanges([]);
      return;
    }
    const timer = setTimeout(
      () => setDebouncedValueRanges(selectedValueRanges),
      TILE_RANGE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueRangeSelection.ranges]);

  const [debouncedAngleRanges, setDebouncedAngleRanges] =
    React.useState(selectedAngleRanges);
  React.useEffect(() => {
    if (angleRangeSelection.ranges.length === 0) {
      setDebouncedAngleRanges([]);
      return;
    }
    const timer = setTimeout(
      () => setDebouncedAngleRanges(selectedAngleRanges),
      TILE_RANGE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angleRangeSelection.ranges]);

  const tileUrl = React.useMemo(
    () =>
      buildVariableTileUrl({
        baseUrl: isLocal ? 'localtiles:/' : BACKEND_BASE,
        cacheKey: tileCacheKey,
        colormap: selectedColormap,
        circularColormap: selectedCircularColormap,
        isCircular,
        cbMode,
        forecastH,
        variable: selectedVariable,
        classFilter: isCategorical ? selectedClassIds : null,
        valueRanges: isCategorical
          ? null
          : isCircular
            ? debouncedAngleRanges
            : debouncedValueRanges,
        unitSystem: units,
        chain: layerChain.map((entry) => entry.extra),
        renderRange: autoAdaptRenderRange,
      }),
    [
      isLocal,
      tileCacheKey,
      selectedColormap,
      selectedCircularColormap,
      isCircular,
      cbMode,
      forecastH,
      selectedVariable,
      isCategorical,
      selectedClassIds,
      debouncedAngleRanges,
      debouncedValueRanges,
      units,
      layerChain,
      autoAdaptRenderRange,
    ],
  );

  const handlePointValue = React.useCallback(
    (value: number) => setPinnedValue(value),
    [],
  );

  const handleTileClasses = React.useCallback(
    (classes: { id: number; count: number }[]) => {
      setVisibleNominalCounts(
        new Map(classes.map(({ id, count }) => [id, count])),
      );
    },
    [],
  );

  const visibleCategoricalClasses = React.useMemo(() => {
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

  const isOrdinalVariable =
    selectedVariableMeta?.valueType?.toLowerCase() === 'ordinal';
  const colorMode = isOrdinalVariable ? selectedColormap : cbMode;

  const cbVisibleClasses = React.useMemo(
    () =>
      colorMode && visibleCategoricalClasses
        ? visibleCategoricalClasses.map((cls) => ({
            ...cls,
            color: getCbColor(
              selectedVariableMeta?.id ?? '',
              cls.id as number,
              colorMode,
              cls.color ?? '#888888',
            ),
          }))
        : visibleCategoricalClasses,
    [colorMode, selectedVariableMeta, visibleCategoricalClasses],
  );

  const classColors = React.useMemo(() => {
    if (!isCategorical || !selectedVariableMeta?.legendClasses?.length)
      return null;
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta.legendClasses) {
      if (cls.id != null && (cls.color || isOrdinalVariable)) {
        const color = colorMode
          ? getCbColor(
              selectedVariableMeta.id,
              cls.id as number,
              colorMode,
              cls.color ?? '#888888',
            )
          : (cls.color ?? '#888888');
        map.set(String(cls.id), color);
      }
    }
    return map;
  }, [isCategorical, selectedVariableMeta, colorMode, isOrdinalVariable]);

  const classLabels = React.useMemo(() => {
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

  // Surface selection + chain to the caller for its header text / URL sync.
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  React.useEffect(() => {
    onSelectionChangeRef.current?.({
      classIds: selectedClassIds,
      valueRanges: valueRangeSelection.ranges.map((r) => ({
        min: r.start,
        max: r.end,
      })),
      angleRanges: angleRangeSelection.ranges.map((r) => ({
        min: r.start,
        max: r.end,
      })),
    });
  }, [
    selectedClassIds,
    valueRangeSelection.ranges,
    angleRangeSelection.ranges,
  ]);

  const onChainChangeRef = React.useRef(onChainChange);
  onChainChangeRef.current = onChainChange;
  React.useEffect(() => {
    onChainChangeRef.current?.({
      chain: layerChain,
      fullChain: fullLayerChain,
    });
  }, [layerChain, fullLayerChain]);

  // Colorization / legend bounds for a continuous variable: auto-adapt's
  // discovered range when applicable (remote only), else the variable's
  // static catalog bounds (which a local raster always provides). The
  // legend shows whenever these resolve — no longer gated on auto-adapt
  // being applicable.
  const legendMin =
    !isCategorical && !isCircular
      ? isAutoAdaptApplicable
        ? effectiveRenderMin
        : (selectedVariableMeta?.renderMin ?? null)
      : null;
  const legendMax =
    !isCategorical && !isCircular
      ? isAutoAdaptApplicable
        ? effectiveRenderMax
        : (selectedVariableMeta?.renderMax ?? null)
      : null;

  return (
    <View ref={mapContainerRef} style={styles.mapContainer}>
      <SpeciesOccurrenceMap
        occurrences={[]}
        loading={false}
        error={null}
        height={height}
        heatmapTileUrl={tileUrl}
        renderLocalTile={isLocal ? tileSource.renderTile : undefined}
        initialLat={initialLat}
        initialLon={initialLon}
        initialZoom={initialZoom}
        minZoom={0}
        showMarkers={false}
        useLabelsOverlay
        enableBasemapModeToggle={false}
        preserveMapPosition
        onFullscreenToggle={() =>
          toggleFullscreenElement(
            mapContainerRef.current as unknown as Element | null,
          )
        }
        onTileClasses={handleTileClasses}
        onBoundsChange={handleBoundsChange}
        onPointValue={handlePointValue}
        pointQueryUrl={
          !isLocal && selectedVariable
            ? `${BACKEND_BASE}/gis/point?variable=${encodeURIComponent(selectedVariable)}&unit_system=${units}${forecastH > 0 ? `&forecast_h=${forecastH}` : ''}&colormap=${encodeURIComponent(selectedColormap)}`
            : null
        }
        isCircular={isCircular}
        renderMin={legendMin}
        renderMax={legendMax}
        enableAutoAdaptToggle
        autoAdaptApplicable={isAutoAdaptApplicable}
        autoAdaptEnabled={autoAdaptEnabled}
        onToggleAutoAdapt={toggleAutoAdapt}
        gradientStops={
          !isCategorical && !isCircular
            ? COLORMAPS[selectedColormap].stops
            : null
        }
        aspectStops={
          isCircular ? CIRCULAR_COLORMAPS[selectedCircularColormap].stops : null
        }
        classColors={classColors}
        classLabels={classLabels}
        markerOutlineEnabled={markerOutlineEnabled}
      />

      {isCircular && (
        <>
          <MapCircularLegend
            pinnedValue={pinnedValue}
            conicCss={CIRCULAR_COLORMAPS[selectedCircularColormap].conicCss}
            arcSegmentColors={
              CIRCULAR_COLORMAPS[selectedCircularColormap].arcSegmentColors
            }
            selectedRanges={selectedAngleRanges}
            onRangeChange={handleAngleRangeChange}
            forceAdditive={responsive.breakpoint === 'phone'}
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
            selectedClassIds={selectedClassIds}
            onClassClick={toggleSelectedClassId}
          />
          {isOrdinalVariable ? (
            <MapColormapPicker
              selected={selectedColormap}
              onChange={setSelectedColormap}
            />
          ) : (
            <MapCbModePicker
              selected={cbMode}
              onChange={setCbMode}
              topClasses={visibleCategoricalClasses?.slice(0, 3) ?? []}
              variableId={selectedVariableMeta?.id ?? ''}
              shapesEnabled={false}
              dotsOnly
              markerOutlineEnabled={markerOutlineEnabled}
            />
          )}
        </>
      )}

      {!isCategorical &&
        !isCircular &&
        legendMin != null &&
        legendMax != null && (
          <>
            <MapVariableLegend
              min={legendMin}
              max={legendMax}
              units={selectedVariableMeta?.units}
              pinnedValue={pinnedValue}
              barSvgStops={COLORMAPS[selectedColormap].barSvgStops}
              selectedRanges={selectedValueRanges}
              onRangeChange={handleValueRangeChange}
              forceAdditive={responsive.breakpoint === 'phone'}
            />
            <MapColormapPicker
              selected={selectedColormap}
              onChange={setSelectedColormap}
            />
          </>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    position: 'relative',
  },
});
