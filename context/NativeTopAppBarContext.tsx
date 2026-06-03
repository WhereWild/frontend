// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TopAppBarProps } from '@/components';
import React from 'react';

type TopAppBarPrimaryActionConfig = TopAppBarProps['primaryAction'];
type TopAppBarSecondaryActionConfig = TopAppBarProps['secondaryAction'];

export type NativeTopAppBarConfig = {
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  onSubmitSearch?: (value: string) => void;
  searchPlaceholder?: string;
  primaryAction?: TopAppBarPrimaryActionConfig;
  secondaryAction?: TopAppBarSecondaryActionConfig;
};

type NativeTopAppBarContextValue = {
  config: NativeTopAppBarConfig;
  setConfig: (next: NativeTopAppBarConfig) => void;
  resetConfig: () => void;
};

const NOOP_SEARCH_HANDLER = (_value: string) => {};

export const DEFAULT_CONFIG: NativeTopAppBarConfig = {
  searchValue: '',
  onSearchValueChange: NOOP_SEARCH_HANDLER,
  onSubmitSearch: NOOP_SEARCH_HANDLER,
  searchPlaceholder: 'Search',
  primaryAction: { isVisible: false },
  secondaryAction: { isVisible: false },
};

/** Returns a safe route-scoped config so search actions never leak to non-search routes. */
export function resolveNativeTopAppBarConfigForRoute(
  pathname: string | undefined,
  config: NativeTopAppBarConfig,
): NativeTopAppBarConfig {
  if (pathname === '/search') {
    return {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  return DEFAULT_CONFIG;
}

const NativeTopAppBarContext = React.createContext<NativeTopAppBarContextValue | null>(null);

/** Provides native top-app-bar state used by the shared layout host. */
export function NativeTopAppBarProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = React.useState<NativeTopAppBarConfig>(DEFAULT_CONFIG);

  const setConfig = React.useCallback((next: NativeTopAppBarConfig) => {
    setConfigState(next);
  }, []);

  const resetConfig = React.useCallback(() => {
    setConfigState(DEFAULT_CONFIG);
  }, []);

  return (
    <NativeTopAppBarContext.Provider value={{ config, setConfig, resetConfig }}>
      {children}
    </NativeTopAppBarContext.Provider>
  );
}

export function useNativeTopAppBarConfig() {
  const context = React.useContext(NativeTopAppBarContext);
  if (!context) {
    throw new Error('useNativeTopAppBarConfig must be used within NativeTopAppBarProvider');
  }

  return context;
}
