import {
  fetchEnvironmentRangeSlice,
  fetchSpeciesEnvironmentCategorySamples,
  fetchPointEnvironmentValue,
} from '@/data/api';
import type {
  SpeciesEnvironmentObservation,
  SpeciesEnvironmentStats,
} from '@/data/types';
import React from 'react';
import { CategorySampleState, DensitySelectionRange } from './model';

const DENSITY_SLICE_DEBOUNCE_MS = 200;
type CatalogId = number | string;
type CategorySampleEntry = NonNullable<SpeciesEnvironmentStats['categoricalSamples']>[number];

const isCatalogId = (id: unknown): id is CatalogId =>
  typeof id === 'number' || typeof id === 'string';

const toPlaceholderObservations = (ids: CatalogId[]): SpeciesEnvironmentObservation[] =>
  ids.map((id) => ({
    catalogNumber: id,
    value: null,
    latitude: null,
    longitude: null,
  }));

const toCatalogIdsFromObservations = (
  observations?: SpeciesEnvironmentObservation[] | null,
): CatalogId[] => (observations ?? []).map((entry) => entry.catalogNumber).filter(isCatalogId);

const toCatalogIdsFromCategorySample = (
  sample?: CategorySampleEntry,
): CatalogId[] => (sample?.observationIds ?? []).filter(isCatalogId);

/** Inputs for managing observation highlights from environment interactions. */
type UseEnvironmentHighlightsParams = {
  /** Taxon ID used for slice/category sample requests. */
  taxonId?: number;
  /** Active variable id for highlight queries. */
  selectedVariable: string;
  /** Loaded environment stats for current species/variable. */
  stats: SpeciesEnvironmentStats | null;
  /** Whether current variable behaves as categorical. */
  isCategorical: boolean;
  /** Optional location filter gid for scoped highlights. */
  locationGid?: string | null;
  /** Unit system forwarded to backend highlight endpoints. */
  units?: 'metric' | 'imperial' | undefined;
  /** Callback receiving highlighted catalog numbers. */
  onHighlightChange?: (catalogNumbers: (number | string)[]) => void;
  /** Pinned observation for manual highlighting. */
  pinnedObservation?: { catalogNumber: string; lat: number; lon: number } | null;
};

