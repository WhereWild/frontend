import { Platform } from 'react-native';
import type {
  EnvironmentVariableDefinition,
  RelativeRankingEntry,
  RelativeRankingOption,
  RelativeRankingOptionsResponse,
  RelativeRankingResponse,
  SpeciesEnvironmentBinSample,
  SpeciesEnvironmentCategory,
  SpeciesEnvironmentCategorySampleResponse,
  SpeciesEnvironmentCategorySamples,
  SpeciesEnvironmentCategoricalTotals,
  SpeciesEnvironmentHistogram,
  SpeciesEnvironmentObservation,
  SpeciesEnvironmentRelativeRank,
  SpeciesEnvironmentSliceResponse,
  SpeciesEnvironmentStats,
  SpeciesEnvironmentSummary,
  LocationSearchResult,
  SpeciesOccurrence,
} from './types';

const LOCAL_BACKEND = 'http://localhost:8000';
const ANDROID_EMULATOR_BACKEND = 'http://10.0.2.2:8000';

const explicitBackend =
  (process.env.REACT_NATIVE_BACKEND_URL as string) ||
  (process.env.EXPO_PUBLIC_BACKEND_URL as string) ||
  (process.env.REACT_APP_BACKEND_URL as string);

const inferredBackend =
  typeof window === 'undefined' && Platform.OS === 'android'
    ? ANDROID_EMULATOR_BACKEND
    : LOCAL_BACKEND;

export const BACKEND_BASE = explicitBackend || inferredBackend;

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('Using backend:', BACKEND_BASE);
}

/**
 * Normalize backend item to match your original JSON keys exactly,
 * but set `image_file` to the full URL to the static image so RN <Image> can use it.
 */
function normalizeToJsonShape(item: any) {
  // prefer full URL returned by backend
  const imageUrlFromBackend = item.image_url ?? item.imageUrl ?? null;
  // fallback: try image_file (basename) and construct URL
  const imageFile = item.image_file ?? (item.image_file_name ?? null);
  const imageUrl = imageUrlFromBackend ?? (imageFile
    ? `${BACKEND_BASE}/static/species_images/${imageFile.replace(/^images\//, '')}`
    : null);

  return {
    taxon_id: item.taxon_id ?? null,
    scientific_name: item.scientific_name ?? '',
    common_name: item.common_name ?? '',
    image_source: imageUrl,
    _raw: item,
  };
}

export async function fetchSpeciesList(limit?: number, q?: string) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (q) params.set('q', q);
  const url = `${BACKEND_BASE}/api/species${params.toString() ? `?${params.toString()}` : ''}`;

  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch species list: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data.map((it: any) => normalizeToJsonShape(it));
}

export async function fetchSpeciesByTaxonId(taxonId: string | number) {
  const encoded = encodeURIComponent(String(taxonId));
  const url = `${BACKEND_BASE}/api/species/${encoded}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch species ${taxonId}: ${res.status} ${txt}`);
  }
  const item = await res.json();
  const normalized = normalizeToJsonShape(item);
  return {
    ...normalized,
    description: item.description ?? 'description pending',
    taxonomy_path: item.taxonomy_path ?? item.taxonomyPath ?? null,
  };
}

const toVariableDefinition = (entry: any): EnvironmentVariableDefinition => ({
  id: String(entry?.id ?? ''),
  name: entry?.name,
  units: entry?.units ?? null,
  description: entry?.description,
  valueType: entry?.value_type ?? entry?.valueType ?? null,
});

