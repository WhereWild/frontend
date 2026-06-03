// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
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
  /** Optional phenology filter value. */
  phenology?: string | null;
  /** Optional timestamp range filter (Unix seconds). */
  startTimestamp?: number | null;
  endTimestamp?: number | null;

  units?: 'metric' | 'imperial' | undefined;
};

/** Fetches and caches environment stats keyed by selected variable. */
export function useEnvironmentStats({
  taxonId,
  selectedVariable,
  locationGid,
  phenology,
  startTimestamp,
  endTimestamp,
  units,
}: UseEnvironmentStatsParams) {
  const speciesDataSource = useSpeciesDataSource();
  const [statsByVariable, setStatsByVariable] = React.useState<
    Record<string, SpeciesEnvironmentStats>
  >({});
  const [errorByVariable, setErrorByVariable] = React.useState<
    Record<string, string | null>
  >({});
  const [loadingVariable, setLoadingVariable] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    setStatsByVariable({});
    setErrorByVariable({});
  }, [taxonId, locationGid, phenology, startTimestamp, endTimestamp, units]);

  const hasStatsForSelection = Boolean(
    selectedVariable && statsByVariable[selectedVariable],
  );

  React.useEffect(() => {
    if (!taxonId || !selectedVariable || hasStatsForSelection) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingVariable(selectedVariable);
      setErrorByVariable((prev) => ({ ...prev, [selectedVariable]: null }));
      try {
        const response = await speciesDataSource.fetchSpeciesEnvironment(
          taxonId,
          selectedVariable,
          {
            location: locationGid,
            units: units,
            phenology: phenology,
            startTs: startTimestamp,
            endTs: endTimestamp,
          },
        );
        if (
          response.histogram &&
          !isValidHistogramContract(response.histogram)
        ) {
          throw new Error(
            'Received malformed histogram data from environment API',
          );
        }
        if (cancelled) {
          return;
        }
        setStatsByVariable((prev) => ({
          ...prev,
          [selectedVariable]: response,
        }));
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load environment stats';
        setErrorByVariable((prev) => ({
          ...prev,
          [selectedVariable]: message,
        }));
      } finally {
        if (!cancelled) {
          setLoadingVariable((prev) =>
            prev === selectedVariable ? null : prev,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    endTimestamp,
    hasStatsForSelection,
    locationGid,
    phenology,
    selectedVariable,
    speciesDataSource,
    startTimestamp,
    taxonId,
    units,
  ]);

  const stats = selectedVariable
    ? (statsByVariable[selectedVariable] ?? null)
    : null;
  const error = selectedVariable
    ? (errorByVariable[selectedVariable] ?? null)
    : null;
  const loading = loadingVariable === selectedVariable;

  return {
    stats,
    error,
    loading,
  };
}
