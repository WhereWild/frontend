// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Platform } from 'react-native';
import { triggerSelectionHaptic } from '@/utils/haptics';

/** How long a press must be held, with no meaningful movement, before a
 * drag gesture is armed as "additive" — matches Pressable's default
 * long-press delay so the gesture vocabulary feels consistent with the
 * discrete/categorical long-press-to-add gesture elsewhere in the app. */
const LONG_PRESS_ARM_MS = 500;

/**
 * Tracks whether the CURRENT drag gesture should be treated as additive
 * (added to whatever's already selected, rather than replacing it) — read
 * the returned `isAdditive` ref's `.current` at gesture-start time.
 *
 * Used by drag-based charts (DensityChart, PolarDensityChart via
 * useCircularDragSelection), which drive selection through react-native-web's
 * raw GestureResponder system (`onResponderGrant`/`onResponderMove`/etc), NOT
 * Pressable's onPress (a real DOM MouseEvent). Two signals feed into it,
 * ORed together, and BOTH are live on every platform (this is a web-first
 * app — `Platform.OS` is `'web'` on a phone's browser too, so there is no
 * reliable "this is a touchscreen" signal to gate on):
 *
 *   1. Shift/Meta held via document-level keydown/keyup listeners (web
 *      only — there's nothing to listen for without a keyboard). Two things
 *      rule out reading ctrl/cmd off the event directly instead:
 *      a. react-native-web's ResponderSystem gates EVERY mousedown/mousemove
 *         through `isPrimaryPointerDown`, which requires `ctrlKey === false`
 *         — holding ctrl means the gesture never starts at all,
 *         framework-wide, for ANY responder-based drag. This is why ctrl
 *         works for the pill/bar-segment click-based additive gesture (a
 *         real Pressable onClick, a different code path entirely) but can
 *         never work here.
 *      b. Separately, the responder event synthesis in
 *         createResponderEvent.js hardcodes `nativeEvent.ctrlKey` to `false`
 *         unconditionally anyway — only `metaKey` (Cmd) survives that path.
 *      Shift and Meta are NOT blocked by isPrimaryPointerDown, so those are
 *      the only modifiers usable for a drag gesture here.
 *   2. A long press (`beginPress`/`cancelPressIfUnarmed`/`endPress`, called
 *      from the gesture's own onResponderGrant/Move/Release/Terminate)
 *      arming after LONG_PRESS_ARM_MS with no real movement — this is what
 *      makes the gesture reachable at all with just a mouse-and-no-keyboard
 *      or a touchscreen: hold still to arm additive, then drag as normal.
 *      Movement before the timer fires cancels the arm (a quick drag stays
 *      a normal, non-additive selection); movement after it fires no longer
 *      matters. Resets to unarmed on every gesture end (`endPress`) —
 *      unlike the held-key signal, this one can't persist across gestures.
 */
export function useAdditiveModifierRef() {
  const isHeldRef = React.useRef(false);
  const keyHeld = React.useRef(false);
  const armed = React.useRef(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const recompute = React.useCallback(() => {
    isHeldRef.current = keyHeld.current || armed.current;
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key === 'Meta') {
        keyHeld.current = true;
        recompute();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key === 'Meta') {
        keyHeld.current = false;
        recompute();
      }
    };
    // A keyup can be missed if focus left the window while the key was
    // held (e.g. alt-tabbing away) — clear on blur so a stale "held" state
    // doesn't linger into the next interaction.
    const onBlur = () => {
      keyHeld.current = false;
      recompute();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [recompute]);

  const clearTimer = React.useCallback(() => {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  /** Call from onResponderGrant, on every platform. */
  const beginPress = React.useCallback(() => {
    armed.current = false;
    clearTimer();
    longPressTimer.current = setTimeout(() => {
      armed.current = true;
      recompute();
      triggerSelectionHaptic();
    }, LONG_PRESS_ARM_MS);
  }, [clearTimer, recompute]);

  /** Call from onResponderMove once real movement is observed. Cancels the
   * pending arm timer if the long-press/long-click hasn't fired yet — a
   * quick drag shouldn't retroactively become additive once it's already
   * moving. Once armed, movement no longer matters; the gesture stays
   * additive. */
  const cancelPressIfUnarmed = React.useCallback(() => {
    if (armed.current) return;
    clearTimer();
  }, [clearTimer]);

  /** Call from onResponderRelease/onResponderTerminate to end the gesture
   * and reset for the next one. */
  const endPress = React.useCallback(() => {
    clearTimer();
    armed.current = false;
    recompute();
  }, [clearTimer, recompute]);

  return { isAdditive: isHeldRef, beginPress, cancelPressIfUnarmed, endPress };
}
