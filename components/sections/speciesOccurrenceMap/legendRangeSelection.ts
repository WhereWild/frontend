// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import type { GestureResponderEvent } from 'react-native';

/** A selected [min, max] range on a map legend, sent to the tile endpoint as
 * value_min/value_max. For the circular legend these are a start/end angle
 * in degrees rather than a sorted numeric range — see MapCircularLegend. */
export type LegendRange = { min: number; max: number };

/** Minimum on-screen drag distance, in actual touch pixels, below which a
 * gesture is treated as a tap-to-clear rather than a real range selection.
 *
 * This must be pixel-based, not domain-value-based: the two legends share
 * this hook across variables with wildly different value scales (a
 * temperature variable might span 0-100, snowfall water equivalent might
 * span 0-1). An earlier version compared the *converted value* delta
 * against a fixed 0.5 threshold, which was fine for large-range variables
 * but broke any variable whose entire range was smaller than 0.5 — a real
 * drag across most of the bar produced a value delta under the threshold,
 * so dragMoved never flipped true, and the selection the user had just
 * made got wiped by the tap-to-clear check on release.
 */
const DRAG_PIXEL_EPSILON = 4;

/**
 * Shared drag-gesture lifecycle for both map legends' click-and-drag range
 * selection. The two legends need genuinely different position→value math
 * (a linear fraction along a vertical bar vs. an angle around a ring), so
 * that conversion stays the caller's job — this only owns the responder
 * wiring and the "track a start value, report the sorted/ordered range as
 * the gesture moves, treat a near-zero-distance release as clear" state
 * machine that's otherwise identical between them.
 */
export function useLegendRangeDrag(
  locationToValue: (locationX: number, locationY: number) => number | null,
  onDragRange: (start: number, end: number) => void,
  onClear: () => void,
) {
  const dragStart = React.useRef<number | null>(null);
  const dragStartPixel = React.useRef<{ x: number; y: number } | null>(null);
  const dragMoved = React.useRef(false);

  const handleStart = React.useCallback(
    (event: GestureResponderEvent) => {
      const { locationX, locationY } = event.nativeEvent;
      const value = locationToValue(locationX, locationY);
      if (value == null) {
        return;
      }
      dragStart.current = value;
      dragStartPixel.current = { x: locationX, y: locationY };
      dragMoved.current = false;
    },
    [locationToValue],
  );

  const handleMove = React.useCallback(
    (event: GestureResponderEvent) => {
      if (dragStart.current == null || dragStartPixel.current == null) {
        return;
      }
      const { locationX, locationY } = event.nativeEvent;
      const value = locationToValue(locationX, locationY);
      if (value == null) {
        return;
      }
      const dx = locationX - dragStartPixel.current.x;
      const dy = locationY - dragStartPixel.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_PIXEL_EPSILON) {
        dragMoved.current = true;
      }
      onDragRange(dragStart.current, value);
    },
    [locationToValue, onDragRange],
  );

  const handleEnd = React.useCallback(() => {
    if (dragStart.current != null && !dragMoved.current) {
      onClear();
    }
    dragStart.current = null;
    dragStartPixel.current = null;
    dragMoved.current = false;
  }, [onClear]);

  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: handleStart,
    onResponderMove: handleMove,
    onResponderRelease: handleEnd,
    onResponderTerminate: handleEnd,
  };
}
