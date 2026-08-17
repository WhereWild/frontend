// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SpeciesOccurrenceMap, ThemedText } from '@/components';
import type { SelectOption } from '@/components';
import { toggleFullscreenElement } from '@/components/sections/speciesOccurrenceMap/speciesOccurrenceMapHelpers';
import { PageSurface } from '@/components/PageSurface';
import { PageScrollContainer } from '@/components/PageScrollContainer';
import { RoutePressable } from '@/components/navigation/RoutePressable';
import { Colors, Size } from '@/constants/theme';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { BACKEND_BASE, fetchEnvironmentVariables } from '@/data/api';
import { useAutoAdaptRange } from '@/hooks/useAutoAdaptRange';
import { useDataSources } from '@/hooks/useDataSources';
import { SourceAttribution } from '@/components/sections/SourceAttribution';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings, type UnitSystem } from '@/context/SettingsContext';
import { Platform, StyleSheet, View } from 'react-native';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import {
  formatValue,
  isVariableCategorical,
  isVariableCircular,
  joinClassNamesWithAnd,
  normalizeLabel,
} from '@/components/sections/speciesEnvironment/model';
import {
  circularRangeSpan,
  FULL_CIRCLE_SPAN_THRESHOLD,
} from '@/hooks/useCircularDragSelection';
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
import { useEnvironmentVariableSelection } from '@/components/sections/speciesEnvironment/useEnvironmentVariableSelection';
import { VariableSelectorHeader } from '@/components/sections/speciesEnvironment/VariableSelectorHeader';
import { parseTemporalId } from '@/components/sections/speciesEnvironment/temporalHelpers';
import {
  useMapLayerChain,
  type ChainedLayerFilter,
  type MapChainExtra,
} from '@/components/sections/speciesOccurrenceMap/useMapLayerChain';
import {
  buildChainDescriptionText,
  popRestorable,
} from '@/hooks/useVariableFilterChain';
import { useRangeSelectionAccumulator } from '@/hooks/useRangeSelectionAccumulator';

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
    version: e.version ?? null,
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
  valueRanges,
  unitSystem,
  chain,
  renderRange,
}: {
  cacheKey: number;
  colormap: string;
  circularColormap: string;
  isCircular: boolean;
  cbMode: string | null;
  forecastH: number;
  variable: string;
  classFilter: number[] | null;
  valueRanges: LegendRange[] | null;
  unitSystem: UnitSystem | undefined;
  chain?: MapChainExtra[];
  // "Auto-adapt" mode's discovered [min,max] (display units, from GET
  // .../tile-range/stats) — overrides the layer's fixed catalog
  // render_min/max for colorization, rescaling to just what's visible on
  // screen. See main.py's render_range query param.
  renderRange?: [number, number] | null;
}) => {
  const effectiveColormap = isCircular ? circularColormap : colormap;
  const cbParam = cbMode ? `&cb_mode=${encodeURIComponent(cbMode)}` : '';
  const fcParam = forecastH > 0 ? `&forecast_h=${forecastH}` : '';
  // Repeated params (class_filter=1&class_filter=2) — FastAPI's
  // `list[int] = Query(None)` on the backend route collects these the same
  // way it already does for any other repeated-key query param.
  const cfParam =
    classFilter && classFilter.length > 0
      ? classFilter.map((id) => `&class_filter=${id}`).join('')
      : '';
  // value_ranges come from the legend, which displays (and the user drags
  // across) values in the current unit system — the backend needs to know
  // that to convert back to the raw/metric units its raster pixels are
  // actually stored in before masking (see main.py's layer_tile route).
  // A single layer's own filter can itself be multiple disjoint ranges
  // (OR'd) — [min,max] pairs, not just one. unit_system is sent
  // unconditionally (not just when valueRanges is set) since a chained
  // filter can need conversion even when the primary (categorical) layer
  // has no value range of its own.
  const vrParam =
    valueRanges && valueRanges.length > 0
      ? `&value_ranges=${encodeURIComponent(
          JSON.stringify(valueRanges.map((r) => [r.min, r.max])),
        )}`
      : '';
  const chainParam =
    chain && chain.length > 0
      ? `&chain=${encodeURIComponent(JSON.stringify(chain))}`
      : '';
  const renderRangeParam = renderRange
    ? `&render_range=${encodeURIComponent(JSON.stringify(renderRange))}`
    : '';
  return `${BACKEND_BASE}/api/variables/${encodeURIComponent(
    variable || 'landcover',
  )}/tiles/{z}/{x}/{y}.png?reproject=true&max_native_zoom=10&colormap=${encodeURIComponent(effectiveColormap)}${cbParam}&_cb=${cacheKey}${fcParam}${cfParam}${vrParam}&unit_system=${unitSystem ?? 'metric'}${chainParam}${renderRangeParam}`;
};

