import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

type PersistedValue = string | boolean;

const serialize = (value: PersistedValue) => JSON.stringify(value);

const deserialize = <T extends PersistedValue>(raw: string | null, fallback: T): T => {
  if (raw === null) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('Failed to parse persisted setting; falling back to default.', err);
    return fallback;
  }
};

/**
 * Small helper for storing primitive settings (string/boolean) in AsyncStorage.
 * Returns the hydrated value, a setter that also persists, and a reset helper.
 */
export const usePersistentSetting = <T extends PersistedValue>(
  storageKey: string,
  defaultValue: T,
) => {
  const [value, setValue] = React.useState<T>(defaultValue);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (cancelled) {
          return;
        }
        const hydrated = deserialize<T>(stored, defaultValue);
        setValue((prev) => (prev === hydrated ? prev : hydrated));
      } catch (err) {
        if (!cancelled) {
          console.warn(`Failed to load setting '${storageKey}'`, err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey, defaultValue]);

  const persistValue = React.useCallback(
    async (next: T) => {
      setValue(next);
      try {
        await AsyncStorage.setItem(storageKey, serialize(next));
      } catch (err) {
        console.warn(`Failed to persist setting '${storageKey}'`, err);
      }
    },
    [storageKey],
  );

  const resetValue = React.useCallback(async () => {
    setValue(defaultValue);
    try {
      await AsyncStorage.setItem(storageKey, serialize(defaultValue));
    } catch (err) {
      console.warn(`Failed to reset setting '${storageKey}'`, err);
    }
  }, [defaultValue, storageKey]);

  return [value, persistValue, resetValue] as const;
};
