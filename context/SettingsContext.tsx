// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { createContext, useContext, ReactNode } from 'react';
import { useAsyncStorageState } from '@/hooks/useAsyncStorageState';

export type UnitSystem = 'metric' | 'imperial';
export type ColorModeOverride = 'system' | 'light' | 'dark';

export function isUnitSystem(value: string): value is UnitSystem {
  return value === 'metric' || value === 'imperial';
}

export function isColorModeOverride(value: string): value is ColorModeOverride {
  return value === 'system' || value === 'light' || value === 'dark';
}

type SettingsContextType = {
  region: string;
  setRegion: (v: string) => void;
  units: UnitSystem;
  setUnits: (v: UnitSystem) => void;
  language: string;
  setLanguage: (v: string) => void;
  colorModeOverride: ColorModeOverride;
  setColorModeOverride: (v: ColorModeOverride) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [region, setRegion] = useAsyncStorageState<string>(
    'settings.region',
    'utah',
  );
  const [units, setUnits] = useAsyncStorageState<UnitSystem>(
    'settings.units',
    'metric',
  );
  const [language, setLanguage] = useAsyncStorageState<string>(
    'settings.language',
    'en',
  );
  const [colorModeOverride, setColorModeOverride] =
    useAsyncStorageState<ColorModeOverride>(
      'settings.colorModeOverride',
      'system',
    );

  return (
    <SettingsContext.Provider
      value={{
        region,
        setRegion,
        units,
        setUnits,
        language,
        setLanguage,
        colorModeOverride,
        setColorModeOverride,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return ctx;
}

export function useOptionalSettings() {
  return useContext(SettingsContext);
}
