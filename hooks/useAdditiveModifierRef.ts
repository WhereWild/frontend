// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Platform } from 'react-native';

/**
 * Tracks whether shift/cmd is CURRENTLY held, via document-level
 * keydown/keyup listeners — read the returned ref's `.current` at
 * gesture-start time.
 *
 * Used by drag-based charts (DensityChart, PolarDensityChart via
 * useCircularDragSelection), which drive selection through react-native-web's
 * raw GestureResponder system (`onResponderGrant`/`onResponderMove`/etc), NOT
 * Pressable's onPress (a real DOM MouseEvent). Two things rule out reading
 * ctrl/cmd off the event directly there, same underlying system either way:
 *   1. react-native-web's ResponderSystem gates EVERY mousedown/mousemove
 *      through `isPrimaryPointerDown`, which requires `ctrlKey === false` —
 *      holding ctrl means the gesture never starts at all, framework-wide,
 *      for ANY responder-based drag. This is why ctrl works for the
 *      pill/bar-segment click-based additive gesture (a real Pressable
 *      onClick, a different code path entirely) but can never work here.
 *   2. Separately, the responder event synthesis in createResponderEvent.js
 *      hardcodes `nativeEvent.ctrlKey` to `false` unconditionally anyway —
 *      only `metaKey` (Cmd) survives that path.
 * Shift and Meta are NOT blocked by isPrimaryPointerDown, so those are the
 * only modifiers usable for a drag gesture here — tracking key state
 * ourselves (rather than trusting the event) sidesteps both gaps.
 *
 * No-op (always false) on native, where there's no keyboard modifier concept
 * — mobile uses long-press as the additive gesture instead.
 */
export function useAdditiveModifierRef() {
  const isHeldRef = React.useRef(false);

  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key === 'Meta') {
        isHeldRef.current = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key === 'Meta') {
        isHeldRef.current = false;
      }
    };
    // A keyup can be missed if focus left the window while the key was
    // held (e.g. alt-tabbing away) — clear on blur so a stale "held" state
    // doesn't linger into the next interaction.
    const onBlur = () => {
      isHeldRef.current = false;
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return isHeldRef;
}
