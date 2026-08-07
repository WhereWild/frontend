// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
import type { SpeciesOccurrence } from '@/data/types';
import React from 'react';

type UseSpeciesOccurrencesParams = {
  taxonId?: string;
  locationGid?: string | null;
  phenology?: string | null;
  startTimestamp?: number | null;
  endTimestamp?: number | null;
};

type UseSpeciesOccurrencesResult = {
  occurrences: SpeciesOccurrence[];
  loading: boolean;
  error: string | null;
  minTimestamp: number | null;
  maxTimestamp: number | null;
  phenologyCounts: Record<string, number> | null;
  phenologyNoData: boolean;
};

export const useSpeciesOccurrences = ({
  taxonId,
  locationGid,
  phenology,
  startTimestamp,
  endTimestamp,
}: UseSpeciesOccurrencesParams): UseSpeciesOccurrencesResult => {
  const speciesDataSource = useSpeciesDataSource();
  const [occurrences, setOccurrences] = React.useState<SpeciesOccurrence[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [minTimestamp, setMinTimestamp] = React.useState<number | null>(null);
  const [maxTimestamp, setMaxTimestamp] = React.useState<number | null>(null);
  const [phenologyCounts, setPhenologyCounts] = React.useState<Record<string, number> | null>(null);
  const [phenologyNoData, setPhenologyNoData] = React.useState(false);
  const requestRef = React.useRef(0);

  React.useEffect(() => {
    return () => {
      requestRef.current += 1;
    };
  }, []);

  React.useEffect(() => {
    const requestId = ++requestRef.current;

    if (!taxonId) {
      setOccurrences([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await speciesDataSource.fetchSpeciesOccurrences(taxonId, {
          location: locationGid ?? undefined,
          phenology: phenology ?? undefined,
          startTs: startTimestamp ?? undefined,
          endTs: endTimestamp ?? undefined,
        });

        if (requestRef.current === requestId) {
          setOccurrences(result.occurrences);
          setMinTimestamp(result.minTimestamp);
          setMaxTimestamp(result.maxTimestamp);
          if (!phenology) {
            setPhenologyCounts(result.phenologyCounts);
            setPhenologyNoData(false);
          } else {
            const hasData =
              result.phenologyCounts != null &&
              Object.keys(result.phenologyCounts).length > 0;
            setPhenologyNoData(!hasData);
          }
        }
      } catch (requestError) {
        if (requestRef.current === requestId) {
          const message =
            requestError instanceof Error ? requestError.message : 'Failed to load observations.';
          setError(message);
          setOccurrences([]);
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    })();
  }, [endTimestamp, locationGid, phenology, speciesDataSource, startTimestamp, taxonId]);

  return {
    occurrences,
    loading,
    error,
    minTimestamp,
    maxTimestamp,
    phenologyCounts,
    phenologyNoData,
  };
};
