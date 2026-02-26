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

  units?: 'metric' | 'imperial' | undefined;

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
  units,
}: UseEnvironmentHighlightsParams) {
  const [selectedCategoryValue, setSelectedCategoryValue] = React.useState<number | string | null>(
    null,
  );
  const [categorySamplesByValue, setCategorySamplesByValue] = React.useState<
    Record<string, CategorySampleState>
  >({});
  const [selectedDensityRange, setSelectedDensityRange] = React.useState<DensitySelectionRange | null>(
    null,
  );
  const [rangeObservations, setRangeObservations] = React.useState<SpeciesEnvironmentObservation[]>(
    [],
  );

  const resetHighlightState = React.useCallback(() => {
    setSelectedCategoryValue(null);
    setSelectedDensityRange(null);
    setRangeObservations([]);
    setCategorySamplesByValue({});
  }, []);

  React.useEffect(() => {
    resetHighlightState();
  }, [locationGid, resetHighlightState, selectedVariable, taxonId, units]);

  const selectedCategoryKey = selectedCategoryValue !== null ? String(selectedCategoryValue) : null;
  const selectedCategorySampleState = selectedCategoryKey
    ? categorySamplesByValue[selectedCategoryKey]
    : undefined;

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
  }, [stats?.categoricalSamples, selectedVariable, locationGid, units]);

  React.useEffect(() => {
    if (
      !isCategorical ||
      !taxonId ||
      !selectedVariable ||
      !selectedCategoryKey ||
      selectedCategorySampleState?.loading ||
      selectedCategorySampleState?.loaded
    ) {
      return;
    }
    let cancelled = false;
    setCategorySamplesByValue((prev) => ({
      ...prev,
      [selectedCategoryKey]: {
        observations: prev[selectedCategoryKey]?.observations ?? [],
        loading: true,
        loaded: false,
        error: null,
      },
    }));
    (async () => {
      try {
        const response = await fetchSpeciesEnvironmentCategorySamples(
          taxonId,
          selectedVariable,
          selectedCategoryKey,
          { location: locationGid ?? undefined },
        );
        if (cancelled) {
          return;
        }
        setCategorySamplesByValue((prev) => ({
          ...prev,
          [selectedCategoryKey]: {
            observations: response.observations ?? [],
            loading: false,
            loaded: true,
            error: null,
          },
        }));
      } catch (err) {
        if (cancelled) {
          return;
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to load category observations.';
        setCategorySamplesByValue((prev) => ({
          ...prev,
          [selectedCategoryKey]: {
            observations: [],
            loading: false,
            loaded: true,
            error: errorMessage,
          },
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isCategorical,
    selectedCategoryKey,
    selectedCategorySampleState?.loaded,
    selectedCategorySampleState?.loading,
    selectedVariable,
    taxonId,
    locationGid,
    units,
  ]);

  const handleDensitySelectionChange = React.useCallback((range: DensitySelectionRange | null) => {
    setSelectedDensityRange(range);
  }, []);

  React.useEffect(() => {
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
  }, [onHighlightChange, selectedDensityRange, selectedVariable, taxonId, locationGid]);

  React.useEffect(() => {
    if (!onHighlightChange) {
      return;
    }
    if (!isCategorical) {
      return;
    }
    if (selectedCategoryValue === null) {
      onHighlightChange([]);
      return;
    }
    const catalogs = (selectedCategorySampleState?.observations ?? [])
      .map((entry) => entry.catalogNumber)
      .filter((id) => typeof id === 'number' || typeof id === 'string');
    if (!catalogs.length) {
      onHighlightChange([]);
      return;
    }
    onHighlightChange(catalogs);
  }, [
    isCategorical,
    onHighlightChange,
    selectedCategorySampleState?.observations,
    selectedCategoryValue,
  ]);

  return {
    selectedCategoryValue,
    setSelectedCategoryValue,
    selectedDensityRange,
    handleDensitySelectionChange,
    rangeObservations,
  };
}