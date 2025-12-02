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
console.log("BACKEND_BASE:", BACKEND_BASE);

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
    slug: item.slug ?? null,
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

export async function fetchSpeciesBySlug(slug: string) {
  const url = `${BACKEND_BASE}/api/species/${encodeURIComponent(slug)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch species ${slug}: ${res.status} ${txt}`);
  }
  const item = await res.json();
  const normalized = normalizeToJsonShape(item);
  return{
    ...normalized,
    description: item.description ?? 'description pending',
  };
}
export async function fetchSpeciesByCommonName(commonName: string) {
  if (!commonName) throw new Error('commonName is required');
  // Use the list endpoint with q= to get candidates, then exact-match locally.
  const params = new URLSearchParams();
  params.set('q', commonName);
  // we don't need many results; 50 is a safe upper bound
  params.set('limit', '50');
  const url = `${BACKEND_BASE}/api/species/by_name?name=${encodeURIComponent(commonName)}`;
  console.log("fetchSpeciesByCommonName -> url:", url);

  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch candidates for ${commonName}: ${res.status} ${txt}`);
  }
  const data: any[] = await res.json();

  // case-insensitive exact match on common_name or scientific_name
  const target = data.find((it) => {
    const cn = (it.common_name ?? '').toString().trim().toLowerCase();
    const sn = (it.scientific_name ?? '').toString().trim().toLowerCase();
    const q = commonName.trim().toLowerCase();
    return cn === q || sn === q;
  });

  if (!target) {
    // not found; return null for caller to handle
    return null;
  }

  const normalized = normalizeToJsonShape(target);
  return {
    ...normalized,
    description: (target.description ?? 'descriptions pending'),
  };
}