/** Handles category/range selections and resolves corresponding highlighted observations. */
export function useEnvironmentHighlights({
  taxonId,
  selectedVariable,
  stats,
  isCategorical,
  locationGid,
  units,
  onHighlightChange,
  pinnedObservation,
}: UseEnvironmentHighlightsParams) {
  const [selectedCategoryValue, setSelectedCategoryValueState] = React.useState<
    number | string | null
  >(null);
  const [categorySamplesByValue, setCategorySamplesByValue] = React.useState<
    Record<string, CategorySampleState>
  >({});
  const [selectedDensityRange, setSelectedDensityRange] = React.useState<DensitySelectionRange | null>(
    null,
  );
  const [rangeObservations, setRangeObservations] = React.useState<SpeciesEnvironmentObservation[]>(
    [],
  );
  const categoryRequestRef = React.useRef(0);
  const lastEmittedSignatureRef = React.useRef<string | null>(null);
  const [pinnedValue, setPinnedValue] = React.useState<number | null>(null);
  const [pinnedLoading, setPinnedLoading] = React.useState(false);
  const pinnedRequestRef = React.useRef(0);

  const emitHighlightChange = React.useCallback(
    (ids: (number | string)[]) => {
      const signature = JSON.stringify(ids);
      if (signature === lastEmittedSignatureRef.current) {
        return;
      }
      lastEmittedSignatureRef.current = signature;
      onHighlightChange?.(ids);
    },
    [onHighlightChange],
  );

  const resetHighlightState = React.useCallback(() => {
    categoryRequestRef.current += 1;
    setSelectedCategoryValueState(null);
    setSelectedDensityRange(null);
    setRangeObservations([]);
    setCategorySamplesByValue({});
    emitHighlightChange([]);
  }, [emitHighlightChange]);

  React.useEffect(() => {
    resetHighlightState();
  }, [locationGid, resetHighlightState, selectedVariable, taxonId, units]);

  React.useEffect(() => {
    setPinnedValue(null);
    pinnedRequestRef.current += 1;
  }, [selectedVariable, locationGid, taxonId, units]);

  React.useEffect(() => {
    if (!pinnedObservation || !selectedVariable) {
      setPinnedValue(null);
      return;
    }
    const requestId = ++pinnedRequestRef.current;
    setPinnedLoading(true);
    void (async () => {
      try {
    const result = await fetchPointEnvironmentValue(
      pinnedObservation.lat,
      pinnedObservation.lon,
      selectedVariable,
      { units },
    );
    console.log('pinned result:', result);
    if (pinnedRequestRef.current !== requestId) {
      return;
    }
    setPinnedValue(result.value);
      } catch {
        if (pinnedRequestRef.current !== requestId) {
          return;
        }
        setPinnedValue(null);
      } finally {
        if (pinnedRequestRef.current === requestId) {
          setPinnedLoading(false);
        }
      }
    })();
  }, [pinnedObservation, selectedVariable, units]);

  React.useEffect(() => {
    if (!stats?.categoricalSamples || !stats.categoricalSamples.length) {
      return;
    }
    if (locationGid) {
      return;
    }
    setCategorySamplesByValue((prev) => {
      let changed = false;
      const next = { ...prev };
      stats.categoricalSamples?.forEach((entry) => {
        const key = String(entry.value);
        if (!Array.isArray(entry.observationIds) || !entry.observationIds.length) {
          return;
        }
        const existing = next[key];
        if (existing && existing.loaded && existing.observations.length) {
          return;
        }
        next[key] = {
          observations: toPlaceholderObservations(entry.observationIds.filter(isCatalogId)),
          loading: false,
          loaded: true,
          error: null,
        };
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [stats?.categoricalSamples, selectedVariable, locationGid]);

  const resolveCategorySelection = React.useCallback(
    (nextKey: string) => {
      const cached = categorySamplesByValue[nextKey];
      if (cached?.loaded && !cached.error) {
        emitHighlightChange(toCatalogIdsFromObservations(cached.observations));
        return;
      }

      if (!locationGid && stats?.categoricalSamples?.length) {
        const preloaded = stats.categoricalSamples.find((entry) => String(entry.value) === nextKey);
        const preloadedIds = toCatalogIdsFromCategorySample(preloaded);
        if (preloadedIds.length) {
          setCategorySamplesByValue((prev) => ({
            ...prev,
            [nextKey]: {
              observations: toPlaceholderObservations(preloadedIds),
              loading: false,
              loaded: true,
              error: null,
            },
          }));
          emitHighlightChange(preloadedIds);
          return;
        }
      }

      if (!isCategorical || !taxonId || !selectedVariable) {
        emitHighlightChange([]);
        return;
      }

      const requestId = categoryRequestRef.current + 1;
      categoryRequestRef.current = requestId;
      setCategorySamplesByValue((prev) => ({
        ...prev,
        [nextKey]: {
          observations: prev[nextKey]?.observations ?? [],
          loading: true,
          loaded: false,
          error: null,
        },
      }));

      void (async () => {
        try {
          const response = await fetchSpeciesEnvironmentCategorySamples(
            taxonId,
            selectedVariable,
            nextKey,
            { location: locationGid ?? undefined, units },
          );
          if (categoryRequestRef.current !== requestId) {
            return;
          }
          const observations = response.observations ?? [];
          setCategorySamplesByValue((prev) => ({
            ...prev,
            [nextKey]: {
              observations,
              loading: false,
              loaded: true,
              error: null,
            },
          }));
          emitHighlightChange(toCatalogIdsFromObservations(observations));
        } catch (err) {
          if (categoryRequestRef.current !== requestId) {
            return;
          }
          const errorMessage =
            err instanceof Error ? err.message : 'Failed to load category observations.';
          setCategorySamplesByValue((prev) => ({
            ...prev,
            [nextKey]: {
              observations: [],
              loading: false,
              loaded: true,
              error: errorMessage,
            },
          }));
          emitHighlightChange([]);
        }
      })();
    },
    [
      categorySamplesByValue,
      emitHighlightChange,
      isCategorical,
      locationGid,
      selectedVariable,
      stats?.categoricalSamples,
      taxonId,
      units,
    ],
  );

  const setSelectedCategoryValue = React.useCallback(
    (nextValueOrUpdater: React.SetStateAction<number | string | null>) => {
      const nextValue =
        typeof nextValueOrUpdater === 'function'
          ? (nextValueOrUpdater as (previous: number | string | null) => number | string | null)(
            selectedCategoryValue,
          )
          : nextValueOrUpdater;
      const currentKey = selectedCategoryValue !== null ? String(selectedCategoryValue) : null;
      const nextKey = nextValue !== null ? String(nextValue) : null;

      if (!nextKey || nextKey === currentKey) {
        categoryRequestRef.current += 1;
        setSelectedCategoryValueState(null);
        emitHighlightChange([]);
        return;
      }

      setSelectedCategoryValueState(nextValue);
      if (!stats) {
        return;
      }
      resolveCategorySelection(nextKey);
    },
    [
      emitHighlightChange,
      resolveCategorySelection,
      selectedCategoryValue,
      stats,
    ],
  );

  React.useEffect(() => {
    if (!isCategorical || !onHighlightChange || selectedCategoryValue === null) {
      return;
    }
    const key = String(selectedCategoryValue);
    const state = categorySamplesByValue[key];
    if (!state?.loaded || state.loading || state.error) {
      return;
    }
    emitHighlightChange(toCatalogIdsFromObservations(state.observations));
  }, [
    categorySamplesByValue,
    emitHighlightChange,
    isCategorical,
    onHighlightChange,
    selectedCategoryValue,
  ]);

  React.useEffect(() => {
    if (!isCategorical || !stats || selectedCategoryValue === null) {
      return;
    }
    const key = String(selectedCategoryValue);
    const state = categorySamplesByValue[key];
    if (state?.loading || state?.loaded) {
      return;
    }
    resolveCategorySelection(key);
  }, [
    categorySamplesByValue,
    isCategorical,
    resolveCategorySelection,
    selectedCategoryValue,
    stats,
  ]);

  const handleDensitySelectionChange = React.useCallback((range: DensitySelectionRange | null) => {
    setSelectedDensityRange(range);
  }, []);

  React.useEffect(() => {
    if (isCategorical) {
      setRangeObservations([]);
      return;
    }
    if (!taxonId || !selectedVariable || !selectedDensityRange) {
      setRangeObservations([]);
      emitHighlightChange([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetchEnvironmentRangeSlice({
            taxonId,
            variableId: selectedVariable,
            min: selectedDensityRange.start,
            max: selectedDensityRange.end,
            location: locationGid ?? undefined,
            units,
          });
          if (cancelled) {
            return;
          }
          const observations = response.observations ?? [];
          setRangeObservations(observations);
          emitHighlightChange(toCatalogIdsFromObservations(observations));
        } catch {
          if (cancelled) {
            return;
          }
          setRangeObservations([]);
          emitHighlightChange([]);
        }
      })();
    }, DENSITY_SLICE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [emitHighlightChange, isCategorical, selectedDensityRange, selectedVariable, taxonId, locationGid, units]);

  return {
    selectedCategoryValue,
    setSelectedCategoryValue,
    selectedDensityRange,
    handleDensitySelectionChange,
    rangeObservations,
    pinnedValue,
    pinnedLoading,
  };
}