export async function fetchEnvironmentVariables(): Promise<EnvironmentVariableDefinition[]> {
  const url = `${BACKEND_BASE}/variables`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch variables: ${res.status} ${txt}`);
  }
  const payload = await res.json();
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map(toVariableDefinition)
    .filter((entry) => entry.id.length > 0);
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
};

const coerceEnvironmentSummary = (
  value: Partial<SpeciesEnvironmentSummary> | undefined,
): SpeciesEnvironmentSummary => ({
  count: typeof value?.count === 'number' ? value.count : 0,
  min: toNumber(value?.min),
  mean: toNumber(value?.mean),
  max: toNumber(value?.max),
  stddev: toNumber(value?.stddev),
  q01: toNumber(value?.q01 ?? value?.q1),
  q10: toNumber(value?.q10),
  q90: toNumber(value?.q90),
  q99: toNumber(value?.q99 ?? value?.q_99),
});

const coerceHistogram = (
  value: Partial<SpeciesEnvironmentHistogram> | undefined,
): SpeciesEnvironmentHistogram | null => {
  if (!value) {
    return null;
  }
  const bins = Array.isArray(value.bins)
    ? value.bins.map(toNumber).filter((num): num is number => typeof num === 'number')
    : [];
  const counts = Array.isArray(value.counts)
    ? value.counts.map(toNumber).filter((num): num is number => typeof num === 'number')
    : [];
  if (!bins.length || !counts.length) {
    return null;
  }
  return { bins, counts };
};

const coerceBinSamples = (value: any): SpeciesEnvironmentBinSample[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => ({
      index: typeof entry?.index === 'number' ? entry.index : Number(entry?.index ?? -1),
      observationIds: Array.isArray(entry?.observation_ids)
        ? entry.observation_ids
        : Array.isArray(entry?.observationIds)
          ? entry.observationIds
          : [],
    }))
    .filter((entry) => Number.isFinite(entry.index) && entry.index >= 0);
};

const coerceCategories = (value: any): SpeciesEnvironmentCategory[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => ({
      value:
        typeof entry?.value === 'number'
          ? entry.value
          : typeof entry?.value === 'string'
            ? entry.value
            : Number(entry?.value ?? NaN),
      className: entry?.class_name ?? entry?.className ?? String(entry?.value ?? ''),
      description: entry?.description ?? null,
      count: typeof entry?.count === 'number' ? entry.count : Number(entry?.count ?? 0),
      fraction:
        typeof entry?.fraction === 'number' ? entry.fraction : Number(entry?.fraction ?? 0),
    }))
    .filter((entry) => entry.className.length > 0);
};

const coerceCategorySamples = (value: any): SpeciesEnvironmentCategorySamples[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => ({
      value:
        typeof entry?.value === 'number'
          ? entry.value
          : typeof entry?.value === 'string'
            ? entry.value
            : Number(entry?.value ?? NaN),
      observationIds: Array.isArray(entry?.observation_ids)
        ? entry.observation_ids
        : Array.isArray(entry?.observationIds)
          ? entry.observationIds
          : [],
    }))
    .filter((entry) => entry.observationIds.length > 0);
};

const coerceCategoricalTotals = (value: any): SpeciesEnvironmentCategoricalTotals | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const totalSamples = toNumber(value.total_samples ?? value.totalSamples);
  const uniqueClasses = toNumber(value.unique_classes ?? value.uniqueClasses);
  const significantUniqueClasses = toNumber(
    value.significant_unique_classes ?? value.significantUniqueClasses,
  );
  return {
    totalSamples: totalSamples ?? undefined,
    uniqueClasses: uniqueClasses ?? undefined,
    significantUniqueClasses: significantUniqueClasses ?? undefined,
  };
};

const normalizeObservationEntry = (
  entry: any,
): SpeciesEnvironmentObservation => {
  const rawCatalog =
    entry?.catalogNumber ??
    entry?.catalog_number ??
    entry?.catalog ??
    entry?.id;
  const catalogNumber =
    typeof rawCatalog === 'number' || typeof rawCatalog === 'string'
      ? String(rawCatalog)
      : '';
  return {
    catalogNumber,
    value: toNumber(entry?.value),
    latitude: toNumber(entry?.latitude),
    longitude: toNumber(entry?.longitude),
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
  value: any,
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
    if (!entry?.variable) {
      return true;
    }
    return String(entry.variable).toLowerCase() === variable;
  });
  if (!filtered.length) {
    return null;
  }
  let totalSamples: number | undefined;
  let uniqueClasses: number | undefined;
  let significantClasses: number | undefined;
  const categories: SpeciesEnvironmentCategory[] = [];
  filtered.forEach((entry) => {
    const metric = String(entry?.metric ?? '').trim();
    const rawValue =
      typeof entry?.value === 'number'
        ? entry.value
        : Number(entry?.value ?? NaN);
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
    const count =
      typeof totalSamples === 'number'
        ? Math.round(totalSamples * fraction)
        : fraction;
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

const coerceRelativeRanks = (value: any): SpeciesEnvironmentRelativeRank[] => {
  if (!value) {
    return [];
  }

  const normalizeRank = (
    metric: string,
    entry: any,
    overrides?: Partial<SpeciesEnvironmentRelativeRank>,
  ): SpeciesEnvironmentRelativeRank => ({
    metric,
    label: entry?.label ?? entry?.name ?? overrides?.label ?? null,
    rank: toNumber(
      typeof entry?.position === 'number' ? entry.position : entry?.rank,
    ),
    count: toNumber(entry?.count),
    percentile: toNumber(entry?.percentile),
    context:
      entry?.context ??
      entry?.context_label ??
      entry?.ancestor_name ??
      overrides?.context ??
      null,
  });

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeRank(String(entry?.metric ?? ''), entry))
      .filter((entry) => entry.metric.length > 0);
  }

  const ranks: SpeciesEnvironmentRelativeRank[] = [];
  const entries = Object.entries(value);
  for (const [key, raw] of entries) {
    if (Array.isArray(raw)) {
      raw.forEach((entry) => {
        ranks.push(normalizeRank(String(entry?.metric ?? key), entry));
      });
      continue;
    }

    const layers = raw?.layers;
    if (layers && typeof layers === 'object') {
      for (const [layer, metrics] of Object.entries(layers)) {
        if (!metrics || typeof metrics !== 'object') {
          continue;
        }
        for (const [metric, record] of Object.entries(metrics as Record<string, any>)) {
          ranks.push(
            normalizeRank(metric, record, {
              label: layer,
              context: raw?.ancestor_name ?? key,
            }),
          );
        }
      }
      continue;
    }

    ranks.push(normalizeRank(key, raw));
  }
  return ranks;
};

type LocationOptions = {
  location?: string | null;
};

export async function fetchSpeciesEnvironment(
  taxonId: string | number,
  variableId: string,
  options?: LocationOptions,
): Promise<SpeciesEnvironmentStats> {
  const encodedId = encodeURIComponent(String(taxonId));
  const encodedVariable = encodeURIComponent(variableId);
  const params = new URLSearchParams();
  if (options?.location) {
    params.set('location', options.location);
  }
  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(
      `Failed to fetch environment stats (${variableId}) for ${taxonId}: ${res.status} ${txt}`,
    );
  }
  const payload = await res.json();
  const summary = coerceEnvironmentSummary(payload.summary);
  const baselineSummary = payload.baseline_summary || payload.baselineSummary
    ? coerceEnvironmentSummary(payload.baseline_summary ?? payload.baselineSummary)
    : null;
  const tallStats = buildCategoriesFromTallStats(payload.categorical_stats, variableId);
  if ((summary.count === 0 || !Number.isFinite(summary.count)) && tallStats?.totals.totalSamples) {
    summary.count = tallStats.totals.totalSamples;
  }
  const distribution = coerceCategories(payload.categorical_distribution);
  const dominant = coerceCategories(payload.dominant_categories);
  const baselineCategoricalDistribution = coerceCategories(
    payload.baseline_categorical_distribution ?? payload.baselineCategoricalDistribution,
  );
  const baselineCategoricalTotals = coerceCategoricalTotals(
    payload.baseline_categorical_totals ?? payload.baselineCategoricalTotals,
  );
  return {
    speciesId: payload.species_id ?? Number(taxonId),
    variable: payload.variable ?? variableId,
    variableName: payload.variable_metadata?.name ?? payload.variable ?? variableId,
    units: payload.variable_metadata?.units ?? null,
    variableType:
      payload.variable_metadata?.value_type ?? payload.variable_metadata?.valueType ?? null,
    generatedAt: payload.generated_at,
    summary,
    histogram: coerceHistogram(payload.histogram),
    densityCurve: Array.isArray(payload.densityCurve?.points ?? payload.density_curve?.points)
    ? {
        points: payload.densityCurve?.points ?? payload.density_curve?.points ?? [],
        density: payload.densityCurve?.density ?? payload.density_curve?.density ?? [],
      }
    : null,
    binSamples: coerceBinSamples(payload.bin_samples),
    categoricalDistribution:
      distribution.length ? distribution : tallStats?.distribution ?? [],
    dominantCategories: dominant.length ? dominant : tallStats?.dominant ?? [],
    categoricalSamples: coerceCategorySamples(payload.categorical_samples),
    relativeRanks: coerceRelativeRanks(
      payload.relative_ranks ?? payload.relative_rankings ?? payload.rankings,
    ),
    baselineSummary,
    baselineCategoricalDistribution,
    baselineCategoricalTotals,
  };
}

const normalizeRelativeRankingEntry = (entry: any): RelativeRankingEntry => ({
  taxonId: entry?.taxon_id ?? entry?.taxonId ?? entry?.id ?? null,
  scientificName: entry?.scientific_name ?? entry?.scientificName ?? null,
  commonName: entry?.common_name ?? entry?.commonName ?? null,
  rank: entry?.rank ?? entry?.taxon_rank ?? null,
  value: toNumber(entry?.value),
  position: typeof entry?.position === 'number' ? entry.position : Number(entry?.position ?? 0),
  percentile: toNumber(entry?.percentile),
  count: typeof entry?.count === 'number' ? entry.count : Number(entry?.count ?? 0),
  sampleCount:
    typeof entry?.sample_count === 'number'
      ? entry.sample_count
      : typeof entry?.sampleCount === 'number'
        ? entry.sampleCount
        : entry?.count ?? null,
});

export type RelativeRankingParams = {
  taxonId: number | string;
  rank: string;
  variableId: string;
  metric: string;
  limit?: number;
  order?: 'asc' | 'desc';
  minSamples?: number;
  includeSpeciesLike?: boolean;
  location?: string | null;
};

export type RelativeRankingOptionsParams = {
  taxonId: number | string;
  rank: string;
};

export async function fetchRelativeRankingOptions(
  params: RelativeRankingOptionsParams,
): Promise<RelativeRankingOptionsResponse> {
  const { taxonId, rank } = params;
  const encoded = encodeURIComponent(String(taxonId));
  const query = new URLSearchParams({ rank });
  const url = `${BACKEND_BASE}/relative-rankings/${encoded}/options?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch relative ranking options: ${res.status} ${txt}`);
  }
  const payload = await res.json();
  const options: RelativeRankingOption[] = Array.isArray(payload.options)
    ? payload.options
        .map((entry: any) => ({
          variable: typeof entry?.variable === 'string' ? entry.variable : String(entry?.variable ?? '').trim(),
          metric: typeof entry?.metric === 'string' ? entry.metric : String(entry?.metric ?? '').trim(),
          column: typeof entry?.column === 'string' && entry.column.length
            ? entry.column
            : `${entry?.variable ?? ''}::${entry?.metric ?? ''}`,
          count: typeof entry?.count === 'number' ? entry.count : Number(entry?.count ?? 0) || 0,
        }))
        .filter((entry) => entry.variable.length > 0 && entry.metric.length > 0)
    : [];
  return {
    ancestorTaxonId: payload.ancestor_taxon_id ?? Number(taxonId),
    rank: payload.rank ?? rank,
    options,
  };
}

export async function fetchRelativeRankings(
  params: RelativeRankingParams,
): Promise<RelativeRankingResponse> {
  const {
    taxonId,
    rank,
    variableId,
    metric,
    limit,
    order,
    minSamples,
    includeSpeciesLike,
    location,
  } = params;
  const encoded = encodeURIComponent(String(taxonId));
  const query = new URLSearchParams({
    rank,
    variable: variableId,
    metric,
  });
  if (limit) {
    query.set('limit', String(limit));
  }
  if (order) {
    query.set('order', order);
  }
  if (minSamples) {
    query.set('min_samples', String(minSamples));
  }
  if (includeSpeciesLike) {
    query.set('include_species_like', 'true');
  }
  if (location) {
    query.set('location', location);
  }
  const url = `${BACKEND_BASE}/relative-rankings/${encoded}?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch relative rankings: ${res.status} ${txt}`);
  }
  const payload = await res.json();
  const entries = Array.isArray(payload.entries)
    ? payload.entries.map(normalizeRelativeRankingEntry)
    : [];
  const distribution =
    payload.distribution &&
    Array.isArray(payload.distribution.points) &&
    Array.isArray(payload.distribution.density)
      ? {
          points: payload.distribution.points,
          density: payload.distribution.density,
        }
      : null;
  return {
    ancestorTaxonId: payload.ancestor_taxon_id ?? Number(taxonId),
    rank: payload.rank ?? rank,
    variable: payload.variable ?? variableId,
    metric: payload.metric ?? metric,
    total: typeof payload.total === 'number' ? payload.total : entries.length,
    limit: typeof payload.limit === 'number' ? payload.limit : limit ?? entries.length,
    entries,
    order: payload.order === 'desc' ? 'desc' : 'asc',
    minSamples: typeof payload.min_samples === 'number' ? payload.min_samples : minSamples,
    includeSpeciesLike:
      typeof payload.include_species_like === 'boolean'
        ? payload.include_species_like
        : includeSpeciesLike ?? false,
    distribution,
  };
}

export type EnvironmentSliceParams = {
  taxonId: number | string;
  variableId: string;
  min: number;
  max: number;
  limit?: number;
  location?: string | null;
};

export async function fetchEnvironmentRangeSlice(
  params: EnvironmentSliceParams,
): Promise<SpeciesEnvironmentSliceResponse> {
  const { taxonId, variableId, min, max, limit, location } = params;
  const encodedId = encodeURIComponent(String(taxonId));
  const encodedVariable = encodeURIComponent(variableId);
  const query = new URLSearchParams({
    min: String(min),
    max: String(max),
  });
  if (typeof limit === 'number') {
    query.set('limit', String(limit));
  }
  if (location) {
     query.set('location', location);
  }
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}/slice?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(
      `Failed to fetch environment slice (${variableId}) for ${taxonId}: ${res.status} ${txt}`,
    );
  }
  const payload = await res.json();
  const observations = Array.isArray(payload.observations)
    ? payload.observations.map(normalizeObservationEntry)
    : [];
  return {
    speciesId: payload.speciesId ?? Number(taxonId),
    variable: payload.variable ?? variableId,
    range: {
      min: typeof payload.range?.min === 'number' ? payload.range.min : min,
      max: typeof payload.range?.max === 'number' ? payload.range.max : max,
    },
    limit: typeof payload.limit === 'number' ? payload.limit : limit ?? null,
    count: typeof payload.count === 'number' ? payload.count : observations.length,
    observations,
  };
}

type CategorySampleOptions = {
  limit?: number;
  location?: string | null;
};

export async function fetchSpeciesEnvironmentCategorySamples(
  taxonId: string | number,
  variableId: string,
  classValue: string | number,
  options?: CategorySampleOptions,
): Promise<SpeciesEnvironmentCategorySampleResponse> {
  const encodedId = encodeURIComponent(String(taxonId));
  const encodedVariable = encodeURIComponent(variableId);
  const encodedClass = encodeURIComponent(String(classValue));
  const query = new URLSearchParams();
  if (typeof options?.limit === 'number') {
    query.set('limit', String(options.limit));
  }
  if (options?.location) {
    query.set('location', options.location);
  }
  const queryString = query.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}/class/${encodedClass}/samples${queryString ? `?${queryString}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(
      `Failed to fetch samples for ${variableId}=${classValue}: ${res.status} ${txt}`,
    );
  }
  const payload = await res.json();
  const observations = Array.isArray(payload.observations)
    ? payload.observations.map(normalizeObservationEntry)
    : [];
  return {
    speciesId: payload.speciesId ?? payload.species_id ?? Number(taxonId),
    variable: payload.variable ?? variableId,
    classValue: payload.classValue ?? payload.class_value ?? classValue,
    observations,
    count: typeof payload.count === 'number' ? payload.count : observations.length,
  };
}

