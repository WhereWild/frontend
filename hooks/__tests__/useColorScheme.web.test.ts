import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { useColorScheme } from '../useColorScheme.web';

const mockRNHook = jest.spyOn(ReactNative, 'useColorScheme');

describe('useColorScheme (web)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRNHook.mockReset();
  });

  it('defaults to dark before hydration completes', () => {
    const effectSpy = jest.spyOn(React, 'useEffect').mockImplementationOnce(() => undefined);
    mockRNHook.mockReturnValue('light');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
    effectSpy.mockRestore();
  });

  it('returns the native color scheme after hydration', async () => {
    mockRNHook.mockReturnValue('dark');

    const { result } = renderHook(() => useColorScheme());

    await waitFor(() => {
      expect(result.current).toBe('dark');
    });
  });
});
