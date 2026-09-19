// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ThemedText } from '@/components';
import type { SelectOption } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { PageScrollContainer } from '@/components/PageScrollContainer';
import { RoutePressable } from '@/components/navigation/RoutePressable';
import { Colors, Size } from '@/constants/theme';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { fetchEnvironmentVariables } from '@/data/api';
import { useDataSources } from '@/hooks/useDataSources';
import { SourceAttribution } from '@/components/sections/SourceAttribution';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
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
import { useEnvironmentVariableSelection } from '@/components/sections/speciesEnvironment/useEnvironmentVariableSelection';
import { VariableSelectorHeader } from '@/components/sections/speciesEnvironment/VariableSelectorHeader';
import { parseTemporalId } from '@/components/sections/speciesEnvironment/temporalHelpers';
import type {
  ChainedLayerFilter,
  MapChainExtra,
} from '@/components/sections/speciesOccurrenceMap/useMapLayerChain';
import { buildChainDescriptionText } from '@/hooks/useVariableFilterChain';
import {
  VariableHeatmapMap,
  type HeatmapSelection,
} from '@/components/sections/VariableHeatmapMap';

const MAP_HEIGHT = 520;

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

// Parses ?slice=<json> — a JSON-encoded MapChainExtra[] (see
// encodeMapChainParam below) — into full ChainedLayerFilter[] entries.
// Mirrors app/_species.tsx's parseChainParam. Self-describing from the JSON
// shape alone (class_filter present => categorical). isCircular can't be
// recovered this way and defaults to false; VariableHeatmapMap corrects the
// entry for whatever variable ends up selected at mount with the live,
// catalog-resolved value. Defensive against malformed input.
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
  const { units } = useSettings();
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  const dataSources = useDataSources();
  const pathname = usePathname();

  const [variables, setVariables] =
    useState<EnvironmentVariableOption[]>(FALLBACK_VARIABLES);

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
    variableId: typeof routeVariableId === 'string' ? routeVariableId : '',
    variables,
  });

  const isRecentWeather =
    (selectedVariableCategory ?? '').toLowerCase() === 'recent weather';
  const isCircular = isVariableCircular(selectedVariableMeta);
  const isCategorical = isVariableCategorical(selectedVariableMeta);

  const [selectedForecast, setSelectedForecast] = useState('now');
  const selectedForecastH = FORECAST_HOUR_MAP[selectedForecast] ?? 0;
  const forecastH = isRecentWeather ? selectedForecastH : 0;

  // The map's live class/range selection + filter chain, surfaced from
  // VariableHeatmapMap for the header "Selected range:" / "And filtering…"
  // text and the ?slice= URL sync.
  const [selection, setSelection] = useState<HeatmapSelection>({
    classIds: [],
    valueRanges: [],
    angleRanges: [],
  });
  const [chains, setChains] = useState<{
    chain: ChainedLayerFilter[];
    fullChain: ChainedLayerFilter[];
  }>({ chain: [], fullChain: [] });

  const initialChain = useMemo(
    () =>
      parseMapChainParam(
        typeof routeSliceParam === 'string' ? routeSliceParam : undefined,
      ),
    [routeSliceParam],
  );

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

  // Mirrors the current variable into the URL's query string (state -> URL
  // only), same one-directional replaceState approach as the species page.
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

  // Same idea for the slice/chain, debounced — a slice can be actively
  // dragged or built up across several quick clicks, so write the URL once
  // the selection settles rather than on every intermediate tick.
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
    const encodedChain = encodeMapChainParam(chains.fullChain);
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
  }, [pathname, chains.fullChain]);

  // Selected-range text shown above the map pane (same spot the species
  // page's density charts show "Selected range: …" via VariableSelectorHeader).
  const mapMetaText = useMemo(() => {
    if (isCircular && selection.angleRanges.length > 0) {
      const rangeLabel = joinClassNamesWithAnd(
        selection.angleRanges.map((range) => {
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
    if (!isCircular && !isCategorical && selection.valueRanges.length > 0) {
      const unitsSuffix = selectedVariableMeta?.units
        ? ` ${selectedVariableMeta.units}`
        : '';
      const rangeLabel = joinClassNamesWithAnd(
        selection.valueRanges.map(
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
    selection.angleRanges,
    selection.valueRanges,
    selectedVariableMeta?.units,
  ]);

  // Read-only summary of chained filters from layers switched away from.
  const mapChainDescription = useMemo(
    () =>
      buildChainDescriptionText(
        chains.chain,
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
    [chains.chain, allVariables],
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

            <VariableHeatmapMap
              variableId={selectedVariable}
              variableMeta={selectedVariableMeta ?? null}
              tileSource={{ kind: 'remote' }}
              height={MAP_HEIGHT}
              allVariables={allVariables}
              initialChain={initialChain}
              forecastH={forecastH}
              onSelectionChange={setSelection}
              onChainChange={setChains}
            />

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
});
