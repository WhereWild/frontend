import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
import type { SpeciesOccurrence } from '@/data/types';
import React from 'react';

type UseSpeciesOccurrencesParams = {
  taxonId?: number;
  locationGid?: string | null;
  phenology?: string | null;
};

type UseSpeciesOccurrencesResult = {
  occurrences: SpeciesOccurrence[];
  loading: boolean;
  error: string | null;
};

export const useSpeciesOccurrences = ({
  taxonId,
  locationGid,
  phenology,
}: UseSpeciesOccurrencesParams): UseSpeciesOccurrencesResult => {
  const speciesDataSource = useSpeciesDataSource();
  const [occurrences, setOccurrences] = React.useState<SpeciesOccurrence[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
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
      setError('No taxon ID supplied.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const rows = await speciesDataSource.fetchSpeciesOccurrences(taxonId, {
          location: locationGid ?? undefined,
          phenology: phenology ?? undefined,
        });

        if (requestRef.current === requestId) {
          setOccurrences(rows);
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
  }, [locationGid, phenology, speciesDataSource, taxonId]);

  return {
    occurrences,
    loading,
    error,
  };
};
