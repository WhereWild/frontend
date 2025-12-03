import { Platform } from 'react-native';

const DEFAULT_LOCAL = 'http://localhost:8000';

const DEV_HOST = (() => {
  // prefer explicit env var (works on web & node)
  const env = (process.env.REACT_NATIVE_BACKEND_URL as string) || (process.env.REACT_APP_BACKEND_URL as string);
  if (env && env.length) return env;

  // If running in a browser, default to localhost:8000
  if (typeof window !== 'undefined') return DEFAULT_LOCAL;

  // For native Android emulator
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : DEFAULT_LOCAL;
})();
export const BACKEND_BASE = (process.env.REACT_NATIVE_BACKEND_URL as string) ?? DEV_HOST;

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('BACKEND_BASE:', BACKEND_BASE);
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
  return{
    ...normalized,
    description: item.description ?? 'description pending',
  };
}
