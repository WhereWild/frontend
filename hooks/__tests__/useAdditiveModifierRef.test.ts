// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useAdditiveModifierRef } from '../useAdditiveModifierRef';

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  'OS',
);

const setPlatformOS = (os: string) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
};

const restorePlatformOS = () => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
  }
};

// This jest environment has no real `document`/`window` (not jsdom) — a
// minimal mock capturing registered listeners lets the test manually fire
// them, standing in for real keydown/keyup/blur browser events.
type MockableGlobal = {
  document?: unknown;
  window?: unknown;
};
const globalScope = global as unknown as MockableGlobal;
const originalDocument = globalScope.document;
const originalWindow = globalScope.window;
const listeners: Record<string, ((event: { key: string }) => void)[]> = {};

const installMockBrowserGlobals = () => {
  listeners.keydown = [];
  listeners.keyup = [];
  listeners.blur = [];
  globalScope.document = {
    addEventListener: (
      type: string,
      listener: (event: { key: string }) => void,
    ) => {
      (listeners[type] ??= []).push(listener);
    },
    removeEventListener: (
      type: string,
      listener: (event: { key: string }) => void,
    ) => {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== listener);
    },
  };
  globalScope.window = {
    addEventListener: (type: string, listener: () => void) => {
      (listeners[type] ??= []).push(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== listener);
    },
  };
};

const restoreMockBrowserGlobals = () => {
  globalScope.document = originalDocument;
  globalScope.window = originalWindow;
};

const fireKeyEvent = (type: 'keydown' | 'keyup', key: string) => {
  (listeners[type] ?? []).forEach((listener) => listener({ key }));
};

describe('useAdditiveModifierRef', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    restorePlatformOS();
    restoreMockBrowserGlobals();
  });

  describe('web keyboard modifier', () => {
    beforeEach(() => {
      setPlatformOS('web');
      installMockBrowserGlobals();
    });

    it('tracks shift held via keydown/keyup', () => {
      const { result, unmount } = renderHook(() => useAdditiveModifierRef());

      expect(result.current.isAdditive.current).toBe(false);
      act(() => {
        fireKeyEvent('keydown', 'Shift');
      });
      expect(result.current.isAdditive.current).toBe(true);
      act(() => {
        fireKeyEvent('keyup', 'Shift');
      });
      expect(result.current.isAdditive.current).toBe(false);
      unmount();
    });

    it('stays additive from a long press even after the key is released', () => {
      jest.useFakeTimers();
      const { result, unmount } = renderHook(() => useAdditiveModifierRef());

      act(() => {
        fireKeyEvent('keydown', 'Shift');
        result.current.beginPress();
      });
      expect(result.current.isAdditive.current).toBe(true);

      act(() => {
        fireKeyEvent('keyup', 'Shift');
      });
      // Key released, but the long-press timer is still pending — not armed
      // yet, and the key is no longer held, so additive drops.
      expect(result.current.isAdditive.current).toBe(false);

      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(result.current.isAdditive.current).toBe(true);
      unmount();
      jest.useRealTimers();
    });
  });

  // Long-press-to-arm applies on every platform — this is a web-first app,
  // so `Platform.OS` reads 'web' on a phone's browser too, not just desktop.
  describe.each([['web'], ['ios']])('long press to arm (%s)', (os) => {
    beforeEach(() => {
      setPlatformOS(os);
      if (os === 'web') installMockBrowserGlobals();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('arms additive after a long press with no movement, and fires a haptic', () => {
      const { result, unmount } = renderHook(() => useAdditiveModifierRef());

      act(() => {
        result.current.beginPress();
      });
      expect(result.current.isAdditive.current).toBe(false);

      act(() => {
        jest.advanceTimersByTime(499);
      });
      expect(result.current.isAdditive.current).toBe(false);
      expect(Haptics.selectionAsync).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(result.current.isAdditive.current).toBe(true);
      expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
      unmount();
    });

    it('cancels the pending arm if real movement happens before the long-press threshold', () => {
      const { result, unmount } = renderHook(() => useAdditiveModifierRef());

      act(() => {
        result.current.beginPress();
        jest.advanceTimersByTime(200);
        result.current.cancelPressIfUnarmed();
        jest.advanceTimersByTime(1000);
      });
      expect(result.current.isAdditive.current).toBe(false);
      expect(Haptics.selectionAsync).not.toHaveBeenCalled();
      unmount();
    });

    it('does not cancel an already-armed gesture on subsequent movement', () => {
      const { result, unmount } = renderHook(() => useAdditiveModifierRef());

      act(() => {
        result.current.beginPress();
        jest.advanceTimersByTime(500);
      });
      expect(result.current.isAdditive.current).toBe(true);

      act(() => {
        result.current.cancelPressIfUnarmed();
      });
      expect(result.current.isAdditive.current).toBe(true);
      unmount();
    });

    it('resets on endPress so the next gesture starts unarmed', () => {
      const { result, unmount } = renderHook(() => useAdditiveModifierRef());

      act(() => {
        result.current.beginPress();
        jest.advanceTimersByTime(500);
      });
      expect(result.current.isAdditive.current).toBe(true);

      act(() => {
        result.current.endPress();
      });
      expect(result.current.isAdditive.current).toBe(false);

      // A pending timer from a stale beginPress should not fire late and
      // re-arm after endPress already reset it.
      act(() => {
        result.current.beginPress();
        result.current.endPress();
        jest.advanceTimersByTime(1000);
      });
      expect(result.current.isAdditive.current).toBe(false);
      unmount();
    });
  });
});
