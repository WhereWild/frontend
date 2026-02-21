import type {
  EnvironmentVariableDefinition,
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
} from './types';

type JsonRecord = Record<string, unknown>;

/** Coerces an unknown value into a plain key-value record when possible. */
const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === 'object' ? (value as JsonRecord) : null;

/** Returns the input only when it is an array; otherwise returns an empty array. */
const getArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Normalizes scalar identifier arrays to number/string values only. */
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

/** Converts an unknown list into finite numeric values. */
const toNumericArray = (value: unknown): number[] =>
  getArray(value)
    .map(toFiniteNumber)
    .filter((num): num is number => typeof num === 'number');

/** Converts unknown input into a finite number, or null when coercion fails. */
export const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
};

/** Coerces API variable metadata into the app's environment variable definition shape. */
const toVariableDefinition = (entry: unknown): EnvironmentVariableDefinition => {
  const source = asRecord(entry);
  return {
    id: String(source?.id ?? ''),
    name: typeof source?.name === 'string' ? source.name : undefined,
    units: typeof source?.units === 'string' ? source.units : null,
    description: typeof source?.description === 'string' ? source.description : undefined,
    valueType:
      typeof source?.value_type === 'string'
        ? source.value_type
        : typeof source?.valueType === 'string'
          ? source.valueType
          : null,
    category: typeof source?.category === 'string' ? source.category : null,
  };
};

/** Coerces summary statistics into a complete, null-safe summary object. */
const coerceEnvironmentSummary = (
  value: Partial<SpeciesEnvironmentSummary> | undefined,
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
});

