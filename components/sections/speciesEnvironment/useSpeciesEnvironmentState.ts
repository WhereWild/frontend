// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SpeciesEnvironmentRelativeRank } from '@/data/types';
import React from 'react';
import {
  buildCategoricalSummary,
  EnvironmentVariableOption,
  formatValue,
  isVariableCategorical as isVariableCategoricalOption,
  isVariableCircular,
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

const SPECIES_CATEGORY_REMAP: Record<string, string> = {
  'live weather': 'Recent Weather',
};

/** Inputs for orchestrating full SpeciesEnvironmentSection state. */
type UseSpeciesEnvironmentStateParams = {
  /** Taxon ID for all environment/statistics queries. */
  taxonId?: number;
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
  units?: 'metric' | 'imperial' | undefined;
  pinnedObservation?: {
    catalogNumber: string;
    lat: number;
    lon: number;
  } | null;
};

/** Inputs used to derive presentational state from loaded stats and selection metadata. */
type PresentationInput = {
  stats: ReturnType<typeof useEnvironmentStats>['stats'];
  selectedVariable: string;
  selectedVariableMeta: EnvironmentVariableOption | null;
  locationFilterActive: boolean;
};

/** Derives baseline/summary/density display state from selected stats context. */
const resolvePresentationState = ({
  stats,
  selectedVariable,
  selectedVariableMeta,
  locationFilterActive,
}: PresentationInput) => {
  const baselineSummary = locationFilterActive
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
    summary,
    categoricalDistribution,
    isCategorical,
    densityCurve: isCategorical ? null : (stats?.densityCurve ?? null),
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
  units,
  pinnedObservation,
}: UseSpeciesEnvironmentStateParams) {
  const {
    categories,
    selectedVariableCategory,
    setSelectedVariableCategory,
    filteredVariables,
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

  const locationFilterActive = Boolean(locationGid);
  const { stats, error, loading } = useEnvironmentStats({
    taxonId,
    selectedVariable,
    locationGid,
    phenology,
    startTimestamp,
    endTimestamp,
    units,
  });

  const {
    baselineSummary,
    summary,
    categoricalDistribution,
    isCategorical,
    densityCurve,
  } = React.useMemo(
    () =>
      resolvePresentationState({
        stats,
        selectedVariable,
        selectedVariableMeta,
        locationFilterActive,
      }),
    [locationFilterActive, selectedVariable, selectedVariableMeta, stats],
  );

  const {
    selectedCategoryValue,
    setSelectedCategoryValue,
    selectedDensityRange,
    handleDensitySelectionChange,
    rangeObservations,
    pinnedClassName,
    pinnedNoData,
    pinnedValueLabel,
    pinnedValueDescription,
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
    onHighlightChange,
    units,
    pinnedObservation,
  });

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
    () => getRankContextOptions(locationFilterActive, stats?.relativeRanks),
    [locationFilterActive, stats?.relativeRanks],
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
    const selectedFraction =
      selectedCategoryValue != null
        ? (categoricalDistribution.find(
            (c) => c.value === selectedCategoryValue,
          )?.fraction ?? null)
        : null;
    return {
      min: resolveRankForMetric('min', summary?.min),
      mean: resolveRankForMetric('mean', summary?.mean),
      max: resolveRankForMetric('max', summary?.max),
      std: resolveRankForMetric('std', summary?.stddev, {
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
      mode_class:
        summary?.mode != null && modeFraction != null
          ? resolveRankForMetric(`class_${summary.mode}`, modeFraction, {
              allowHistogramFallback: false,
            })
          : null,
      selected_class:
        selectedCategoryValue != null && selectedFraction != null
          ? resolveRankForMetric(
              `class_${selectedCategoryValue}`,
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
    summaryRangeValue,
    categoricalDistribution,
    selectedCategoryValue,
  ]);

  const summaryComparisons = React.useMemo<Record<string, string | null>>(
    () =>
      buildSummaryComparisons(
        locationFilterActive,
        summary,
        baselineSummary,
        summaryRangeValue,
        baselineRangeValue,
      ),
    [
      baselineRangeValue,
      baselineSummary,
      locationFilterActive,
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

  const showRankContext =
    !locationFilterActive && rankContextOptions.length > 0;

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
      const legendColor =
        distributionColor ??
        selectedVariableMeta?.legendClasses?.find(
          (cls) => String(cls.id) === String(pinnedValue),
        )?.color ??
        null;

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
    ]);

  const headingText = buildHeadingText(
    Boolean(stats),
    stats?.variableName,
    selectedVariableMeta?.label,
    isCategorical,
    stats?.units,
  );

  const metaText = buildMetaText({
    hasStats: Boolean(stats),
    isCategorical,
    selectedDensityRange,
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
    selectedCategoryValue,
    setSelectedCategoryValue,
    densityCurve,
    summary,
    selectedDensityRange,
    handleDensitySelectionChange,
    showRankContext,
    rankContextOptions,
    selectedRankContext,
    setSelectedRankContext,
    summaryRanks,
    summaryComparisons,
    locationFilterActive,
    pinnedCategoryValue,
    pinnedUnobservedCategory,
    pinnedClassName,
    pinnedValue,
    pinnedLoading,
    pinnedNoData,
    selectedVariableMeta,
    isCircularVariable: isVariableCircular({
      id: selectedVariable ?? '',
      valueType: selectedVariableMeta?.valueType ?? null,
    }),
  };
}
