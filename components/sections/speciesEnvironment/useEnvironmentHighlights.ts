// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchPointEnvironmentValue } from '@/data/api';
import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
import type {
  ExtraVariableFilter,
  SpeciesEnvironmentObservation,
  SpeciesEnvironmentStats,
} from '@/data/types';
import React from 'react';
import {
  CategorySampleState,
  ChainedVariableFilter,
  DensitySelectionRange,
} from './model';

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

// A chained filter's classValue must be the raw numeric class code (see
// ExtraVariableFilter) — the backend's /slice and /class/:value/samples
// endpoints both key categorical values by that code. selectedCategoryValue
// here can arrive as a plain number (remote data source) or a resolved
// metric-string key like "class_52" (local upload data source) — strip a
// "class_" prefix before parsing so both shapes resolve to the same code.
const toNumericClassValue = (value: number | string): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const stripped = value.startsWith('class_') ? value.slice(6) : value;
  const parsed = Number(stripped);
  return Number.isFinite(parsed) ? parsed : null;
};

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
  /** When false, suppresses slice and category-sample network requests. */
  slicingEnabled?: boolean;
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
  slicingEnabled = true,
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

  // Slices/category selections stashed from variables the user has since
  // switched away from — applied as additional `extra` filters onto
  // whatever variable is selected now, so switching variables no longer
  // discards an active slice, it chains onto it instead. Cleared entirely
  // on a genuine context change (location/phenology/timestamp/units/taxon),
  // same as the old single-slice behavior for those.
  const [activeChain, setActiveChain] = React.useState<ChainedVariableFilter[]>(
    [],
  );
  // Tracks which variable + mode the CURRENT selectedDensityRange/
  // selectedCategoryValue belongs to, plus its already-resolved display
  // label — set at the moment a selection is made (when `stats` reliably
  // still matches that variable), not derived at variable-switch time
  // (when `stats`/isCategorical may have already flipped to the new
  // variable, same synchronous-prop-update hazard as elsewhere in this
  // codebase's variable-switch handling).
  const selectionMetaRef = React.useRef<{
    variableId: string;
    isCategorical: boolean;
    label: string;
  } | null>(null);
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
    // Preserve reference identity when already empty (as it is on every
    // mount) — callers may derive a signal from activeChain's *reference*
    // changing (see useSpeciesEnvironmentState's stats-refetch bridge), and
    // a no-op reset shouldn't look like a real chain change to them.
    setActiveChain((prev) => (prev.length === 0 ? prev : []));
    selectionMetaRef.current = null;
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

  // A genuine context change (not just switching which variable is
  // selected) invalidates any chained filters too — the whole underlying
  // dataset shifted, so there's nothing meaningful left to chain onto.
  React.useEffect(() => {
    resetHighlightState();
  }, [
    endTimestamp,
    locationGid,
    phenology,
    resetHighlightState,
    startTimestamp,
    taxonId,
    units,
  ]);

  // Switching the selected variable, by contrast, stashes whatever
  // selection was active on the OUTGOING variable onto the chain instead of
  // discarding it — that's what lets a slice from one variable stay applied
  // while looking at another. If the INCOMING variable already has a
  // stashed entry (the user switched back to it), that entry is restored
  // as the live selection instead of staying chained, so it's visible/
  // editable again rather than orphaned.
  const previousVariableRef = React.useRef(selectedVariable);
  React.useEffect(() => {
    if (previousVariableRef.current === selectedVariable) {
      return;
    }
    const outgoingVariableId = previousVariableRef.current;
    previousVariableRef.current = selectedVariable;

    const outgoingMeta = selectionMetaRef.current;
    let nextChain = activeChain;
    if (outgoingMeta && outgoingMeta.variableId === outgoingVariableId) {
      const entry: ChainedVariableFilter | null = outgoingMeta.isCategorical
        ? selectedCategoryValue === null
          ? null
          : (() => {
              const numericValue = toNumericClassValue(selectedCategoryValue);
              return numericValue === null
                ? null
                : {
                    variableId: outgoingVariableId,
                    isCategorical: true,
                    extra: { variableId: outgoingVariableId, classValue: numericValue },
                    label: outgoingMeta.label,
                    originalCategoryValue: selectedCategoryValue,
                  };
            })()
        : selectedDensityRange === null
          ? null
          : {
              variableId: outgoingVariableId,
              isCategorical: false,
              extra: {
                variableId: outgoingVariableId,
                min: selectedDensityRange.start,
                max: selectedDensityRange.end,
              },
              label: outgoingMeta.label,
              originalRange: selectedDensityRange,
            };
      if (entry) {
        nextChain = [
          ...activeChain.filter((e) => e.variableId !== outgoingVariableId),
          entry,
        ];
      }
    }
    selectionMetaRef.current = null;

    const restored = nextChain.find((e) => e.variableId === selectedVariable);
    categoryRequestRef.current += 1;
    setCategorySamplesByValue({});
    setRangeObservations([]);
    if (restored) {
      setActiveChain(
        nextChain.filter((e) => e.variableId !== selectedVariable),
      );
      selectionMetaRef.current = {
        variableId: selectedVariable,
        isCategorical: restored.isCategorical,
        label: restored.label,
      };
      if (restored.isCategorical) {
        setSelectedCategoryValueState(restored.originalCategoryValue ?? null);
        setSelectedDensityRange(null);
      } else {
        setSelectedDensityRange(restored.originalRange ?? null);
        setSelectedCategoryValueState(null);
      }
    } else {
      setActiveChain(nextChain);
      setSelectedCategoryValueState(null);
      setSelectedDensityRange(null);
    }
    // The slice/category-fetch effects below react to the resulting
    // selectedDensityRange/selectedCategoryValue/activeChain changes and
    // will emit the correct (non-empty) highlight set once they resolve —
    // but that's an async fetch, same as the earlier marker-color flicker.
    // Clearing to [] here unconditionally means the map shows every dot
    // "unfiltered" for that gap before narrowing back down: a visible
    // flicker, not a fix. Only clear now when there's genuinely nothing
    // left to filter by (no chain, nothing restored) — otherwise hold
    // whatever's currently displayed until the real data lands, same
    // "don't update until ready" approach as the color fix.
    if (nextChain.length === 0 && !restored) {
      emitHighlightChange([]);
    }
  }, [selectedVariable, activeChain, emitHighlightChange, selectedCategoryValue, selectedDensityRange]);

  const removeChainedFilter = React.useCallback((variableId: string) => {
    setActiveChain((prev) => {
      const next = prev.filter((e) => e.variableId !== variableId);
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const clearChain = React.useCallback(() => {
    setActiveChain((prev) => (prev.length === 0 ? prev : []));
  }, []);

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
    //
    // Gated on selectedDensityRange specifically: rangeObservations is no
    // longer guaranteed to hold THIS variable's own values — the chain-only
    // fallback effect also populates it, from whichever OTHER variable is
    // primary in the chain, whenever nothing is selected on the current
    // one. Without this gate, a categorical chain entry's class code (e.g.
    // a Köppen-Geiger zone id) could get read as if it were this numeric
    // variable's value. selectedDensityRange is only ever set by a live
    // slice on THIS variable, so its presence is what actually confirms
    // rangeObservations.value here means what this code assumes it means.
    if (!isCategorical && selectedDensityRange) {
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
        if (
          !isCategorical ||
          result.value === null ||
          !taxonId ||
          !slicingEnabled
        ) {
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
    selectedDensityRange,
    selectedVariable,
    speciesDataSource,
    startTimestamp,
    taxonId,
    stats,
    units,
    slicingEnabled,
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
      // Neither the per-value cache nor the preloaded stats.categoricalSamples
      // shortcut below account for chained filters from other variables —
      // both were populated (or would be populated) against the unfiltered
      // set, so a chain in effect means always going to the network instead.
      const hasActiveChain = activeChain.length > 0;
      const cached = hasActiveChain ? undefined : categorySamplesByValue[nextKey];
      if (cached?.loaded && !cached.error) {
        emitHighlightChange(toCatalogIdsFromObservations(cached.observations));
        return;
      }

      if (!hasActiveChain && !locationGid && stats?.categoricalSamples?.length) {
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

      if (!isCategorical || !taxonId || !selectedVariable || !slicingEnabled) {
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
              {
                location: locationGid ?? undefined,
                units,
                extra: activeChain.map((f) => f.extra),
              },
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
      activeChain,
      categorySamplesByValue,
      emitHighlightChange,
      isCategorical,
      locationGid,
      selectedVariable,
      stats?.categoricalSamples,
      speciesDataSource,
      taxonId,
      units,
      slicingEnabled,
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
        selectionMetaRef.current = null;
        emitHighlightChange([]);
        return;
      }

      setSelectedCategoryValueState(nextValue);
      // Resolved now, while `stats` still reliably matches selectedVariable
      // — see selectionMetaRef's own comment for why this can't wait until
      // the variable-switch effect runs.
      const label =
        stats?.categoricalDistribution?.find(
          (category) => String(category.value) === nextKey,
        )?.className ?? nextKey;
      selectionMetaRef.current = {
        variableId: selectedVariable,
        isCategorical: true,
        label,
      };
      if (!stats) {
        return;
      }
      resolveCategorySelection(nextKey);
    },
    [
      emitHighlightChange,
      resolveCategorySelection,
      selectedCategoryValue,
      selectedVariable,
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
      if (!range) {
        selectionMetaRef.current = null;
        return;
      }
      const startLabel = range.displayStart ?? range.start;
      const endLabel = range.displayEnd ?? range.end;
      selectionMetaRef.current = {
        variableId: selectedVariable,
        isCategorical: false,
        label: `${startLabel}–${endLabel}`,
      };
    },
    [selectedVariable],
  );

  React.useEffect(() => {
    if (isCategorical) {
      setRangeObservations([]);
      return;
    }
    if (!taxonId || !selectedVariable || !slicingEnabled) {
      setRangeObservations([]);
      emitHighlightChange([]);
      return;
    }
    if (!selectedDensityRange) {
      // Nothing selected on the CURRENT variable. If a chain is active, the
      // chain-only fallback effect below owns applying/emitting it instead
      // — clearing here unconditionally would immediately wipe out
      // whatever that effect just set, since both react to activeChain
      // changing (switching variables changes both at once).
      if (activeChain.length === 0) {
        setRangeObservations([]);
        emitHighlightChange([]);
      }
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
                extra: activeChain.map((f) => f.extra),
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
    activeChain,
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
    slicingEnabled,
  ]);

  // When nothing is selected on the CURRENT variable but the chain isn't
  // empty, the view should still reflect the chained filter(s) on their
  // own — otherwise switching to a fresh variable shows the fully
  // unfiltered dataset until the user ALSO slices that variable, even
  // though a slice from a previous variable is meant to still be in
  // effect. Treats the first chain entry as the "primary" request (as it
  // would have been before it was stashed) and the rest as `extra`.
  React.useEffect(() => {
    if (selectedDensityRange || selectedCategoryValue !== null) {
      // The effects above already cover "there's a live selection".
      return;
    }
    if (activeChain.length === 0 || !taxonId || !slicingEnabled) {
      return;
    }
    const [primary, ...rest] = activeChain;
    const extra = rest.map((f) => f.extra);
    let cancelled = false;
    void (async () => {
      try {
        if (primary.isCategorical) {
          if (!('classValue' in primary.extra)) {
            return;
          }
          const response =
            await speciesDataSource.fetchSpeciesEnvironmentCategorySamples(
              taxonId,
              primary.variableId,
              primary.extra.classValue,
              { location: locationGid ?? undefined, units, extra },
            );
          if (cancelled) {
            return;
          }
          const observations = response.observations ?? [];
          setRangeObservations(observations);
          emitHighlightChange(toCatalogIdsFromObservations(observations));
          return;
        }
        if (!('min' in primary.extra)) {
          return;
        }
        const { min, max } = primary.extra;
        const isWrapped = min > max;
        const sliceParams = isWrapped
          ? [
              { min, max: 360 },
              { min: 0, max },
            ]
          : [{ min, max }];
        const responses = await Promise.all(
          sliceParams.map((range) =>
            speciesDataSource.fetchEnvironmentRangeSlice({
              taxonId,
              variableId: primary.variableId,
              min: range.min,
              max: range.max,
              location: locationGid ?? undefined,
              units,
              phenology: phenology ?? undefined,
              startTs: startTimestamp ?? undefined,
              endTs: endTimestamp ?? undefined,
              extra,
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
    return () => {
      cancelled = true;
    };
  }, [
    activeChain,
    selectedVariable,
    selectedDensityRange,
    selectedCategoryValue,
    taxonId,
    locationGid,
    phenology,
    startTimestamp,
    endTimestamp,
    units,
    slicingEnabled,
    speciesDataSource,
    emitHighlightChange,
  ]);

  return {
    selectedCategoryValue,
    setSelectedCategoryValue,
    selectedDensityRange,
    handleDensitySelectionChange,
    rangeObservations,
    activeChain,
    removeChainedFilter,
    clearChain,
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
