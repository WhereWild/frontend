// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Platform } from 'react-native';

/**
 * Tracks the browser's actual connectivity state (`navigator.onLine` +
 * `online`/`offline` events) — same detection SpeciesOccurrenceMapOffline's
 * own in-page fallback logic uses, surfaced here so a caller can decide
 * whether to load the offline-capable map template in the first place
 * (rather than always paying that template's ~26MB/~300ms-per-switch cost
 * regardless of whether it'll ever actually be needed this session).
 *
 * Always true on native, where there's no `navigator.onLine` equivalent
 * wired up yet.
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = React.useState(() =>
    Platform.OS !== 'web' || typeof navigator === 'undefined'
      ? true
      : navigator.onLine,
  );

  React.useEffect(() => {
    // Also guards test/SSR-like environments that report Platform.OS as
    // 'web' but don't provide a real `window` with working listener methods.
    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function'
    ) {
      return;
    }
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}
