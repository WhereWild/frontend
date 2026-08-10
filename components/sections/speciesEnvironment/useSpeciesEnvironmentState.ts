// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  ExtraVariableFilter,
  SpeciesEnvironmentRelativeRank,
} from '@/data/types';
import React from 'react';
import {
  buildCategoricalSummary,
  EnvironmentVariableOption,
  formatValue,
  isVariableCategorical as isVariableCategoricalOption,
  isVariableCircular,
  joinClassNamesWithAnd,
  type PinnedCategoryBadge,
  RankContextOption,
} from './model';
import {
  buildHeadingText,
  buildMetaText,
  buildSummaryComparisons,
  getRankContextOptions,
  resolveMetricRank,
  resolveRangeValue,
} from './stateDerivations';
import { useEnvironmentHighlights } from './useEnvironmentHighlights';
import { useEnvironmentStats } from './useEnvironmentStats';
import { useEnvironmentVariableSelection } from './useEnvironmentVariableSelection';
import { useHomeLocationPin } from './useHomeLocationPin';
import { getCbColor, type CbMode } from '../speciesOccurrenceMap/cbColors';

const SPECIES_CATEGORY_REMAP: Record<string, string> = {
  'live weather': 'Recent Weather',
};

/** Inputs for orchestrating full SpeciesEnvironmentSection state. */
type UseSpeciesEnvironmentStateParams = {
  /** Taxon ID for all environment/statistics queries. */
  taxonId?: string;
  /** Initial variable id requested by parent component. */
  variableId: string;
  /** Optional external variable definitions. */
  variables?: EnvironmentVariableOption[];
  /** Callback with highlighted catalog numbers from chart/category interactions. */
  onHighlightChange?: (catalogNumbers: (number | string)[]) => void;
  /** Optional location filter gid for scoped environment views. */
  locationGid?: string | null;
  /** Optional phenology filter value. */
  phenology?: string | null;
  /** Optional timestamp range filter (Unix seconds). */
  startTimestamp?: number | null;
  endTimestamp?: number | null;
  /** Encoded polyline region filter (see encodePolygonsParam) — a drawn/uploaded map region, unioned server-side. */
  polygon?: string | null;
  units?: 'metric' | 'imperial' | undefined;
  pinnedObservation?: {
    catalogNumber: string;
    lat: number;
    lon: number;
  } | null;
  /** When false, suppresses slice and category-sample network requests. */
  slicingEnabled?: boolean;
  /** Accessibility color mode (colorblind/achromatopsia) — used for nominal
   * pinned/unobserved-category badge colors. Not used for ordinal variables
   * (see colormap below). */
  cbMode?: CbMode | null;
  /** Currently-selected continuous colormap — used instead of cbMode for
   * ordinal variables' pinned/unobserved-category badge colors, since
   * ordinal has no separate accessibility variant (the colormap IS its
   * coloring mechanism). See util/tiles.py's matching branch. */
  colormap?: CbMode | null;
};

/** Inputs used to derive presentational state from loaded stats and selection metadata. */
type PresentationInput = {
  stats: ReturnType<typeof useEnvironmentStats>['stats'];
  selectedVariable: string;
  selectedVariableMeta: EnvironmentVariableOption | null;
  anyFilterActive: boolean;
};

/** Derives baseline/summary/density display state from selected stats context. */
const resolvePresentationState = ({
  stats,
  selectedVariable,
  selectedVariableMeta,
  anyFilterActive,
}: PresentationInput) => {
  const baselineSummary = anyFilterActive
    ? (stats?.baselineSummary ?? null)
    : null;
  const summary = stats?.summary;
  const categoricalDistribution = stats?.categoricalDistribution ?? [];

  const variableType =
    stats?.variableType?.toLowerCase?.() ??
    selectedVariableMeta?.valueType?.toLowerCase?.() ??
    null;
  const forcedCategorical = isVariableCategoricalOption({
    id: selectedVariable ?? '',
    valueType: variableType,
  });
  const isCategorical = forcedCategorical || categoricalDistribution.length > 0;

  return {
    baselineSummary,
    baselineCategoricalDistribution: anyFilterActive
      ? (stats?.baselineCategoricalDistribution ?? null)
      : null,
    summary,
    categoricalDistribution,
    isCategorical,
    densityCurve: isCategorical ? null : (stats?.densityCurve ?? null),
    ternaryCompositionDensity: stats?.ternaryCompositionDensity ?? null,
  };
};

