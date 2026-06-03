// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { remoteSpeciesDataSource, type SpeciesDataSource } from '@/data/speciesDataSource';
import React from 'react';

const SpeciesDataSourceContext = React.createContext<SpeciesDataSource>(remoteSpeciesDataSource);

export function SpeciesDataSourceProvider({
  value,
  children,
}: {
  value: SpeciesDataSource;
  children: React.ReactNode;
}) {
  return (
    <SpeciesDataSourceContext.Provider value={value}>
      {children}
    </SpeciesDataSourceContext.Provider>
  );
}

export function useSpeciesDataSource() {
  return React.useContext(SpeciesDataSourceContext);
}
