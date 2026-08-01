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
import {
  CategorySampleState,
  ChainedVariableFilter,
  DensitySelectionRange,
  joinClassNamesWithAnd,
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
// endpoints both key categorical values by that code. Each of
// selectedCategoryValues here can arrive as a plain number (remote data
// source) or a resolved
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

// Stable identity for a density range — used to detect "the user
// clicked/dragged this exact range again" (toggle it off) when multiple
// ranges are selected at once.
const densityRangeKey = (range: DensitySelectionRange): string =>
  `${range.start}_${range.end}`;

const formatDensityRangeLabel = (range: DensitySelectionRange): string => {
  const start = range.displayStart ?? range.start;
  const end = range.displayEnd ?? range.end;
  return `${start}–${end}`;
};

/** Whether `value` falls within `range` — `range.start > range.end` means a
 * circular (aspect-style) wraparound arc through 0/360, e.g. {start:350,
 * end:20} covers 350→360 and 0→20. A plain continuous range never wraps
 * (start <= end always), so this degrades to a normal bounds check there. */
const densityRangeContainsValue = (
  range: DensitySelectionRange,
  value: number,
): boolean =>
  range.start <= range.end
    ? value >= range.start && value <= range.end
    : value >= range.start || value <= range.end;

const DENSITY_CIRCULAR_MAX = 360;

/** Collapses overlapping/touching/subsuming ranges into their minimal
 * combined set — e.g. two disjoint drags that end up overlapping become one
 * range spanning both. Ranges with `start > end` (only ever produced by a
 * circular/aspect-style variable) represent a wraparound arc through 0/360;
 * each is split into up to two plain [start,end] segments before merging (a
 * continuous, non-circular range never has start > end, so this is a no-op
 * for those), then any segment pair straddling the 0/360 seam is recombined
 * back into a single wrapped range afterward. */
const mergeDensityRanges = (
  ranges: DensitySelectionRange[],
): DensitySelectionRange[] => {
  if (ranges.length <= 1) {
    return ranges;
  }
  type Segment = { start: number; end: number };
  const segments: Segment[] = [];
  for (const r of ranges) {
    if (r.start <= r.end) {
      segments.push({ start: r.start, end: r.end });
    } else {
      segments.push({ start: r.start, end: DENSITY_CIRCULAR_MAX });
      segments.push({ start: 0, end: r.end });
    }
  }
  segments.sort((a, b) => a.start - b.start);
  const merged: Segment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && seg.start <= last.end) {
      last.end = Math.max(last.end, seg.end);
    } else {
      merged.push({ ...seg });
    }
  }
  // Recombine a segment touching the 0/360 seam on both sides back into one
  // wrapped range — e.g. [350,360] + [0,20] merged separately above become
  // one {start:350, end:20} arc. Only when there's more than one merged
  // segment left: if everything collapsed into a single [0,360] segment,
  // that's a full circle, not a wraparound, and is left as-is (capped below
  // FULL_CIRCLE_SPAN_THRESHOLD's convention of never hitting exactly 360).
  if (
    merged.length > 1 &&
    merged[0].start === 0 &&
    merged[merged.length - 1].end === DENSITY_CIRCULAR_MAX
  ) {
    const last = merged.pop()!;
    merged[0] = { start: last.start, end: merged[0].end };
  }
  return merged.map((seg) => ({
    start: seg.start,
    // A lingering end of exactly 360 only ever comes from this function's
    // own wraparound-splitting above (real per-drag ranges cap at 359.9,
    // matching useCircularDragSelection's own convention) — normalize back
    // to that same convention rather than leaking the internal 360 sentinel.
    end: seg.end === DENSITY_CIRCULAR_MAX ? 359.9 : seg.end,
  }));
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
  const [selectedCategoryValues, setSelectedCategoryValuesState] =
    React.useState<(number | string)[]>([]);
  // Authoritative "current" selection, updated eagerly (not just via the
  // state setter) so a rapid second selectCategoryValue call — e.g. two
  // ctrl-clicks in quick succession, both scheduled via startTransition
  // before the first one's re-render commits — computes its additive
  // toggle against the REAL latest selection instead of a stale snapshot
  // captured from render scope. Same ref-mirrors-state pattern as
  // activeChainRef elsewhere in this codebase.
  const selectedCategoryValuesRef = React.useRef<(number | string)[]>([]);
  const setSelectedCategoryValues = React.useCallback(
    (next: (number | string)[]) => {
      selectedCategoryValuesRef.current = next;
      setSelectedCategoryValuesState(next);
    },
    [],
  );
  const [categorySamplesByValue, setCategorySamplesByValue] = React.useState<
    Record<string, CategorySampleState>
  >({});
  const [selectedDensityRanges, setSelectedDensityRangesState] = React.useState<
    DensitySelectionRange[]
  >([]);
  // Same eager-ref-mirror pattern as selectedCategoryValuesRef — protects
  // against two rapid selectDensityRange calls (e.g. ctrl-click on two
  // histogram bars in quick succession, batched via startTransition) both
  // computing their additive toggle against the same stale pre-update
  // snapshot.
  const selectedDensityRangesRef = React.useRef<DensitySelectionRange[]>([]);
  const setSelectedDensityRanges = React.useCallback(
    (next: DensitySelectionRange[]) => {
      selectedDensityRangesRef.current = next;
      setSelectedDensityRangesState(next);
    },
    [],
  );
  const [rangeSamplesByKey, setRangeSamplesByKey] = React.useState<
    Record<string, CategorySampleState>
  >({});
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
  // Tracks which variable + mode the CURRENT selectedDensityRanges/
  // selectedCategoryValues belongs to, plus its already-resolved display
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
    if (selectedCategoryValuesRef.current.length !== 0) {
      setSelectedCategoryValues([]);
    }
    if (selectedDensityRangesRef.current.length !== 0) {
      setSelectedDensityRanges([]);
    }
    setRangeObservations([]);
    setCategorySamplesByValue({});
    setRangeSamplesByKey({});
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
        ? (() => {
            if (selectedCategoryValues.length === 0) return null;
            const numericValues = selectedCategoryValues
              .map(toNumericClassValue)
              .filter((v): v is number => v !== null);
            return numericValues.length === 0
              ? null
              : {
                  variableId: outgoingVariableId,
                  isCategorical: true,
                  extra: {
                    variableId: outgoingVariableId,
                    classValues: numericValues,
                  },
                  label: outgoingMeta.label,
                  originalCategoryValues: selectedCategoryValues,
                };
          })()
        : (() => {
            if (selectedDensityRanges.length === 0) return null;
            return {
              variableId: outgoingVariableId,
              isCategorical: false,
              extra:
                selectedDensityRanges.length === 1
                  ? {
                      variableId: outgoingVariableId,
                      min: selectedDensityRanges[0].start,
                      max: selectedDensityRanges[0].end,
                    }
                  : {
                      variableId: outgoingVariableId,
                      ranges: selectedDensityRanges.map((r) => ({
                        min: r.start,
                        max: r.end,
                      })),
                    },
              label: outgoingMeta.label,
              originalRanges: selectedDensityRanges,
            };
          })();
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
    setRangeSamplesByKey({});
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
        setSelectedCategoryValues(restored.originalCategoryValues ?? []);
        setSelectedDensityRanges([]);
      } else {
        setSelectedDensityRanges(restored.originalRanges ?? []);
        setSelectedCategoryValues([]);
      }
    } else {
      setActiveChain(nextChain);
      setSelectedCategoryValues([]);
      setSelectedDensityRanges([]);
    }
    // The slice/category-fetch effects below react to the resulting
    // selectedDensityRanges/selectedCategoryValues/activeChain changes and
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
  }, [
    selectedVariable,
    activeChain,
    emitHighlightChange,
    selectedCategoryValues,
    selectedDensityRanges,
  ]);

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
    // Gated on selectedDensityRanges specifically: rangeObservations is no
    // longer guaranteed to hold THIS variable's own values — the chain-only
    // fallback effect also populates it, from whichever OTHER variable is
    // primary in the chain, whenever nothing is selected on the current
    // one. Without this gate, a categorical chain entry's class code (e.g.
    // a Köppen-Geiger zone id) could get read as if it were this numeric
    // variable's value. selectedDensityRanges is only ever set by a live
    // slice on THIS variable, so its presence is what actually confirms
    // rangeObservations.value here means what this code assumes it means.
    if (!isCategorical && selectedDensityRanges.length > 0) {
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
    selectedDensityRanges,
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

  // Resolves ONE category key into categorySamplesByValue's cache — it
  // never emits a highlight itself. With multi-select, several keys can be
  // resolving independently/at different speeds; if each one emitted its
  // own result the map would flicker through partial unions as each
  // request landed. A separate effect below watches
  // categorySamplesByValue + selectedCategoryValues and emits the UNION
  // once every currently-selected key has settled.
  const resolveCategorySelection = React.useCallback(
    (nextKey: string) => {
      // Neither the per-value cache nor the preloaded stats.categoricalSamples
      // shortcut below account for chained filters from other variables —
      // both were populated (or would be populated) against the unfiltered
      // set, so a chain in effect means always going to the network instead.
      const hasActiveChain = activeChain.length > 0;
      const cached = hasActiveChain
        ? undefined
        : categorySamplesByValue[nextKey];
      if (cached?.loaded && !cached.error) {
        return;
      }

      if (
        !hasActiveChain &&
        !locationGid &&
        stats?.categoricalSamples?.length
      ) {
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
          return;
        }
      }

      if (!isCategorical || !taxonId || !selectedVariable || !slicingEnabled) {
        setCategorySamplesByValue((prev) => ({
          ...prev,
          [nextKey]: {
            observations: [],
            loading: false,
            loaded: true,
            error: null,
          },
        }));
        return;
      }

      // Reads (never bumps) the shared generation counter — categoryRequestRef
      // is also used elsewhere as a genuine "everything in flight is now
      // stale" reset signal (resetHighlightState, variable switches, clearing
      // the selection). Bumping it here too, per individual key, used to mean
      // resolving key B while key A's fetch was still in flight made A's own
      // response look stale and get silently dropped — exactly the bug where
      // a multi-select never finished resolving every selected class (worse
      // the more classes selected at once, e.g. ordinal variables with many
      // classes). Capturing the CURRENT generation instead of minting a new
      // one means concurrent per-key fetches no longer invalidate each other,
      // and are still correctly invalidated together on a genuine reset.
      const requestId = categoryRequestRef.current;
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
        }
      })();
    },
    [
      activeChain,
      categorySamplesByValue,
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

  // Clicking a value that's already selected always just removes it —
  // whether the click was additive (ctrl/cmd) or not, and regardless of how
  // many other values are currently selected — since replacing a multi-
  // select down to just the clicked value on a plain click would silently
  // discard the rest of the selection with no way to tell it was intended.
  // Clicking a NOT-yet-selected value adds it when additive (ctrl/cmd), or
  // — only when there's zero or one value currently selected — replaces the
  // selection with just it (plain click starting fresh, or swapping a
  // single selection for another). A plain click on an unselected value
  // while a MULTI-selection is already active does nothing at all: without
  // ctrl/cmd held there's no way to tell "start fresh" apart from "add to
  // this", so it's treated as a no-op rather than silently discarding the
  // rest of the selection.
  const selectCategoryValue = React.useCallback(
    (value: number | string, options?: { additive?: boolean }) => {
      const key = String(value);
      const additive = options?.additive ?? false;
      const current = selectedCategoryValuesRef.current;
      const alreadySelected = current.some((v) => String(v) === key);
      if (!alreadySelected && !additive && current.length > 1) {
        return;
      }
      const nextValues = alreadySelected
        ? current.filter((v) => String(v) !== key)
        : additive
          ? [...current, value]
          : [value];

      if (nextValues.length === 0) {
        categoryRequestRef.current += 1;
        setSelectedCategoryValues([]);
        selectionMetaRef.current = null;
        emitHighlightChange([]);
        return;
      }

      setSelectedCategoryValues(nextValues);
      // Resolved now, while `stats` still reliably matches selectedVariable
      // — see selectionMetaRef's own comment for why this can't wait until
      // the variable-switch effect runs.
      const label = joinClassNamesWithAnd(
        nextValues.map(
          (v) =>
            stats?.categoricalDistribution?.find(
              (category) => String(category.value) === String(v),
            )?.className ?? String(v),
        ),
      );
      selectionMetaRef.current = {
        variableId: selectedVariable,
        isCategorical: true,
        label,
      };
      // Resolution itself is left entirely to the reactive effect below
      // (which watches selectedCategoryValues + categorySamplesByValue) —
      // it already guards on state?.loading/state?.loaded correctly.
      // Calling resolveCategorySelection directly here too, for every
      // value in nextValues on EVERY call, used to re-trigger a duplicate
      // fetch for values that were already loaded/in-flight from a prior
      // call (its own cache guard only checked `loaded`, not `loading`) —
      // harmless in effect but wasteful, and needlessly re-triggers a
      // network request each time another value is added to the selection.
    },
    [emitHighlightChange, selectedVariable, stats],
  );

  // Emits the UNION of every currently-selected key's resolved
  // observations — but only once ALL of them have settled (loaded, not
  // loading, no error), so a multi-select never flashes a partial union as
  // each key's fetch lands at a different time.
  React.useEffect(() => {
    if (
      !isCategorical ||
      !onHighlightChange ||
      selectedCategoryValues.length === 0
    ) {
      return;
    }
    const keys = selectedCategoryValues.map((v) => String(v));
    const states = keys.map((key) => categorySamplesByValue[key]);
    if (
      states.some((state) => !state?.loaded || state.loading || state.error)
    ) {
      return;
    }
    const seen = new Set<CatalogId>();
    const merged: SpeciesEnvironmentObservation[] = [];
    for (const state of states) {
      for (const obs of state?.observations ?? []) {
        if (!seen.has(obs.catalogNumber)) {
          seen.add(obs.catalogNumber);
          merged.push(obs);
        }
      }
    }
    emitHighlightChange(toCatalogIdsFromObservations(merged));
  }, [
    categorySamplesByValue,
    emitHighlightChange,
    isCategorical,
    onHighlightChange,
    selectedCategoryValues,
  ]);

  React.useEffect(() => {
    if (!isCategorical || !stats || selectedCategoryValues.length === 0) {
      return;
    }
    for (const value of selectedCategoryValues) {
      const key = String(value);
      const state = categorySamplesByValue[key];
      if (state?.loading || state?.loaded) {
        continue;
      }
      resolveCategorySelection(key);
    }
  }, [
    categorySamplesByValue,
    isCategorical,
    resolveCategorySelection,
    selectedCategoryValues,
    stats,
  ]);

  // Replaces the whole selection with just this one range — unless it's
  // already selected, in which case it's removed instead (regardless of
  // `additive`; see below) — UNLESS `options.discrete` is set (histogram
  // bars, which behave exactly like category pills/bar segments) and 2+
  // ranges are already selected, in which case a plain click on a
  // not-yet-selected bar is a no-op rather than silently collapsing the
  // multi-selection down to just that bar. Continuous/circular charts don't
  // get that no-op treatment: a plain drag there always defines a brand new
  // selection and wipes whatever was selected before, since there's no
  // discrete "click an existing thing" gesture to protect there (dragging
  // is inherently a fresh gesture each time). `additive` (shift/cmd-drag on
  // the continuous/circular charts, ctrl/cmd-click on a discrete bar)
  // instead adds this range to whatever's currently selected.
  // `range === null` (a tap without a drag on a continuous/circular chart)
  // clears the whole selection.
  // Tracks the in-progress additive drag's own slot in selectedDensityRanges
  // — a continuous drag calls this on every mousemove frame (live preview)
  // plus once more on release, all for what's conceptually ONE gesture. Each
  // of those calls needs to keep updating the SAME array entry (the range
  // currently being dragged), not append a new one every frame — otherwise
  // one ctrl-drag would flood the selection with dozens of near-duplicate
  // ranges. `sessionId` (from DensityChart/PolarDensityChart, incremented
  // once per new gesture) is how a run of calls is recognized as "the same
  // drag" versus "a new one has started".
  const activeDragSessionRef = React.useRef<{
    id: number;
    index: number;
  } | null>(null);

  const selectDensityRange = React.useCallback(
    (
      range: DensitySelectionRange | null,
      options?: {
        additive?: boolean;
        discrete?: boolean;
        sessionId?: number;
        /** True only on the call that finalizes a drag (release/terminate),
         * never on a live in-progress move — merging overlapping ranges only
         * happens here, so a live-dragged range doesn't visually snap
         * together with an already-committed one mid-drag, only once the
         * gesture actually ends. */
        final?: boolean;
      },
    ) => {
      if (range === null) {
        // An additive drag that hasn't moved far enough yet to register a
        // real range (or ended without ever doing so) calls this — it's
        // NOT the user asking to clear the whole multi-selection, just
        // "nothing new from THIS gesture yet". Only remove this session's
        // own tentative slot (if it had already appended one), leaving the
        // rest of the selection untouched. A plain (non-additive) null — a
        // genuine tap-to-clear — still clears everything.
        if (options?.additive && options?.sessionId != null) {
          if (activeDragSessionRef.current?.id === options.sessionId) {
            const index = activeDragSessionRef.current.index;
            const current = selectedDensityRangesRef.current;
            const nextRanges = current.filter((_, i) => i !== index);
            activeDragSessionRef.current = null;
            setSelectedDensityRanges(nextRanges);
            if (nextRanges.length === 0) {
              selectionMetaRef.current = null;
              emitHighlightChange([]);
            } else {
              selectionMetaRef.current = {
                variableId: selectedVariable,
                isCategorical: false,
                label: joinClassNamesWithAnd(
                  nextRanges.map(formatDensityRangeLabel),
                ),
              };
            }
          }
          return;
        }
        activeDragSessionRef.current = null;
        setSelectedDensityRanges([]);
        selectionMetaRef.current = null;
        emitHighlightChange([]);
        return;
      }
      const additive = options?.additive ?? false;
      const discrete = options?.discrete ?? false;
      const current = selectedDensityRangesRef.current;

      let nextRanges: DensitySelectionRange[];
      if (additive && options?.sessionId != null) {
        if (activeDragSessionRef.current?.id === options.sessionId) {
          const index = activeDragSessionRef.current.index;
          nextRanges = current.map((r, i) => (i === index ? range : r));
        } else {
          nextRanges = [...current, range];
          activeDragSessionRef.current = {
            id: options.sessionId,
            index: nextRanges.length - 1,
          };
        }
      } else {
        activeDragSessionRef.current = null;
        const key = densityRangeKey(range);
        // The "click an already-selected thing again toggles it off" rule
        // only makes sense for discrete bars (distinct, stable, individually
        // clickable — same semantics as pills/bar segments). For a
        // continuous drag, applying it here would be a bug:
        // handleSelectionMove already sets the selection to this exact
        // range on every intermediate frame, so by release time this SAME
        // range is already "selected" — treating that as a toggle-off would
        // cancel the drag's own result the instant it finishes, discarding
        // the just-made selection.
        const alreadySelected =
          discrete && current.some((r) => densityRangeKey(r) === key);
        if (!alreadySelected && !additive && discrete && current.length > 1) {
          return;
        }
        nextRanges = alreadySelected
          ? current.filter((r) => densityRangeKey(r) !== key)
          : additive
            ? [...current, range]
            : [range];
      }

      // Discrete bars are fixed, individually-toggled bins (same model as
      // category pills) — merging would fight that: two adjacent bars need
      // to stay separately deselectable, not collapse into one blob.
      // Continuous/circular drag ranges have no such constraint, so
      // overlapping or touching ones (including one fully containing
      // another) collapse into a single combined range — but only once the
      // gesture that produced them is actually finalized (see `final`'s
      // doc comment above), not on every live move frame.
      const isLiveDragUpdate =
        additive && options?.sessionId != null && options?.final !== true;
      if (!discrete && !isLiveDragUpdate) {
        const mergedRanges = mergeDensityRanges(nextRanges);
        // Merging can shrink the array (e.g. a live-dragged range just grew
        // into overlapping an already-committed one) — if this call is part
        // of an in-progress additive drag, re-find which merged range now
        // contains it so the NEXT move event still updates the right slot
        // instead of a stale/out-of-bounds index.
        if (additive && options?.sessionId != null) {
          const containingIndex = mergedRanges.findIndex(
            (r) =>
              densityRangeContainsValue(r, range.start) ||
              densityRangeContainsValue(r, range.end),
          );
          if (containingIndex !== -1) {
            activeDragSessionRef.current = {
              id: options.sessionId,
              index: containingIndex,
            };
          }
        }
        nextRanges = mergedRanges;
      }

      if (nextRanges.length === 0) {
        setSelectedDensityRanges([]);
        selectionMetaRef.current = null;
        emitHighlightChange([]);
        return;
      }

      setSelectedDensityRanges(nextRanges);
      selectionMetaRef.current = {
        variableId: selectedVariable,
        isCategorical: false,
        label: joinClassNamesWithAnd(nextRanges.map(formatDensityRangeLabel)),
      };
    },
    [emitHighlightChange, selectedVariable],
  );

  // Resolves ONE range's observations into rangeSamplesByKey's cache — never
  // emits a highlight itself, same reason as resolveCategorySelection: with
  // multiple ranges selected, each one resolves independently/at different
  // speeds, and a separate union-and-emit effect below waits for all of them
  // to settle before emitting once (avoiding a flash of a partial union).
  const resolveDensityRange = React.useCallback(
    (key: string, range: DensitySelectionRange) => {
      if (!taxonId || !selectedVariable || !slicingEnabled) {
        setRangeSamplesByKey((prev) => ({
          ...prev,
          [key]: {
            observations: [],
            loading: false,
            loaded: true,
            error: null,
          },
        }));
        return;
      }
      // Reads (never bumps) the shared generation counter — same fix as
      // resolveCategorySelection: minting a new id per call here would make
      // resolving one range while another is still in flight look like it
      // invalidated the first one.
      const requestGeneration = categoryRequestRef.current;
      setRangeSamplesByKey((prev) => ({
        ...prev,
        [key]: {
          observations: prev[key]?.observations ?? [],
          loading: true,
          loaded: false,
          error: null,
        },
      }));
      const { start, end } = range;
      // Circular variables (e.g. aspect_deg 0–360°) can produce a wrap-around
      // arc where start > end (e.g. 315° → 45°). Split into two linear
      // slices and merge.
      const isWrapped = start > end;
      const sliceParams = isWrapped
        ? [
            { min: start, max: 360 },
            { min: 0, max: end },
          ]
        : [{ min: start, max: end }];
      void (async () => {
        try {
          const responses = await Promise.all(
            sliceParams.map((slice) =>
              speciesDataSource.fetchEnvironmentRangeSlice({
                taxonId,
                variableId: selectedVariable,
                min: slice.min,
                max: slice.max,
                location: locationGid ?? undefined,
                units,
                phenology: phenology ?? undefined,
                startTs: startTimestamp ?? undefined,
                endTs: endTimestamp ?? undefined,
                extra: activeChain.map((f) => f.extra),
              }),
            ),
          );
          if (categoryRequestRef.current !== requestGeneration) {
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
          setRangeSamplesByKey((prev) => ({
            ...prev,
            [key]: { observations, loading: false, loaded: true, error: null },
          }));
        } catch (err) {
          if (categoryRequestRef.current !== requestGeneration) {
            return;
          }
          const errorMessage =
            err instanceof Error
              ? err.message
              : 'Failed to load range observations.';
          setRangeSamplesByKey((prev) => ({
            ...prev,
            [key]: {
              observations: [],
              loading: false,
              loaded: true,
              error: errorMessage,
            },
          }));
        }
      })();
    },
    [
      activeChain,
      locationGid,
      phenology,
      endTimestamp,
      selectedVariable,
      slicingEnabled,
      speciesDataSource,
      startTimestamp,
      taxonId,
      units,
    ],
  );

  // Clears rangeObservations/emits [] when nothing is selected on the
  // current variable — but only when the chain is ALSO empty; if a chain is
  // active, the chain-only fallback effect further below owns
  // applying/emitting it instead (clearing here unconditionally would
  // immediately wipe out whatever that effect just set, since both react to
  // activeChain changing when switching variables).
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
    if (selectedDensityRanges.length === 0 && activeChain.length === 0) {
      setRangeObservations([]);
      emitHighlightChange([]);
    }
  }, [
    activeChain.length,
    emitHighlightChange,
    isCategorical,
    selectedDensityRanges,
    selectedVariable,
    slicingEnabled,
    taxonId,
  ]);

  // Debounced trigger: fires resolveDensityRange for any currently-selected
  // range not yet cached, DENSITY_SLICE_DEBOUNCE_MS after the selection
  // settles — same debounce the single-range implementation always had, so
  // dragging doesn't fire a network request on every intermediate frame.
  const densityResolveTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  React.useEffect(() => {
    if (densityResolveTimerRef.current) {
      clearTimeout(densityResolveTimerRef.current);
      densityResolveTimerRef.current = null;
    }
    if (isCategorical || selectedDensityRanges.length === 0) {
      return;
    }
    densityResolveTimerRef.current = setTimeout(() => {
      for (const range of selectedDensityRangesRef.current) {
        const key = densityRangeKey(range);
        const state = rangeSamplesByKey[key];
        if (state?.loading || state?.loaded) {
          continue;
        }
        resolveDensityRange(key, range);
      }
    }, DENSITY_SLICE_DEBOUNCE_MS);
    return () => {
      if (densityResolveTimerRef.current) {
        clearTimeout(densityResolveTimerRef.current);
      }
    };
  }, [
    isCategorical,
    rangeSamplesByKey,
    resolveDensityRange,
    selectedDensityRanges,
  ]);

  // Emits the UNION of every currently-selected range's resolved
  // observations — but only once ALL of them have settled (loaded, not
  // loading, no error), same reasoning as the categorical union-and-emit
  // effect.
  React.useEffect(() => {
    // NOT gated on `onHighlightChange` — unlike the categorical union-and-
    // emit effect above (which ONLY ever calls emitHighlightChange, nothing
    // else), this one also populates rangeObservations, which callers use
    // for their own display purposes (e.g. the meta text's observation
    // count) independent of whether they gave us a highlight callback at
    // all. emitHighlightChange itself already no-ops safely when
    // onHighlightChange is undefined.
    if (isCategorical || selectedDensityRanges.length === 0) {
      return;
    }
    const keys = selectedDensityRanges.map(densityRangeKey);
    const states = keys.map((key) => rangeSamplesByKey[key]);
    if (
      states.some((state) => !state?.loaded || state.loading || state.error)
    ) {
      return;
    }
    const seen = new Set<number | string>();
    const merged: SpeciesEnvironmentObservation[] = [];
    for (const state of states) {
      for (const obs of state?.observations ?? []) {
        const id = obs.catalogNumber;
        if (id !== null && id !== undefined && !seen.has(id)) {
          seen.add(id);
          merged.push(obs);
        }
      }
    }
    setRangeObservations(merged);
    emitHighlightChange(toCatalogIdsFromObservations(merged));
  }, [emitHighlightChange, isCategorical, rangeSamplesByKey, selectedDensityRanges]);

  // When nothing is selected on the CURRENT variable but the chain isn't
  // empty, the view should still reflect the chained filter(s) on their
  // own — otherwise switching to a fresh variable shows the fully
  // unfiltered dataset until the user ALSO slices that variable, even
  // though a slice from a previous variable is meant to still be in
  // effect. Treats the first chain entry as the "primary" request (as it
  // would have been before it was stashed) and the rest as `extra`.
  React.useEffect(() => {
    if (selectedDensityRanges.length > 0 || selectedCategoryValues.length > 0) {
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
          if ('classValues' in primary.extra) {
            const responses = await Promise.all(
              primary.extra.classValues.map((classValue) =>
                speciesDataSource.fetchSpeciesEnvironmentCategorySamples(
                  taxonId,
                  primary.variableId,
                  classValue,
                  { location: locationGid ?? undefined, units, extra },
                ),
              ),
            );
            if (cancelled) {
              return;
            }
            const seenClass = new Set<number | string>();
            const merged: SpeciesEnvironmentObservation[] = [];
            for (const response of responses) {
              for (const obs of response.observations ?? []) {
                const id = obs.catalogNumber;
                if (id !== null && id !== undefined && !seenClass.has(id)) {
                  seenClass.add(id);
                  merged.push(obs);
                }
              }
            }
            setRangeObservations(merged);
            emitHighlightChange(toCatalogIdsFromObservations(merged));
            return;
          }
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
        if ('ranges' in primary.extra) {
          const responses = await Promise.all(
            primary.extra.ranges.flatMap(({ min, max }) => {
              const isWrapped = min > max;
              const sliceParams = isWrapped
                ? [
                    { min, max: 360 },
                    { min: 0, max },
                  ]
                : [{ min, max }];
              return sliceParams.map((slice) =>
                speciesDataSource.fetchEnvironmentRangeSlice({
                  taxonId,
                  variableId: primary.variableId,
                  min: slice.min,
                  max: slice.max,
                  location: locationGid ?? undefined,
                  units,
                  phenology: phenology ?? undefined,
                  startTs: startTimestamp ?? undefined,
                  endTs: endTimestamp ?? undefined,
                  extra,
                }),
              );
            }),
          );
          if (cancelled) {
            return;
          }
          const seenRanges = new Set<number | string>();
          const mergedRanges: SpeciesEnvironmentObservation[] = [];
          for (const response of responses) {
            for (const obs of response.observations ?? []) {
              const id = obs.catalogNumber;
              if (id !== null && id !== undefined && !seenRanges.has(id)) {
                seenRanges.add(id);
                mergedRanges.push(obs);
              }
            }
          }
          setRangeObservations(mergedRanges);
          emitHighlightChange(toCatalogIdsFromObservations(mergedRanges));
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
    selectedDensityRanges,
    selectedCategoryValues,
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
    selectedCategoryValues,
    selectCategoryValue,
    selectedDensityRanges,
    selectDensityRange,
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
