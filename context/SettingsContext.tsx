// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { createContext, useContext, ReactNode } from 'react';
import { useAsyncStorageState } from '@/hooks/useAsyncStorageState';
import {
  type ColormapId,
  type CircularColormapId,
  COLORMAP_ORDER,
  CIRCULAR_COLORMAP_ORDER,
  DEFAULT_COLORMAP,
  DEFAULT_CIRCULAR_COLORMAP,
} from '@/components/sections/speciesOccurrenceMap/variableColors';
import { type CbMode } from '@/components/sections/speciesOccurrenceMap/cbColors';

export type UnitSystem = 'metric' | 'imperial';
export type ColorModeOverride = 'system' | 'light' | 'dark';

export function isUnitSystem(value: string): value is UnitSystem {
  return value === 'metric' || value === 'imperial';
}

export function isColorModeOverride(value: string): value is ColorModeOverride {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function isColormapId(value: string): value is ColormapId {
  return (COLORMAP_ORDER as string[]).includes(value);
}

export function isCircularColormapId(value: string): value is CircularColormapId {
  return (CIRCULAR_COLORMAP_ORDER as string[]).includes(value);
}

const CB_MODES: CbMode[] = ['colorblind', 'achromatopsia'];
export function isCbMode(value: string): value is CbMode {
  return (CB_MODES as string[]).includes(value);
}

export type { CbMode };

type SettingsContextType = {
  region: string;
  setRegion: (v: string) => void;
  units: UnitSystem;
  setUnits: (v: UnitSystem) => void;
  language: string;
  setLanguage: (v: string) => void;
  colorModeOverride: ColorModeOverride;
  setColorModeOverride: (v: ColorModeOverride) => void;
  colormap: ColormapId;
  setColormap: (v: ColormapId) => void;
  circularColormap: CircularColormapId;
  setCircularColormap: (v: CircularColormapId) => void;
  cbMode: CbMode | null;
  setCbMode: (v: CbMode | null) => void;
  shapesEnabled: boolean;
  setShapesEnabled: (v: boolean) => void;
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
  const [colormap, setColormap] = useAsyncStorageState<ColormapId>(
    'settings.colormap',
    DEFAULT_COLORMAP,
  );
  const [circularColormap, setCircularColormap] = useAsyncStorageState<CircularColormapId>(
    'settings.circularColormap',
    DEFAULT_CIRCULAR_COLORMAP,
  );
  const [cbMode, setCbModeRaw] = useAsyncStorageState<CbMode | null>(
    'settings.cbMode',
    null,
  );
  const setCbMode = (v: CbMode | null) => setCbModeRaw(v);
  const [shapesEnabled, setShapesEnabled] = useAsyncStorageState<boolean>(
    'settings.shapesEnabled',
    false,
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
        colormap,
        setColormap,
        circularColormap,
        setCircularColormap,
        cbMode,
        setCbMode,
        shapesEnabled,
        setShapesEnabled,
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
