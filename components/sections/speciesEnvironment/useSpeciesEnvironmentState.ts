import type { SpeciesEnvironmentRelativeRank } from '@/data/types';
import React from 'react';
import {
  buildCategoricalSummary,
  EnvironmentVariableOption,
  formatValue,
  isVariableCategorical as isVariableCategoricalOption,
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
  units?: 'metric' | 'imperial' | undefined;
  pinnedObservation?: { catalogNumber: string; lat: number; lon: number } | null;
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
  const baselineSummary = locationFilterActive ? stats?.baselineSummary ?? null : null;
  const summary = stats?.summary;
  const categoricalDistribution = stats?.categoricalDistribution ?? [];

  const variableType =
    stats?.variableType?.toLowerCase?.() ?? selectedVariableMeta?.valueType?.toLowerCase?.() ?? null;
  const forcedCategorical = isVariableCategoricalOption({
    id: selectedVariable ?? '',
    valueType: null,
  });
  const isCategorical =
    forcedCategorical || variableType === 'categorical' || categoricalDistribution.length > 0;

  return {
    baselineSummary,
    summary,
    categoricalDistribution,
    isCategorical,
    densityCurve: isCategorical ? null : stats?.densityCurve ?? null,
  };
};

/** Composes selection, stats, ranking, and presentation state for SpeciesEnvironmentSection. */
export function useSpeciesEnvironmentState({
  taxonId,
  variableId,
  variables,
  onHighlightChange,
  locationGid,
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
  });

  const locationFilterActive = Boolean(locationGid);
  const { stats, error, loading } = useEnvironmentStats({
    taxonId,
    selectedVariable,
    locationGid,
    units,
  });

  const { baselineSummary, summary, categoricalDistribution, isCategorical, densityCurve } =
    React.useMemo(
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
    pinnedValue,
    pinnedLoading,
  } = useEnvironmentHighlights({
    taxonId,
    selectedVariable,
    stats,
    isCategorical,
    locationGid,
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

  const [selectedRankContextState, setSelectedRankContext] = React.useState<string | null>(null);

  const selectedRankContext = React.useMemo(() => {
    if (!rankContextOptions.length) {
      return null;
    }
    if (
      selectedRankContextState &&
      rankContextOptions.some((option) => option.key === selectedRankContextState)
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

  const summaryRanks = React.useMemo(
    () => ({
      min: resolveRankForMetric('min', summary?.min),
      mean: resolveRankForMetric('mean', summary?.mean),
      max: resolveRankForMetric('max', summary?.max),
      std: resolveRankForMetric('std', summary?.stddev, { allowHistogramFallback: false }),
      range99: resolveRankForMetric('1-99 range', summaryRangeValue, {
        allowHistogramFallback: false,
      }),
    }),
    [
      resolveRankForMetric,
      summary?.max,
      summary?.mean,
      summary?.min,
      summary?.stddev,
      summaryRangeValue,
    ],
  );

  const summaryComparisons = React.useMemo<Record<string, string | null>>(
    () =>
      buildSummaryComparisons(
        locationFilterActive,
        summary,
        baselineSummary,
        summaryRangeValue,
        baselineRangeValue,
      ),
    [baselineRangeValue, baselineSummary, locationFilterActive, summary, summaryRangeValue],
  );

  const categoricalSummary = React.useMemo(
    () => (isCategorical ? buildCategoricalSummary(categoricalDistribution, summary) : null),
    [categoricalDistribution, isCategorical, summary],
  );

  const showRankContext = !locationFilterActive && rankContextOptions.length > 0;

  const pinnedCategoryValue = React.useMemo(() => {
    if (!isCategorical || pinnedValue === null) {
      return null;
    }

    return (
      categoricalDistribution.find((category) => String(category.value) === String(pinnedValue))?.value ??
      null
    );
  }, [categoricalDistribution, isCategorical, pinnedValue]);

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
    pinnedValue,
    pinnedLoading,
  };
}
