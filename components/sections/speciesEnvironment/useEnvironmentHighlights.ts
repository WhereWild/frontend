import {
  fetchEnvironmentRangeSlice,
  fetchSpeciesEnvironmentCategorySamples,
} from '@/data/api';
import type {
  SpeciesEnvironmentObservation,
  SpeciesEnvironmentStats,
} from '@/data/types';
import React from 'react';
import { CategorySampleState, DensitySelectionRange } from './model';

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
  /** Callback receiving highlighted catalog numbers. */
  onHighlightChange?: (catalogNumbers: (number | string)[]) => void;
};

/** Handles category/range selections and resolves corresponding highlighted observations. */
export function useEnvironmentHighlights({
  taxonId,
  selectedVariable,
  stats,
  isCategorical,
  locationGid,
  onHighlightChange,
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

  const resetHighlightState = React.useCallback(() => {
    categoryRequestRef.current += 1;
    setSelectedCategoryValueState(null);
    setSelectedDensityRange(null);
    setRangeObservations([]);
    setCategorySamplesByValue({});
  }, []);

  React.useEffect(() => {
    resetHighlightState();
  }, [locationGid, resetHighlightState, selectedVariable, taxonId]);

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
          observations: entry.observationIds.map((id) => ({
            catalogNumber: id,
            value: null,
            latitude: null,
            longitude: null,
          })),
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
      const emit = (ids: (number | string)[]) => onHighlightChange?.(ids);

      const cached = categorySamplesByValue[nextKey];
      if (cached?.loaded && !cached.error) {
        emit(
          (cached.observations ?? [])
            .map((entry) => entry.catalogNumber)
            .filter((id): id is number | string => typeof id === 'number' || typeof id === 'string'),
        );
        return;
      }

      if (!locationGid && stats?.categoricalSamples?.length) {
        const preloaded = stats.categoricalSamples.find((entry) => String(entry.value) === nextKey);
        const preloadedIds = (preloaded?.observationIds ?? []).filter(
          (id): id is number | string => typeof id === 'number' || typeof id === 'string',
        );
        if (preloadedIds.length) {
          setCategorySamplesByValue((prev) => ({
            ...prev,
            [nextKey]: {
              observations: preloadedIds.map((id) => ({
                catalogNumber: id,
                value: null,
                latitude: null,
                longitude: null,
              })),
              loading: false,
              loaded: true,
              error: null,
            },
          }));
          emit(preloadedIds);
          return;
        }
      }

      if (!isCategorical || !taxonId || !selectedVariable) {
        emit([]);
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
            { location: locationGid ?? undefined },
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
          emit(
            observations
              .map((entry) => entry.catalogNumber)
              .filter((id): id is number | string => typeof id === 'number' || typeof id === 'string'),
          );
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
          emit([]);
        }
      })();
    },
    [
      categorySamplesByValue,
      isCategorical,
      locationGid,
      onHighlightChange,
      selectedVariable,
      stats?.categoricalSamples,
      taxonId,
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
      const emit = (ids: (number | string)[]) => onHighlightChange?.(ids);

      if (!nextKey || nextKey === currentKey) {
        categoryRequestRef.current += 1;
        setSelectedCategoryValueState(null);
        emit([]);
        return;
      }

      setSelectedCategoryValueState(nextValue);
      if (!stats) {
        return;
      }
      resolveCategorySelection(nextKey);
    },
    [
      onHighlightChange,
      resolveCategorySelection,
      selectedCategoryValue,
      stats,
    ],
  );

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

  React.useEffect(() => {
    if (!isCategorical || !onHighlightChange || selectedCategoryValue === null) {
      return;
    }
    const key = String(selectedCategoryValue);
    const state = categorySamplesByValue[key];
    if (!state?.loaded || state.loading || state.error) {
      return;
    }
    onHighlightChange(
      (state.observations ?? [])
        .map((entry) => entry.catalogNumber)
        .filter((id): id is number | string => typeof id === 'number' || typeof id === 'string'),
    );
  }, [categorySamplesByValue, isCategorical, onHighlightChange, selectedCategoryValue]);

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
      onHighlightChange?.([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetchEnvironmentRangeSlice({
          taxonId,
          variableId: selectedVariable,
          min: selectedDensityRange.start,
          max: selectedDensityRange.end,
          location: locationGid ?? undefined,
        });
        if (cancelled) {
          return;
        }
        setRangeObservations(response.observations ?? []);
        onHighlightChange?.(
          (response.observations ?? [])
            .map((entry) => entry.catalogNumber)
            .filter((id) => typeof id === 'number' || typeof id === 'string'),
        );
      } catch {
        if (cancelled) {
          return;
        }
        setRangeObservations([]);
        onHighlightChange?.([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCategorical, onHighlightChange, selectedDensityRange, selectedVariable, taxonId, locationGid]);

  return {
    selectedCategoryValue,
    setSelectedCategoryValue,
    selectedDensityRange,
    handleDensitySelectionChange,
    rangeObservations,
  };
}
