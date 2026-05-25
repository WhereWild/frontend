import type {
  SpeciesEnvironmentBinSample,
  SpeciesEnvironmentCategory,
  SpeciesEnvironmentCategorySampleResponse,
  SpeciesEnvironmentCategorySamples,
  SpeciesEnvironmentCategoricalTotals,
  SpeciesEnvironmentDensity,
  SpeciesEnvironmentHistogram,
  SpeciesEnvironmentObservation,
  SpeciesEnvironmentRelativeRank,
  SpeciesEnvironmentSliceResponse,
  SpeciesEnvironmentStats,
  SpeciesEnvironmentSummary,
} from '../../types';
import { asRecord, getArray, type JsonRecord } from '../core';

const toScalarIds = (value: unknown): (number | string)[] =>
  getArray(value).filter((item): item is number | string =>
    typeof item === 'number' || typeof item === 'string',
  );

const toScalarValue = (value: unknown): number | string => {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  return Number(value ?? NaN);
};

const pickScalarIds = (source: JsonRecord, snakeKey: string, camelKey: string) => {
  const snake = toScalarIds(source[snakeKey]);
  return snake.length ? snake : toScalarIds(source[camelKey]);
};

const toNumericArray = (value: unknown): number[] =>
  getArray(value)
    .map(toFiniteNumber)
    .filter((num): num is number => typeof num === 'number');

/**
 * Converts unknown input to a finite number when possible.
 */
export const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
};

const coerceEnvironmentSummary = (
  value: JsonRecord | undefined,
): SpeciesEnvironmentSummary => ({
  count: typeof value?.count === 'number' ? value.count : 0,
  min: toFiniteNumber(value?.min),
  mean: toFiniteNumber(value?.mean),
  max: toFiniteNumber(value?.max),
  stddev: toFiniteNumber(value?.stddev),
  q01: toFiniteNumber(value?.q01),
  q10: toFiniteNumber(value?.q10),
  q90: toFiniteNumber(value?.q90),
  q99: toFiniteNumber(value?.q99),
  circular_mean: toFiniteNumber(value?.circular_mean),
  rbar: toFiniteNumber(value?.rbar),
  circular_std: toFiniteNumber(value?.circular_std),
  unique_classes: toFiniteNumber(value?.unique_classes),
  entropy: toFiniteNumber(value?.entropy),
  mode:
    typeof value?.mode === 'number'
      ? value.mode
      : typeof value?.mode === 'string'
        ? value.mode
        : null,
});

const coerceHistogram = (
  value: JsonRecord | undefined,
): SpeciesEnvironmentHistogram | null => {
  if (!value) {
    return null;
  }
  const bins = Array.isArray(value.bins)
    ? value.bins.map(toFiniteNumber).filter((num): num is number => typeof num === 'number')
    : [];
  const counts = Array.isArray(value.counts)
    ? value.counts.map(toFiniteNumber).filter((num): num is number => typeof num === 'number')
    : [];
  if (!bins.length || !counts.length) {
    return null;
  }
  return { bins, counts };
};

const coerceBinSamples = (value: unknown): SpeciesEnvironmentBinSample[] => {
  return getArray(value)
    .map((entry) => {
      const source = asRecord(entry);
      return {
        index:
          typeof source?.index === 'number' ? source.index : Number(source?.index ?? -1),
        observationIds: pickScalarIds(source, 'observation_ids', 'observationIds'),
      };
    })
    .filter((entry) => Number.isFinite(entry.index) && entry.index >= 0);
};

const coerceCategories = (value: unknown): SpeciesEnvironmentCategory[] => {
  return getArray(value)
    .map((entry) => {
      const source = asRecord(entry);
      return {
        value: toScalarValue(source?.value),
        className:
          (typeof source?.class_name === 'string' ? source.class_name : undefined) ??
          (typeof source?.className === 'string' ? source.className : undefined) ??
          String(source?.value ?? ''),
        description: typeof source?.description === 'string' ? source.description : null,
        color: typeof source?.color === 'string' ? source.color : null,
        count:
          typeof source?.count === 'number' ? source.count : Number(source?.count ?? 0),
        fraction:
          typeof source?.fraction === 'number' ? source.fraction : Number(source?.fraction ?? 0),
      };
    })
    .filter((entry) => entry.className.length > 0);
};

