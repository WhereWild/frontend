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
};

const resolveCategoryLabel = (
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
}: UseMapLayerChainParams) {
  const [chain, setChain] = React.useState<ChainedLayerFilter[]>([]);

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

    const outgoingEntry: ChainedLayerFilter | null = outgoing.isCategorical
      ? selectedClassIds.length === 0
        ? null
        : {
            layerId: outgoing.variable,
            isCategorical: true,
            isCircular: false,
            label: resolveCategoryLabel(
              allVariables,
              outgoing.variable,
              selectedClassIds,
            ),
            extra: {
              layer_id: outgoing.variable,
              class_filter: selectedClassIds,
            },
            originalClassIds: selectedClassIds,
          }
      : outgoing.isCircular
        ? selectedAngleRanges.length === 0
          ? null
          : {
              layerId: outgoing.variable,
              isCategorical: false,
              isCircular: true,
              label: '',
              extra: {
                layer_id: outgoing.variable,
                value_ranges: toValueRanges(selectedAngleRanges),
              },
              originalRanges: selectedAngleRanges,
            }
        : selectedValueRanges.length === 0
          ? null
          : {
              layerId: outgoing.variable,
              isCategorical: false,
              isCircular: false,
              label: '',
              extra: {
                layer_id: outgoing.variable,
                value_ranges: toValueRanges(selectedValueRanges),
              },
              originalRanges: selectedValueRanges,
            };

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

  return { chain, removeChainedFilter, clearChain };
}