// Parses ?slice=<json> — a JSON-encoded MapChainExtra[] (see
// encodeMapChainParam below) — into full ChainedLayerFilter[] entries.
// Mirrors app/_species.tsx's parseChainParam. Self-describing from the JSON
// shape alone (class_filter present => categorical), same as the species
// version — no catalog lookup needed, so it isn't racing the async
// variable-catalog fetch. isCircular can't be recovered this way (a
// circular variable's angle ranges serialize identically to a plain
// numeric range) and defaults to false; the ONE place that actually needs
// it right — the entry for whatever variable ends up selected at mount —
// gets corrected with the live, catalog-resolved value once it's known
// (see Maps()'s initialChainSplit). Defensive against malformed input, same
// as the species version.
function parseMapChainParam(raw: string | undefined): ChainedLayerFilter[] {
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  const result: ChainedLayerFilter[] = [];
  for (const item of parsed) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as { layer_id?: unknown }).layer_id !== 'string'
    ) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const layerId = record.layer_id as string;

    let extra: MapChainExtra | null = null;
    if (Array.isArray(record.class_filter)) {
      const classFilter = record.class_filter.filter(
        (v): v is number => typeof v === 'number',
      );
      if (classFilter.length > 0) {
        extra = { layer_id: layerId, class_filter: classFilter };
      }
    } else if (Array.isArray(record.value_ranges)) {
      const valueRanges = record.value_ranges.filter(
        (r): r is [number, number] =>
          Array.isArray(r) &&
          r.length === 2 &&
          typeof r[0] === 'number' &&
          typeof r[1] === 'number',
      );
      if (valueRanges.length > 0) {
        extra = { layer_id: layerId, value_ranges: valueRanges };
      }
    }
    if (!extra) {
      continue;
    }

    const isCategorical = 'class_filter' in extra;
    result.push({
      layerId,
      isCategorical,
      isCircular: false,
      extra,
      label: isCategorical
        ? (extra.class_filter ?? []).map(String).join(', ')
        : '',
      originalClassIds: isCategorical ? extra.class_filter : undefined,
      originalRanges: !isCategorical
        ? (extra.value_ranges ?? []).map(([min, max]) => ({ min, max }))
        : undefined,
    });
  }
  return result;
}

