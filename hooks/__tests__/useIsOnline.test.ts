// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useIsOnline } from '../useIsOnline';

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  'OS',
);
const originalPlatformOS = Platform.OS;
type MockableGlobal = {
  navigator?: unknown;
  window?: unknown;
};
const globalScope = global as unknown as MockableGlobal;
const originalNavigator = globalScope.navigator;
const originalWindow = globalScope.window;

const setPlatformOS = (os: string) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
};

const restorePlatformOS = () => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    return;
  }
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatformOS,
  });
};

// This jest environment has no real `window`/`navigator` (not jsdom) — a
// minimal mock capturing registered listeners lets the test manually fire
// them, standing in for a real 'online'/'offline' browser event.
const listeners: Record<string, (() => void)[]> = {};

const installMockBrowserGlobals = (onLine: boolean) => {
  listeners.online = [];
  listeners.offline = [];
  globalScope.navigator = { onLine };
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
  globalScope.navigator = originalNavigator;
  globalScope.window = originalWindow;
};

const fireBrowserEvent = (type: 'online' | 'offline') => {
  (listeners[type] ?? []).forEach((listener) => listener());
};

describe('useIsOnline', () => {
  afterEach(() => {
    restorePlatformOS();
    restoreMockBrowserGlobals();
  });

  it('is always true on native, regardless of navigator.onLine', () => {
    setPlatformOS('ios');
    installMockBrowserGlobals(false);

    const { result, unmount } = renderHook(() => useIsOnline());

    expect(result.current).toBe(true);
    unmount();
  });

  it('reflects navigator.onLine on web at mount', () => {
    setPlatformOS('web');
    installMockBrowserGlobals(false);

    const { result, unmount } = renderHook(() => useIsOnline());

    expect(result.current).toBe(false);
    unmount();
  });

  it('flips to false when the browser goes offline, and back when it reconnects', () => {
    setPlatformOS('web');
    installMockBrowserGlobals(true);

    const { result, unmount } = renderHook(() => useIsOnline());
    expect(result.current).toBe(true);

    act(() => {
      fireBrowserEvent('offline');
    });
    expect(result.current).toBe(false);

    act(() => {
      fireBrowserEvent('online');
    });
    expect(result.current).toBe(true);
    unmount();
  });
});
