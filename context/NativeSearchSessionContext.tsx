// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { UseSearchFiltersInitialState } from '@/hooks/search/filters/useSearchFilters';
import React from 'react';

type NativeSearchSessionContextValue = {
  filterVisible: boolean;
  filtersState?: UseSearchFiltersInitialState;
  searchQuery: string;
  setFilterVisible: (value: boolean) => void;
  setFiltersState: (value?: UseSearchFiltersInitialState) => void;
  setSearchQuery: (value: string) => void;
};

const NativeSearchSessionContext =
  React.createContext<NativeSearchSessionContextValue | null>(null);

/** Keeps native search state alive while the shared layout rebuilds tab stacks. */
export function NativeSearchSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterVisible, setFilterVisible] = React.useState(false);
  const [filtersState, setFiltersState] = React.useState<
    UseSearchFiltersInitialState | undefined
  >(undefined);

  const value = React.useMemo(
    () => ({
      filterVisible,
      filtersState,
      searchQuery,
      setFilterVisible,
      setFiltersState,
      setSearchQuery,
    }),
    [filterVisible, filtersState, searchQuery],
  );

  return (
    <NativeSearchSessionContext.Provider value={value}>
      {children}
    </NativeSearchSessionContext.Provider>
  );
}

export function useNativeSearchSession() {
  const context = React.useContext(NativeSearchSessionContext);

  if (!context) {
    throw new Error(
      'useNativeSearchSession must be used within NativeSearchSessionProvider',
    );
  }

  return context;
}
