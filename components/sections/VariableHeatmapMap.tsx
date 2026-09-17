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
  sampleColormap,
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
      /** Local equivalent of the backend's /gis/point endpoint, for the
       * "click the map to read a value" popup. Optional — omit it and
       * clicking is silently disabled, same as a remote source with no
       * catalog variable selected. */
      readPointValue?: (
        lat: number,
        lon: number,
      ) => Promise<{
        value: number;
        className?: string | null;
        classColor?: string | null;
      } | null>;
      /** Continuous rasters only — drives auto-adapt locally, the same role
       * the remote tile-range/stats endpoint plays for a catalog variable.
       * Omit for vector sources (gis-editor's vector data is nominal-only,
       * so auto-adapt never applies there anyway). */
      getVisibleRange?: (bounds: {
        z: number;
        x0: number;
        y0: number;
        x1: number;
        y1: number;
      }) => { min: number; max: number } | null;
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
  /** Fires with any nominal/ordinal class ids seen in a rendered tile that
   * aren't already in `variableMeta.legendClasses` — the guaranteed-correct
   * counterpart to the /gis-editor sample-based auto-detected class list:
   * a downsampled preview can miss a real, rare class outright, but a
   * class that's actually been rendered on screen unambiguously exists.
   * Only meaningful for local sources (a remote catalog variable's class
   * list is already complete); the local /gis-editor tile source is the
   * only caller that passes this. */
  onDiscoverClasses?: (ids: number[]) => void;
};

