// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  ExtraVariableFilter,
  LegendClass,
  SpeciesEnvironmentCategory,
  SpeciesEnvironmentCategoricalTotals,
  SpeciesEnvironmentHistogram,
  SpeciesEnvironmentObservation,
  SpeciesEnvironmentSummary,
} from '@/data/types';

const SIGNIFICANT_CATEGORY_THRESHOLD = 0.02;

/** Default variable shown when no variable is explicitly selected. */
export const DEFAULT_VARIABLE = 'bio_1';
/** Variables forced into categorical mode regardless of backend metadata. */
export const FORCED_CATEGORICAL_VARIABLES = new Set(['landcover']);

/** Selectable environment variable metadata used by the section UI. */
export type EnvironmentVariableOption = {
  id: string;
  label: string;
  units?: string | null;
  valueType?: string | null;
  domain?: string | null;
  category?: string | null;
  sourceIds?: string[];
  legendClasses?: LegendClass[] | null;
  renderMin?: number | null;
  renderMax?: number | null;
  group?: string | null;
  groupLabel?: string | null;
  version?: number | null;
  compositionGroup?: string | null;
  compositionAxis?: 'top' | 'bottom_left' | 'bottom_right' | null;
  compositionLabel?: string | null;
};

/** Loading/result state for one categorical class sample request. */
export type CategorySampleState = {
  observations: SpeciesEnvironmentObservation[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

export type PinnedCategoryBadge = {
  value: number | string;
  label: string;
  description?: string | null;
  color?: string | null;
};

/** Rank context option for switching ancestor-group comparisons. */
export type RankContextOption = {
  key: string;
  label: string;
};

/** Selected numeric range on density chart interactions. */
export type DensitySelectionRange = {
  start: number;
  end: number;
  /** Human-readable bounds for display (e.g. actual chunk edges for discrete bars). */
  displayStart?: number;
  displayEnd?: number;
};

/**
 * A slice/category selection that was active on a variable the user has
 * since switched away from, held onto as an additional filter chained onto
 * whatever variable is selected now (e.g. "elevation 500-1500m AND
 * landcover=Forest"). `label` is resolved once at the moment the selection
 * was made (from that variable's own stats), since by the time this entry
 * is displayed the stats prop may already reflect a different variable.
 */
export type ChainedVariableFilter = {
  variableId: string;
  isCategorical: boolean;
  extra: ExtraVariableFilter;
  /** Human-readable summary of the filter's value alone (e.g. "10-20" or "Forest") — the caller prepends the variable's own display name. */
  label: string;
  /** Original selection, kept so switching back to this variable can restore it as the live selection instead of just leaving it chained. */
  originalRange?: DensitySelectionRange;
  /** One or more selected classes (multi-select OR within this one variable, e.g. Forest + Grassland). */
  originalCategoryValues?: (number | string)[];
};

/** Fallback variable list used when remote catalog is unavailable. */
export const DEFAULT_VARIABLES: EnvironmentVariableOption[] = [
  { id: 'elevation', label: 'Elevation' },
  { id: 'annual_precip', label: 'Annual Precipitation' },
  { id: 'mean_temp_coldest_quarter', label: 'Mean Temp (Cold Qtr)' },
  { id: 'max_temp_warmest_month', label: 'Max Temp (Warmest Mo)' },
  { id: 'landcover', label: 'Land Cover', valueType: 'categorical' },
];

/** Returns true when variable should render with the polar (circular KDE) chart. */
export const isVariableCircular = (
  variable:
    | Pick<EnvironmentVariableOption, 'id' | 'valueType'>
    | null
    | undefined,
): boolean => {
  if (!variable) return false;
  if (variable.valueType?.toLowerCase() === 'circular') return true;
  if (variable.valueType?.toLowerCase() === 'categorical') return false;
  if (variable.valueType?.toLowerCase() === 'nominal') return false;
  if (variable.valueType?.toLowerCase() === 'ordinal') return false;
  const lower = variable.id.toLowerCase();
  return lower === 'aspect_deg' || lower === 'aspect';
};

/** Returns true when variable should render as a discrete histogram. */
export const isVariableDiscrete = (
  variable: Pick<EnvironmentVariableOption, 'domain'> | null | undefined,
): boolean => variable?.domain === 'discrete';

/** Returns true when variable should render with categorical UI. */
export const isVariableCategorical = (
  variable:
    | Pick<EnvironmentVariableOption, 'id' | 'valueType'>
    | null
    | undefined,
) => {
  if (!variable?.id) {
    return false;
  }
  if (isVariableCircular(variable)) {
    return false;
  }
  const forcedCategorical = FORCED_CATEGORICAL_VARIABLES.has(
    variable.id.toLowerCase(),
  );
  if (forcedCategorical) {
    return true;
  }
  const vt = variable.valueType?.toLowerCase();
  return vt === 'categorical' || vt === 'nominal' || vt === 'ordinal';
};

/** For a variable that's the classifier/legend for a ternary compositional
 * group (e.g. soil_texture summarizing sand/silt/clay), finds that group's 3
 * member variables among the full variable catalog and returns their short
 * corner labels (compositionLabel, e.g. "Sand" — falling back to the full
 * `label` if a compositional variable doesn't supply one, e.g. "Sand Content
 * (0–5cm)" is too long for a triangle corner) in [top, bottom-left,
 * bottom-right] triangle order — driven entirely by catalog
 * compositionGroup/compositionAxis metadata, no hardcoded variable ids or
 * names. Returns null if the variable isn't a composition anchor, or its
 * group doesn't have all 3 axes represented in `allVariables`. */
export const getCompositionAxisLabels = (
  selected:
    | Pick<EnvironmentVariableOption, 'compositionGroup'>
    | null
    | undefined,
  allVariables: Pick<
    EnvironmentVariableOption,
    'label' | 'compositionGroup' | 'compositionAxis' | 'compositionLabel'
  >[],
): [string, string, string] | null => {
  const group = selected?.compositionGroup;
  if (!group) return null;
  const byAxis: Partial<
    Record<'top' | 'bottom_left' | 'bottom_right', string>
  > = {};
  for (const variable of allVariables) {
    if (variable.compositionGroup === group && variable.compositionAxis) {
      byAxis[variable.compositionAxis] =
        variable.compositionLabel ?? variable.label;
    }
  }
  if (!byAxis.top || !byAxis.bottom_left || !byAxis.bottom_right) return null;
  return [byAxis.top, byAxis.bottom_left, byAxis.bottom_right];
};

/** Converts underscore-separated variable ids into title-cased labels. */
export const normalizeLabel = (value: string) =>
  value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

/** Formats numeric values with a fixed number of fraction digits. */
export const formatValue = (value: number | null | undefined, digits = 0) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

/** Joins class names as a natural-language list ("A", "A; and B", "A; B; and
 * C") — always semicolon-separated (even for exactly two items, for
 * consistency) rather than comma-separated, since class names (e.g.
 * Köppen-Geiger classes like "Continental, dry summer warm") routinely
 * contain commas of their own. */
export const joinClassNamesWithAnd = (names: string[]): string => {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join('; ')}; and ${names[names.length - 1]}`;
};

/** Formats a category fraction for display as a rounded percentage. */
export const formatCategoryPercent = (fraction: number) => {
  if (!Number.isFinite(fraction)) {
    return '0%';
  }
  if (fraction * 100 < 1) {
    return '<1%';
  }
  const num = Math.round(fraction * 100);
  return `${num}%`;
};

/** Returns English ordinal suffix for a positive integer. */
export const getOrdinalSuffix = (num: number) => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
};

/** Formats percentile fraction as an ordinal percentage label. */
export const formatPercent = (fraction: number) => {
  if (!Number.isFinite(fraction)) {
    return '0.0th';
  }
  if (fraction * 100 < 1) {
    return '<1st';
  }
  const num = Math.round(fraction * 100);
  return num + getOrdinalSuffix(num);
};

/** Builds baseline comparison copy for one summary metric. */
export const formatComparisonLabel = (
  current: number | null | undefined,
  baseline: number | null | undefined,
  digits = 1,
  unit = '',
) => {
  if (typeof current !== 'number' || typeof baseline !== 'number') {
    return null;
  }
  return `vs. ${formatValue(baseline, digits)}${unit} globally`;
};

/** Computes summary statistics for categorical distributions. */
export const buildCategoricalSummary = (
  distribution: SpeciesEnvironmentCategory[],
  summary?: SpeciesEnvironmentSummary | null,
  totals?: SpeciesEnvironmentCategoricalTotals | null,
) => {
  const totalSamples =
    totals?.totalSamples ??
    (typeof summary?.count === 'number' && summary.count > 0
      ? summary.count
      : distribution.reduce((sum, entry) => sum + (entry.count || 0), 0));
  const uniqueClasses = totals?.uniqueClasses ?? distribution.length;
  const significantClasses =
    totals?.significantUniqueClasses ??
    (distribution.length
      ? distribution.filter(
          (entry) => entry.fraction >= SIGNIFICANT_CATEGORY_THRESHOLD,
        ).length
      : 0);
  const dominant =
    distribution.length > 0
      ? distribution
          .slice()
          .sort((a, b) => (b.fraction ?? 0) - (a.fraction ?? 0))[0]
      : null;
  return {
    totalSamples,
    uniqueClasses,
    significantClasses,
    dominant,
  };
};

/** Estimates percentile position for a value using histogram bins/counts. */
export const estimatePercentileFromHistogram = (
  histogram: SpeciesEnvironmentHistogram | null,
  target: number | null | undefined,
): number | null => {
  if (!histogram || typeof target !== 'number' || !Number.isFinite(target)) {
    return null;
  }
  if (!isValidHistogramContract(histogram)) {
    return null;
  }

  const { bins, counts } = histogram;
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) {
    return null;
  }

  let cumulative = 0;
  for (let index = 0; index < counts.length; index += 1) {
    const start = bins[index];
    const end = bins[index + 1];
    if (target >= end) {
      cumulative += counts[index];
      continue;
    }
    if (target <= start) {
      break;
    }
    const span = end - start;
    const fraction = Math.max(0, Math.min(1, (target - start) / span));
    cumulative += counts[index] * fraction;
    break;
  }
  return Math.min(1, Math.max(0, cumulative / total));
};

/** Validates histogram contract used by chart and percentile helpers. */
export const isValidHistogramContract = (
  histogram: SpeciesEnvironmentHistogram | null | undefined,
) => {
  if (!histogram) {
    return false;
  }
  const { bins, counts } = histogram;
  if (bins.length < 2 || !counts.length) {
    return false;
  }
  if (bins.length !== counts.length + 1) {
    return false;
  }
  if (!bins.every((value) => Number.isFinite(value))) {
    return false;
  }
  if (!counts.every((value) => Number.isFinite(value) && value >= 0)) {
    return false;
  }
  for (let index = 1; index < bins.length; index += 1) {
    if (bins[index] <= bins[index - 1]) {
      return false;
    }
  }
  return true;
};
