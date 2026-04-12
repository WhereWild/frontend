import { fetchDataSources } from '@/data/api';
import type { DataSource } from '@/data/types';
import React from 'react';

/**
 * Fetches and caches the data-sources catalog for the lifetime of the component.
 * Returns an empty map until the fetch resolves.
 */
export function useDataSources(): Record<string, DataSource> {
  const [sources, setSources] = React.useState<Record<string, DataSource>>({});

  React.useEffect(() => {
    let cancelled = false;
    fetchDataSources()
      .then((data) => {
        if (!cancelled) setSources(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return sources;
}
