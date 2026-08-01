// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Platform } from 'react-native';
import { useAdditiveModifierRef } from '@/hooks/useAdditiveModifierRef';
import { useScrollLock } from '@/context/ScrollLockContext';

/** Pixels of wander tolerated before a long-press-to-arm is cancelled — a
 * finger resting on a touchscreen (or a mouse held "still") is never
 * perfectly stationary, so too tight a tolerance made arming close to
 * impossible to hit consistently on mobile. Mirrors DensityChart's own
 * constant of the same name/value. */
const LONG_PRESS_MOVEMENT_TOLERANCE_PX = 10;

const toSortedRange = (left: number, right: number) => ({
  start: Math.min(left, right),
  end: Math.max(left, right),
});

export type LinearDragRange = { start: number; end: number };

type UseLinearLegendDragSelectionOptions = {
  /** Converts a touch/click location into a domain value, or null if outside
   * the draggable area (e.g. off the bar). */
  locationToValue: (locationX: number, locationY: number) => number | null;
  /** Called when a drag selection changes or clears — same additive/
   * long-press-to-arm vocabulary as DensityChart's onSelectionChange (see
   * useAdditiveModifierRef): `options.additive` means add this range to
   * whatever's already selected rather than replacing it, either from
   * shift/cmd held for the gesture or a ~500ms long-press-to-arm. */
  onRangeChange: (
    range: LinearDragRange | null,
    options?: { additive?: boolean; sessionId?: number; final?: boolean },
  ) => void;
  /** DOM testID of the responder view, used only on web to work around
   * pointercancel/native touch-callout stealing a long-press mid-gesture —
   * see the effect below for why. Omit to skip that workaround entirely. */
  webTestID?: string;
  /** Skips the long-press-to-arm gesture entirely and treats EVERY drag as
   * additive (a tap with no drag still clears) — same escape hatch
   * useCircularDragSelection offers, for the same reason: long-press-to-arm
   * turned out unreliable on real mobile touchscreens for this legend too. */
  forceAdditive?: boolean;
};

/**
 * Linear-bar counterpart to useCircularDragSelection (ring-shaped legends) —
 * same long-press-to-arm + shift/cmd additive-drag model, mirroring
 * DensityChart's own continuous-drag path exactly (this hook exists because
 * DensityChart's version is inline and tightly coupled to its own
 * discrete-histogram-bar mode, scroll-lock, and web pointer-capture
 * plumbing — extracting a hook shared with DensityChart itself would mean
 * refactoring a delicate already-tuned component; this reuses the same
 * underlying useAdditiveModifierRef primitive instead, same relationship
 * useCircularDragSelection already has to it).
 */
