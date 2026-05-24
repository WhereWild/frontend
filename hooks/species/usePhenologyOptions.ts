import { fetchPhenologyValues, type PhenologyOption } from '@/data/phenologyConstants';
import React from 'react';

/** Fetches phenology filter options from the backend once and caches them. */
export function usePhenologyOptions(): PhenologyOption[] {
  const [options, setOptions] = React.useState<PhenologyOption[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetchPhenologyValues()
      .then((values) => {
        if (!cancelled) {
          setOptions(values);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}
