// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  LocationDetail,
  LocationHierarchyEntry,
  LocationSearchResult,
} from './types';
import { BACKEND_BASE, asRecord, fetchJsonOrThrow } from './apiShared';

export type FetchLocationByGidOptions = {
  signal?: AbortSignal;
};

type LocationLevel = 'continent' | 'country' | 'state' | 'county' | number;

const LEVEL_NAME_TO_NUM: Record<string, number> = {
  continent: -1,
  country: 0,
  state: 1,
  county: 2,
};

const toLocationSearchResult = (
  entry: unknown,
): LocationSearchResult | null => {
  const source = asRecord(entry);
  const gid = String(source.gid ?? '').trim();
  const name = typeof source.name === 'string' ? source.name : '';

  if (!gid.length || !name.length) {
    return null;
  }

  return {
    gid,
    name,
    level:
      typeof source.level === 'number'
        ? source.level
        : Number(source.level ?? -1),
    hierarchy: Array.isArray(source.hierarchy)
      ? source.hierarchy.map((item) => String(item ?? '')).filter(Boolean)
      : [],
  };
};

const toLocationHierarchyEntry = (
  entry: unknown,
): LocationHierarchyEntry | null => {
  const source = asRecord(entry);
  const gid = String(source.gid ?? '').trim();
  const name = typeof source.name === 'string' ? source.name : '';

  if (!gid.length || !name.length) {
    return null;
  }

  return {
    gid,
    name,
    level:
      typeof source.level === 'number'
        ? source.level
        : Number(source.level ?? -1),
  };
};

const toLocationDetail = (payload: unknown): LocationDetail | null => {
  const source = asRecord(payload);
  const base = toLocationSearchResult(source);
  if (!base) {
    return null;
  }

  const parentGid = String(source.parent_gid ?? source.parentGid ?? '').trim();
  const ancestors = Array.isArray(source.ancestors)
    ? source.ancestors
        .map(toLocationHierarchyEntry)
        .filter((entry): entry is LocationHierarchyEntry => Boolean(entry))
    : [];

  return {
    ...base,
    parent_gid: parentGid.length > 0 ? parentGid : null,
    ancestors,
  };
};

/** Normalizes a `results` wrapper payload into location rows. */
const mapLocationSearchResults = (payload: unknown): LocationSearchResult[] => {
  const source = asRecord(payload);
  const results = Array.isArray(source.results) ? source.results : [];

  return results
    .map(toLocationSearchResult)
    .filter((entry): entry is LocationSearchResult => Boolean(entry));
};

const setLocationLevelParam = (
  params: URLSearchParams,
  level?: LocationLevel,
) => {
  if (typeof level === 'string') {
    const maybe = LEVEL_NAME_TO_NUM[level.toLowerCase()];
    if (typeof maybe === 'number') {
      params.set('level', String(maybe));
    }
    return;
  }

  if (typeof level === 'number') {
    params.set('level', String(level));
  }
};

/**
 * Searches locations within an optional hierarchy scope.
 */
export async function fetchLocationsByHierarchy(
  query: string,
  level?: LocationLevel,
  parent?: string,
  limit = 50,
): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();

  const params = new URLSearchParams();
  if (trimmed.length > 0) {
    params.set('q', trimmed);
  }
  setLocationLevelParam(params, level);
  if (parent) params.set('parent', parent);
  params.set('limit', String(limit));

  const payload = await fetchJsonOrThrow(
    `${BACKEND_BASE}/api/locations/search_hierarchy?${params.toString()}`,
    'Failed to search locations by hierarchy',
  );

  return mapLocationSearchResults(payload);
}

/**
 * Searches locations by free-text query.
 */
export async function fetchLocations(
  query: string,
  limit = 8,
): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed.length) {
    return [];
  }
  const params = new URLSearchParams({ q: trimmed });
  if (limit) {
    params.set('limit', String(limit));
  }
  const payload = await fetchJsonOrThrow(
    `${BACKEND_BASE}/api/locations/search?${params.toString()}`,
    'Failed to search locations',
  );

  return mapLocationSearchResults(payload);
}

/**
 * Fetches canonical hierarchy metadata for a single location gid.
 */
export async function fetchLocationByGid(
  gid: string,
  options?: FetchLocationByGidOptions,
): Promise<LocationDetail | null> {
  const trimmedGid = gid.trim();
  if (!trimmedGid.length) {
    return null;
  }

  const requestOptions = options?.signal
    ? { signal: options.signal }
    : undefined;

  const response = requestOptions
    ? await fetch(
        `${BACKEND_BASE}/api/locations/${encodeURIComponent(trimmedGid)}`,
        requestOptions,
      )
    : await fetch(
        `${BACKEND_BASE}/api/locations/${encodeURIComponent(trimmedGid)}`,
      );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to fetch location detail for ${trimmedGid}: ${response.status} ${text}`,
    );
  }

  const payload = await response.json();

  return toLocationDetail(payload);
}

/**
 * Fetches location memberships for a species.
 */
export async function fetchSpeciesLocations(
  taxonId: string | number,
  level?: LocationLevel,
  parent?: string,
  limit = 500,
): Promise<LocationSearchResult[]> {
  const encodedId = encodeURIComponent(String(taxonId));
  const params = new URLSearchParams();
  setLocationLevelParam(params, level);
  if (parent) {
    params.set('parent', parent);
  }
  if (limit) {
    params.set('limit', String(limit));
  }

  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/locations${query ? `?${query}` : ''}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch species locations for ${taxonId}`,
  );
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(asRecord(payload).results)
      ? (asRecord(payload).results as unknown[])
      : [];

  return rows
    .map(toLocationSearchResult)
    .filter((entry): entry is LocationSearchResult => Boolean(entry));
}

/** Accepted location level values for location endpoints. */
export type { LocationLevel };