// Inverse of parseMapChainParam — just the `extra` field of each entry.
function encodeMapChainParam(chain: ChainedLayerFilter[]): string | null {
  if (chain.length === 0) {
    return null;
  }
  return JSON.stringify(chain.map((entry) => entry.extra));
}

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
  const pathname = usePathname();

  const [variables, setVariables] =
    useState<EnvironmentVariableOption[]>(FALLBACK_VARIABLES);

  // Lets other pages (e.g. a variable guide's "View on map" link) deep-link
  // straight to a specific variable via /maps?variable=<id>, and a slice/
  // chain filter reproduce via ?slice=<json> — species-page-style hydration
  // (see app/_species.tsx), mirrored here for the maps page's own chain
  // shape (ChainedLayerFilter/MapChainExtra instead of
  // ChainedVariableFilter/ExtraVariableFilter).
  const { variable: routeVariableId, slice: routeSliceParam } =
    useLocalSearchParams<{ variable?: string; slice?: string }>();

  const {
    categories,
    selectedVariableCategory,
    setSelectedVariableCategory,
    filteredVariables,
    allVariables,
    selectedVariable,
    setSelectedVariable,
    selectedVariableMeta,
  } = useEnvironmentVariableSelection({
    // No route param falls through to useEnvironmentVariableSelection's own
    // default (the catalog's first variable) rather than forcing a specific
    // one here.
    variableId: typeof routeVariableId === 'string' ? routeVariableId : '',
    variables,
  });

  const isRecentWeather =
    (selectedVariableCategory ?? '').toLowerCase() === 'recent weather';
  const isCircular = isVariableCircular(selectedVariableMeta);
  const isCategorical = isVariableCategorical(selectedVariableMeta);

  const initialChain = useMemo(
    () =>
      parseMapChainParam(
        typeof routeSliceParam === 'string' ? routeSliceParam : undefined,
      ),
    [routeSliceParam],
  );
  // If the hydrated chain has an entry for the variable that's already
  // selected on mount, pop it off and apply it as the live selection
  // instead of a "chained" filter — mirrors useEnvironmentHighlights.ts's
  // initialChainSplit. Computed once via ref (not useMemo, which React
  // doesn't guarantee to run only once).
  const initialChainSplitRef = useRef<{
    chain: ChainedLayerFilter[];
    restored: ChainedLayerFilter | null;
  } | null>(null);
  if (initialChainSplitRef.current === null) {
    const split = popRestorable(
      initialChain,
      selectedVariable,
      (entry: ChainedLayerFilter) => entry.layerId,
    );
    // parseMapChainParam can't tell a circular variable's angle ranges from
    // a plain numeric range and defaults isCircular to false — the live,
    // catalog-resolved flags for the variable actually selected at mount
    // are authoritative, so use those instead for the restored entry.
    initialChainSplitRef.current = {
      chain: split.chain,
      restored: split.restored
        ? { ...split.restored, isCategorical, isCircular }
        : null,
    };
  }
  const initialChainSplit = initialChainSplitRef.current;

  const [visibleNominalCounts, setVisibleNominalCounts] = useState<
    Map<number, number>
  >(new Map());
  const [pinnedValue, setPinnedValue] = useState<number | null>(null);
  const [selectedForecast, setSelectedForecast] = useState('now');
  // Multiple classes can be toggled on at once — an empty array means no
  // filter (all classes shown), same as the previous single-select's null.
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>(() =>
    initialChainSplit.restored?.isCategorical
      ? (initialChainSplit.restored.originalClassIds ?? [])
      : [],
  );
  const toggleSelectedClassId = useCallback((id: number) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);
  // Drag-selected value range(s) on MapVariableLegend's gradient bar
  // (numeric variables) — filters which pixels render, same idea as
  // classFilter but for a continuous range instead of a discrete class.
  // Multiple disjoint ranges can be selected at once (shift/cmd-drag or a
  // ~500ms long-press-to-arm adds a range instead of replacing the
  // selection — see useLinearLegendDragSelection/useRangeSelectionAccumulator).
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
  const handleValueRangeChange = useCallback(
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
  const setSelectedValueRanges = useCallback(
    (ranges: LegendRange[]) =>
      valueRangeSelection.setAll(
        ranges.map((r) => ({ start: r.min, end: r.max })),
      ),
    [valueRangeSelection],
  );

  // Same for MapCircularLegend's ring (circular variables) — min/max here
  // are a clockwise start/end angle, not a sorted range; see LegendRange's
  // doc comment on MapCircularLegendProps for the wraparound convention.
  // mergeRanges (used internally by the accumulator) already handles this
  // wraparound case, same as the species page's circular density chart.
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
  const handleAngleRangeChange = useCallback(
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
  const setSelectedAngleRanges = useCallback(
    (ranges: LegendRange[]) =>
      angleRangeSelection.setAll(
        ranges.map((r) => ({ start: r.min, end: r.max })),
      ),
    [angleRangeSelection],
  );
  // Fullscreens the map + its legend/colormap-picker overlays together —
  // see onFullscreenToggle's doc comment on SpeciesOccurrenceMapProps.
  const mapContainerRef = useRef<View | null>(null);

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

  // Auto-adapt only makes sense for a plain numeric gradient — circular
  // (wraparound 0-360°) variables don't have a meaningful "observed
  // min/max" the same way, and categorical variables have no numeric range
  // at all.
  const isAutoAdaptApplicable = !isCategorical && !isCircular;

  const forecastH = isRecentWeather
    ? (FORECAST_HOUR_MAP[selectedForecast] ?? 0)
    : 0;

  // Backend derives this from the layer's source-file mtime, so it only
  // changes when the underlying data is actually rebuilt — letting tile
  // responses be cached indefinitely instead of busted on every page load.
  const tileCacheKey = selectedVariableMeta?.version ?? 0;

  // Selection switching on a plain selectedVariable change is owned by
  // useMapLayerChain below (stash-and-restore instead of always clearing).
  useEffect(() => {
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

  // Mirrors the current variable + slice selection into the URL's query
  // string, so copying the address bar reproduces this exact view — same
  // replaceState-based, one-directional (state -> URL only) approach as the
  // species page (see app/_species.tsx).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (selectedVariable) {
      params.set('variable', selectedVariable);
    } else {
      params.delete('variable');
    }
    const query = params.toString();
    const nextUrl = `${pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [pathname, selectedVariable]);

  // Same idea, but debounced and split out on its own — a slice can be
  // actively dragged or built up across several quick clicks, and
  // fullLayerChain changes on every one of those intermediate steps.
  // Writing the URL on every tick would spam history.replaceState
  // mid-gesture instead of once the selection actually settles (see
  // app/_species.tsx's equivalent sliceUrlSyncTimeoutRef effect).
  const sliceUrlSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    if (sliceUrlSyncTimeoutRef.current) {
      clearTimeout(sliceUrlSyncTimeoutRef.current);
    }
    const encodedChain = encodeMapChainParam(fullLayerChain);
    sliceUrlSyncTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (encodedChain) {
        params.set('slice', encodedChain);
      } else {
        params.delete('slice');
      }
      const query = params.toString();
      const nextUrl = `${pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) {
        window.history.replaceState(null, '', nextUrl);
      }
    }, 600);
    return () => {
      if (sliceUrlSyncTimeoutRef.current) {
        clearTimeout(sliceUrlSyncTimeoutRef.current);
      }
    };
  }, [pathname, fullLayerChain]);

  // The renderer swap (globe <-> flat map) discards the old WebView/iframe
  // document outright, so any tileClassesRemoved messages it still owed
  // never get sent — a harder reset than a plain variable switch, so this
  // clears the whole chain too rather than trying to preserve it.
  const previousGlobeViewRef = useRef(globeViewEnabled);
  useEffect(() => {
    if (previousGlobeViewRef.current === globeViewEnabled) {
      return;
    }
    previousGlobeViewRef.current = globeViewEnabled;
    setSelectedClassIds([]);
    valueRangeSelection.clear();
    angleRangeSelection.clear();
    clearLayerChain();
    // valueRangeSelection/angleRangeSelection are fresh object literals every
    // render (only their .clear method, listed below, is memoized) —
    // depending on the whole objects would rerun this reset on every
    // range-selection change instead of only on a real renderer swap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    globeViewEnabled,
    clearLayerChain,
    valueRangeSelection.clear,
    angleRangeSelection.clear,
  ]);

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
        classFilter: isCategorical ? selectedClassIds : null,
        valueRanges: isCategorical
          ? null
          : isCircular
            ? selectedAngleRanges
            : selectedValueRanges,
        unitSystem: units,
        chain: layerChain.map((entry) => entry.extra),
        renderRange: autoAdaptRenderRange,
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
      selectedClassIds,
      selectedAngleRanges,
      selectedValueRanges,
      units,
      layerChain,
      autoAdaptRenderRange,
    ],
  );

  const handlePointValue = useCallback(
    (value: number) => setPinnedValue(value),
    [],
  );

  // A full snapshot of currently-visible nominal classes, recomputed from
  // scratch by the map template each time it settles — not an incremental
  // add/remove delta (see SpeciesOccurrenceMap.html's layer.syncClasses).
  // A plain replace, so a class with no currently-visible pixels is
  // automatically absent from `classes` and therefore dropped here — no
  // separate removal step needed, and nothing for stale per-tile add/remove
  // pairing to ever drift out of sync.
  const handleTileClasses = useCallback(
    (classes: { id: number; count: number }[]) => {
      setVisibleNominalCounts(
        new Map(classes.map(({ id, count }) => [id, count])),
      );
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

  // Ordinal variables have no separate accessibility variant — the
  // selected continuous colormap IS their coloring mechanism, always on
  // (unlike cbMode, which is an opt-in accessibility toggle for nominal
  // variables). See util/tiles.py's matching branch for the raster side.
  const isOrdinalVariable =
    selectedVariableMeta?.valueType?.toLowerCase() === 'ordinal';
  const colorMode = isOrdinalVariable ? selectedColormap : cbMode;

  const cbVisibleClasses = useMemo(
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

  const classColors = useMemo(() => {
    if (!isCategorical || !selectedVariableMeta?.legendClasses?.length)
      return null;
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta.legendClasses) {
      // Ordinal classes intentionally carry no raw legend color — see the
      // matching comment in app/_species.tsx's classColors.
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

  // Selected-range text used to live baked into MapCircularLegend/
  // MapVariableLegend themselves — moved up here (above the map pane, same
  // spot the species page's density charts show "Selected range: ..." via
  // VariableSelectorHeader's metaText) so it reads as page context rather
  // than legend chrome.
  const mapMetaText = useMemo(() => {
    if (isCircular && selectedAngleRanges.length > 0) {
      const rangeLabel = joinClassNamesWithAnd(
        selectedAngleRanges.map((range) => {
          const isFullCircle =
            circularRangeSpan({ start: range.min, end: range.max }) >=
            FULL_CIRCLE_SPAN_THRESHOLD;
          return isFullCircle
            ? 'Full circle'
            : `${Math.round(range.min)}° to ${Math.round(range.max)}°`;
        }),
      );
      return `Selected range: ${rangeLabel}`;
    }
    if (!isCircular && !isCategorical && selectedValueRanges.length > 0) {
      const unitsSuffix = selectedVariableMeta?.units
        ? ` ${selectedVariableMeta.units}`
        : '';
      const rangeLabel = joinClassNamesWithAnd(
        selectedValueRanges.map(
          (range) =>
            `${formatValue(range.min, 1)} to ${formatValue(range.max, 1)}`,
        ),
      );
      return `Selected range: ${rangeLabel}${unitsSuffix}`;
    }
    return null;
  }, [
    isCircular,
    isCategorical,
    selectedAngleRanges,
    selectedValueRanges,
    selectedVariableMeta?.units,
  ]);

  // Read-only summary of any chained filters from layers the user has since
  // switched away from — same "And filtering ..." copy the species page
  // shows via chainDescription, built from the same shared formatter.
  const mapChainDescription = useMemo(
    () =>
      buildChainDescriptionText(
        layerChain,
        (entry) => entry.layerId,
        (entry) => entry.isCategorical,
        (entry) => entry.label,
        (key) => {
          const meta = allVariables.find((v) => v.id === key);
          return meta ? { name: meta.label, units: meta.units } : null;
        },
        (entry) => {
          const ranges = entry.originalRanges ?? [];
          if (ranges.length === 0) {
            return '';
          }
          if (entry.isCircular) {
            // No "°" embedded per number here — the catalog's own units
            // string ("°" for circular variables) is appended once at the
            // end by buildChainDescriptionText, same as any other unit.
            return joinClassNamesWithAnd(
              ranges.map((range) => {
                const isFullCircle =
                  circularRangeSpan({ start: range.min, end: range.max }) >=
                  FULL_CIRCLE_SPAN_THRESHOLD;
                return isFullCircle
                  ? 'Full circle'
                  : `${Math.round(range.min)} to ${Math.round(range.max)}`;
              }),
            );
          }
          return joinClassNamesWithAnd(
            ranges.map(
              (range) =>
                `${formatValue(range.min, 1)} to ${formatValue(range.max, 1)}`,
            ),
          );
        },
      ),
    [layerChain, allVariables],
  );

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
              metaText={mapMetaText}
              chainDescription={mapChainDescription}
              forecastOptions={isRecentWeather ? FORECAST_OPTIONS : undefined}
              selectedForecast={selectedForecast}
              onForecastChange={setSelectedForecast}
            />

            <View ref={mapContainerRef} style={styles.mapContainer}>
              <SpeciesOccurrenceMap
                occurrences={[]}
                loading={false}
                error={null}
                height={MAP_HEIGHT}
                heatmapTileUrl={tileUrl}
                minZoom={MAP_MIN_ZOOM}
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
                  selectedVariable
                    ? `${BACKEND_BASE}/gis/point?variable=${encodeURIComponent(selectedVariable)}&unit_system=${units}${forecastH > 0 ? `&forecast_h=${forecastH}` : ''}&colormap=${encodeURIComponent(selectedColormap)}`
                    : null
                }
                isCircular={isCircular}
                renderMin={isAutoAdaptApplicable ? effectiveRenderMin : null}
                renderMax={isAutoAdaptApplicable ? effectiveRenderMax : null}
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
                    // Ordinal has no accessibility-mode picker — the
                    // continuous colormap picker IS its coloring control,
                    // same widget continuous variables use below.
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

              {isAutoAdaptApplicable &&
                effectiveRenderMin != null &&
                effectiveRenderMax != null && (
                  <>
                    <MapVariableLegend
                      min={effectiveRenderMin}
                      max={effectiveRenderMax}
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
            {selectedVariable ? (
              <RoutePressable
                href={`/guides/variables/${parseTemporalId(selectedVariable)?.baseId ?? selectedVariable}`}
                accessibilityRole='link'
              >
                <ThemedText variant='bodySmallLink'>{'View guide'}</ThemedText>
              </RoutePressable>
            ) : null}
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
