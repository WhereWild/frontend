import { Platform } from 'react-native';
import type {
  EnvironmentVariableDefinition,
  SpeciesEnvironmentBinSample,
  SpeciesEnvironmentCategory,
  SpeciesEnvironmentCategorySamples,
  SpeciesEnvironmentHistogram,
  SpeciesEnvironmentStats,
  SpeciesEnvironmentSummary,
} from './types';

const LOCAL_BACKEND = 'http://localhost:8000';
const ANDROID_EMULATOR_BACKEND = 'http://10.0.2.2:8000';

const explicitBackend =
  (process.env.REACT_NATIVE_BACKEND_URL as string) ||
  (process.env.EXPO_PUBLIC_BACKEND_URL as string) ||
  (process.env.REACT_APP_BACKEND_URL as string);

const inferredBackend = typeof window === 'undefined' && Platform.OS === 'android'
  ? ANDROID_EMULATOR_BACKEND
  : LOCAL_BACKEND;

export const BACKEND_BASE = explicitBackend || inferredBackend;

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
  return{
    ...normalized,
    description: item.description ?? 'description pending',
  };
}

const toVariableDefinition = (entry: any): EnvironmentVariableDefinition => ({
  id: String(entry?.id ?? ''),
  name: entry?.name,
  units: entry?.units ?? null,
  description: entry?.description,
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

const coerceEnvironmentSummary = (value: Partial<SpeciesEnvironmentSummary> | undefined): SpeciesEnvironmentSummary => ({
  count: value?.count ?? 0,
  mean: typeof value?.mean === 'number' ? value?.mean : null,
  stddev: typeof value?.stddev === 'number' ? value?.stddev : null,
  q10: typeof value?.q10 === 'number' ? value?.q10 : null,
  q90: typeof value?.q90 === 'number' ? value?.q90 : null,
  min: typeof value?.min === 'number' ? value?.min : null,
  max: typeof value?.max === 'number' ? value?.max : null,
});

const coerceHistogram = (
  value: Partial<SpeciesEnvironmentHistogram> | undefined,
): SpeciesEnvironmentHistogram | null => {
  if (!value) {
    return null;
  }
  const bins = Array.isArray(value.bins) ? value.bins.map(Number).filter((num) => Number.isFinite(num)) : [];
  const counts = Array.isArray(value.counts)
    ? value.counts.map((num) => Number(num)).filter((num) => Number.isFinite(num))
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
      value: typeof entry?.value === 'number' ? entry.value : Number(entry?.value ?? NaN),
      className: entry?.class_name ?? entry?.className ?? String(entry?.value ?? ''),
      description: entry?.description ?? null,
      count: typeof entry?.count === 'number' ? entry.count : Number(entry?.count ?? 0),
      fraction: typeof entry?.fraction === 'number' ? entry.fraction : Number(entry?.fraction ?? 0),
    }))
    .filter((entry) => Number.isFinite(entry.value));
};

const coerceCategorySamples = (value: any): SpeciesEnvironmentCategorySamples[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => ({
      value: typeof entry?.value === 'number' ? entry.value : Number(entry?.value ?? NaN),
      observationIds: Array.isArray(entry?.observation_ids)
        ? entry.observation_ids
        : Array.isArray(entry?.observationIds)
          ? entry.observationIds
          : [],
    }))
    .filter((entry) => Number.isFinite(entry.value));
};

export async function fetchSpeciesEnvironment(
  taxonId: string | number,
  variableId: string,
): Promise<SpeciesEnvironmentStats> {
  const encodedId = encodeURIComponent(String(taxonId));
  const encodedVariable = encodeURIComponent(variableId);
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch environment stats (${variableId}) for ${taxonId}: ${res.status} ${txt}`);
  }
  const payload = await res.json();
  return {
    speciesId: payload.species_id ?? Number(taxonId),
    variable: payload.variable ?? variableId,
    variableName: payload.variable_metadata?.name ?? payload.variable ?? variableId,
    units: payload.variable_metadata?.units ?? null,
    variableType: payload.variable_metadata?.value_type ?? payload.variable_metadata?.valueType ?? null,
    generatedAt: payload.generated_at,
    summary: coerceEnvironmentSummary(payload.summary),
    histogram: coerceHistogram(payload.histogram),
    binSamples: coerceBinSamples(payload.bin_samples),
    categoricalDistribution: coerceCategories(payload.categorical_distribution),
    dominantCategories: coerceCategories(payload.dominant_categories),
    categoricalSamples: coerceCategorySamples(payload.categorical_samples),
  };
}