/** Coerces histogram payloads when both bins and counts are available. */
const coerceHistogram = (
  value: Partial<SpeciesEnvironmentHistogram> | undefined,
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

/** Coerces per-bin observation samples from mixed API payload shapes. */
const coerceBinSamples = (value: unknown): SpeciesEnvironmentBinSample[] => {
  return getArray(value)
    .map((entry) => {
      const source = asRecord(entry);
      return {
        index:
          typeof source?.index === 'number' ? source.index : Number(source?.index ?? -1),
        observationIds: source ? pickScalarIds(source, 'observation_ids', 'observationIds') : [],
      };
    })
    .filter((entry) => Number.isFinite(entry.index) && entry.index >= 0);
};

/** Coerces categorical distribution entries into normalized category objects. */
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

/** Coerces observation IDs grouped by category value. */
const coerceCategorySamples = (value: unknown): SpeciesEnvironmentCategorySamples[] => {
  return getArray(value)
    .map((entry) => {
      const source = asRecord(entry);
      return {
        value: toScalarValue(source?.value),
        observationIds: source ? pickScalarIds(source, 'observation_ids', 'observationIds') : [],
      };
    })
    .filter((entry) => entry.observationIds.length > 0);
};

/** Coerces aggregate categorical totals from snake_case or camelCase payload fields. */
const coerceCategoricalTotals = (value: unknown): SpeciesEnvironmentCategoricalTotals | null => {
  const source = asRecord(value);
  if (!source) {
    return null;
  }
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

/**
 * Builds category distributions from tall categorical metric rows.
 *
 * Supports payloads where each row represents a metric/value pair and filters rows
 * by the target variable when present.
 */
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

/**
 * Normalizes one relative-rank entry into a strongly typed rank record.
 *
 * Optional overrides support nested payloads where metric labels and context are
 * carried by parent objects.
 */
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

/** Parses rank lists where each item may include an explicit `metric` field. */
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

/**
 * Parses layered rank payloads of the form `{ layers: { [layer]: { [metric]: rank } } }`.
 */
const coerceRelativeRanksFromLayers = (
  key: string,
  raw: JsonRecord,
): SpeciesEnvironmentRelativeRank[] => {
  const layers = asRecord(raw.layers);
  if (!layers) {
    return [];
  }

  const fallbackContext =
    (typeof raw.ancestor_name === 'string' ? raw.ancestor_name : undefined) ?? key;

  return Object.entries(layers).flatMap(([layer, metrics]) => {
    const metricsRecord = asRecord(metrics);
    if (!metricsRecord) {
      return [];
    }
    return Object.entries(metricsRecord).map(([metric, record]) =>
      normalizeRelativeRank(metric, record, {
        label: layer,
        context: fallbackContext,
      }),
    );
  });
};

/**
 * Coerces relative rank payloads from array/object variants used by upstream APIs.
 */
const coerceRelativeRanks = (value: unknown): SpeciesEnvironmentRelativeRank[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return coerceRelativeRanksFromArray(value);
  }

  const source = asRecord(value);
  if (!source) {
    return [];
  }

  return Object.entries(source).flatMap(([key, raw]) => {
    if (Array.isArray(raw)) {
      return coerceRelativeRanksFromArray(raw, key);
    }

    const rawRecord = asRecord(raw);
    if (!rawRecord) {
      return [normalizeRelativeRank(key, raw)];
    }

    const layeredRanks = coerceRelativeRanksFromLayers(key, rawRecord);
    return layeredRanks.length ? layeredRanks : [normalizeRelativeRank(key, rawRecord)];
  });
};

/** Coerces one environment observation row into a normalized observation shape. */
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

/** Coerces density curve data from camelCase or snake_case field variants. */
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

/** Parses environment variable definitions from list payloads. */
export const parseEnvironmentVariableDefinitions = (payload: unknown): EnvironmentVariableDefinition[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map(toVariableDefinition).filter((entry) => entry.id.length > 0);
};

/**
 * Parses species environment statistics and normalizes optional nested payloads.
 *
 * Supports histogram, categorical, and ranking data with compatibility for
 * snake_case and camelCase backend fields.
 */
export const parseSpeciesEnvironmentStats = (
  payload: unknown,
  taxonId: string | number,
  variableId: string,
): SpeciesEnvironmentStats => {
  const source = asRecord(payload) ?? {};
  const variableMetadata = asRecord(source.variable_metadata);
  const summary = coerceEnvironmentSummary(asRecord(source.summary) as Partial<SpeciesEnvironmentSummary>);
  const baselineSummary = source.baseline_summary || source.baselineSummary
    ? coerceEnvironmentSummary(
      asRecord(source.baseline_summary ?? source.baselineSummary) as Partial<SpeciesEnvironmentSummary>,
    )
    : null;
  const tallStats = buildCategoriesFromTallStats(source.categorical_stats, variableId);
  if ((summary.count === 0 || !Number.isFinite(summary.count)) && tallStats?.totals.totalSamples) {
    summary.count = tallStats.totals.totalSamples;
  }
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
    variableName:
      (typeof variableMetadata?.name === 'string' ? variableMetadata.name : undefined) ??
      (typeof source.variable === 'string' ? source.variable : variableId),
    units: typeof variableMetadata?.units === 'string' ? variableMetadata.units : null,
    variableType:
      (typeof variableMetadata?.value_type === 'string' ? variableMetadata.value_type : undefined) ??
      (typeof variableMetadata?.valueType === 'string' ? variableMetadata.valueType : undefined) ??
      null,
    generatedAt: typeof source.generated_at === 'string' ? source.generated_at : undefined,
    summary,
    histogram: coerceHistogram(asRecord(source.histogram) as Partial<SpeciesEnvironmentHistogram>),
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

/** Parses the environment slice response for a numeric range filter query. */
export const parseEnvironmentSliceResponse = (
  payload: unknown,
  params: { taxonId: number | string; variableId: string; min: number; max: number; limit?: number },
): SpeciesEnvironmentSliceResponse => {
  const source = asRecord(payload) ?? {};
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

/** Parses category sample observations for one categorical class value. */
export const parseEnvironmentCategorySampleResponse = (
  payload: unknown,
  params: { taxonId: number | string; variableId: string; classValue: string | number },
): SpeciesEnvironmentCategorySampleResponse => {
  const source = asRecord(payload) ?? {};
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