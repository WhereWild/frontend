// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Platform } from 'react-native';
import { BACKEND_BASE } from '@/data/apiShared';

// navigator.onLine only reflects whether some network interface is up, not
// whether the internet (or our backend) is actually reachable — confirmed
// broken in real-world testing (still reports true in airplane mode). It's
// used here only as a cheap, immediate "definitely offline" fast path; a
// `true` reading is always re-verified with a real fetch before being
// trusted.
const REACHABILITY_TIMEOUT_MS = 4000;
const POLL_WHILE_OFFLINE_MS = 15000;

async function probeReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS);
  try {
    // Reaching our own backend at all — even a non-2xx response — means
    // real connectivity exists; only a network-level failure (offline, DNS,
    // timeout) means it doesn't.
    await fetch(`${BACKEND_BASE}/`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Tracks whether the backend is actually reachable — not just whether
 * `navigator.onLine` claims a network interface is up. Used to decide
 * whether to load the offline-capable map template in the first place
 * (rather than always paying that template's extra data + logic cost
 * regardless of whether it'll ever actually be needed this session).
 *
 * Always true on native, where there's no reachability signal wired up yet.
 */
export function useIsOnline(): boolean {
  const isWeb =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function';

  const [isOnline, setIsOnline] = React.useState(() => {
    if (!isWeb) return true;
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  });

  React.useEffect(() => {
    if (!isWeb) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPoll = () => {
      if (pollTimer != null) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const runProbe = async () => {
      const reachable = await probeReachable();
      if (cancelled) return;
      setIsOnline(reachable);
      clearPoll();
      if (!reachable) {
        // Nothing else re-checks while navigator.onLine stays (wrongly)
        // true, so poll until reachability actually returns.
        pollTimer = setTimeout(runProbe, POLL_WHILE_OFFLINE_MS);
      }
    };

    // navigator.onLine === false is trustworthy enough to act on
    // immediately; a `true` reading always gets verified against the
    // backend before being trusted.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setIsOnline(false);
    }
    runProbe();

    const onNetworkEventOrVisible = () => runProbe();
    window.addEventListener('online', onNetworkEventOrVisible);
    window.addEventListener('offline', onNetworkEventOrVisible);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onNetworkEventOrVisible);
    }

    return () => {
      cancelled = true;
      clearPoll();
      window.removeEventListener('online', onNetworkEventOrVisible);
      window.removeEventListener('offline', onNetworkEventOrVisible);
      if (typeof document !== 'undefined') {
        document.removeEventListener(
          'visibilitychange',
          onNetworkEventOrVisible,
        );
      }
    };
  }, [isWeb]);

  return isOnline;
}
