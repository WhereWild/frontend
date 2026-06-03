// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// hooks/useAsyncStorageState.ts
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * useAsyncStorageState - like useState but persisted to AsyncStorage.
 * - key: storage key
 * - initial: initial value used until stored value is loaded (and if none exists)
 *
 * NOTE: only call this for the select fields you want persisted.
 */
export function useAsyncStorageState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const loadedRef = useRef(false);

  // load once on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!mounted) return;
        if (raw !== null) {
          // stored as JSON
          try {
            setState(JSON.parse(raw) as T);
          } catch {
            // fallback: treat as plain string
            // @ts-ignore
            setState(raw);
          }
        }
      } catch (e) {
        // ignore load errors, keep initial
        // console.warn('AsyncStorage load failed', key, e);
      } finally {
        loadedRef.current = true;
      }
    })();
    return () => { mounted = false; };
  }, [key]);

  // save whenever state changes after the first load attempt
  useEffect(() => {
    if (!loadedRef.current) return; // don't overwrite storage before initial load
    (async () => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(state));
      } catch (e) {
        // ignore write errors
        // console.warn('AsyncStorage save failed', key, e);
      }
    })();
  }, [key, state]);

  return [state, setState] as const;
}
