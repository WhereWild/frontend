import React from 'react';
import { fetchSpeciesLocations } from '@/data/api';
import type { LocationSearchResult } from '@/data/types';
import {
  type LocationOption,
  mapLocationsToOptions,
} from './locationHelpers';

type LocationLevel = 'country' | 'state' | 'county';

type UseSpeciesLocationFiltersParams = {
  taxonId?: number;
  locationSearchLimit: number;
  occurrenceCheckConcurrency: number;
};

type UseSpeciesLocationFiltersResult = {
  countryOptions: LocationOption[];
  stateOptions: LocationOption[];
  countyOptions: LocationOption[];
  countryLoading: boolean;
  stateLoading: boolean;
  countyLoading: boolean;
  selectedCountryGid: string | null;
  selectedStateGid: string | null;
  selectedCountyGid: string | null;
  finalLocationGid: string | null;
  onCountryChange: (gid: string | null) => void;
  onStateChange: (gid: string | null) => void;
  onCountyChange: (gid: string | null) => void;
};

export const useSpeciesLocationFilters = ({
  taxonId,
  locationSearchLimit,
  occurrenceCheckConcurrency,
}: UseSpeciesLocationFiltersParams): UseSpeciesLocationFiltersResult => {
  void occurrenceCheckConcurrency;

  const [countryOptions, setCountryOptions] = React.useState<LocationOption[]>([]);
  const [stateOptions, setStateOptions] = React.useState<LocationOption[]>([]);
  const [countyOptions, setCountyOptions] = React.useState<LocationOption[]>([]);

  const [countryLoading, setCountryLoading] = React.useState(false);
  const [stateLoading, setStateLoading] = React.useState(false);
  const [countyLoading, setCountyLoading] = React.useState(false);

  const [selectedCountryGid, setSelectedCountryGid] = React.useState<string | null>(null);
  const [selectedStateGid, setSelectedStateGid] = React.useState<string | null>(null);
  const [selectedCountyGid, setSelectedCountyGid] = React.useState<string | null>(null);

  const countryMapRef = React.useRef<Record<string, LocationSearchResult>>({});
  const stateMapRef = React.useRef<Record<string, LocationSearchResult>>({});
  const countyMapRef = React.useRef<Record<string, LocationSearchResult>>({});
  const countryLoadRequestRef = React.useRef(0);
  const stateLoadRequestRef = React.useRef(0);
  const countyLoadRequestRef = React.useRef(0);

  const speciesLocationCacheRef = React.useRef<Record<string, LocationSearchResult[]>>({});

  const finalLocationGid = React.useMemo(() => {
    return selectedCountyGid ?? selectedStateGid ?? selectedCountryGid;
  }, [selectedCountryGid, selectedCountyGid, selectedStateGid]);

  const findByNameInMap = React.useCallback(
    (name: string, map: Record<string, LocationSearchResult>): LocationSearchResult | null => {
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
    },
    [],
  );

  const loadSpeciesLocations = React.useCallback(
    async (level: LocationLevel, parentGidOrName: string | null): Promise<LocationSearchResult[]> => {
      if (taxonId == null) return [];

      const parentToken = parentGidOrName ? String(parentGidOrName).trim() : '';
      const cacheParent = parentToken || 'root';
      const cacheKey = `${taxonId}::${level}::${cacheParent}::limit:${locationSearchLimit}`;
      if (speciesLocationCacheRef.current[cacheKey]) {
        return speciesLocationCacheRef.current[cacheKey];
      }

      let locations: LocationSearchResult[] = [];
      let fetchSucceeded = false;
      try {
        locations = await fetchSpeciesLocations(
          taxonId,
          level,
          parentToken || undefined,
          locationSearchLimit,
        );
        fetchSucceeded = true;
      } catch {
        locations = [];
      }

      if (fetchSucceeded) {
        speciesLocationCacheRef.current[cacheKey] = locations;
      }
      return locations;
    },
    [locationSearchLimit, taxonId],
  );

  const runGuardedLoad = React.useCallback(
    async (
      requestRef: React.MutableRefObject<number>,
      setLoading: React.Dispatch<React.SetStateAction<boolean>>,
      load: () => Promise<LocationSearchResult[]>,
      onSuccess: (list: LocationSearchResult[]) => void,
    ) => {
      const requestId = ++requestRef.current;
      setLoading(true);
      let list: LocationSearchResult[] = [];
      try {
        list = await load();
      } catch {
        list = [];
      } finally {
        if (requestRef.current === requestId) {
          onSuccess(list);
          setLoading(false);
        }
      }
    },
    [],
  );

  const resetCountySelection = React.useCallback(() => {
    countyLoadRequestRef.current += 1;
    setCountyOptions([]);
    setSelectedCountyGid(null);
    setCountyLoading(false);
    countyMapRef.current = {};
  }, []);

  const resetStateAndCountySelection = React.useCallback(() => {
    stateLoadRequestRef.current += 1;
    setStateOptions([]);
    setSelectedStateGid(null);
    setStateLoading(false);
    stateMapRef.current = {};
    resetCountySelection();
  }, [resetCountySelection]);

  React.useEffect(() => {
    countryLoadRequestRef.current += 1;
    stateLoadRequestRef.current += 1;
    countyLoadRequestRef.current += 1;

    setSelectedCountryGid(null);
    setSelectedStateGid(null);
    setSelectedCountyGid(null);

    setCountryOptions([]);
    setStateOptions([]);
    setCountyOptions([]);

    setCountryLoading(false);
    setStateLoading(false);
    setCountyLoading(false);

    countryMapRef.current = {};
    stateMapRef.current = {};
    countyMapRef.current = {};
    speciesLocationCacheRef.current = {};
  }, [taxonId]);

  React.useEffect(() => {
    return () => {
      countryLoadRequestRef.current += 1;
      stateLoadRequestRef.current += 1;
      countyLoadRequestRef.current += 1;
    };
  }, []);

  const inferAndSetParentsFromEntry = React.useCallback((entry: LocationSearchResult) => {
    const hierarchy = Array.isArray(entry.hierarchy) ? entry.hierarchy.map((value) => String(value ?? '')) : [];

    if (entry.level == null) {
      return;
    }

    const level = Number(entry.level);
    if (!Number.isInteger(level) || (level !== 0 && level !== 1 && level !== 2)) {
      return;
    }

    if (level === 0) {
      setSelectedCountryGid(entry.gid);
      return;
    }

    if (level === 1) {
      setSelectedStateGid(entry.gid);
      const countryName = hierarchy[1] ?? '';
      const countryMatch = findByNameInMap(countryName, countryMapRef.current);
      if (countryMatch) setSelectedCountryGid(countryMatch.gid);
      return;
    }

    setSelectedCountyGid(entry.gid);
    const stateName = hierarchy[hierarchy.length - 2] ?? '';
    const countryName = hierarchy[hierarchy.length - 3] ?? hierarchy[1] ?? '';

    const stateMatch = findByNameInMap(stateName, stateMapRef.current);
    if (stateMatch) setSelectedStateGid(stateMatch.gid);

    const countryMatch = findByNameInMap(countryName, countryMapRef.current);
    if (countryMatch) setSelectedCountryGid(countryMatch.gid);
  }, [findByNameInMap]);

  React.useEffect(() => {
    void runGuardedLoad(
      countryLoadRequestRef,
      setCountryLoading,
      () => loadSpeciesLocations('country', null),
      (list) => {
        const { sanitized, options } = mapLocationsToOptions(list);
        setCountryOptions(options);
        for (const country of sanitized) {
          countryMapRef.current[country.gid] = country;
        }
      },
    );
  }, [loadSpeciesLocations, runGuardedLoad, taxonId]);

  React.useEffect(() => {
    resetStateAndCountySelection();

    if (!taxonId || !selectedCountryGid) {
      return;
    }

    void runGuardedLoad(
      stateLoadRequestRef,
      setStateLoading,
      () => loadSpeciesLocations('state', selectedCountryGid),
      (list) => {
        const { sanitized, options } = mapLocationsToOptions(list);
        setStateOptions(options);
        for (const state of sanitized) {
          stateMapRef.current[state.gid] = state;
        }
      },
    );
  }, [
    loadSpeciesLocations,
    resetStateAndCountySelection,
    runGuardedLoad,
    selectedCountryGid,
    taxonId,
  ]);

  React.useEffect(() => {
    resetCountySelection();

    if (!taxonId || !selectedStateGid) {
      return;
    }

    void runGuardedLoad(
      countyLoadRequestRef,
      setCountyLoading,
      () => loadSpeciesLocations('county', selectedStateGid),
      (list) => {
        const { sanitized, options } = mapLocationsToOptions(list);
        setCountyOptions(options);
        for (const county of sanitized) {
          countyMapRef.current[county.gid] = county;
        }
      },
    );
  }, [loadSpeciesLocations, resetCountySelection, runGuardedLoad, selectedStateGid, taxonId]);

  const onCountryChange = React.useCallback(
    (gid: string | null) => {
      setSelectedCountryGid(gid);
    },
    [],
  );

  const onStateChange = React.useCallback(
    (gid: string | null) => {
      setSelectedStateGid(gid);
      if (gid) {
        const entry = stateMapRef.current[gid];
        if (entry) {
          inferAndSetParentsFromEntry(entry);
        }
      }
    },
    [inferAndSetParentsFromEntry],
  );

  const onCountyChange = React.useCallback(
    (gid: string | null) => {
      setSelectedCountyGid(gid);
      if (gid) {
        const entry = countyMapRef.current[gid];
        if (entry) {
          inferAndSetParentsFromEntry(entry);
        }
      }
    },
    [inferAndSetParentsFromEntry],
  );

  return {
    countryOptions,
    stateOptions,
    countyOptions,
    countryLoading,
    stateLoading,
    countyLoading,
    selectedCountryGid,
    selectedStateGid,
    selectedCountyGid,
    finalLocationGid,
    onCountryChange,
    onStateChange,
    onCountyChange,
  };
};
