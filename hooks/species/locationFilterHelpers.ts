// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LocationSearchResult } from '@/data/types';

export type LocationLevel = 'country' | 'state' | 'county';

type ParentLookupInput = {
  level: LocationLevel;
  parentGidOrName: string | null;
  countryMap: Record<string, LocationSearchResult>;
  stateMap: Record<string, LocationSearchResult>;
};

export type ParentLookupResult = {
  parentRequestToken: string | null;
  parentFilterToken: string | null;
  parentCacheIdentity: string;
};

export type InferredLocationSelection = {
  countryGid?: string;
  stateGid?: string;
  countyGid?: string;
};

export const findLocationByNameInMap = (
  name: string,
  map: Record<string, LocationSearchResult>,
): LocationSearchResult | null => {
  if (!name) {
    return null;
  }

  const lower = name.toLowerCase();
  for (const location of Object.values(map)) {
    if ((location.name ?? '').toLowerCase() === lower) {
      return location;
    }
  }

  return null;
};

const findLocationInMapByHierarchyEntry = (
  entry: string,
  map: Record<string, LocationSearchResult>,
) => {
  if (!entry) {
    return null;
  }

  return map[entry] ?? findLocationByNameInMap(entry, map);
};

const findLastLocationMatchInHierarchy = (
  hierarchy: string[],
  map: Record<string, LocationSearchResult>,
  endExclusive?: number,
) => {
  const endIndex = typeof endExclusive === 'number' ? Math.min(endExclusive, hierarchy.length) : hierarchy.length;

  for (let index = endIndex - 1; index >= 0; index -= 1) {
    const match = findLocationInMapByHierarchyEntry(hierarchy[index] ?? '', map);
    if (match) {
      return { match, index };
    }
  }

  return null;
};

export const resolveParentLookup = ({
  level,
  parentGidOrName,
  countryMap,
  stateMap,
}: ParentLookupInput): ParentLookupResult => {
  let parentRequestToken: string | null = null;
  let parentFilterToken: string | null = null;
  let parentCacheIdentity = 'root';

  if (parentGidOrName == null) {
    return {
      parentRequestToken,
      parentFilterToken,
      parentCacheIdentity,
    };
  }

  const parentInput = String(parentGidOrName).trim();
  if (!parentInput) {
    return {
      parentRequestToken,
      parentFilterToken,
      parentCacheIdentity,
    };
  }

  const parentLookupMap = level === 'county' ? stateMap : countryMap;
  const byGid = parentLookupMap[parentInput];
  const byName = byGid ? null : findLocationByNameInMap(parentInput, parentLookupMap);
  const resolvedParent = byGid ?? byName;

  if (resolvedParent) {
    parentRequestToken = resolvedParent.name;
    parentFilterToken = resolvedParent.gid;
    parentCacheIdentity = `gid:${resolvedParent.gid}`;
  } else {
    parentRequestToken = parentInput;
    parentFilterToken = parentInput;
    parentCacheIdentity = `name:${parentInput.toLowerCase()}`;
  }

  return {
    parentRequestToken,
    parentFilterToken,
    parentCacheIdentity,
  };
};

export const buildLocationCacheKey = (
  taxonId: string,
  level: LocationLevel,
  parentCacheIdentity: string,
  locationSearchLimit: number,
) => `${taxonId}::${level}::${parentCacheIdentity}::limit:${locationSearchLimit}`;

export const filterCandidatesByParent = (
  candidates: LocationSearchResult[],
  parentToken: string | null,
) => {
  if (!parentToken) {
    return candidates;
  }

  const lowerParent = parentToken.toLowerCase();
  return candidates.filter((candidate) => {
    const hierarchy = Array.isArray(candidate.hierarchy)
      ? candidate.hierarchy.map((value) => String(value ?? '').toLowerCase())
      : [];

    if (!hierarchy.length) {
      return true;
    }

    return hierarchy.includes(lowerParent);
  });
};

export const inferParentSelection = (
  entry: LocationSearchResult,
  countryMap: Record<string, LocationSearchResult>,
  stateMap: Record<string, LocationSearchResult>,
): InferredLocationSelection | null => {
  if (entry.level == null) {
    return null;
  }

  const level = Number(entry.level);
  if (!Number.isInteger(level) || (level !== 0 && level !== 1 && level !== 2)) {
    return null;
  }

  const hierarchy = Array.isArray(entry.hierarchy)
    ? entry.hierarchy.map((value) => String(value ?? ''))
    : [];

  if (level === 0) {
    return {
      countryGid: entry.gid,
    };
  }

  if (level === 1) {
    const countryMatch = findLastLocationMatchInHierarchy(hierarchy, countryMap)?.match;

    return {
      stateGid: entry.gid,
      countryGid: countryMatch?.gid,
    };
  }

  const stateResult = findLastLocationMatchInHierarchy(hierarchy, stateMap);
  const stateMatch = stateResult?.match;
  const countryMatch = findLastLocationMatchInHierarchy(
    hierarchy,
    countryMap,
    stateResult?.index,
  )?.match;

  return {
    countyGid: entry.gid,
    stateGid: stateMatch?.gid,
    countryGid: countryMatch?.gid,
  };
};