const coerceCategorySamples = (value: unknown): SpeciesEnvironmentCategorySamples[] => {
  return getArray(value)
    .map((entry) => {
      const source = asRecord(entry);
      return {
        value: toScalarValue(source?.value),
        observationIds: pickScalarIds(source, 'observation_ids', 'observationIds'),
      };
    })
    .filter((entry) => entry.observationIds.length > 0);
};

const coerceCategoricalTotals = (value: unknown): SpeciesEnvironmentCategoricalTotals | null => {
  const source = asRecord(value);
  const totalSamples = toFiniteNumber(source.total_samples ?? source.totalSamples);
  const uniqueClasses = toFiniteNumber(source.unique_classes ?? source.uniqueClasses);
  const significantUniqueClasses = toFiniteNumber(
    source.significant_unique_classes ?? source.significantUniqueClasses,
  );
  return {
    totalSamples: totalSamples ?? undefined,
    uniqueClasses: uniqueClasses ?? undefined,
    significantUniqueClasses: significantUniqueClasses ?? undefined,
  };
};

const capitalize = (word: string) =>
  word.length ? word[0].toUpperCase() + word.slice(1) : '';

const labelFromSlug = (slug: string) =>
  slug
    .split('_')
    .filter(Boolean)
    .map(capitalize)
    .join(' ');

const buildCategoriesFromTallStats = (
  value: unknown,
  variableId: string,
): {
  distribution: SpeciesEnvironmentCategory[];
  dominant: SpeciesEnvironmentCategory[];
  totals: { totalSamples?: number; uniqueClasses?: number; significantClasses?: number };
} | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const variable = variableId?.toLowerCase?.() ?? '';
  const filtered = value.filter((entry) => {
    const source = asRecord(entry);
    if (!source?.variable) {
      return true;
    }
    return String(source.variable).toLowerCase() === variable;
  });
  if (!filtered.length) {
    return null;
  }
  let totalSamples: number | undefined;
  let uniqueClasses: number | undefined;
  let significantClasses: number | undefined;
  const categories: SpeciesEnvironmentCategory[] = [];
  filtered.forEach((entry) => {
    const source = asRecord(entry);
    const metric = String(source?.metric ?? '').trim();
    const rawValue =
      typeof source?.value === 'number' ? source.value : Number(source?.value ?? NaN);
    if (!metric.length) {
      return;
    }
    if (metric === 'total_samples') {
      if (Number.isFinite(rawValue)) {
        totalSamples = rawValue;
      }
      return;
    }
    if (metric === 'unique_classes') {
      if (Number.isFinite(rawValue)) {
        uniqueClasses = rawValue;
      }
      return;
    }
    if (metric === 'significant_unique_classes') {
      if (Number.isFinite(rawValue)) {
        significantClasses = rawValue;
      }
      return;
    }
    if (!Number.isFinite(rawValue)) {
      return;
    }
    const fraction = Number(rawValue);
    const count = typeof totalSamples === 'number' ? Math.round(totalSamples * fraction) : fraction;
    categories.push({
      value: metric,
      className: labelFromSlug(metric),
      description: null,
      count,
      fraction,
    });
  });
  categories.sort((a, b) => b.fraction - a.fraction);
  const dominant = categories.slice(0, Math.min(5, categories.length));
  return {
    distribution: categories,
    dominant,
    totals: { totalSamples, uniqueClasses, significantClasses },
  };
};

