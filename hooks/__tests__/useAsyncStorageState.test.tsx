import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useAsyncStorageState } from '../useAsyncStorageState';

type HarnessProps<T> = {
  storageKey: string;
  initial: T;
  onValue: (value: T, setValue: (next: T) => void) => void;
};

function HookHarness<T>({ storageKey, initial, onValue }: HarnessProps<T>) {
  const [value, setValue] = useAsyncStorageState(storageKey, initial);

  React.useEffect(() => {
    onValue(value, setValue);
  }, [onValue, setValue, value]);

  return null;
}

function promiseDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('useAsyncStorageState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
  });

  it('loads JSON from storage and persists updates', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce('"stored"');

    let latestValue = 'initial';
    let latestSetter: ((next: string) => void) | undefined;

    render(
      <HookHarness
        storageKey="settings.region"
        initial="initial"
        onValue={(value, setValue) => {
          latestValue = value;
          latestSetter = setValue;
        }}
      />,
    );

    await waitFor(() => expect(latestValue).toBe('stored'));
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('settings.region');

    await act(async () => {
      latestSetter?.('updated');
    });

    await waitFor(() => {
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('settings.region', '"updated"');
    });
  });

  it('falls back to raw string when stored value is not valid JSON', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce('raw-text');

    let latestValue = 'initial';

    render(
      <HookHarness
        storageKey="settings.language"
        initial="initial"
        onValue={(value) => {
          latestValue = value;
        }}
      />,
    );

    await waitFor(() => expect(latestValue).toBe('raw-text'));
  });

  it('keeps initial value when storage has no saved value', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(null);

    let latestValue = 'initial';

    render(
      <HookHarness
        storageKey="settings.empty"
        initial="initial"
        onValue={(value) => {
          latestValue = value;
        }}
      />,
    );

    await waitFor(() => {
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('settings.empty');
    });
    expect(latestValue).toBe('initial');
  });

  it('keeps initial value when load fails and ignores save errors', async () => {
    mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('load failed'));
    mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('save failed'));

    let latestValue = 'initial';
    let latestSetter: ((next: string) => void) | undefined;

    render(
      <HookHarness
        storageKey="settings.units"
        initial="initial"
        onValue={(value, setValue) => {
          latestValue = value;
          latestSetter = setValue;
        }}
      />,
    );

    await waitFor(() => expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('settings.units'));
    expect(latestValue).toBe('initial');

    await act(async () => {
      latestSetter?.('next');
    });

    await waitFor(() => {
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('settings.units', '"next"');
    });
  });

  it('does not set state if unmounted before async load resolves', async () => {
    const deferred = promiseDeferred<string | null>();
    mockAsyncStorage.getItem.mockReturnValueOnce(deferred.promise);

    let latestValue = 'initial';

    const view = render(
      <HookHarness
        storageKey="settings.region"
        initial="initial"
        onValue={(value) => {
          latestValue = value;
        }}
      />,
    );

    await waitFor(() => {
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('settings.region');
    });

    view.unmount();

    await act(async () => {
      deferred.resolve('"late-value"');
      await deferred.promise;
    });

    expect(latestValue).toBe('initial');
  });
});