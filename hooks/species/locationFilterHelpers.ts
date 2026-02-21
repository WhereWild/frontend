import type { LocationSearchResult } from '@/data/types';

export type LocationLevel = 'country' | 'state' | 'county';

type ParentLookupInput = {
  level: LocationLevel;
  parentGidOrName: string | null;
  countryMap: Record<string, LocationSearchResult>;
  stateMap: Record<string, LocationSearchResult>;
};

export type ParentLookupResult = {
  parentToken: string | null;
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

export const resolveParentLookup = ({
  level,
  parentGidOrName,
  countryMap,
  stateMap,
}: ParentLookupInput): ParentLookupResult => {
  let parentToken: string | null = null;
  let parentCacheIdentity = 'root';

  if (parentGidOrName == null) {
    return {
      parentToken,
      parentCacheIdentity,
    };
  }

  const parentInput = String(parentGidOrName).trim();
  if (!parentInput) {
    return {
      parentToken,
      parentCacheIdentity,
    };
  }

  const parentLookupMap = level === 'county' ? stateMap : countryMap;
  const byGid = parentLookupMap[parentInput];
  const byName = byGid ? null : findLocationByNameInMap(parentInput, parentLookupMap);
  const resolvedParent = byGid ?? byName;

  if (resolvedParent) {
    parentToken = resolvedParent.name;
    parentCacheIdentity = `gid:${resolvedParent.gid}`;
  } else {
    parentToken = parentInput;
    parentCacheIdentity = `name:${parentInput.toLowerCase()}`;
  }

  return {
    parentToken,
    parentCacheIdentity,
  };
};

export const buildLocationCacheKey = (
  taxonId: number,
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
    const countryName = hierarchy[1] ?? '';
    const countryMatch = findLocationByNameInMap(countryName, countryMap);

    return {
      stateGid: entry.gid,
      countryGid: countryMatch?.gid,
    };
  }

  const stateName = hierarchy[hierarchy.length - 2] ?? '';
  const countryName = hierarchy[hierarchy.length - 3] ?? hierarchy[1] ?? '';
  const stateMatch = findLocationByNameInMap(stateName, stateMap);
  const countryMatch = findLocationByNameInMap(countryName, countryMap);

  return {
    countyGid: entry.gid,
    stateGid: stateMatch?.gid,
    countryGid: countryMatch?.gid,
  };
};
