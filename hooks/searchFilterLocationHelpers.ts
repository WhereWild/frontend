import { fetchLocationsByHierarchy } from '@/data/api';
import type { SelectOption } from '@/components';
import { mapLocationsToOptions } from './species/locationHelpers';

const LOCATION_LOAD_LIMIT = 300;

/** Resolves the display label for a selected option value, if present. */
export const getOptionLabelForValue = (options: SelectOption[], selectedValue: string): string => {
  const match = options.find((option) => option.value === selectedValue);
  return typeof match?.label === 'string' ? match.label.trim() : '';
};

/** Fetches location options for a hierarchy level and maps them for select controls. */
const fetchHierarchyOptions = async (
  level: 'country' | 'state' | 'county',
  parent?: string,
) => {
  const results = await fetchLocationsByHierarchy('', level, parent, LOCATION_LOAD_LIMIT);
  return mapLocationsToOptions(results).options;
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
export const fetchCountryHierarchyOptions = async (): Promise<SelectOption[]> => {
  return fetchHierarchyOptions('country');
};
