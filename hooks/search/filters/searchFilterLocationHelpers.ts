import { fetchLocationsByHierarchy } from '@/data/api';
import type { SelectOption } from '@/components';
import { mapLocationsToOptions } from '../../species/locationHelpers';

const LOCATION_LOAD_LIMIT = 300;
const hierarchyOptionsCache = new Map<string, SelectOption[]>();
const hierarchyOptionsInFlightCache = new Map<
  string,
  Promise<SelectOption[]>
>();

const getHierarchyOptionsCacheKey = (
  level: 'country' | 'state' | 'county',
  parent?: string,
) => `${level}:${parent ?? ''}`;

export const getCachedHierarchyOptions = (
  level: 'country' | 'state' | 'county',
  parent?: string,
) => {
  return hierarchyOptionsCache.get(getHierarchyOptionsCacheKey(level, parent));
};

export const getCachedHierarchyOptionsForValue = (
  level: 'country' | 'state' | 'county',
  value: string,
  parent?: string,
) => {
  if (!value) {
    return [];
  }

  return (
    getCachedHierarchyOptions(level, parent)?.filter(
      (option) => option.value === value,
    ) ?? []
  );
};

export const resetSearchFilterLocationOptionsCache = () => {
  hierarchyOptionsCache.clear();
  hierarchyOptionsInFlightCache.clear();
};

/** Resolves the display label for a selected option value, if present. */
export const getOptionLabelForValue = (
  options: SelectOption[],
  selectedValue: string,
): string => {
  const match = options.find((option) => option.value === selectedValue);
  return typeof match?.label === 'string' ? match.label.trim() : '';
};

/** Fetches location options for a hierarchy level and maps them for select controls. */
const fetchHierarchyOptions = async (
  level: 'country' | 'state' | 'county',
  parent?: string,
) => {
  const cacheKey = getHierarchyOptionsCacheKey(level, parent);
  const cachedOptions = hierarchyOptionsCache.get(cacheKey);
  if (cachedOptions) {
    return cachedOptions;
  }

  const inFlightRequest = hierarchyOptionsInFlightCache.get(cacheKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = fetchLocationsByHierarchy(
    '',
    level,
    parent,
    LOCATION_LOAD_LIMIT,
  )
    .then((results) => {
      const options = mapLocationsToOptions(results).options;
      hierarchyOptionsCache.set(cacheKey, options);
      return options;
    })
    .finally(() => {
      hierarchyOptionsInFlightCache.delete(cacheKey);
    });

  hierarchyOptionsInFlightCache.set(cacheKey, request);

  return request;
};

/** Tries parent candidates in order and returns the first non-empty hierarchy result set. */
export const fetchHierarchyOptionsWithParentFallback = async (
  level: 'state' | 'county',
  parentCandidates: (string | undefined)[],
): Promise<SelectOption[]> => {
  const uniqueParents = Array.from(
    new Set(
      parentCandidates
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  );

  for (const parent of uniqueParents) {
    try {
      const options = await fetchHierarchyOptions(level, parent);
      if (options.length > 0) {
        return options;
      }
    } catch (error) {
      console.warn(
        `[searchFilterLocationHelpers] Failed location lookup for level="${level}" parent="${parent}"`,
        error,
      );
      continue;
    }
  }

  return [];
};

/** Loads top-level country options. */
export const fetchCountryHierarchyOptions = async (): Promise<
  SelectOption[]
> => {
  return fetchHierarchyOptions('country');
};
