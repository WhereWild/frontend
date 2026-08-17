// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import { joinClassNamesWithAnd } from '@/components/sections/speciesEnvironment/model';
import {
  clearChainEntries,
  popRestorable,
  removeChainEntry,
  stashOutgoing,
} from '@/hooks/useVariableFilterChain';
import type { LegendRange } from './legendRangeSelection';

/** Backend-wire shape for one chained layer filter — matches the `chain`
 * query param util/tiles.py's render_layer_tile_bytes expects. A layer's
 * own filter can itself be multiple disjoint ranges (OR'd) — value_ranges
 * is a list of [min, max] pairs, not a single pair. */
export type MapChainExtra = {
  layer_id: string;
  class_filter?: number[];
  value_ranges?: [number, number][];
};

/** A slice/selection that was active on a layer the user has since switched
 * away from, held onto as an additional filter chained onto whatever layer
 * is selected now — the maps-page equivalent of ChainedVariableFilter on
 * the species page (see hooks/useVariableFilterChain), keyed by layerId
 * instead of variableId. */
export type ChainedLayerFilter = {
  layerId: string;
  isCategorical: boolean;
  isCircular: boolean;
  /** Resolved class name(s), meaningful only when isCategorical. */
  label: string;
  extra: MapChainExtra;
  originalClassIds?: number[];
  /** Numeric ranges (continuous) or angle ranges (circular) — which one
   * depends on isCircular, same as the live selectedValueRanges/
   * selectedAngleRanges split in app/maps.tsx. */
  originalRanges?: LegendRange[];
};

const chainEntryKey = (entry: ChainedLayerFilter) => entry.layerId;

const toValueRanges = (ranges: LegendRange[]): [number, number][] =>
  ranges.map((r) => [r.min, r.max]);

// Builds a ChainedLayerFilter-shaped entry from a live selection — shared
// by the "outgoing layer" stash-onto-chain transition and by fullChain
// below (species-page-style: see useEnvironmentHighlights.ts's
// buildSelectionEntry, same idea, different entry shape). Returns null when
// there's nothing selected to represent.
const buildLayerSelectionEntry = (
  layerId: string,
  isCategorical: boolean,
  isCircular: boolean,
  label: string,
  selectedClassIds: number[],
  selectedValueRanges: LegendRange[],
  selectedAngleRanges: LegendRange[],
): ChainedLayerFilter | null => {
  if (isCategorical) {
    if (selectedClassIds.length === 0) return null;
    return {
      layerId,
      isCategorical: true,
      isCircular: false,
      label,
      extra: { layer_id: layerId, class_filter: selectedClassIds },
      originalClassIds: selectedClassIds,
    };
  }
  const ranges = isCircular ? selectedAngleRanges : selectedValueRanges;
  if (ranges.length === 0) return null;
  return {
    layerId,
    isCategorical: false,
    isCircular,
    label,
    extra: { layer_id: layerId, value_ranges: toValueRanges(ranges) },
    originalRanges: ranges,
  };
};

type UseMapLayerChainParams = {
  selectedVariable: string;
  isCategorical: boolean;
  isCircular: boolean;
  allVariables: EnvironmentVariableOption[];
  selectedClassIds: number[];
  selectedValueRanges: LegendRange[];
  selectedAngleRanges: LegendRange[];
  setSelectedClassIds: (ids: number[]) => void;
  /** Replaces the whole value-range selection at once — e.g. the
   * accumulator hook's `setAll`, not its additive `applyRangeChange`. */
  setSelectedValueRanges: (ranges: LegendRange[]) => void;
  setSelectedAngleRanges: (ranges: LegendRange[]) => void;
  /** Seeds `chain` on mount — e.g. a chain hydrated from the route's
   * ?slice= param, already split by the caller (any entry naming the
   * variable selected at mount should have been popped off and applied as
   * the live selection instead — see app/maps.tsx). */
  initialChain?: ChainedLayerFilter[];
};

export const resolveCategoryLabel = (
  allVariables: EnvironmentVariableOption[],
  layerId: string,
  classIds: number[],
): string => {
  const legendClasses = allVariables.find(
    (v) => v.id === layerId,
  )?.legendClasses;
  return joinClassNamesWithAnd(
    classIds.map(
      (id) =>
        legendClasses?.find((cls) => String(cls.id) === String(id))?.name ??
        String(id),
    ),
  );
};

