// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import type { GestureResponderEvent } from 'react-native';
import { useAdditiveModifierRef } from './useAdditiveModifierRef';

/** A clockwise arc from start to end (degrees, 0 = north) — start > end means
 * the arc wraps through 0°/360°, e.g. {start: 350, end: 20} is a 30° slice
 * facing roughly north, not an (invalid) negative span. */
export type CircularDragRange = { start: number; end: number };

type UseCircularDragSelectionOptions = {
  /** Center of the circular control, in the same coordinate space as the
   * responder view's locationX/locationY (i.e. relative to that view). */
  center: { cx: number; cy: number };
  /** `options.additive` reflects whether shift/cmd was held at the START of
   * this drag (captured once at grant, not re-checked per move) — callers
   * that don't care about multi-select can ignore the second argument.
   * `options.sessionId` identifies this one drag gesture across its many
   * move calls plus its final release, so a caller doing additive
   * multi-select can recognize repeated calls as updates to the SAME
   * in-progress selection rather than a new one each frame. */
  onRangeChange: (
    range: CircularDragRange | null,
    options?: { additive?: boolean; sessionId?: number; final?: boolean },
  ) => void;
  /** Below this cumulative drag distance (degrees), a release is treated as
   * a tap-to-clear rather than a real selection. */
  minDragDeg?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

/**
 * Shared by PolarDensityChart (species page) and MapCircularLegend (maps
 * page) for click-and-drag arc selection on a circular (0–360°) control.
 *
 * A naive "angle at drag start" vs. "angle now" comparison can't tell drag
 * direction or handle wraparound correctly — e.g. dragging from 10° to 350°
 * could mean a short 20° arc backward through 0°, or a long 340° arc
 * forward, and the two raw endpoints alone can't distinguish them (they're
 * consistent with either). Tracking the *cumulative signed delta* instead —
 * always the shortest step each move event, in (-180, 180] — fixes both:
 * its sign gives the drag direction, and accumulating rather than diffing
 * against the start handles wrapping past 0°/360° any number of times.
 */
export function useCircularDragSelection({
  center,
  onRangeChange,
  minDragDeg = 3,
  onDragStart,
  onDragEnd,
}: UseCircularDragSelectionOptions) {
  const dragOrigin = React.useRef<number | null>(null);
  const cumulativeSpan = React.useRef(0);
  const prevAngle = React.useRef<number | null>(null);
  const hasDragged = React.useRef(false);
  const isAdditive = useAdditiveModifierRef();
  const dragSessionId = React.useRef(0);
  const lastRange = React.useRef<CircularDragRange | null>(null);

  const touchToDeg = React.useCallback(
    (locationX: number, locationY: number) =>
      ((Math.atan2(locationY - center.cy, locationX - center.cx) * 180) /
        Math.PI +
        90 +
        360) %
      360,
    [center.cx, center.cy],
  );

  const handleGrant = React.useCallback(
    (event: GestureResponderEvent) => {
      onDragStart?.();
      const deg = touchToDeg(
        event.nativeEvent.locationX,
        event.nativeEvent.locationY,
      );
      dragOrigin.current = deg;
      prevAngle.current = deg;
      cumulativeSpan.current = 0;
      hasDragged.current = false;
      dragSessionId.current += 1;
    },
    [touchToDeg, onDragStart],
  );

  const handleMove = React.useCallback(
    (event: GestureResponderEvent) => {
      if (dragOrigin.current == null || prevAngle.current == null) {
        return;
      }
      hasDragged.current = true;
      const currentAngle = touchToDeg(
        event.nativeEvent.locationX,
        event.nativeEvent.locationY,
      );
      const delta = ((currentAngle - prevAngle.current + 540) % 360) - 180;
      prevAngle.current = currentAngle;
      // Capped at a full circle in either direction. 359.9° (not 360°) keeps
      // start !== end so downstream arc math never sees a degenerate
      // zero-span pair — the tiny 0.1° gap this leaves is visually
      // invisible, so a "drag all the way around" selection still reads as
      // a full circle.
      const newSpan = Math.max(
        -359.9,
        Math.min(359.9, cumulativeSpan.current + delta),
      );
      cumulativeSpan.current = newSpan;

      const absSpan = Math.abs(newSpan);
      if (absSpan < minDragDeg) {
        onRangeChange(null, {
          additive: isAdditive.current,
          sessionId: dragSessionId.current,
        });
        return;
      }

      const anchor = dragOrigin.current;
      const additiveOptions = {
        additive: isAdditive.current,
        sessionId: dragSessionId.current,
      };
      const range: CircularDragRange =
        newSpan >= 0
          ? // CW arc: anchor → anchor + span
            { start: anchor, end: (anchor + absSpan + 360) % 360 }
          : // CCW arc: represented the same way as a CW arc from arcStart →
            // anchor, so callers only ever need to handle one direction.
            { start: (anchor - absSpan + 360) % 360, end: anchor };
      lastRange.current = range;
      onRangeChange(range, additiveOptions);
    },
    [touchToDeg, onRangeChange, minDragDeg],
  );

  const handleRelease = React.useCallback(() => {
    onDragEnd?.();
    if (dragOrigin.current != null && !hasDragged.current) {
      onRangeChange(null);
    } else if (hasDragged.current && lastRange.current) {
      // Re-emits the drag's own final range once more, marked `final` —
      // this is the ONLY point range-merging (overlapping/touching/
      // subsuming ranges collapsing into one) happens, so it doesn't
      // visually snap ranges together mid-drag, only once the gesture
      // actually ends.
      onRangeChange(lastRange.current, {
        additive: isAdditive.current,
        sessionId: dragSessionId.current,
        final: true,
      });
    }
    dragOrigin.current = null;
    prevAngle.current = null;
    cumulativeSpan.current = 0;
    hasDragged.current = false;
    lastRange.current = null;
  }, [onRangeChange, onDragEnd]);

  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: handleGrant,
    onResponderMove: handleMove,
    onResponderRelease: handleRelease,
    onResponderTerminate: handleRelease,
  };
}

/** Span (degrees, 0-360) of a clockwise arc from start to end, wrapping
 * through 0° if start > end. */
export const circularRangeSpan = (range: CircularDragRange): number =>
  (range.end - range.start + 360) % 360;

/** Span at or above this is treated as "the whole circle" rather than a
 * meaningfully bounded slice — mirrors PolarDensityChart's threshold for
 * switching from a partial arc to a full-donut highlight. */
export const FULL_CIRCLE_SPAN_THRESHOLD = 358;
