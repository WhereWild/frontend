import { Platform } from 'react-native';

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
  const heatmapUrlFromBackend =
    item.heatmap_image_url ?? item.heatmapImageUrl ?? item.heatmap_imageUrl ?? null;
  const heatmapFile = item.heatmap_image_file ?? item.heatmap_file ?? null;
  const heatmapUrl = heatmapUrlFromBackend ?? (heatmapFile
    ? `${BACKEND_BASE}/static/species_probabilities/${heatmapFile.replace(/^probabilities\//, '')}`
    : null);

  return {
    taxon_id: item.taxon_id ?? null,
    scientific_name: item.scientific_name ?? '',
    common_name: item.common_name ?? '',
    image_source: imageUrl,
    heatmap_image_source: heatmapUrl,
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
