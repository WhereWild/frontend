// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SelectOption } from '@/components';
import type { LegendClass } from '@/data/types';

export const FILTER_OPERATOR_OPTIONS: SelectOption[] = [
  { label: 'At least (≥)', value: 'gte' },
  { label: 'More than (>)', value: 'gt' },
  { label: 'At most (≤)', value: 'lte' },
  { label: 'Less than (<)', value: 'lt' },
  { label: 'Equal to (=)', value: 'eq' },
  { label: 'Not equal to (≠)', value: 'ne' },
];

// Mirrors config/config.py's METRICS_BY_TYPE tuples — kept as a small static
// duplication (same pattern already used for RANK_OPTIONS/SORT_METRIC_OPTIONS
// elsewhere in this codebase) rather than a fetch, since the set is fixed by
// the stats pipeline, not per-taxon data.
const CONTINUOUS_METRICS = [
  'count',
  'unique_samples',
  'min',
  '10th_percentile',
  '25th_percentile',
  'median',
  '75th_percentile',
  '90th_percentile',
  'max',
  'mean',
  'std',
  'variance',
  'iqr',
  '10_90_range',
  'range',
  'entropy',
];

const NOMINAL_STAT_METRICS = [
  'unique_samples',
  'total_samples',
  'unique_classes',
  'entropy',
];

const ORDINAL_STAT_METRICS = [
  'count',
  'unique_samples',
  'total_samples',
  'unique_classes',
  'entropy',
  'mode',
  '10th_percentile',
  '25th_percentile',
  'median',
  '75th_percentile',
  '90th_percentile',
];

const CIRCULAR_METRICS = [
  'count',
  'unique_samples',
  'circular_mean',
  'rbar',
  'circular_var',
  'circular_std',
  'entropy',
  'mode',
];

const STAT_METRIC_LABELS: Record<string, string> = {
  mean: 'Average',
  median: 'Median',
  min: 'Minimum',
  max: 'Maximum',
  std: 'Standard deviation',
  variance: 'Variance',
  iqr: 'Interquartile range',
  '10_90_range': '10–90 range',
  range: 'Range',
  count: 'Sample count',
  unique_samples: 'Unique samples',
  total_samples: 'Total samples',
  unique_classes: 'Unique classes',
  entropy: 'Entropy',
  '10th_percentile': '10th percentile',
  '25th_percentile': '25th percentile',
  '75th_percentile': '75th percentile',
  '90th_percentile': '90th percentile',
  circular_mean: 'Directional mean',
  rbar: 'Concentration (R̄)',
  circular_std: 'Circular std. dev.',
  circular_var: 'Circular variance',
  mode: 'Mode',
};

export const toStatMetricLabel = (metric: string) =>
  STAT_METRIC_LABELS[metric] ??
  metric.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// The /variables endpoint reports value_type as "continuous" / "categorical" /
// "ordinal" / "circular" — a consumer-facing vocabulary distinct from (and
// collapsed relative to) the backend's internal ValueType enum (ratio/interval/
// nominal/ordinal/circular/aggregate). "continuous" covers both ratio and
// interval; "categorical" is what the backend calls nominal.
export const getStatMetricOptions = (
  valueType?: string | null,
): SelectOption[] => {
  const metrics = (() => {
    switch (valueType) {
      case 'continuous':
        return CONTINUOUS_METRICS;
      case 'categorical':
        return NOMINAL_STAT_METRICS;
      case 'ordinal':
        return ORDINAL_STAT_METRICS;
      case 'circular':
        return CIRCULAR_METRICS;
      default:
        return [];
    }
  })();

  return metrics.map((metric) => ({
    label: toStatMetricLabel(metric),
    value: metric,
  }));
};

export const supportsCategoryFilter = (valueType?: string | null) =>
  valueType === 'categorical' || valueType === 'ordinal';

export const toCategoryOptions = (
  legendClasses: LegendClass[] | null | undefined,
): SelectOption[] =>
  (legendClasses ?? [])
    .map((cls) => ({ label: cls.name, value: String(cls.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
