import { SpeciesOccurrence, LocationSearchResult } from './types';

const ENV_BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export const BACKEND_BASE = ENV_BACKEND_BASE || 'http://localhost:8000';

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
  const sciName = item.scientific_name ?? '';

  const rawCommon = item.common_name ?? item.commonName ?? null;

  const commonName =
    typeof rawCommon === 'string' && rawCommon.trim().length > 0
      ? rawCommon
      : sciName;
  return {
    taxon_id: item.taxon_id ?? null,
    scientific_name: sciName,
    common_name: commonName,
    image_source: imageUrl,
    _raw: item,
  };
}

export async function fetchLocationsByHierarchy(
  query: string,
  level?: 'continent' | 'country' | 'state' | 'county' | number,
  parent?: string, // parent name(s) or gid; for multiple parents use 'Country|State'
  limit = 50,
): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();

  // map friendly level names to numeric level codes used by the backend
  const LEVEL_NAME_TO_NUM: Record<string, number> = {
    continent: -1,
    country: 0,
    state: 1,
    county: 2,
  };

  const params = new URLSearchParams({ q: trimmed });
  // if caller passed a string name, convert to numeric; if they passed a number, use it
  if (typeof level === 'string') {
    const maybe = LEVEL_NAME_TO_NUM[level.toLowerCase()];
    if (typeof maybe === 'number') {
      params.set('level', String(maybe));
    }
  } else if (typeof level === 'number') {
    params.set('level', String(level));
  }
  if (parent) params.set('parent', parent);
  params.set('limit', String(limit));

  const res = await fetch(`${BACKEND_BASE}/locations/search_hierarchy?${params.toString()}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to search locations by hierarchy: ${res.status} ${txt}`);
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
    .filter((entry: any) => entry.gid.length > 0 && entry.name.length > 0);
}

export async function fetchSpeciesLocations(
  taxonId: string | number,
  level?: 'continent' | 'country' | 'state' | 'county' | number,
  parent?: string,
  limit = 500,
): Promise<LocationSearchResult[]> {
  const encodedId = encodeURIComponent(String(taxonId));
  const params = new URLSearchParams();
  if (typeof level === 'string') {
    params.set('level', level);
  } else if (typeof level === 'number') {
    params.set('level', String(level));
  }
  if (parent) {
    params.set('parent', parent);
  }
  if (limit) {
    params.set('limit', String(limit));
  }
  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/locations${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch species locations: ${res.status} ${txt}`);
  }
  const payload = await res.json();
  const results = Array.isArray(payload) ? payload : [];
  return results
    .map((entry: any) => ({
      gid: String(entry?.gid ?? ''),
      name: entry?.name ?? '',
      level: typeof entry?.level === 'number' ? entry.level : Number(entry?.level ?? -1),
      hierarchy: Array.isArray(entry?.hierarchy)
        ? entry.hierarchy.map((item: any) => String(item ?? '')).filter(Boolean)
        : [],
    }))
    .filter((entry: any) => entry.gid.length > 0 && entry.name.length > 0);
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
    .filter((entry: any) => entry.gid.length > 0 && entry.name.length > 0);
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