export async function fetchSpeciesOccurrences(
  taxonId: string | number,
  options?: LocationOptions,
): Promise<SpeciesOccurrence[]> {
  const encodedId = encodeURIComponent(String(taxonId));
  const params = new URLSearchParams();
  if (options?.location) {
    params.set('location', options.location);
  }
  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/occurrences${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(
      `Failed to fetch occurrences for ${taxonId}: ${res.status} ${txt}`,
    );
  }
  const payload = await res.json();
  const rows = Array.isArray(payload.occurrences) ? payload.occurrences : [];
  return rows
    .map((entry: any) => ({
      catalogNumber:
        entry?.catalogNumber ??
        entry?.catalog_number ??
        entry?.id ??
        entry?.catalog ??
        null,
      latitude: toNumber(entry?.latitude),
      longitude: toNumber(entry?.longitude),
    }))
    .filter(
      (entry): entry is { catalogNumber: string | number; latitude: number; longitude: number } =>
        (typeof entry.latitude === 'number' && typeof entry.longitude === 'number'),
    )
    .map((entry) => ({
      catalogNumber: entry.catalogNumber ?? '',
      latitude: entry.latitude,
      longitude: entry.longitude,
    }));
}

export async function fetchLocations(query: string, limit = 8): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed.length) {
    return [];
  }
  const params = new URLSearchParams({ q: trimmed });
  if (limit) {
    params.set('limit', String(limit));
  }
  const res = await fetch(`${BACKEND_BASE}/locations/search?${params.toString()}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to search locations: ${res.status} ${txt}`);
  }
  const payload = await res.json();
  const results = Array.isArray(payload.results) ? payload.results : [];
  return results
    .map((entry: any) => ({
      gid: String(entry?.gid ?? ''),
      name: entry?.name ?? '',
      level: typeof entry?.level === 'number' ? entry.level : Number(entry?.level ?? -1),
      hierarchy: Array.isArray(entry?.hierarchy)
        ? entry.hierarchy.map((item: any) => String(item ?? '')).filter(Boolean)
        : [],
    }))
    .filter((entry) => entry.gid.length > 0 && entry.name.length > 0);
}
