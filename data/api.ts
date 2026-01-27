import { Platform } from 'react-native';
import { SpeciesOccurrence } from './types';

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

type LocationOptions = {
  location?: string | null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : null;
};

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
      (entry: { latitude: any; longitude: any; }): entry is { catalogNumber: string | number; latitude: number; longitude: number } =>
        (typeof entry.latitude === 'number' && typeof entry.longitude === 'number'),
    )
    .map((entry: { catalogNumber: any; latitude: any; longitude: any; }) => ({
      catalogNumber: entry.catalogNumber ?? '',
      latitude: entry.latitude,
      longitude: entry.longitude,
    }));
}