const normalizeRelativeRank = (
  metric: string,
  entry: unknown,
  overrides?: Partial<SpeciesEnvironmentRelativeRank>,
): SpeciesEnvironmentRelativeRank => {
  const source = asRecord(entry);
  return {
    metric,
    label:
      (typeof source?.label === 'string' ? source.label : undefined) ??
      (typeof source?.name === 'string' ? source.name : undefined) ??
      overrides?.label ??
      null,
    rank: toFiniteNumber(
      typeof source?.position === 'number' ? source.position : source?.rank,
    ),
    count: toFiniteNumber(source?.count),
    percentile: toFiniteNumber(source?.percentile),
    context:
      (typeof source?.context === 'string' ? source.context : undefined) ??
      (typeof source?.context_label === 'string' ? source.context_label : undefined) ??
      (typeof source?.ancestor_name === 'string' ? source.ancestor_name : undefined) ??
      overrides?.context ??
      null,
  };
};

const coerceRelativeRanksFromArray = (
  entries: unknown[],
  metricFallback = '',
): SpeciesEnvironmentRelativeRank[] => {
  return entries
    .map((entry) => {
      const source = asRecord(entry);
      return normalizeRelativeRank(String(source?.metric ?? metricFallback), entry);
    })
    .filter((entry) => entry.metric.length > 0);
};

const coerceRelativeRanksFromLayers = (
  key: string,
  raw: JsonRecord,
): SpeciesEnvironmentRelativeRank[] => {
  const layers = asRecord(raw.layers);

  const fallbackContext =
    (typeof raw.ancestor_name === 'string' ? raw.ancestor_name : undefined) ?? key;

  return Object.entries(layers).flatMap(([layer, metrics]) => {
    const metricsRecord = asRecord(metrics);
    return Object.entries(metricsRecord).map(([metric, record]) =>
      normalizeRelativeRank(metric, record, {
        label: layer,
        context: fallbackContext,
      }),
    );
  });
};

const coerceRelativeRanks = (value: unknown): SpeciesEnvironmentRelativeRank[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return coerceRelativeRanksFromArray(value);
  }

  const source = asRecord(value);

  return Object.entries(source).flatMap(([key, raw]) => {
    if (Array.isArray(raw)) {
      return coerceRelativeRanksFromArray(raw, key);
    }

    const rawRecord = asRecord(raw);
    const layeredRanks = coerceRelativeRanksFromLayers(key, rawRecord);
    return layeredRanks.length ? layeredRanks : [normalizeRelativeRank(key, rawRecord)];
  });
};

/**
 * Normalizes one observation row from mixed backend key formats.
 */
export const normalizeObservationEntry = (entry: unknown): SpeciesEnvironmentObservation => {
  const source = asRecord(entry);
  const rawCatalog = source?.catalogNumber ?? source?.catalog_number ?? source?.catalog ?? source?.id;
  const catalogNumber =
    typeof rawCatalog === 'number' || typeof rawCatalog === 'string' ? String(rawCatalog) : '';
  return {
    catalogNumber,
    value: toFiniteNumber(source?.value),
    latitude: toFiniteNumber(source?.latitude),
    longitude: toFiniteNumber(source?.longitude),
  };
};

const coerceDensityCurve = (payload: unknown): SpeciesEnvironmentDensity | null => {
  const source = asRecord(payload);
  const densityCurve = asRecord(source?.densityCurve);
  const densityCurveSnake = asRecord(source?.density_curve);
  if (!Array.isArray(densityCurve?.points ?? densityCurveSnake?.points)) {
    return null;
  }
  return {
    points: toNumericArray(densityCurve?.points ?? densityCurveSnake?.points),
    density: toNumericArray(densityCurve?.density ?? densityCurveSnake?.density),
  };
};

/**
 * Parses species environment stats payloads into app-safe shapes.
 */
