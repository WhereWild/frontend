import React, { createContext, useContext, ReactNode } from 'react';
import { useAsyncStorageState } from '@/hooks/useAsyncStorageState';

export type UnitSystem = 'metric' | 'imperial';

type SettingsContextType = {
  region: string;
  setRegion: (v: string) => void;
  units: UnitSystem;
  setUnits: (v: UnitSystem) => void;
  language: string;
  setLanguage: (v: string) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [region, setRegion] = useAsyncStorageState<string>('settings.region', 'utah');
  const [units, setUnits] = useAsyncStorageState<UnitSystem>('settings.units', 'metric');
  const [language, setLanguage] = useAsyncStorageState<string>('settings.language', 'en');

  return (
    <SettingsContext.Provider
      value={{ region, setRegion, units, setUnits, language, setLanguage }}
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