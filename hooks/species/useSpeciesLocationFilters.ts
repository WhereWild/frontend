import React from 'react';
import { fetchSpeciesLocations } from '@/data/api';
import type { LocationSearchResult } from '@/data/types';
import {
  type LocationOption,
  mapLocationsToOptions,
} from './locationHelpers';
import {
  buildLocationCacheKey,
  filterCandidatesByParent,
  inferParentSelection,
  resolveParentLookup,
  type LocationLevel,
} from './locationFilterHelpers';

type UseSpeciesLocationFiltersParams = {
  taxonId?: number;
  locationSearchLimit: number;
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
}: UseSpeciesLocationFiltersParams): UseSpeciesLocationFiltersResult => {
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

  const loadSpeciesLocations = React.useCallback(
    async (level: LocationLevel, parentGidOrName: string | null): Promise<LocationSearchResult[]> => {
      if (taxonId == null) return [];

      const { parentToken, parentCacheIdentity } = resolveParentLookup({
        level,
        parentGidOrName,
        countryMap: countryMapRef.current,
        stateMap: stateMapRef.current,
      });

      // Cache keys use parent identity (prefer gid, fallback normalized name) and
      // include locationSearchLimit so:
      // - gid vs name inputs for the same parent share one cache entry,
      // - same-name but different-gid parents do not collide, and
      // - requests with different limits do not reuse stale cached result sizes.
      const cacheKey = buildLocationCacheKey(taxonId, level, parentCacheIdentity, locationSearchLimit);
      if (speciesLocationCacheRef.current[cacheKey]) {
        return speciesLocationCacheRef.current[cacheKey];
      }

      const locations = await fetchSpeciesLocations(
        taxonId,
        level,
        parentToken || undefined,
        locationSearchLimit,
      );

      const filtered = filterCandidatesByParent(locations, parentToken);
      speciesLocationCacheRef.current[cacheKey] = filtered;
      return filtered;
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

      try {
        const list = await load();
        if (requestRef.current === requestId) {
          onSuccess(list);
        }
      } catch {
        if (requestRef.current === requestId) {
          onSuccess([]);
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [],
  );

  const applyLocationOptions = React.useCallback(
    (
      list: LocationSearchResult[],
      setOptions: React.Dispatch<React.SetStateAction<LocationOption[]>>,
      mapRef: React.MutableRefObject<Record<string, LocationSearchResult>>,
    ) => {
      const { sanitized, options } = mapLocationsToOptions(list);
      setOptions(options);
      mapRef.current = {};
      for (const item of sanitized) {
        mapRef.current[item.gid] = item;
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
    const inferred = inferParentSelection(entry, countryMapRef.current, stateMapRef.current);
    if (!inferred) {
      return;
    }

    if (inferred.countryGid) {
      setSelectedCountryGid(inferred.countryGid);
    }
    if (inferred.stateGid) {
      setSelectedStateGid(inferred.stateGid);
    }
    if (inferred.countyGid) {
      setSelectedCountyGid(inferred.countyGid);
    }
  }, []);

  React.useEffect(() => {
    void runGuardedLoad(
      countryLoadRequestRef,
      setCountryLoading,
      () => loadSpeciesLocations('country', null),
      (list) => applyLocationOptions(list, setCountryOptions, countryMapRef),
    );
  }, [applyLocationOptions, loadSpeciesLocations, runGuardedLoad, taxonId]);

  React.useEffect(() => {
    resetStateAndCountySelection();

    if (!taxonId || !selectedCountryGid) {
      return;
    }

    void runGuardedLoad(
      stateLoadRequestRef,
      setStateLoading,
      () => loadSpeciesLocations('state', selectedCountryGid),
      (list) => applyLocationOptions(list, setStateOptions, stateMapRef),
    );
  }, [
    applyLocationOptions,
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
      (list) => applyLocationOptions(list, setCountyOptions, countyMapRef),
    );
  }, [
    applyLocationOptions,
    loadSpeciesLocations,
    resetCountySelection,
    runGuardedLoad,
    selectedStateGid,
    taxonId,
  ]);

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
