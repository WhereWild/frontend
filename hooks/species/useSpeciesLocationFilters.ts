import React from 'react';
import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
import type { LocationSearchResult } from '@/data/types';
import type { SpeciesDataSource } from '@/data/speciesDataSource';
import { type LocationOption, mapLocationsToOptions } from './locationHelpers';
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

type LocationLevelState = {
  options: LocationOption[];
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  selectedGid: string | null;
  setSelectedGid: React.Dispatch<React.SetStateAction<string | null>>;
  mapRef: React.MutableRefObject<Record<string, LocationSearchResult>>;
  requestRef: React.MutableRefObject<number>;
  applyOptions: (list: LocationSearchResult[]) => void;
  invalidatePendingLoads: () => void;
  reset: () => void;
};

const sharedSpeciesLocationInFlightCache = new WeakMap<
  SpeciesDataSource,
  Partial<Record<string, Promise<LocationSearchResult[]>>>
>();

const getSharedSpeciesLocationInFlightCache = (
  speciesDataSource: SpeciesDataSource,
) => {
  let cache = sharedSpeciesLocationInFlightCache.get(speciesDataSource);

  if (!cache) {
    cache = {};
    sharedSpeciesLocationInFlightCache.set(speciesDataSource, cache);
  }

  return cache;
};

const useLocationLevelState = (): LocationLevelState => {
  const [options, setOptions] = React.useState<LocationOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedGid, setSelectedGid] = React.useState<string | null>(null);
  const mapRef = React.useRef<Record<string, LocationSearchResult>>({});
  const requestRef = React.useRef(0);

  const applyOptions = React.useCallback((list: LocationSearchResult[]) => {
    const { sanitized, options: nextOptions } = mapLocationsToOptions(list);
    setOptions(nextOptions);
    mapRef.current = {};
    for (const item of sanitized) {
      mapRef.current[item.gid] = item;
    }
  }, []);

  const invalidatePendingLoads = React.useCallback(() => {
    requestRef.current += 1;
  }, []);

  const reset = React.useCallback(() => {
    invalidatePendingLoads();
    setOptions([]);
    setSelectedGid(null);
    setLoading(false);
    mapRef.current = {};
  }, [invalidatePendingLoads]);

  return {
    options,
    loading,
    setLoading,
    selectedGid,
    setSelectedGid,
    mapRef,
    requestRef,
    applyOptions,
    invalidatePendingLoads,
    reset,
  };
};

