// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
import type {
  ExtraVariableFilter,
  SpeciesEnvironmentStats,
} from '@/data/types';
import React from 'react';
import { isValidHistogramContract } from './model';

/** Inputs for loading environment stats for one variable. */
type UseEnvironmentStatsParams = {
  /** Taxon ID used for environment stats endpoint calls. */
  taxonId?: string;
  /** Active variable id to load. */
  selectedVariable: string;
  /** Optional location filter gid. */
  locationGid?: string | null;
  /** Optional phenology filter value. */
  phenology?: string | null;
  /** Optional timestamp range filter (Unix seconds). */
  startTimestamp?: number | null;
  endTimestamp?: number | null;
  /** Encoded polyline region filter (see encodePolygonsParam) — a drawn/uploaded map region, unioned server-side. */
  polygon?: string | null;

  units?: 'metric' | 'imperial' | undefined;
  /**
   * Chained filters from other variables (see useEnvironmentHighlights'
   * activeChain), read via ref rather than passed as a plain array. The
   * caller (useSpeciesEnvironmentState) computes activeChain from a hook
   * that itself needs THIS hook's stats as an input — a same-render
   * circular dependency — so the chain arrives here through a ref +
   * `chainSignal` version bump instead of a normal prop, landing one
   * render after it actually changes. Since this hook's fetch is already
   * effect-driven/async, that one-render lag is imperceptible.
   */
  extraRef?: React.RefObject<ExtraVariableFilter[]>;
  chainSignal?: number;
};

/** Fetches and caches environment stats keyed by selected variable. */
export function useEnvironmentStats({
  taxonId,
  selectedVariable,
  locationGid,
  phenology,
  startTimestamp,
  endTimestamp,
  polygon,
  units,
  extraRef,
  chainSignal,
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
  }, [
    taxonId,
    locationGid,
    phenology,
    startTimestamp,
    endTimestamp,
    polygon,
    units,
    chainSignal,
  ]);

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
        const extra = extraRef?.current ?? [];
        const filterActive =
          Boolean(locationGid) ||
          Boolean(phenology) ||
          startTimestamp != null ||
          endTimestamp != null ||
          Boolean(polygon) ||
          extra.some((f) => f.variableId !== selectedVariable);

        const [filteredResponse, globalResponse] = await Promise.all([
          speciesDataSource.fetchSpeciesEnvironment(taxonId, selectedVariable, {
            location: locationGid,
            units,
            phenology,
            startTs: startTimestamp,
            endTs: endTimestamp,
            polygon,
            extra,
          }),
          filterActive
            ? speciesDataSource.fetchSpeciesEnvironment(
                taxonId,
                selectedVariable,
                { units },
              )
            : Promise.resolve(null),
        ]);

        const response =
          filterActive && !filteredResponse.baselineSummary && globalResponse
            ? {
                ...filteredResponse,
                baselineSummary: globalResponse.summary,
                baselineCategoricalDistribution: filteredResponse
                  .baselineCategoricalDistribution?.length
                  ? filteredResponse.baselineCategoricalDistribution
                  : globalResponse.categoricalDistribution,
              }
            : filteredResponse;
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
    chainSignal,
    endTimestamp,
    extraRef,
    hasStatsForSelection,
    locationGid,
    phenology,
    polygon,
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
