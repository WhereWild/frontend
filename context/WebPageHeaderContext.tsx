import type { SearchTaxaQueryFilters } from '@/data/api';
import React from 'react';

export type HeaderConfig = {
  showFilterButton?: boolean;
  onFilterPress?: () => void;
  filterLabel?: string;
  showResetFilterButton?: boolean;
  onResetFilterPress?: () => void;
  showSearchResultsDropdown?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  filterParams?: SearchTaxaQueryFilters;
};

type WebPageHeaderContextValue = {
  config: HeaderConfig;
  setConfig: (next: HeaderConfig) => void;
  resetConfig: () => void;
};

export const DEFAULT_CONFIG: HeaderConfig = {
  showFilterButton: false,
  showSearchResultsDropdown: true,
};

/** Identifies whether the current route is the dedicated search page. */
const isSearchRoute = (pathname?: string) => pathname === '/search';

/**
 * Applies route-aware constraints to shared header config so page-specific controls
 * do not bleed into unrelated routes when the single global header stays mounted.
 */
export function resolveHeaderConfigForRoute(
  pathname: string | undefined,
  config: HeaderConfig,
): HeaderConfig {
  const merged = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  if (isSearchRoute(pathname)) {
    return merged;
  }

  return {
    ...merged,
    showFilterButton: false,
    onFilterPress: undefined,
    filterLabel: undefined,
    showResetFilterButton: false,
    onResetFilterPress: undefined,
    showSearchResultsDropdown: true,
    searchQuery: undefined,
    onSearchQueryChange: undefined,
    filterParams: undefined,
  };
}

const WebPageHeaderContext =
  React.createContext<WebPageHeaderContextValue | null>(null);

/** Provides shared, route-aware header configuration to the app shell. */
export function WebPageHeaderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config, setConfigState] = React.useState<HeaderConfig>(DEFAULT_CONFIG);

  const setConfig = React.useCallback((next: HeaderConfig) => {
    setConfigState(next);
  }, []);

  const resetConfig = React.useCallback(() => {
    setConfigState(DEFAULT_CONFIG);
  }, []);

  return (
    <WebPageHeaderContext.Provider value={{ config, setConfig, resetConfig }}>
      {children}
    </WebPageHeaderContext.Provider>
  );
}

export function useWebPageHeaderConfig() {
  const context = React.useContext(WebPageHeaderContext);
  if (!context) {
    throw new Error(
      'useWebPageHeaderConfig must be used within WebPageHeaderProvider',
    );
  }

  return context;
}
