// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchPointEnvironmentValue } from '@/data/api';
import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
import type {
  SpeciesEnvironmentObservation,
  SpeciesEnvironmentStats,
} from '@/data/types';
import React from 'react';
import { CategorySampleState, DensitySelectionRange } from './model';

const DENSITY_SLICE_DEBOUNCE_MS = 200;
type CatalogId = number | string;
type CategorySampleEntry = NonNullable<
  SpeciesEnvironmentStats['categoricalSamples']
>[number];

const isCatalogId = (id: unknown): id is CatalogId =>
  typeof id === 'number' || typeof id === 'string';

const toPlaceholderObservations = (
  ids: CatalogId[],
): SpeciesEnvironmentObservation[] =>
  ids.map((id) => ({
    catalogNumber: id,
    value: null,
    latitude: null,
    longitude: null,
  }));

const toCatalogIdsFromObservations = (
  observations?: SpeciesEnvironmentObservation[] | null,
): CatalogId[] =>
  (observations ?? []).map((entry) => entry.catalogNumber).filter(isCatalogId);

const toCatalogIdsFromCategorySample = (
  sample?: CategorySampleEntry,
): CatalogId[] => (sample?.observationIds ?? []).filter(isCatalogId);

const normalizeCategoryIdentity = (
  value: number | string | null | undefined,
) =>
  typeof value === 'string' ? value.trim().toLowerCase() : String(value ?? '');

const isSyntheticPinnedPoint = (catalogNumber: string | number) =>
  typeof catalogNumber === 'string' && catalogNumber.startsWith('point:');

const resolvePinnedCategoryQueryValue = ({
  stats,
  pointValue,
  pointLabel,
}: {
  stats: SpeciesEnvironmentStats | null;
  pointValue: number | string | null;
  pointLabel: string | null;
}): number | string | null => {
  const normalizedPointValue = normalizeCategoryIdentity(pointValue);
  const normalizedPointLabel = normalizeCategoryIdentity(pointLabel);

  const matchedDistributionValue =
    stats?.categoricalDistribution?.find((category) => {
      const normalizedCategoryValue = normalizeCategoryIdentity(category.value);
      const normalizedCategoryLabel = normalizeCategoryIdentity(
        category.className,
      );
      return (
        normalizedCategoryValue === normalizedPointValue ||
        normalizedCategoryLabel === normalizedPointValue ||
        (normalizedPointLabel.length > 0 &&
          (normalizedCategoryValue === normalizedPointLabel ||
            normalizedCategoryLabel === normalizedPointLabel))
      );
    })?.value ?? null;

  if (matchedDistributionValue !== null) {
    return matchedDistributionValue;
  }

  const matchedSampleValue =
    stats?.categoricalSamples?.find((sample) => {
      const normalizedSampleValue = normalizeCategoryIdentity(sample.value);
      return (
        normalizedSampleValue === normalizedPointValue ||
        (normalizedPointLabel.length > 0 &&
          normalizedSampleValue === normalizedPointLabel)
      );
    })?.value ?? null;

  if (matchedSampleValue !== null) {
    return matchedSampleValue;
  }

  return pointLabel ?? pointValue;
};

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
  /** Optional phenology filter value. */
  phenology?: string | null;
  /** Optional timestamp range filter (Unix seconds). */
  startTimestamp?: number | null;
  endTimestamp?: number | null;
  /** Unit system forwarded to backend highlight endpoints. */
  units?: 'metric' | 'imperial' | undefined;
  /** Callback receiving highlighted catalog numbers. */
  onHighlightChange?: (catalogNumbers: (number | string)[]) => void;
  /** Pinned observation for manual highlighting. */
  pinnedObservation?: {
    catalogNumber: string;
    lat: number;
    lon: number;
  } | null;
};

