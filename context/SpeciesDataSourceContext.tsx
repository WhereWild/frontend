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