const categoryHasObservedSamples = (category: {
  count: number;
  fraction: number;
}) =>
  (Number.isFinite(category.count) && category.count > 0) ||
  (Number.isFinite(category.fraction) && category.fraction > 0);

const normalizeCategoryIdentity = (
  value: number | string | null | undefined,
) =>
  typeof value === 'string' ? value.trim().toLowerCase() : String(value ?? '');

/** Composes selection, stats, ranking, and presentation state for SpeciesEnvironmentSection. */
export function useSpeciesEnvironmentState({
  taxonId,
  variableId,
  variables,
  onHighlightChange,
  locationGid,
  phenology,
  startTimestamp,
  endTimestamp,
  polygon,
  units,
  pinnedObservation,
  slicingEnabled = true,
  cbMode = null,
  colormap = null,
}: UseSpeciesEnvironmentStateParams) {
  const {
    categories,
    selectedVariableCategory,
    setSelectedVariableCategory,
    filteredVariables,
    allVariables,
    selectedVariable,
    setSelectedVariable,
    selectedVariableMeta,
    isVariableCategorical,
  } = useEnvironmentVariableSelection({
    variableId,
    variables,
    units,
    remapCategories: SPECIES_CATEGORY_REMAP,
  });

  // Ordinal variables have no separate accessibility variant — the
  // selected continuous colormap IS their coloring mechanism, always on
  // (unlike cbMode, which is an opt-in accessibility toggle for nominal
  // variables). See util/tiles.py's matching branch for the raster side.
  const isOrdinalVariable =
    selectedVariableMeta?.valueType?.toLowerCase() === 'ordinal';
  const colorMode = isOrdinalVariable ? (colormap ?? 'viridis') : cbMode;

  // useEnvironmentStats needs the active chain (to send as `extra`, so the
  // density curve/histogram/categorical distribution it returns reflect a
  // chained slice from another variable, not just the raw unfiltered
  // dataset) — but the chain itself only exists on useEnvironmentHighlights'
  // return below, which in turn needs THIS hook's `stats` as one of its own
  // inputs. Bridged via a ref + version signal instead of a plain prop: the
  // chain lands here one render after it actually changes, which is
  // invisible since this hook's fetch is already async/effect-driven.
  const activeChainRef = React.useRef<ExtraVariableFilter[]>([]);
  const [chainSignal, setChainSignal] = React.useState(0);
  // A chained slice from another variable is a filter just like location/
  // phenology/timestamp — it should also unlock the "vs global" baseline
  // comparison and the other anyFilterActive-gated UI below, but ONLY when
  // the chain actually affects what's shown (i.e. the KDE for THIS variable
  // was actually recomputed against a filter) — a chain entry naming the
  // currently-selected variable itself shouldn't count (by construction it
  // never should exist — switching back to a chained variable restores it
  // as the live selection instead — but check explicitly rather than lean
  // on that invariant never breaking). Reads the same ref useEnvironmentStats
  // does (one render behind at worst, same as the stats themselves).
  const anyFilterActive =
    Boolean(locationGid) ||
    Boolean(phenology) ||
    startTimestamp != null ||
    endTimestamp != null ||
    Boolean(polygon) ||
    activeChainRef.current.some((f) => f.variableId !== selectedVariable);
  const { stats, error, loading } = useEnvironmentStats({
    taxonId,
    selectedVariable,
    locationGid,
    phenology,
    startTimestamp,
    endTimestamp,
    polygon,
    units,
    extraRef: activeChainRef,
    chainSignal,
  });

  const {
    baselineSummary,
    baselineCategoricalDistribution,
    summary,
    categoricalDistribution,
    isCategorical,
    densityCurve,
    ternaryCompositionDensity,
  } = React.useMemo(
    () =>
      resolvePresentationState({
        stats,
        selectedVariable,
        selectedVariableMeta,
        anyFilterActive,
      }),
    [anyFilterActive, selectedVariable, selectedVariableMeta, stats],
  );

  const {
    selectedCategoryValues,
    selectCategoryValue,
    selectedDensityRanges,
    selectDensityRange,
    rangeObservations,
    activeChain,
    removeChainedFilter,
    clearChain,
    pinnedClassName,
    pinnedNoData,
    pinnedValueLabel,
    pinnedValueDescription,
    pinnedValueColor,
    pinnedCategoryObserved,
    pinnedValue,
    pinnedLoading,
  } = useEnvironmentHighlights({
    taxonId,
    selectedVariable,
    stats,
    isCategorical,
    locationGid,
    phenology,
    startTimestamp,
    endTimestamp,
    polygon,
    onHighlightChange,
    units,
    pinnedObservation,
    slicingEnabled,
    colorMode,
  });

  // A single combined line for display right below metaText, e.g. "And
  // filtering from 35.5 to 39.0 °F Annual Mean Temperature and to only
  // Continental, subarctic Köppen-Geiger Climate Classification" — one
  // "And filtering" prefix with each additional chained variable joined by
  // "and", not a separate line per entry. No edit/remove affordance is
  // exposed here on purpose — a reload gives a clean slate, so this is
  // read-only context. Class/variable names are shown exactly as they come
  // from the catalog metadata, no forced casing.
  const chainDescription = React.useMemo(() => {
    if (activeChain.length === 0) {
      return null;
    }
    const clauses = activeChain.map((entry) => {
      const variableMeta = allVariables.find((v) => v.id === entry.variableId);
      const variableName = variableMeta?.label ?? entry.variableId;
      if (entry.isCategorical) {
        return `to only ${entry.label} ${variableName}`;
      }
      const ranges = entry.originalRanges ?? [];
      const rangeText = joinClassNamesWithAnd(
        ranges.map(
          (range) =>
            `${formatValue(range.displayStart ?? range.start, 1)} to ${formatValue(range.displayEnd ?? range.end, 1)}`,
        ),
      );
      const unitsSuffix = variableMeta?.units ? ` ${variableMeta.units}` : '';
      return `from ${rangeText}${unitsSuffix} ${variableName}`;
    });
    return `And filtering ${clauses.join(' and ')}`;
  }, [activeChain, allVariables]);

  React.useEffect(() => {
    activeChainRef.current = activeChain.map((f) => f.extra);
    setChainSignal((v) => v + 1);
  }, [activeChain]);

  const { homePinValue, homePinValueLabel, homePinLoading } =
    useHomeLocationPin({
      selectedVariable,
      units,
    });

  const homePinnedCategoryValue = React.useMemo(() => {
    if (!isCategorical || homePinValue === null) return null;
    const normalizedPinnedValue = normalizeCategoryIdentity(homePinValue);
    const normalizedPinnedLabel = normalizeCategoryIdentity(homePinValueLabel);
    const classFormatPinned = normalizedPinnedValue.startsWith('class_')
      ? normalizedPinnedValue
      : `class_${normalizedPinnedValue}`;
    return (
      categoricalDistribution.find(
        (category) =>
          categoryHasObservedSamples(category) &&
          (normalizeCategoryIdentity(category.value) ===
            normalizedPinnedValue ||
            normalizeCategoryIdentity(category.value) === classFormatPinned ||
            normalizeCategoryIdentity(category.className) ===
              normalizedPinnedValue ||
            (normalizedPinnedLabel.length > 0 &&
              (normalizeCategoryIdentity(category.value) ===
                normalizedPinnedLabel ||
                normalizeCategoryIdentity(category.className) ===
                  normalizedPinnedLabel))),
      )?.value ?? null
    );
  }, [categoricalDistribution, isCategorical, homePinValue, homePinValueLabel]);

  const homeUnobservedCategory =
    React.useMemo<PinnedCategoryBadge | null>(() => {
      if (!isCategorical || homePinValue === null || homePinLoading)
        return null;
      if (homePinnedCategoryValue !== null) return null;

      const normalizedPinned = normalizeCategoryIdentity(homePinValue);
      const distributionColor =
        categoricalDistribution.find(
          (cat) => normalizeCategoryIdentity(cat.value) === normalizedPinned,
        )?.color ?? null;
      const rawLegendColor =
        distributionColor ??
        selectedVariableMeta?.legendClasses?.find(
          (cls) => String(cls.id) === String(homePinValue),
        )?.color ??
        null;
      const legendColor = colorMode
        ? getCbColor(
            selectedVariable ?? '',
            Number(homePinValue),
            colorMode,
            rawLegendColor ?? '#888888',
          )
        : rawLegendColor;

      return {
        value: homePinValue,
        label: homePinValueLabel?.trim().length
          ? homePinValueLabel
          : String(homePinValue),
        description: null,
        ...(legendColor !== null ? { color: legendColor } : {}),
      };
    }, [
      categoricalDistribution,
      isCategorical,
      homePinLoading,
      homePinnedCategoryValue,
      homePinValue,
      homePinValueLabel,
      selectedVariableMeta,
      selectedVariable,
      colorMode,
    ]);

  const rangeObservationItems = React.useMemo(
    () =>
      rangeObservations.map((entry) => ({
        id: entry.catalogNumber,
        label:
          typeof entry.value === 'number'
            ? `#${entry.catalogNumber} (${formatValue(entry.value, 1)})`
            : `#${entry.catalogNumber}`,
      })),
    [rangeObservations],
  );

  const rankContextOptions = React.useMemo<RankContextOption[]>(
    () => getRankContextOptions(anyFilterActive, stats?.relativeRanks),
    [anyFilterActive, stats?.relativeRanks],
  );

  const [selectedRankContextState, setSelectedRankContext] = React.useState<
    string | null
  >(null);

  const selectedRankContext = React.useMemo(() => {
    if (!rankContextOptions.length) {
      return null;
    }
    if (
      selectedRankContextState &&
      rankContextOptions.some(
        (option) => option.key === selectedRankContextState,
      )
    ) {
      return selectedRankContextState;
    }
    return rankContextOptions[0].key;
  }, [rankContextOptions, selectedRankContextState]);

  const summaryRangeValue = resolveRangeValue(summary);
  const baselineRangeValue = resolveRangeValue(baselineSummary);

  const resolveRankForMetric = React.useCallback(
    (
      metric: string,
      value: number | null | undefined,
      options?: { allowHistogramFallback?: boolean },
    ) => {
      return resolveMetricRank({
        metric,
        value,
        stats,
        selectedRankContext,
        allowHistogramFallback: options?.allowHistogramFallback,
      }) as SpeciesEnvironmentRelativeRank | null;
    },
    [stats, selectedRankContext],
  );

  const summaryRanks = React.useMemo(() => {
    const modeFraction =
      summary?.mode != null
        ? (categoricalDistribution.find((c) => c.value === summary.mode)
            ?.fraction ?? null)
        : null;
    const singleSelectedCategoryValue =
      selectedCategoryValues.length === 1 ? selectedCategoryValues[0] : null;
    const selectedFraction =
      singleSelectedCategoryValue != null
        ? (categoricalDistribution.find(
            (c) => c.value === singleSelectedCategoryValue,
          )?.fraction ?? null)
        : null;
    return {
      min: resolveRankForMetric('min', summary?.min),
      mean: resolveRankForMetric('mean', summary?.mean),
      max: resolveRankForMetric('max', summary?.max),
      median: resolveRankForMetric('median', summary?.median, {
        allowHistogramFallback: false,
      }),
      range: resolveRankForMetric('range', summary?.range, {
        allowHistogramFallback: false,
      }),
      std: resolveRankForMetric('std', summary?.std ?? summary?.stddev, {
        allowHistogramFallback: false,
      }),
      q10: resolveRankForMetric('10th_percentile', summary?.q10, {
        allowHistogramFallback: false,
      }),
      q25: resolveRankForMetric('25th_percentile', summary?.q25, {
        allowHistogramFallback: false,
      }),
      q75: resolveRankForMetric('75th_percentile', summary?.q75, {
        allowHistogramFallback: false,
      }),
      q90: resolveRankForMetric('90th_percentile', summary?.q90, {
        allowHistogramFallback: false,
      }),
      iqr: resolveRankForMetric('iqr', summary?.iqr, {
        allowHistogramFallback: false,
      }),
      q10_90_range: resolveRankForMetric('10_90_range', summary?.q10_90_range, {
        allowHistogramFallback: false,
      }),
      range99: resolveRankForMetric('1-99 range', summaryRangeValue, {
        allowHistogramFallback: false,
      }),
      rbar: resolveRankForMetric('rbar', summary?.rbar, {
        allowHistogramFallback: false,
      }),
      circular_std: resolveRankForMetric(
        'circular_std',
        summary?.circular_std,
        {
          allowHistogramFallback: false,
        },
      ),
      circular_var: resolveRankForMetric(
        'circular_var',
        summary?.circular_var,
        { allowHistogramFallback: false },
      ),
      unique_classes: resolveRankForMetric(
        'unique_classes',
        summary?.unique_classes,
        {
          allowHistogramFallback: false,
        },
      ),
      entropy: resolveRankForMetric('entropy', summary?.entropy, {
        allowHistogramFallback: false,
      }),
      mode: resolveRankForMetric(
        'mode',
        summary?.mode as number | null | undefined,
        {
          allowHistogramFallback: false,
        },
      ),
      mode_class:
        summary?.mode != null && modeFraction != null
          ? resolveRankForMetric(`class_${summary.mode}`, modeFraction, {
              allowHistogramFallback: false,
            })
          : null,
      selected_class:
        singleSelectedCategoryValue != null && selectedFraction != null
          ? resolveRankForMetric(
              `class_${singleSelectedCategoryValue}`,
              selectedFraction,
              {
                allowHistogramFallback: false,
              },
            )
          : null,
    };
  }, [
    resolveRankForMetric,
    summary?.max,
    summary?.mean,
    summary?.min,
    summary?.stddev,
    summary?.rbar,
    summary?.circular_std,
    summary?.unique_classes,
    summary?.entropy,
    summary?.mode,
    summary?.circular_var,
    summary?.iqr,
    summary?.median,
    summary?.q10,
    summary?.q10_90_range,
    summary?.q25,
    summary?.q75,
    summary?.q90,
    summary?.range,
    summary?.std,
    summaryRangeValue,
    categoricalDistribution,
    selectedCategoryValues,
  ]);

  const summaryComparisons = React.useMemo<Record<string, string | null>>(
    () =>
      buildSummaryComparisons(
        anyFilterActive,
        summary,
        baselineSummary,
        summaryRangeValue,
        baselineRangeValue,
      ),
    [
      baselineRangeValue,
      baselineSummary,
      anyFilterActive,
      summary,
      summaryRangeValue,
    ],
  );

  const categoricalSummary = React.useMemo(
    () =>
      isCategorical
        ? buildCategoricalSummary(categoricalDistribution, summary)
        : null,
    [categoricalDistribution, isCategorical, summary],
  );

  const showRankContext = !anyFilterActive && rankContextOptions.length > 0;

  const pinnedCategoryValue = React.useMemo(() => {
    if (!isCategorical || pinnedValue === null) {
      return null;
    }

    const normalizedPinnedValue = normalizeCategoryIdentity(pinnedValue);
    const normalizedPinnedLabel = normalizeCategoryIdentity(pinnedValueLabel);
    const classFormatPinned = normalizedPinnedValue.startsWith('class_')
      ? normalizedPinnedValue
      : `class_${normalizedPinnedValue}`;

    return (
      categoricalDistribution.find(
        (category) =>
          categoryHasObservedSamples(category) &&
          (normalizeCategoryIdentity(category.value) ===
            normalizedPinnedValue ||
            normalizeCategoryIdentity(category.value) === classFormatPinned ||
            normalizeCategoryIdentity(category.className) ===
              normalizedPinnedValue ||
            (normalizedPinnedLabel.length > 0 &&
              (normalizeCategoryIdentity(category.value) ===
                normalizedPinnedLabel ||
                normalizeCategoryIdentity(category.className) ===
                  normalizedPinnedLabel))),
      )?.value ?? null
    );
  }, [categoricalDistribution, isCategorical, pinnedValue, pinnedValueLabel]);

  const pinnedUnobservedCategory =
    React.useMemo<PinnedCategoryBadge | null>(() => {
      if (!isCategorical || pinnedValue === null) {
        return null;
      }

      // Only show the badge when we've explicitly confirmed 0 observations for
      // this category. null means still loading or indeterminate — don't flash.
      if (pinnedCategoryObserved !== false) {
        return null;
      }

      const normalizedPinned = normalizeCategoryIdentity(pinnedValue);
      const distributionColor =
        categoricalDistribution.find(
          (cat) => normalizeCategoryIdentity(cat.value) === normalizedPinned,
        )?.color ?? null;
      const rawLegendColor =
        distributionColor ??
        selectedVariableMeta?.legendClasses?.find(
          (cls) => String(cls.id) === String(pinnedValue),
        )?.color ??
        null;
      const legendColor = colorMode
        ? getCbColor(
            selectedVariable ?? '',
            Number(pinnedValue),
            colorMode,
            rawLegendColor ?? '#888888',
          )
        : rawLegendColor;

      return {
        value: pinnedValue,
        label: pinnedValueLabel?.trim().length
          ? pinnedValueLabel
          : String(pinnedValue),
        description: pinnedValueDescription,
        ...(legendColor !== null ? { color: legendColor } : {}),
      };
    }, [
      categoricalDistribution,
      isCategorical,
      pinnedCategoryObserved,
      pinnedValue,
      pinnedValueDescription,
      pinnedValueLabel,
      selectedVariableMeta,
      selectedVariable,
      colorMode,
    ]);

  const headingText = buildHeadingText(
    Boolean(stats),
    stats?.variableName,
    selectedVariableMeta?.label,
    isCategorical,
    stats?.units,
  );

  const isCircularForMeta = isVariableCircular({
    id: selectedVariable ?? '',
    valueType: selectedVariableMeta?.valueType ?? null,
  });

  const metaText = buildMetaText({
    hasStats: Boolean(stats),
    isCategorical,
    isCircular: isCircularForMeta,
    selectedDensityRanges,
    rangeObservationCount: rangeObservationItems.length,
    observationCount: stats?.observationCount,
    summaryCount: summary?.count,
    categoricalTotalSamples: categoricalSummary?.totalSamples,
  });

  return {
    categories,
    selectedVariableCategory,
    setSelectedVariableCategory,
    filteredVariables,
    selectedVariable,
    setSelectedVariable,
    headingText,
    metaText,
    loading,
    stats,
    isVariableCategorical,
    error,
    isCategorical,
    categoricalDistribution,
    baselineCategoricalDistribution,
    selectedCategoryValues,
    selectCategoryValue,
    densityCurve,
    ternaryCompositionDensity,
    summary,
    selectedDensityRanges,
    selectDensityRange,
    activeChain,
    chainDescription,
    removeChainedFilter,
    clearChain,
    showRankContext,
    rankContextOptions,
    selectedRankContext,
    setSelectedRankContext,
    summaryRanks,
    summaryComparisons,
    anyFilterActive,
    pinnedCategoryValue,
    pinnedUnobservedCategory,
    pinnedClassName,
    pinnedValueColor,
    pinnedValue,
    pinnedLoading,
    pinnedNoData,
    homePinValue,
    homePinLoading,
    homePinnedCategoryValue,
    homeUnobservedCategory,
    selectedVariableMeta,
    isCircularVariable: isVariableCircular({
      id: selectedVariable ?? '',
      valueType: selectedVariableMeta?.valueType ?? null,
    }),
  };
}