// Not a real URL — intercepted by isLocalPointUrl() in the map templates
// before it's ever fetched. Just needs to be truthy (to satisfy the
// templates' `if (POINT_QUERY_URL)` click-enabling checks) and start with
// the recognized scheme.
const LOCAL_POINT_QUERY_URL = 'localpoint://point';

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
  onDiscoverClasses,
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

  // Applicable for any continuous source, remote or local — a local raster
  // just reads its already-decoded visible-tile range instead of hitting
  // tile-range/stats (see useAutoAdaptRange's localRangeReader). A local
  // source with no getVisibleRange (vector data, which is nominal-only
  // anyway, or an older/mocked renderer) has no way to supply that range.
  const isAutoAdaptApplicable =
    !isCategorical &&
    !isCircular &&
    (tileSource.kind === 'remote' || !!tileSource.getVisibleRange);

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
    localRangeReader:
      tileSource.kind === 'local' ? tileSource.getVisibleRange : undefined,
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
      if (onDiscoverClasses) {
        const known = new Set(
          (selectedVariableMeta?.legendClasses ?? []).map((c) => c.id),
        );
        const newIds = classes.map((c) => c.id).filter((id) => !known.has(id));
        if (newIds.length > 0) onDiscoverClasses(newIds);
      }
    },
    [onDiscoverClasses, selectedVariableMeta],
  );

  const isOrdinalVariable =
    selectedVariableMeta?.valueType?.toLowerCase() === 'ordinal';

  const visibleCategoricalClasses = React.useMemo(() => {
    if (!isCategorical || visibleNominalCounts.size === 0) return null;
    const isLandcover = selectedVariableMeta?.id === 'landcover';
    const allClasses = (selectedVariableMeta?.legendClasses ?? []).filter(
      (cls) => !(isLandcover && cls.id === 0),
    );
    const visible = allClasses
      .filter((cls) => visibleNominalCounts.has(cls.id as number))
      .sort(
        isOrdinalVariable
          ? // Ordinal classes are ranked, not unordered — keeping them in
            // rank order (rather than most-common-first, which scrambles a
            // sequential colormap's ramp into a visually random-looking
            // order) is what makes the legend actually read as an
            // increasing gradient, matching the colormap the tiles
            // themselves are rendered with.
            (a, b) => (a.id as number) - (b.id as number)
          : (a, b) =>
              (visibleNominalCounts.get(b.id as number) ?? 0) -
              (visibleNominalCounts.get(a.id as number) ?? 0),
      );
    return visible.length > 0 ? visible : null;
  }, [
    isCategorical,
    isOrdinalVariable,
    selectedVariableMeta,
    visibleNominalCounts,
  ]);
  const colorMode = isOrdinalVariable ? selectedColormap : cbMode;

  // getCbColor's own fallback (the class's static seeded color) is right
  // for nominal colorblind-safe substitution, but wrong for ordinal: a
  // local raster has no CB_CLASS_COLORS catalog entry to look up at all
  // (that table only covers known backend variables like salinity), so
  // getCbColor always fell through to whatever color the class was seeded
  // with when the file was first typed as ordinal — frozen at that moment,
  // never updated when the colormap picker changes afterward. Sampling the
  // *currently selected* colormap live, at this class's own position in
  // the render range, keeps it matching whatever the raster tiles
  // themselves are actually showing for that value.
  const ordinalFallbackColor = React.useCallback(
    (classId: number, fallback: string): string => {
      if (!isOrdinalVariable) return fallback;
      const renderMin = selectedVariableMeta?.renderMin;
      const renderMax = selectedVariableMeta?.renderMax;
      if (renderMin == null || renderMax == null || renderMax === renderMin) {
        return fallback;
      }
      return sampleColormap(
        selectedColormap,
        (classId - renderMin) / (renderMax - renderMin),
      );
    },
    [isOrdinalVariable, selectedVariableMeta, selectedColormap],
  );

  const cbVisibleClasses = React.useMemo(
    () =>
      colorMode && visibleCategoricalClasses
        ? visibleCategoricalClasses.map((cls) => ({
            ...cls,
            color: getCbColor(
              selectedVariableMeta?.id ?? '',
              cls.id as number,
              colorMode,
              ordinalFallbackColor(cls.id as number, cls.color ?? '#888888'),
            ),
          }))
        : visibleCategoricalClasses,
    [
      colorMode,
      ordinalFallbackColor,
      selectedVariableMeta,
      visibleCategoricalClasses,
    ],
  );

  const classColors = React.useMemo(() => {
    if (!isCategorical || !selectedVariableMeta?.legendClasses?.length)
      return null;
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta.legendClasses) {
      if (cls.id != null && (cls.color || isOrdinalVariable)) {
        const fallback = ordinalFallbackColor(
          cls.id as number,
          cls.color ?? '#888888',
        );
        const color = colorMode
          ? getCbColor(
              selectedVariableMeta.id,
              cls.id as number,
              colorMode,
              fallback,
            )
          : fallback;
        map.set(String(cls.id), color);
      }
    }
    return map;
  }, [
    isCategorical,
    selectedVariableMeta,
    colorMode,
    isOrdinalVariable,
    ordinalFallbackColor,
  ]);

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

  // Local rasters' own readPointValue() bakes each class's color in at
  // renderer-construction time (see cogTileRenderer.ts) — for ordinal data
  // that's the same stale/seeded color problem ordinalFallbackColor above
  // fixes for the legend, just showing up in the click-popup instead.
  // Re-deriving it here at click time keeps the popup swatch matching
  // whatever colormap is currently selected.
  const renderLocalPointValue = React.useMemo(() => {
    if (!isLocal || !tileSource.readPointValue) return undefined;
    const rawReadPointValue = tileSource.readPointValue;
    return async (lat: number, lon: number) => {
      const result = await rawReadPointValue(lat, lon);
      // Only ordinal needs this override at all (see ordinalFallbackColor's
      // own comment) — for anything else (ratio/interval/circular, or
      // nominal, which is already colored correctly via the static
      // per-class colorsById baked into the renderer), pass the result
      // through untouched. Introducing a classColor here unconditionally
      // was a real bug: the map template's popup renderer treats
      // `data.class_name || data.class_color` being truthy as "this is
      // categorical" (see fetchBackgroundPointPopup in
      // SpeciesOccurrenceMap.html) — forcing classColor to a '#888888'
      // fallback for continuous data made every local point query look
      // categorical, so it always rendered the fallback gray dot instead
      // of ever reaching the gradient-color branch.
      if (!result || !isOrdinalVariable) return result;
      return {
        ...result,
        classColor: ordinalFallbackColor(
          result.value,
          result.classColor ?? '#888888',
        ),
      };
    };
  }, [isLocal, tileSource, isOrdinalVariable, ordinalFallbackColor]);

  return (
    <View ref={mapContainerRef} style={styles.mapContainer}>
      <SpeciesOccurrenceMap
        occurrences={[]}
        loading={false}
        error={null}
        height={height}
        heatmapTileUrl={tileUrl}
        renderLocalTile={isLocal ? tileSource.renderTile : undefined}
        renderLocalPointValue={renderLocalPointValue}
        // Falls back into the click-popup's value line whenever a
        // per-point response doesn't carry its own units (always true for
        // local sources, since there's no backend to embed them into the
        // response — see requestLocalPointValue in
        // speciesOccurrenceMapHelpers.ts).
        varUnits={selectedVariableMeta?.units ?? null}
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
          isLocal
            ? // Sentinel recognized by isLocalPointUrl() in the map
              // templates — routes the click-to-read-a-value flow through
              // renderLocalPointValue's postMessage bridge instead of a
              // real fetch(), the same "generic API, remote or local"
              // pattern as the localtiles:// tile URLs.
              tileSource.readPointValue
              ? LOCAL_POINT_QUERY_URL
              : null
            : selectedVariable
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