export function useLinearLegendDragSelection({
  locationToValue,
  onRangeChange,
  webTestID,
  forceAdditive = false,
}: UseLinearLegendDragSelectionOptions) {
  const { lockScroll, unlockScroll } = useScrollLock();
  const dragOrigin = React.useRef<number | null>(null);
  const dragValue = React.useRef<number | null>(null);
  const hasDragged = React.useRef(false);
  const pressOrigin = React.useRef<{ x: number; y: number } | null>(null);
  const { isAdditive, beginPress, cancelPressIfUnarmed, endPress } =
    useAdditiveModifierRef();
  // Identifies one continuous drag gesture across its many move events plus
  // its final release — lets the caller recognize repeated calls as "the
  // same in-progress selection", not a fresh one each frame.
  const dragSessionId = React.useRef(0);

  const handleGrant = React.useCallback(
    (event: GestureResponderEvent) => {
      lockScroll();
      hasDragged.current = false;
      dragSessionId.current += 1;
      pressOrigin.current = {
        x: event.nativeEvent.locationX,
        y: event.nativeEvent.locationY,
      };
      if (!forceAdditive) beginPress();
      const value = locationToValue(
        event.nativeEvent.locationX,
        event.nativeEvent.locationY,
      );
      if (value === null) return;
      dragOrigin.current = value;
      dragValue.current = value;
    },
    [locationToValue, lockScroll, beginPress, forceAdditive],
  );

  const handleMove = React.useCallback(
    (event: GestureResponderEvent) => {
      if (dragOrigin.current === null) return;
      hasDragged.current = true;
      const effectiveAdditive = forceAdditive || isAdditive.current;
      let movedPastTolerance = true;
      if (pressOrigin.current) {
        const dx = event.nativeEvent.locationX - pressOrigin.current.x;
        const dy = event.nativeEvent.locationY - pressOrigin.current.y;
        movedPastTolerance =
          Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVEMENT_TOLERANCE_PX;
      }
      if (movedPastTolerance) {
        cancelPressIfUnarmed();
      }
      if (!movedPastTolerance && !effectiveAdditive) {
        // Still just the long-press dwell — nothing has moved enough (and
        // we're not yet armed as additive) to count as a real gesture.
        // Emit nothing: the caller treats any non-additive call here as
        // "replace the whole selection", which would wipe out whatever's
        // already selected before we even know whether this becomes an
        // additive drag. (Never true when forceAdditive — every move counts
        // immediately there.)
        return;
      }
      const value = locationToValue(
        event.nativeEvent.locationX,
        event.nativeEvent.locationY,
      );
      if (value === null) return;
      dragValue.current = value;
      onRangeChange(toSortedRange(dragOrigin.current, value), {
        additive: effectiveAdditive,
        sessionId: dragSessionId.current,
      });
    },
    [
      locationToValue,
      onRangeChange,
      cancelPressIfUnarmed,
      isAdditive,
      forceAdditive,
    ],
  );

  const handleRelease = React.useCallback(
    (event?: GestureResponderEvent) => {
      unlockScroll();
      const effectiveAdditive = forceAdditive || isAdditive.current;
      if (dragOrigin.current === null) {
        onRangeChange(null);
        endPress();
        return;
      }
      const value =
        event && Number.isFinite(event.nativeEvent.locationX)
          ? locationToValue(
              event.nativeEvent.locationX,
              event.nativeEvent.locationY,
            )
          : (dragValue.current ?? dragOrigin.current);
      if (value !== null) dragValue.current = value;
      if (!hasDragged.current || value === null) {
        onRangeChange(null);
      } else {
        onRangeChange(toSortedRange(dragOrigin.current, value), {
          additive: effectiveAdditive,
          sessionId: dragSessionId.current,
          final: true,
        });
      }
      dragOrigin.current = null;
      dragValue.current = null;
      hasDragged.current = false;
      endPress();
    },
    [
      unlockScroll,
      locationToValue,
      onRangeChange,
      endPress,
      isAdditive,
      forceAdditive,
    ],
  );

  const handleTerminate = React.useCallback(() => {
    unlockScroll();
    const effectiveAdditive = forceAdditive || isAdditive.current;
    if (dragOrigin.current === null) {
      onRangeChange(null);
      endPress();
      return;
    }
    const value = dragValue.current ?? dragOrigin.current;
    if (!hasDragged.current || value === null) {
      onRangeChange(null);
    } else {
      onRangeChange(toSortedRange(dragOrigin.current, value), {
        additive: effectiveAdditive,
        sessionId: dragSessionId.current,
        final: true,
      });
    }
    dragOrigin.current = null;
    dragValue.current = null;
    hasDragged.current = false;
    endPress();
  }, [unlockScroll, onRangeChange, endPress, isAdditive, forceAdditive]);

  // On web, prevent the browser's own long-press callout (text-selection
  // menu, "Add to Reading List", image-save sheet) from stealing/cancelling
  // the touch before our long-press-to-arm timer gets to run — touch-action
  // alone only suppresses scroll/pan/zoom, not that. Same fix as
  // DensityChart/PolarDensityChart's own copies of this effect.
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !webTestID) return;
    const selector = `[data-testid="${webTestID}"]`;
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el?.style) el.style.touchAction = 'none';

    const onDocPointerDown = (e: PointerEvent) => {
      const responder = document.querySelector(selector);
      if (
        responder &&
        (e.target === responder || responder.contains(e.target as Node))
      ) {
        responder.setPointerCapture(e.pointerId);
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown, {
      capture: true,
    });

    const styleEl = document.createElement('style');
    styleEl.textContent = `${selector} { touch-action: none !important; -webkit-touch-callout: none !important; -webkit-user-select: none !important; user-select: none !important; }`;
    document.head.appendChild(styleEl);

    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, {
        capture: true,
      });
      styleEl.remove();
    };
  }, [webTestID]);

  // On web, mouseup outside the element is not delivered to the RN responder.
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onWindowMouseUp = () => {
      if (dragOrigin.current !== null) handleRelease();
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, [handleRelease]);

  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: handleGrant,
    onResponderMove: handleMove,
    onResponderRelease: handleRelease,
    onResponderTerminate: handleTerminate,
  };
}
