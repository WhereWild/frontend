// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  EnvironmentVariableDefinition,
  ExtraVariableFilter,
  LegendClass,
  SpeciesEnvironmentCategory,
  SpeciesEnvironmentCategoricalTotals,
  SpeciesEnvironmentHistogram,
  SpeciesEnvironmentObservation,
  SpeciesEnvironmentSummary,
} from '@/data/types';
import { parseTemporalId, stripTemporalSuffix } from './temporalHelpers';

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
  /** One or more selected ranges (multi-select OR within this one variable, e.g. two disjoint histogram/KDE slices), kept so switching back to this variable can restore them as the live selection instead of just leaving them chained. */
  originalRanges?: DensitySelectionRange[];
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

/** Resolves the "family" key that unifies a variable's temporal-window
 * and/or grouped-agg variants (e.g. weather_code_simple_mode_24h/_168h, or
 * vpdmin/vpdmean/vpdmax/vpdrange) into one conceptual variable — same
 * priority order as useVariableGroupSelection's baseVariableOptions. */
export const getVariableFamilyKey = (
  variable: Pick<EnvironmentVariableDefinition, 'id' | 'group' | 'agg'>,
): string => {
  const parsed = parseTemporalId(variable.id);
  if (parsed) return parsed.baseId;
  if (variable.group && variable.agg) return variable.group;
  return variable.id;
};

/** Groups a flat variable list by family key (see getVariableFamilyKey). */
export const groupVariablesByFamily = (
  variables: EnvironmentVariableDefinition[],
): Map<string, EnvironmentVariableDefinition[]> => {
  const groups = new Map<string, EnvironmentVariableDefinition[]>();
  for (const variable of variables) {
    const key = getVariableFamilyKey(variable);
    const existing = groups.get(key) ?? [];
    existing.push(variable);
    groups.set(key, existing);
  }
  return groups;
};

/** Picks the variant a multi-variant family's shared stats/legend/sources
 * are sourced from — the "mean" agg for grouped families, else the
 * shortest temporal window, else whichever variant came first. */
export const pickFamilyRepresentative = (
  variants: EnvironmentVariableDefinition[],
): EnvironmentVariableDefinition => {
  const meanVariant = variants.find((v) => v.agg === 'mean');
  if (meanVariant) return meanVariant;
  const shortestWindow = variants
    .map((v) => ({ v, parsed: parseTemporalId(v.id) }))
    .filter(
      (
        entry,
      ): entry is {
        v: EnvironmentVariableDefinition;
        parsed: NonNullable<ReturnType<typeof parseTemporalId>>;
      } => entry.parsed !== null,
    )
    .sort((a, b) => a.parsed.windowHours - b.parsed.windowHours)[0];
  return shortestWindow?.v ?? variants[0];
};

/** Simplified display label for a variable family — strips the temporal
 * agg/window suffix, or falls back to the shared group label. */
export const getFamilyLabel = (
  representative: EnvironmentVariableDefinition,
  familyKey: string,
): string => {
  if (parseTemporalId(representative.id)) {
    return stripTemporalSuffix(
      representative.name ?? normalizeLabel(familyKey),
    );
  }
  if (representative.group && representative.agg) {
    return (
      representative.groupLabel ??
      representative.name ??
      normalizeLabel(familyKey)
    );
  }
  return representative.name ?? normalizeLabel(familyKey);
};

/** Human-readable API id (or id pattern) for a variable family — a single
 * real id when there's only one variant, a `{baseId}_{agg}_{window}h`
 * template plus the actual windows present for a temporal family (rather
 * than just one arbitrarily-picked variant's id), or a comma-separated list
 * of the real ids for a grouped family (vpdmin/vpdmean/vpdmax/vpdrange —
 * no shared template to derive one from). */
export const getApiIdDisplay = (
  variants: EnvironmentVariableDefinition[],
): string => {
  if (variants.length <= 1) return variants[0]?.id ?? '';

  const parsedVariants = variants
    .map((v) => ({ v, parsed: parseTemporalId(v.id) }))
    .filter(
      (
        entry,
      ): entry is {
        v: EnvironmentVariableDefinition;
        parsed: NonNullable<ReturnType<typeof parseTemporalId>>;
      } => entry.parsed !== null,
    );
  if (parsedVariants.length === variants.length) {
    const { baseId, agg } = parsedVariants[0].parsed;
    const windows = parsedVariants
      .map((entry) => entry.parsed.windowHours)
      .sort((a, b) => a - b)
      .map((hours) => `${hours}`)
      .join(', ');
    return `${baseId}_${agg}_{window}h (windows: ${windows})`;
  }

  return variants.map((v) => v.id).join(', ');
};

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
