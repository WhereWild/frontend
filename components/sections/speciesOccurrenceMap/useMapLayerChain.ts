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
 * query param util/tiles.py's render_layer_tile_bytes expects. */
export type MapChainExtra = {
  layer_id: string;
  class_filter?: number[];
  value_min?: number;
  value_max?: number;
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
  /** Numeric range (continuous) or angle range (circular) — which one
   * depends on isCircular, same as the live selectedValueRange/
   * selectedAngleRange split in app/maps.tsx. */
  originalRange?: LegendRange | null;
};

const chainEntryKey = (entry: ChainedLayerFilter) => entry.layerId;

type UseMapLayerChainParams = {
  selectedVariable: string;
  isCategorical: boolean;
  isCircular: boolean;
  allVariables: EnvironmentVariableOption[];
  selectedClassIds: number[];
  selectedValueRange: LegendRange | null;
  selectedAngleRange: LegendRange | null;
  setSelectedClassIds: (ids: number[]) => void;
  setSelectedValueRange: (range: LegendRange | null) => void;
  setSelectedAngleRange: (range: LegendRange | null) => void;
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
  selectedValueRange,
  selectedAngleRange,
  setSelectedClassIds,
  setSelectedValueRange,
  setSelectedAngleRange,
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
        ? selectedAngleRange == null
          ? null
          : {
              layerId: outgoing.variable,
              isCategorical: false,
              isCircular: true,
              label: '',
              extra: {
                layer_id: outgoing.variable,
                value_min: selectedAngleRange.min,
                value_max: selectedAngleRange.max,
              },
              originalRange: selectedAngleRange,
            }
        : selectedValueRange == null
          ? null
          : {
              layerId: outgoing.variable,
              isCategorical: false,
              isCircular: false,
              label: '',
              extra: {
                layer_id: outgoing.variable,
                value_min: selectedValueRange.min,
                value_max: selectedValueRange.max,
              },
              originalRange: selectedValueRange,
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
      setSelectedValueRange(
        !restored.isCategorical && !restored.isCircular
          ? (restored.originalRange ?? null)
          : null,
      );
      setSelectedAngleRange(
        !restored.isCategorical && restored.isCircular
          ? (restored.originalRange ?? null)
          : null,
      );
    } else {
      setChain(nextChain);
      setSelectedClassIds([]);
      setSelectedValueRange(null);
      setSelectedAngleRange(null);
    }
  }, [
    selectedVariable,
    isCategorical,
    isCircular,
    allVariables,
    selectedClassIds,
    selectedValueRange,
    selectedAngleRange,
    chain,
    setSelectedClassIds,
    setSelectedValueRange,
    setSelectedAngleRange,
  ]);

  const removeChainedFilter = React.useCallback((layerId: string) => {
    setChain((prev) => removeChainEntry(prev, layerId, chainEntryKey));
  }, []);

  const clearChain = React.useCallback(() => {
    setChain((prev) => clearChainEntries(prev));
  }, []);

  return { chain, removeChainedFilter, clearChain };
}