/**
 * Maps-page counterpart to the species page's chain-of-filters (see
 * hooks/useVariableFilterChain, and useEnvironmentHighlights.ts's switch
 * effect, which drives the same transitions from a different selection
 * shape). Slicing a class/range on one layer, then switching the active
 * layer, stashes the outgoing layer's selection as a chained filter instead
 * of discarding it; switching back restores it as the live selection.
 *
 * Unlike the species page, there's no async server-fetched "meta" to race
 * against — legend class names come from `allVariables` (the static
 * catalog), which doesn't change when the selected layer switches, so no
 * ref-based "what was selected a moment ago" tracking is needed for labels.
 */
export function useMapLayerChain({
  selectedVariable,
  isCategorical,
  isCircular,
  allVariables,
  selectedClassIds,
  selectedValueRanges,
  selectedAngleRanges,
  setSelectedClassIds,
  setSelectedValueRanges,
  setSelectedAngleRanges,
  initialChain,
}: UseMapLayerChainParams) {
  const [chain, setChain] = React.useState<ChainedLayerFilter[]>(
    () => initialChain ?? [],
  );

  // Tracks the OUTGOING layer's own type flags — by the time the switch
  // effect below runs, isCategorical/isCircular already reflect the
  // INCOMING layer (same render that updated selectedVariable also updates
  // these, derived from the same catalog lookup), so reading them fresh
  // inside the effect would describe the wrong layer.
  const outgoingRef = React.useRef({
    variable: selectedVariable,
    isCategorical,
    isCircular,
  });

  React.useEffect(() => {
    if (outgoingRef.current.variable === selectedVariable) {
      return;
    }
    const outgoing = outgoingRef.current;
    outgoingRef.current = {
      variable: selectedVariable,
      isCategorical,
      isCircular,
    };

    const outgoingEntry = buildLayerSelectionEntry(
      outgoing.variable,
      outgoing.isCategorical,
      outgoing.isCircular,
      outgoing.isCategorical
        ? resolveCategoryLabel(allVariables, outgoing.variable, selectedClassIds)
        : '',
      selectedClassIds,
      selectedValueRanges,
      selectedAngleRanges,
    );

    const nextChain = stashOutgoing(
      chain,
      outgoing.variable,
      chainEntryKey,
      outgoingEntry,
    );
    const { chain: remainingChain, restored } = popRestorable(
      nextChain,
      selectedVariable,
      chainEntryKey,
    );

    if (restored) {
      setChain(remainingChain);
      setSelectedClassIds(
        restored.isCategorical ? (restored.originalClassIds ?? []) : [],
      );
      setSelectedValueRanges(
        !restored.isCategorical && !restored.isCircular
          ? (restored.originalRanges ?? [])
          : [],
      );
      setSelectedAngleRanges(
        !restored.isCategorical && restored.isCircular
          ? (restored.originalRanges ?? [])
          : [],
      );
    } else {
      setChain(nextChain);
      setSelectedClassIds([]);
      setSelectedValueRanges([]);
      setSelectedAngleRanges([]);
    }
  }, [
    selectedVariable,
    isCategorical,
    isCircular,
    allVariables,
    selectedClassIds,
    selectedValueRanges,
    selectedAngleRanges,
    chain,
    setSelectedClassIds,
    setSelectedValueRanges,
    setSelectedAngleRanges,
  ]);

  const removeChainedFilter = React.useCallback((layerId: string) => {
    setChain((prev) => removeChainEntry(prev, layerId, chainEntryKey));
  }, []);

  const clearChain = React.useCallback(() => {
    setChain((prev) => clearChainEntries(prev));
  }, []);

  // chain plus the live selection currently active on selectedVariable
  // itself, if any — chain alone never includes it (a chain entry naming
  // the currently-selected layer gets restored as the live selection
  // instead, see the switch effect above), but URL round-tripping needs it
  // represented too. Species-page equivalent: useEnvironmentHighlights.ts's
  // fullChain.
  const fullChain = React.useMemo(() => {
    const liveEntry = buildLayerSelectionEntry(
      selectedVariable,
      isCategorical,
      isCircular,
      isCategorical
        ? resolveCategoryLabel(allVariables, selectedVariable, selectedClassIds)
        : '',
      selectedClassIds,
      selectedValueRanges,
      selectedAngleRanges,
    );
    return liveEntry ? [...chain, liveEntry] : chain;
  }, [
    allVariables,
    chain,
    isCategorical,
    isCircular,
    selectedAngleRanges,
    selectedClassIds,
    selectedValueRanges,
    selectedVariable,
  ]);

  return { chain, fullChain, removeChainedFilter, clearChain };
}
