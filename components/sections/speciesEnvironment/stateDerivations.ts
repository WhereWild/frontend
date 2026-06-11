// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  SpeciesEnvironmentRelativeRank,
  SpeciesEnvironmentStats,
  SpeciesEnvironmentSummary,
} from '@/data/types';
import {
  estimatePercentileFromHistogram,
  formatComparisonLabel,
  formatValue,
  type DensitySelectionRange,
  type RankContextOption,
} from './model';

/** Builds rank-context options from available relative-rank payload labels. */
export const getRankContextOptions = (
  locationFilterActive: boolean,
  relativeRanks?: SpeciesEnvironmentRelativeRank[] | null,
): RankContextOption[] => {
  if (locationFilterActive || !relativeRanks || !relativeRanks.length) {
    return [];
  }

  const seen = new Map<string, string>();
  relativeRanks.forEach((entry) => {
    const label = entry.label ?? entry.context ?? null;
    if (!label || seen.has(label)) {
      return;
    }
    seen.set(label, label);
  });

  return Array.from(seen.entries())
    .map(([key, label]) => ({ key, label }))
    .reverse();
};

/** Inputs required to resolve rank metadata for one summary metric. */
type ResolveRankParams = {
  metric: string;
  value: number | null | undefined;
  stats: SpeciesEnvironmentStats | null;
  selectedRankContext: string | null;
  allowHistogramFallback?: boolean;
};

/** Resolves best rank entry for a metric, with optional histogram percentile fallback. */
export const resolveMetricRank = ({
  metric,
  value,
  stats,
  selectedRankContext,
  allowHistogramFallback,
}: ResolveRankParams): SpeciesEnvironmentRelativeRank | null => {
  const fallbackEnabled =
    allowHistogramFallback ??
    ['min', 'mean', 'max'].includes(metric.toLowerCase());

  if (!stats) {
    return null;
  }

  const normalizedMetric = metric.toLowerCase();
  const rawCandidates =
    stats.relativeRanks?.filter(
      (entry) => entry.metric?.toLowerCase?.() === normalizedMetric,
    ) ?? [];
  const filteredCandidates = selectedRankContext
    ? rawCandidates.filter(
        (entry) => (entry.label ?? entry.context ?? '') === selectedRankContext,
      )
    : rawCandidates;
  const prioritized = filteredCandidates.length
    ? filteredCandidates
    : rawCandidates;

  if (prioritized.length) {
    return (
      prioritized
        .filter(
          (entry) =>
            typeof entry.rank === 'number' ||
            typeof entry.percentile === 'number',
        )
        .sort((left, right) => (right.count ?? 0) - (left.count ?? 0))[0] ??
      null
    );
  }

  if (!fallbackEnabled) {
    return null;
  }

  const fallbackPercentile = estimatePercentileFromHistogram(
    stats.histogram ?? null,
    value,
  );
  if (fallbackPercentile === null) {
    return null;
  }

  return {
    metric,
    percentile: fallbackPercentile,
    label: 'Distribution',
  };
};

/** Produces baseline comparison labels when location filtering is active. */
export const buildSummaryComparisons = (
  locationFilterActive: boolean,
  summary: SpeciesEnvironmentSummary | null | undefined,
  baselineSummary: SpeciesEnvironmentSummary | null,
  summaryRangeValue: number | null,
  baselineRangeValue: number | null,
): Record<string, string | null> => {
  const empty: Record<string, string | null> = {
    min: null,
    mean: null,
    max: null,
    std: null,
    range99: null,
    circular_mean: null,
    rbar: null,
    circular_std: null,
    entropy: null,
    unique_classes: null,
  };
  if (!locationFilterActive) return empty;

  const fcl = (
    curr: number | null | undefined,
    base: number | null | undefined,
    digits = 1,
    unit = '',
  ) => formatComparisonLabel(curr, base, digits, unit);

  return {
    min: fcl(summary?.min, baselineSummary?.min),
    mean: fcl(summary?.mean, baselineSummary?.mean),
    max: fcl(summary?.max, baselineSummary?.max),
    std: fcl(summary?.stddev, baselineSummary?.stddev),
    range99: fcl(summaryRangeValue, baselineRangeValue),
    circular_mean: fcl(
      summary?.circular_mean,
      baselineSummary?.circular_mean,
      1,
      '°',
    ),
    rbar: fcl(summary?.rbar, baselineSummary?.rbar, 3),
    circular_std: fcl(
      summary?.circular_std,
      baselineSummary?.circular_std,
      1,
      '°',
    ),
    entropy: fcl(summary?.entropy, baselineSummary?.entropy, 3),
    unique_classes:
      typeof summary?.unique_classes === 'number' &&
      typeof baselineSummary?.unique_classes === 'number'
        ? `vs. ${Math.round(baselineSummary.unique_classes)} globally`
        : null,
  };
};

/** Inputs used to derive the section metadata text line. */
type BuildMetaTextParams = {
  hasStats: boolean;
  isCategorical: boolean;
  isCircular: boolean;
  selectedDensityRange: DensitySelectionRange | null;
  rangeObservationCount: number;
  observationCount: number | null | undefined;
  summaryCount: number | null | undefined;
  categoricalTotalSamples: number | null | undefined;
};

/** Builds heading text from resolved variable name and units. */
export const buildHeadingText = (
  hasStats: boolean,
  variableName: string | null | undefined,
  fallbackLabel: string | null | undefined,
  isCategorical: boolean,
  units: string | null | undefined,
) => {
  if (!hasStats) {
    return null;
  }

  const resolvedName = variableName ?? fallbackLabel ?? 'Environment';
  const unitsSuffix = !isCategorical && units ? ` (${units})` : '';
  return `${resolvedName}${unitsSuffix}`;
};

/** Builds metadata copy for selected range or total observation counts. */
export const buildMetaText = ({
  hasStats,
  isCategorical,
  isCircular,
  selectedDensityRange,
  rangeObservationCount,
  observationCount,
  summaryCount,
  categoricalTotalSamples,
}: BuildMetaTextParams) => {
  if (!hasStats) {
    return null;
  }

  const resolvedObservationCount = isCategorical
    ? (categoricalTotalSamples ?? observationCount ?? summaryCount ?? 0)
    : (observationCount ?? summaryCount ?? 0);

  if (!isCategorical && selectedDensityRange) {
    const dispStart =
      selectedDensityRange.displayStart ?? selectedDensityRange.start;
    const dispEnd = selectedDensityRange.displayEnd ?? selectedDensityRange.end;

    const isFullCircle = isCircular && (dispEnd - dispStart + 360) % 360 >= 359;
    const rangeLabel = isFullCircle
      ? 'Full circle'
      : `${formatValue(dispStart, 1)} to ${formatValue(dispEnd, 1)}`;

    return `Selected range: ${rangeLabel} (${rangeObservationCount} of ${formatValue(resolvedObservationCount)} observations)`;
  }

  return `(Based on ${formatValue(resolvedObservationCount)} observations)`;
};

/** Resolves 1st-to-99th percentile span from summary quantiles. */
export const resolveRangeValue = (
  summary: SpeciesEnvironmentSummary | null | undefined,
) => {
  if (typeof summary?.q01 !== 'number' || typeof summary?.q99 !== 'number') {
    return null;
  }

  return summary.q99 - summary.q01;
};
