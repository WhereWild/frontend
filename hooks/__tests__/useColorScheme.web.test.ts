import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { useColorScheme } from '../useColorScheme.web';
import { useOptionalSettings } from '@/context/SettingsContext';

jest.mock('@/context/SettingsContext', () => ({
  useOptionalSettings: jest.fn(() => ({ colorModeOverride: 'system' })),
}));

const mockRNHook = jest.spyOn(ReactNative, 'useColorScheme');

describe('useColorScheme (web)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRNHook.mockReset();
    (useOptionalSettings as jest.Mock).mockReturnValue({
      colorModeOverride: 'system',
    });
  });

  it('defaults to dark before hydration completes', () => {
    const effectSpy = jest
      .spyOn(React, 'useEffect')
      .mockImplementationOnce(() => undefined);
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

  it('falls back to the default when the native value is missing after hydration', async () => {
    mockRNHook.mockReturnValue(undefined);

    const { result } = renderHook(() => useColorScheme());

    await waitFor(() => {
      expect(result.current).toBe('dark');
    });
  });

  it('returns the configured light override before hydration', () => {
    const effectSpy = jest
      .spyOn(React, 'useEffect')
      .mockImplementationOnce(() => undefined);
    (useOptionalSettings as jest.Mock).mockReturnValue({
      colorModeOverride: 'light',
    });
    mockRNHook.mockReturnValue('dark');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('light');
    effectSpy.mockRestore();
  });

  it('returns the configured dark override after hydration', async () => {
    (useOptionalSettings as jest.Mock).mockReturnValue({
      colorModeOverride: 'dark',
    });
    mockRNHook.mockReturnValue('light');

    const { result } = renderHook(() => useColorScheme());

    await waitFor(() => {
      expect(result.current).toBe('dark');
    });
  });
});
