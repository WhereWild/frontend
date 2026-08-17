// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import {
  SettingsProvider,
  useOptionalSettings,
  useSettings,
} from '../SettingsContext';
import { useAsyncStorageState } from '@/hooks/useAsyncStorageState';

jest.unmock('@/context/SettingsContext');

jest.mock('@/hooks/useAsyncStorageState', () => ({
  useAsyncStorageState: jest.fn(),
}));

describe('SettingsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides persisted settings values and setters', () => {
    const setRegion = jest.fn();
    const setUnits = jest.fn();
    const setLanguage = jest.fn();
    const setColorModeOverride = jest.fn();

    (useAsyncStorageState as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'settings.region':
          return ['utah', setRegion] as const;
        case 'settings.units':
          return ['metric', setUnits] as const;
        case 'settings.language':
          return ['en', setLanguage] as const;
        case 'settings.colorModeOverride':
          return ['system', setColorModeOverride] as const;
        case 'settings.colormap':
        case 'settings.circularColormap':
        case 'settings.cbMode':
        case 'settings.shapesEnabled':
        case 'settings.markerOutlineEnabled':
        case 'settings.globeViewEnabled':
        case 'settings.terrainEnabled':
        case 'settings.basemapMode':
        case 'settings.standardBasemapTheme':
        case 'settings.localLat':
        case 'settings.localLon':
          return [undefined, jest.fn()] as const;
        default:
          throw new Error(`Unexpected settings key: ${key}`);
      }
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );

    const { result } = renderHook(
      () => ({
        required: useSettings(),
        optional: useOptionalSettings(),
      }),
      { wrapper },
    );

    expect(result.current.required.region).toBe('utah');
    expect(result.current.required.units).toBe('metric');
    expect(result.current.required.language).toBe('en');
    expect(result.current.required.colorModeOverride).toBe('system');
    expect(result.current.optional).toBe(result.current.required);

    act(() => {
      result.current.required.setRegion('arizona');
      result.current.required.setUnits('imperial');
      result.current.required.setLanguage('es');
      result.current.required.setColorModeOverride('dark');
    });

    expect(setRegion).toHaveBeenCalledWith('arizona');
    expect(setUnits).toHaveBeenCalledWith('imperial');
    expect(setLanguage).toHaveBeenCalledWith('es');
    expect(setColorModeOverride).toHaveBeenCalledWith('dark');
  });

  it('throws when useSettings is called outside the provider', () => {
    expect(() => renderHook(() => useSettings())).toThrow(
      'useSettings must be used inside SettingsProvider',
    );
  });

  it('returns undefined when useOptionalSettings is called outside the provider', () => {
    const { result } = renderHook(() => useOptionalSettings());

    expect(result.current).toBeUndefined();
  });
});
