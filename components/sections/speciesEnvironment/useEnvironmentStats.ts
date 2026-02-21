import { fetchSpeciesEnvironment } from '@/data/api';
import type { SpeciesEnvironmentStats } from '@/data/types';
import React from 'react';
import { isValidHistogramContract } from './model';

/** Inputs for loading environment stats for one variable. */
type UseEnvironmentStatsParams = {
  /** Taxon ID used for environment stats endpoint calls. */
  taxonId?: number;
  /** Active variable id to load. */
  selectedVariable: string;
  /** Optional location filter gid. */
  locationGid?: string | null;
};

/** Fetches and caches environment stats keyed by selected variable. */
export function useEnvironmentStats({
  taxonId,
  selectedVariable,
  locationGid,
}: UseEnvironmentStatsParams) {
  const [statsByVariable, setStatsByVariable] = React.useState<Record<string, SpeciesEnvironmentStats>>(
    {},
  );
  const [errorByVariable, setErrorByVariable] = React.useState<Record<string, string | null>>({});
  const [loadingVariable, setLoadingVariable] = React.useState<string | null>(null);

  React.useEffect(() => {
    setStatsByVariable({});
    setErrorByVariable({});
  }, [taxonId, locationGid]);

  const hasStatsForSelection = Boolean(selectedVariable && statsByVariable[selectedVariable]);

  React.useEffect(() => {
    if (!taxonId || !selectedVariable || hasStatsForSelection) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingVariable(selectedVariable);
      setErrorByVariable((prev) => ({ ...prev, [selectedVariable]: null }));
      try {
        const response = await fetchSpeciesEnvironment(taxonId, selectedVariable, {
          location: locationGid,
        });
        if (response.histogram && !isValidHistogramContract(response.histogram)) {
          throw new Error('Received malformed histogram data from environment API');
        }
        if (cancelled) {
          return;
        }
        setStatsByVariable((prev) => ({ ...prev, [selectedVariable]: response }));
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load environment stats';
        setErrorByVariable((prev) => ({ ...prev, [selectedVariable]: message }));
      } finally {
        if (!cancelled) {
          setLoadingVariable((prev) => (prev === selectedVariable ? null : prev));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasStatsForSelection, selectedVariable, taxonId, locationGid]);

  const stats = selectedVariable ? statsByVariable[selectedVariable] ?? null : null;
  const error = selectedVariable ? errorByVariable[selectedVariable] ?? null : null;
  const loading = loadingVariable === selectedVariable;

  return {
    stats,
    error,
    loading,
  };
}