/** Handles category/range selections and resolves corresponding highlighted observations. */
export function useEnvironmentHighlights({
  taxonId,
  selectedVariable,
  stats,
  isCategorical,
  locationGid,
  phenology,
  startTimestamp,
  endTimestamp,
  units,
  onHighlightChange,
  pinnedObservation,
}: UseEnvironmentHighlightsParams) {
  const speciesDataSource = useSpeciesDataSource();
  const [selectedCategoryValue, setSelectedCategoryValueState] = React.useState<
    number | string | null
  >(null);
  const [categorySamplesByValue, setCategorySamplesByValue] = React.useState<
    Record<string, CategorySampleState>
  >({});
  const [selectedDensityRange, setSelectedDensityRange] =
    React.useState<DensitySelectionRange | null>(null);
  const [rangeObservations, setRangeObservations] = React.useState<
    SpeciesEnvironmentObservation[]
  >([]);
  const categoryRequestRef = React.useRef(0);
  const lastEmittedSignatureRef = React.useRef<string | null>(null);
  const rangeObservationsRef = React.useRef(rangeObservations);
  React.useEffect(() => {
    rangeObservationsRef.current = rangeObservations;
  }, [rangeObservations]);
  const [pinnedValue, setPinnedValue] = React.useState<number | string | null>(
    null,
  );
  const [pinnedValueLabel, setPinnedValueLabel] = React.useState<string | null>(
    null,
  );
  const [pinnedValueDescription, setPinnedValueDescription] = React.useState<
    string | null
  >(null);
  const [pinnedCategoryObserved, setPinnedCategoryObserved] = React.useState<
    boolean | null
  >(null);
  const [pinnedLoading, setPinnedLoading] = React.useState(false);
  const pinnedRequestRef = React.useRef(0);
  const pinnedStateRef = React.useRef({
    value: null as number | string | null,
    label: null as string | null,
    description: null as string | null,
    observed: null as boolean | null,
    loading: false,
  });

  React.useEffect(() => {
    pinnedStateRef.current = {
      value: pinnedValue,
      label: pinnedValueLabel,
      description: pinnedValueDescription,
      observed: pinnedCategoryObserved,
      loading: pinnedLoading,
    };
  }, [
    pinnedCategoryObserved,
    pinnedLoading,
    pinnedValue,
    pinnedValueDescription,
    pinnedValueLabel,
  ]);

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

  const resetPinnedState = React.useCallback(() => {
    const pinnedState = pinnedStateRef.current;

    if (pinnedState.value !== null) {
      setPinnedValue(null);
    }
    if (pinnedState.label !== null) {
      setPinnedValueLabel(null);
    }
    if (pinnedState.description !== null) {
      setPinnedValueDescription(null);
    }
    if (pinnedState.observed !== null) {
      setPinnedCategoryObserved(null);
    }
    if (pinnedState.loading) {
      setPinnedLoading(false);
    }

    pinnedStateRef.current = {
      value: null,
      label: null,
      description: null,
      observed: null,
      loading: false,
    };
  }, []);

  React.useEffect(() => {
    resetHighlightState();
  }, [
    endTimestamp,
    locationGid,
    phenology,
    resetHighlightState,
    selectedVariable,
    startTimestamp,
    taxonId,
    units,
  ]);

  React.useEffect(() => {
    pinnedRequestRef.current += 1;
    resetPinnedState();
  }, [
    endTimestamp,
    locationGid,
    phenology,
    resetPinnedState,
    selectedVariable,
    startTimestamp,
    taxonId,
    units,
  ]);

  React.useEffect(() => {
    if (!pinnedObservation || !selectedVariable) {
      pinnedRequestRef.current += 1;
      resetPinnedState();
      return;
    }
    const requestId = ++pinnedRequestRef.current;
    // For non-categorical variables, prefer the stored index value when the observation
    // is already in rangeObservations. The raster value at lat/lon can differ slightly
    // from the stored occurrence index value, making the pin appear outside the selection arc.
    if (!isCategorical) {
      const stored = rangeObservationsRef.current.find(
        (obs) =>
          obs.catalogNumber === pinnedObservation.catalogNumber &&
          obs.value != null,
      );
      if (stored) {
        setPinnedValue(stored.value ?? null);
        setPinnedValueLabel(null);
        setPinnedValueDescription(null);
        setPinnedCategoryObserved(null);
        setPinnedLoading(false);
        return;
      }
    }
    setPinnedLoading(true);
    void (async () => {
      try {
        const result =
          speciesDataSource.fetchObservationEnvironmentValue &&
          !isSyntheticPinnedPoint(pinnedObservation.catalogNumber)
            ? await speciesDataSource.fetchObservationEnvironmentValue(
                taxonId ?? '',
                pinnedObservation.catalogNumber,
                selectedVariable,
                {
                  location: locationGid ?? undefined,
                  units,
                  phenology: phenology ?? undefined,
                  startTs: startTimestamp ?? undefined,
                  endTs: endTimestamp ?? undefined,
                },
              )
            : await fetchPointEnvironmentValue(
                pinnedObservation.lat,
                pinnedObservation.lon,
                selectedVariable,
                {
                  units,
                  ...(!isSyntheticPinnedPoint(
                    pinnedObservation.catalogNumber,
                  ) && taxonId
                    ? {
                        taxonId,
                        catalogNumber: pinnedObservation.catalogNumber,
                      }
                    : {}),
                },
              );
        if (pinnedRequestRef.current !== requestId) {
          return;
        }
        setPinnedValue(result.value);
        setPinnedValueLabel(result.valueLabel ?? null);
        setPinnedValueDescription(result.valueDescription ?? null);
        if (!isCategorical || result.value === null || !taxonId) {
          setPinnedCategoryObserved(null);
        } else {
          try {
            const categoryQueryValue = resolvePinnedCategoryQueryValue({
              stats,
              pointValue: result.value,
              pointLabel: result.valueLabel ?? null,
            });
            if (categoryQueryValue === null) {
              setPinnedCategoryObserved(null);
              return;
            }
            // If the distribution keyed entries by label rather than a code
            // (e.g. the API stores 'Closed evergreen...' as category.value),
            // categoryQueryValue will equal valueLabel. Use result.value (the
            // numeric code) for the API call instead, since that's what the
            // /class/:classValue endpoint expects.
            const effectiveCategoryQueryValue =
              result.valueLabel != null &&
              String(categoryQueryValue) === String(result.valueLabel)
                ? result.value
                : categoryQueryValue;
            const categoryResponse =
              await speciesDataSource.fetchSpeciesEnvironmentCategorySamples(
                taxonId,
                selectedVariable,
                effectiveCategoryQueryValue ?? categoryQueryValue,
                {
                  location: locationGid ?? undefined,
                  units,
                  phenology: phenology ?? undefined,
                  startTs: startTimestamp ?? undefined,
                  endTs: endTimestamp ?? undefined,
                },
              );
            if (pinnedRequestRef.current !== requestId) {
              return;
            }
            const observedCount =
              typeof categoryResponse.count === 'number'
                ? categoryResponse.count
                : (categoryResponse.observations?.length ?? 0);
            setPinnedCategoryObserved(observedCount > 0);
          } catch {
            if (pinnedRequestRef.current !== requestId) {
              return;
            }
            setPinnedCategoryObserved(null);
          }
        }
      } catch {
        if (pinnedRequestRef.current !== requestId) {
          return;
        }
        setPinnedValue(null);
        setPinnedValueLabel(null);
        setPinnedValueDescription(null);
        setPinnedCategoryObserved(null);
      } finally {
        if (pinnedRequestRef.current === requestId) {
          setPinnedLoading(false);
        }
      }
    })();
  }, [
    endTimestamp,
    locationGid,
    isCategorical,
    phenology,
    pinnedObservation,
    resetPinnedState,
    selectedVariable,
    speciesDataSource,
    startTimestamp,
    taxonId,
    stats,
    units,
  ]);

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
        if (
          !Array.isArray(entry.observationIds) ||
          !entry.observationIds.length
        ) {
          return;
        }
        const existing = next[key];
        if (existing && existing.loaded && existing.observations.length) {
          return;
        }
        next[key] = {
          observations: toPlaceholderObservations(
            entry.observationIds.filter(isCatalogId),
          ),
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
        const preloaded = stats.categoricalSamples.find(
          (entry) => String(entry.value) === nextKey,
        );
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
          const response =
            await speciesDataSource.fetchSpeciesEnvironmentCategorySamples(
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
            err instanceof Error
              ? err.message
              : 'Failed to load category observations.';
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
      speciesDataSource,
      taxonId,
      units,
    ],
  );

  const setSelectedCategoryValue = React.useCallback(
    (nextValueOrUpdater: React.SetStateAction<number | string | null>) => {
      const nextValue =
        typeof nextValueOrUpdater === 'function'
          ? (
              nextValueOrUpdater as (
                previous: number | string | null,
              ) => number | string | null
            )(selectedCategoryValue)
          : nextValueOrUpdater;
      const currentKey =
        selectedCategoryValue !== null ? String(selectedCategoryValue) : null;
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
    if (
      !isCategorical ||
      !onHighlightChange ||
      selectedCategoryValue === null
    ) {
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

  const handleDensitySelectionChange = React.useCallback(
    (range: DensitySelectionRange | null) => {
      setSelectedDensityRange(range);
    },
    [],
  );

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
    const { start, end } = selectedDensityRange;
    // Circular variables (e.g. aspect_deg 0–360°) can produce a wrap-around arc
    // where start > end (e.g. 315° → 45°). Split into two linear slices and merge.
    const isWrapped = start > end;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const sliceParams = isWrapped
            ? [
                { min: start, max: 360 },
                { min: 0, max: end },
              ]
            : [{ min: start, max: end }];

          const responses = await Promise.all(
            sliceParams.map((range) =>
              speciesDataSource.fetchEnvironmentRangeSlice({
                taxonId,
                variableId: selectedVariable,
                min: range.min,
                max: range.max,
                location: locationGid ?? undefined,
                units,
                phenology: phenology ?? undefined,
                startTs: startTimestamp ?? undefined,
                endTs: endTimestamp ?? undefined,
              }),
            ),
          );

          if (cancelled) {
            return;
          }
          const seen = new Set<number | string>();
          const observations: SpeciesEnvironmentObservation[] = [];
          for (const response of responses) {
            for (const obs of response.observations ?? []) {
              const id = obs.catalogNumber;
              if (id !== null && id !== undefined && !seen.has(id)) {
                seen.add(id);
                observations.push(obs);
              }
            }
          }
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
  }, [
    emitHighlightChange,
    endTimestamp,
    isCategorical,
    locationGid,
    phenology,
    selectedDensityRange,
    selectedVariable,
    speciesDataSource,
    startTimestamp,
    taxonId,
    units,
  ]);

  return {
    selectedCategoryValue,
    setSelectedCategoryValue,
    selectedDensityRange,
    handleDensitySelectionChange,
    rangeObservations,
    pinnedClassName: pinnedValueLabel,
    pinnedNoData:
      pinnedValue === null &&
      pinnedValueLabel === null &&
      pinnedValueDescription === null,
    pinnedValueLabel,
    pinnedValueDescription,
    pinnedCategoryObserved,
    pinnedValue,
    pinnedLoading,
  };
}
