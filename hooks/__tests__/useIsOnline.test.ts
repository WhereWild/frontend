// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook, waitFor } from '@testing-library/react-native';
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
  document?: unknown;
  fetch?: unknown;
};
const globalScope = global as unknown as MockableGlobal;
const originalNavigator = globalScope.navigator;
const originalWindow = globalScope.window;
const originalDocument = globalScope.document;
const originalFetch = globalScope.fetch;

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
  globalScope.document = undefined;
};

const restoreMockBrowserGlobals = () => {
  globalScope.navigator = originalNavigator;
  globalScope.window = originalWindow;
  globalScope.document = originalDocument;
  globalScope.fetch = originalFetch;
};

const fireBrowserEvent = (type: 'online' | 'offline') => {
  (listeners[type] ?? []).forEach((listener) => listener());
};

/** Controls what the mocked `fetch(BACKEND_BASE)` reachability probe does. */
const mockFetch = (behavior: 'resolve' | 'reject') => {
  globalScope.fetch = jest.fn(() =>
    behavior === 'resolve'
      ? Promise.resolve({ ok: true } as Response)
      : Promise.reject(new Error('network error')),
  );
};

describe('useIsOnline', () => {
  afterEach(() => {
    restorePlatformOS();
    restoreMockBrowserGlobals();
  });

  it('is always true on native, regardless of navigator.onLine or fetch', () => {
    setPlatformOS('ios');
    installMockBrowserGlobals(false);
    mockFetch('reject');

    const { result, unmount } = renderHook(() => useIsOnline());

    expect(result.current).toBe(true);
    unmount();
  });

  it('reflects navigator.onLine=false immediately on web, without waiting for a probe', () => {
    setPlatformOS('web');
    installMockBrowserGlobals(false);
    mockFetch('resolve');

    const { result, unmount } = renderHook(() => useIsOnline());

    expect(result.current).toBe(false);
    unmount();
  });

  it('does not blindly trust navigator.onLine=true — falls back to false if the backend is unreachable', async () => {
    // Reproduces the real-world bug report: navigator.onLine still says
    // true in airplane mode, so it must not be trusted on its own.
    setPlatformOS('web');
    installMockBrowserGlobals(true);
    mockFetch('reject');

    const { result, unmount } = renderHook(() => useIsOnline());

    await waitFor(() => expect(result.current).toBe(false));
    unmount();
  });

  it('stays online when navigator.onLine=true and the backend is actually reachable', async () => {
    setPlatformOS('web');
    installMockBrowserGlobals(true);
    mockFetch('resolve');

    const { result, unmount } = renderHook(() => useIsOnline());

    await waitFor(() => expect(globalScope.fetch).toHaveBeenCalled());
    expect(result.current).toBe(true);
    unmount();
  });

  it('re-probes on the browser online/offline events and updates accordingly', async () => {
    setPlatformOS('web');
    installMockBrowserGlobals(true);
    mockFetch('resolve');

    const { result, unmount } = renderHook(() => useIsOnline());
    await waitFor(() => expect(result.current).toBe(true));

    mockFetch('reject');
    await act(async () => {
      fireBrowserEvent('offline');
    });
    await waitFor(() => expect(result.current).toBe(false));

    mockFetch('resolve');
    await act(async () => {
      fireBrowserEvent('online');
    });
    await waitFor(() => expect(result.current).toBe(true));

    unmount();
  });
});
