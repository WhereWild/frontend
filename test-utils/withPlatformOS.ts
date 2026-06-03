// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Platform } from 'react-native';

type WithPlatformOptions = {
  ensureWebWindowListeners?: boolean;
};

export const withPlatformOS = (
  platform: typeof Platform.OS,
  run: () => void,
  options?: WithPlatformOptions,
) => {
  const originalPlatform = Platform.OS;
  const windowObject = global.window as (Window & typeof globalThis) | undefined;
  const originalAddEventListener = windowObject?.addEventListener;
  const originalRemoveEventListener = windowObject?.removeEventListener;
  const hadAddEventListener = windowObject != null && 'addEventListener' in windowObject;
  const hadRemoveEventListener = windowObject != null && 'removeEventListener' in windowObject;
  const fallbackAddEventListener = jest.fn() as typeof window.addEventListener;
  const fallbackRemoveEventListener = jest.fn() as typeof window.removeEventListener;

  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: platform,
  });

  if (platform === 'web' && options?.ensureWebWindowListeners && windowObject) {
    windowObject.addEventListener = originalAddEventListener ?? fallbackAddEventListener;
    windowObject.removeEventListener = originalRemoveEventListener ?? fallbackRemoveEventListener;
  }

  try {
    run();
  } finally {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });

    if (platform === 'web' && options?.ensureWebWindowListeners && windowObject) {
      if (hadAddEventListener && originalAddEventListener) {
        windowObject.addEventListener = originalAddEventListener;
      } else {
        delete (windowObject as Partial<Window>).addEventListener;
      }

      if (hadRemoveEventListener && originalRemoveEventListener) {
        windowObject.removeEventListener = originalRemoveEventListener;
      } else {
        delete (windowObject as Partial<Window>).removeEventListener;
      }
    }
  }
};