export const useSpeciesLocationFilters = ({
  taxonId,
  locationSearchLimit,
}: UseSpeciesLocationFiltersParams): UseSpeciesLocationFiltersResult => {
  const speciesDataSource = useSpeciesDataSource();
  const country = useLocationLevelState();
  const state = useLocationLevelState();
  const county = useLocationLevelState();
  const {
    options: countryOptions,
    loading: countryLoading,
    selectedGid: selectedCountryGid,
    setSelectedGid: setSelectedCountryGid,
    mapRef: countryMapRef,
    requestRef: countryRequestRef,
    setLoading: setCountryLoading,
    applyOptions: applyCountryOptions,
    invalidatePendingLoads: invalidateCountryPendingLoads,
    reset: resetCountry,
  } = country;
  const {
    options: stateOptions,
    loading: stateLoading,
    selectedGid: selectedStateGid,
    setSelectedGid: setSelectedStateGid,
    mapRef: stateMapRef,
    requestRef: stateRequestRef,
    setLoading: setStateLoading,
    applyOptions: applyStateOptions,
    invalidatePendingLoads: invalidateStatePendingLoads,
    reset: resetState,
  } = state;
  const {
    options: countyOptions,
    loading: countyLoading,
    selectedGid: selectedCountyGid,
    setSelectedGid: setSelectedCountyGid,
    mapRef: countyMapRef,
    requestRef: countyRequestRef,
    setLoading: setCountyLoading,
    applyOptions: applyCountyOptions,
    invalidatePendingLoads: invalidateCountyPendingLoads,
    reset: resetCounty,
  } = county;

  const speciesLocationCacheRef = React.useRef<
    Record<string, LocationSearchResult[]>
  >({});

  const finalLocationGid = React.useMemo(() => {
    return selectedCountyGid ?? selectedStateGid ?? selectedCountryGid;
  }, [selectedCountryGid, selectedCountyGid, selectedStateGid]);

  const loadSpeciesLocations = React.useCallback(
    async (
      level: LocationLevel,
      parentGidOrName: string | null,
    ): Promise<LocationSearchResult[]> => {
      if (taxonId == null) return [];

      const { parentRequestToken, parentFilterToken, parentCacheIdentity } =
        resolveParentLookup({
          level,
          parentGidOrName,
          countryMap: countryMapRef.current,
          stateMap: stateMapRef.current,
        });
      const parentTokenForDataSource =
        speciesDataSource.locationParentIdentityMode === 'gid'
          ? (parentFilterToken ?? parentRequestToken)
          : parentRequestToken;

      // Cache keys use parent identity (prefer gid, fallback normalized name) and
      // include locationSearchLimit so:
      // - gid vs name inputs for the same parent share one cache entry,
      // - same-name but different-gid parents do not collide, and
      // - requests with different limits do not reuse stale cached result sizes.
      const cacheKey = buildLocationCacheKey(
        taxonId,
        level,
        parentCacheIdentity,
        locationSearchLimit,
      );
      if (speciesLocationCacheRef.current[cacheKey]) {
        return speciesLocationCacheRef.current[cacheKey];
      }

      const sharedInFlightCache =
        getSharedSpeciesLocationInFlightCache(speciesDataSource);

      if (sharedInFlightCache[cacheKey]) {
        const sharedResult = await sharedInFlightCache[cacheKey];
        speciesLocationCacheRef.current[cacheKey] = sharedResult;
        return sharedResult;
      }

      const requestPromise = speciesDataSource
        .fetchSpeciesLocations(
          taxonId,
          level,
          parentTokenForDataSource || undefined,
          locationSearchLimit,
        )
        .then((locations) =>
          speciesDataSource.locationParentIdentityMode === 'gid'
            ? locations
            : filterCandidatesByParent(locations, parentTokenForDataSource),
        )
        .then((filtered) => {
          speciesLocationCacheRef.current[cacheKey] = filtered;
          return filtered;
        })
        .finally(() => {
          if (sharedInFlightCache[cacheKey] === requestPromise) {
            delete sharedInFlightCache[cacheKey];
          }
        });

      sharedInFlightCache[cacheKey] = requestPromise;

      return requestPromise;
    },
    [
      countryMapRef,
      locationSearchLimit,
      speciesDataSource,
      stateMapRef,
      taxonId,
    ],
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

  const resetCountySelection = React.useCallback(() => {
    resetCounty();
  }, [resetCounty]);

  const resetStateAndCountySelection = React.useCallback(() => {
    resetState();
    resetCountySelection();
  }, [resetCountySelection, resetState]);

  React.useEffect(() => {
    resetCountry();
    resetState();
    resetCounty();
    speciesLocationCacheRef.current = {};
  }, [resetCountry, resetCounty, resetState, taxonId]);

  React.useEffect(() => {
    return () => {
      invalidateCountryPendingLoads();
      invalidateStatePendingLoads();
      invalidateCountyPendingLoads();
    };
  }, [
    invalidateCountryPendingLoads,
    invalidateCountyPendingLoads,
    invalidateStatePendingLoads,
  ]);

  const inferAndSetParentsFromEntry = React.useCallback(
    (entry: LocationSearchResult) => {
      const inferred = inferParentSelection(
        entry,
        countryMapRef.current,
        stateMapRef.current,
      );
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
    },
    [
      countryMapRef,
      setSelectedCountryGid,
      setSelectedCountyGid,
      setSelectedStateGid,
      stateMapRef,
    ],
  );

  React.useEffect(() => {
    void runGuardedLoad(
      countryRequestRef,
      setCountryLoading,
      () => loadSpeciesLocations('country', null),
      applyCountryOptions,
    );
  }, [
    applyCountryOptions,
    countryRequestRef,
    loadSpeciesLocations,
    runGuardedLoad,
    setCountryLoading,
    taxonId,
  ]);

  React.useEffect(() => {
    resetStateAndCountySelection();

    if (!taxonId || !selectedCountryGid) {
      return;
    }

    void runGuardedLoad(
      stateRequestRef,
      setStateLoading,
      () => loadSpeciesLocations('state', selectedCountryGid),
      applyStateOptions,
    );
  }, [
    applyStateOptions,
    loadSpeciesLocations,
    resetStateAndCountySelection,
    runGuardedLoad,
    selectedCountryGid,
    setStateLoading,
    stateRequestRef,
    taxonId,
  ]);

  React.useEffect(() => {
    resetCountySelection();

    if (!taxonId || !selectedStateGid) {
      return;
    }

    void runGuardedLoad(
      countyRequestRef,
      setCountyLoading,
      () => loadSpeciesLocations('county', selectedStateGid),
      applyCountyOptions,
    );
  }, [
    applyCountyOptions,
    countyRequestRef,
    loadSpeciesLocations,
    resetCountySelection,
    runGuardedLoad,
    selectedStateGid,
    setCountyLoading,
    taxonId,
  ]);

  const onCountryChange = React.useCallback(
    (gid: string | null) => {
      setSelectedCountryGid(gid);
    },
    [setSelectedCountryGid],
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
    [inferAndSetParentsFromEntry, setSelectedStateGid, stateMapRef],
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
    [countyMapRef, inferAndSetParentsFromEntry, setSelectedCountyGid],
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
