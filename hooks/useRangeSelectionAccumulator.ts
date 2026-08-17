// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { mergeRanges, rangeContainsValue, type PlainRange } from './rangeMerge';

/**
 * Accumulates a multi-select of ranges from a drag gesture's additive/
 * sessionId/final options (as produced by useCircularDragSelection or
 * useLinearLegendDragSelection) — mirrors the continuous-drag path of the
 * species page's selectDensityRange (useEnvironmentHighlights.ts), minus
 * the discrete-histogram-bar branches that don't apply to a plain drag
 * legend. Not shared code with selectDensityRange itself (that stays
 * untouched, lower risk than refactoring already-shipped, tested logic) —
 * but built on the same mergeRanges/rangeContainsValue this session
 * extracted from it, so the actual merge behavior (including circular
 * wraparound) is identical.
 */
export function useRangeSelectionAccumulator(initialRanges?: PlainRange[]) {
  const [ranges, setRangesState] = React.useState<PlainRange[]>(
    () => initialRanges ?? [],
  );
  const rangesRef = React.useRef<PlainRange[]>(initialRanges ?? []);
  const activeDragSessionRef = React.useRef<{
    id: number;
    index: number;
  } | null>(null);

  const setRanges = React.useCallback((next: PlainRange[]) => {
    rangesRef.current = next;
    setRangesState(next);
  }, []);

  const applyRangeChange = React.useCallback(
    (
      range: PlainRange | null,
      options?: { additive?: boolean; sessionId?: number; final?: boolean },
    ) => {
      if (range === null) {
        // An additive drag that hasn't moved far enough yet to register a
        // real range (or ended without ever doing so) calls this — it's
        // NOT the user asking to clear the whole multi-selection, just
        // "nothing new from THIS gesture yet". Only remove this session's
        // own tentative slot (if it had already appended one).
        if (options?.additive && options?.sessionId != null) {
          if (activeDragSessionRef.current?.id === options.sessionId) {
            const index = activeDragSessionRef.current.index;
            const nextRanges = rangesRef.current.filter(
              (_, i) => i !== index,
            );
            activeDragSessionRef.current = null;
            setRanges(nextRanges);
          }
          return;
        }
        activeDragSessionRef.current = null;
        setRanges([]);
        return;
      }

      const additive = options?.additive ?? false;
      const current = rangesRef.current;
      let nextRanges: PlainRange[];
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
        nextRanges = [range];
      }

      // Only merge once the gesture that produced these ranges actually
      // finalizes (or it's a plain non-additive replace) — merging mid-drag
      // would visually snap a live-dragged range together with an
      // already-committed one before the gesture even ends.
      const isLiveDragUpdate =
        additive && options?.sessionId != null && options?.final !== true;
      if (!isLiveDragUpdate) {
        const mergedRanges = mergeRanges(nextRanges);
        if (additive && options?.sessionId != null) {
          const containingIndex = mergedRanges.findIndex(
            (r) =>
              rangeContainsValue(r, range.start) ||
              rangeContainsValue(r, range.end),
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
      setRanges(nextRanges);
    },
    [setRanges],
  );

  /** Replace the whole selection at once (e.g. restoring a chained
   * selection, or a hard reset) — resets any in-progress drag session. */
  const setAll = React.useCallback(
    (next: PlainRange[]) => {
      activeDragSessionRef.current = null;
      setRanges(next);
    },
    [setRanges],
  );

  const clear = React.useCallback(() => setAll([]), [setAll]);

  return { ranges, applyRangeChange, setAll, clear };
}