export const parseSpeciesEnvironmentStats = (
  payload: unknown,
  taxonId: string | number,
  variableId: string,
): SpeciesEnvironmentStats => {
  const source = asRecord(payload);
  const variableMetadata = asRecord(source.variable_metadata);
  const summary = coerceEnvironmentSummary(asRecord(source.summary));
  const baselineSummary = source.baseline_summary || source.baselineSummary
    ? coerceEnvironmentSummary(
      asRecord(source.baseline_summary ?? source.baselineSummary),
    )
    : null;
  const tallStats = buildCategoriesFromTallStats(source.categorical_stats, variableId);
  if ((summary.count === 0 || !Number.isFinite(summary.count)) && tallStats?.totals.totalSamples) {
    summary.count = tallStats.totals.totalSamples;
  }
  const observationCount =
    toFiniteNumber(source.observation_count ?? source.observationCount) ??
    (tallStats?.totals.totalSamples ?? summary.count);
  const distribution = coerceCategories(source.categorical_distribution);
  const dominant = coerceCategories(source.dominant_categories);
  const baselineCategoricalDistribution = coerceCategories(
    source.baseline_categorical_distribution ?? source.baselineCategoricalDistribution,
  );
  const baselineCategoricalTotals = coerceCategoricalTotals(
    source.baseline_categorical_totals ?? source.baselineCategoricalTotals,
  );

  return {
    speciesId: toFiniteNumber(source.species_id) ?? Number(taxonId),
    variable: typeof source.variable === 'string' ? source.variable : variableId,
    allObscured: source.all_obscured === true || source.allObscured === true,
    variableName:
      (typeof variableMetadata?.name === 'string' ? variableMetadata.name : undefined) ??
      (typeof source.variable === 'string' ? source.variable : variableId),
    units: typeof variableMetadata?.units === 'string' ? variableMetadata.units : null,
    variableType:
      (typeof variableMetadata?.value_type === 'string' ? variableMetadata.value_type : undefined) ??
      (typeof variableMetadata?.valueType === 'string' ? variableMetadata.valueType : undefined) ??
      null,
    generatedAt: typeof source.generated_at === 'string' ? source.generated_at : undefined,
    observationCount: observationCount ?? undefined,
    summary,
    histogram: coerceHistogram(asRecord(source.histogram)),
    densityCurve: coerceDensityCurve(source),
    binSamples: coerceBinSamples(source.bin_samples),
    categoricalDistribution: distribution.length ? distribution : tallStats?.distribution ?? [],
    dominantCategories: dominant.length ? dominant : tallStats?.dominant ?? [],
    categoricalSamples: coerceCategorySamples(source.categorical_samples),
    relativeRanks: coerceRelativeRanks(
      source.relative_ranks ?? source.relative_rankings ?? source.rankings,
    ),
    baselineSummary,
    baselineCategoricalDistribution,
    baselineCategoricalTotals,
  };
};

/**
 * Parses numeric slice payloads for range-based observation queries.
 */
export const parseEnvironmentSliceResponse = (
  payload: unknown,
  params: { taxonId: number | string; variableId: string; min: number; max: number; limit?: number },
): SpeciesEnvironmentSliceResponse => {
  const source = asRecord(payload);
  const range = asRecord(source.range);
  const observations = getArray(source.observations).map(normalizeObservationEntry);
  return {
    speciesId: toFiniteNumber(source.speciesId) ?? Number(params.taxonId),
    variable: typeof source.variable === 'string' ? source.variable : params.variableId,
    range: {
      min: typeof range?.min === 'number' ? range.min : params.min,
      max: typeof range?.max === 'number' ? range.max : params.max,
    },
    limit: typeof source.limit === 'number' ? source.limit : params.limit ?? null,
    count: typeof source.count === 'number' ? source.count : observations.length,
    observations,
  };
};

/**
 * Parses categorical class sample payloads.
 */
export const parseEnvironmentCategorySampleResponse = (
  payload: unknown,
  params: { taxonId: number | string; variableId: string; classValue: string | number },
): SpeciesEnvironmentCategorySampleResponse => {
  const source = asRecord(payload);
  const observations = getArray(source.observations).map(normalizeObservationEntry);
  const classValue = source.classValue ?? source.class_value ?? params.classValue;
  return {
    speciesId:
      toFiniteNumber(source.speciesId) ??
      toFiniteNumber(source.species_id) ??
      Number(params.taxonId),
    variable: typeof source.variable === 'string' ? source.variable : params.variableId,
    classValue:
      typeof classValue === 'number' || typeof classValue === 'string'
        ? classValue
        : String(classValue),
    observations,
    count: typeof source.count === 'number' ? source.count : observations.length,
  };
};