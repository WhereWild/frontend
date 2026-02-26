import { fetchSpeciesHeatmap } from '@/data/api';
import type { SpeciesHeatmapCell } from '@/data/types';
import React from 'react';

type UseSpeciesHeatmapParams = {
  taxonId?: number;
  locationGid?: string | null;
  zoom?: number;
  bbox?: string | null;
  maxCells?: number;
  enabled?: boolean;
};

type UseSpeciesHeatmapResult = {
  cells: SpeciesHeatmapCell[];
  loading: boolean;
  error: string | null;
};

export const useSpeciesHeatmap = ({
  taxonId,
  locationGid,
  zoom = 5,
  bbox,
  maxCells = 4000,
  enabled = true,
}: UseSpeciesHeatmapParams): UseSpeciesHeatmapResult => {
  const [cells, setCells] = React.useState<SpeciesHeatmapCell[]>([]);
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

    if (!enabled) {
      setLoading(false);
      setError(null);
      setCells([]);
      return;
    }

    if (!taxonId) {
      setCells([]);
      setError('No taxon ID supplied.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await fetchSpeciesHeatmap(taxonId, {
          location: locationGid ?? undefined,
          bbox: bbox ?? undefined,
          zoom,
          maxCells,
        });
        if (requestRef.current === requestId) {
          setCells(response.cells);
        }
      } catch (requestError) {
        if (requestRef.current === requestId) {
          const message =
            requestError instanceof Error ? requestError.message : 'Failed to load heatmap.';
          setError(message);
          setCells([]);
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    })();
  }, [bbox, enabled, locationGid, maxCells, taxonId, zoom]);

  return {
    cells,
    loading,
    error,
  };
};
