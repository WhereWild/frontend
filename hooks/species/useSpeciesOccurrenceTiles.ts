// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
import type { ViewportTileRange } from '@/data/api';
import type { SpeciesOccurrence } from '@/data/types';
import React from 'react';

// Sane upper bound on tiles fetched for one viewport — a normal screen at a
// normal zoom never comes close to this (z=0 has 1 tile total, z=1 has 4,
// and tile count only grows with on-screen pixel width, not with taxon
// size). Exists purely as a backstop against a pathological viewport
// report, not something real usage should ever hit.
const MAX_TILES_PER_FETCH = 256;

type UseSpeciesOccurrenceTilesParams = {
  taxonId?: string;
  enabled: boolean;
  tileRange: ViewportTileRange | null;
  locationGid?: string | null;
  phenology?: string | null;
  startTimestamp?: number | null;
  endTimestamp?: number | null;
};

type UseSpeciesOccurrenceTilesResult = {
  occurrences: SpeciesOccurrence[];
  loading: boolean;
  error: string | null;
};

/** Viewport-tile-scoped counterpart to useSpeciesOccurrences — for taxa too
 * large for the flat/unbounded fetch (see largeTaxon in app/_species.tsx).
 * Re-fetches whichever tiles are currently visible whenever tileRange (or
 * any filter) changes, and replaces (doesn't accumulate onto) the previous
 * result — a snapshot of what's on screen right now, not a running total
 * of everywhere the user has ever panned. locationGid/phenology/
 * startTimestamp/endTimestamp match useSpeciesOccurrences' filter params
 * exactly — the tile route accepts the same ones now. */
export const useSpeciesOccurrenceTiles = ({
  taxonId,
  enabled,
  tileRange,
  locationGid,
  phenology,
  startTimestamp,
  endTimestamp,
}: UseSpeciesOccurrenceTilesParams): UseSpeciesOccurrenceTilesResult => {
  const speciesDataSource = useSpeciesDataSource();
  const [occurrences, setOccurrences] = React.useState<SpeciesOccurrence[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestRef = React.useRef(0);
  // The map renders `loading` as a full-screen overlay covering whatever's
  // already on screen — appropriate for the very first fetch (there's
  // nothing to show yet), but panning/zooming refetches constantly after
  // that, and blanking the map out on every one of those would make already
  // -loaded dots disappear and reappear on every pan. Only the first fetch
  // for a given enabled taxon reports loading=true externally; every fetch
  // after that updates the occurrences in the background, no overlay.
  const hasLoadedOnceRef = React.useRef(false);

  // The map reports its bounds as a fresh object on every moveend/zoomend,
  // even when the visible tile range didn't actually change (e.g. a
  // redundant event, or a drag that ends where it started). Keying the
  // effect below on this primitive string instead of the tileRange object
  // itself means React's own dependency comparison already skips refetching
  // for those — no object-identity comparison needed.
  const tileRangeKey = tileRange
    ? `${tileRange.z}:${tileRange.x0}:${tileRange.y0}:${tileRange.x1}:${tileRange.y1}`
    : null;

  React.useEffect(() => {
    return () => {
      requestRef.current += 1;
    };
  }, []);

  // A different taxon (or the hook going from disabled to enabled) is a
  // fresh session — its first fetch should show loading again, not silently
  // inherit "already loaded once" from whatever was displayed before.
  const lastTaxonIdRef = React.useRef<string | undefined>(undefined);
  if (taxonId !== lastTaxonIdRef.current) {
    lastTaxonIdRef.current = taxonId;
    hasLoadedOnceRef.current = false;
  }

  React.useEffect(() => {
    const requestId = ++requestRef.current;
    const fetchTile = speciesDataSource.fetchSpeciesOccurrenceTile;

    if (!taxonId || !enabled || !tileRange || !fetchTile) {
      setOccurrences([]);
      setError(null);
      setLoading(false);
      return;
    }

    const { z, x0, y0, x1, y1 } = tileRange;
    const coords: [number, number][] = [];
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
        coords.push([x, y]);
        if (coords.length >= MAX_TILES_PER_FETCH) break;
      }
      if (coords.length >= MAX_TILES_PER_FETCH) break;
    }

    setLoading(!hasLoadedOnceRef.current);
    setError(null);

    const filterOptions = {
      location: locationGid,
      phenology,
      startTs: startTimestamp,
      endTs: endTimestamp,
    };

    (async () => {
      try {
        const results = await Promise.all(
          coords.map(([x, y]) => fetchTile(taxonId, z, x, y, filterOptions)),
        );
        if (requestRef.current !== requestId) return;

        const seen = new Set<string>();
        const merged: SpeciesOccurrence[] = [];
        for (const tileOccurrences of results) {
          for (const occ of tileOccurrences) {
            const key = String(occ.catalogNumber);
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(occ);
          }
        }
        setOccurrences(merged);
      } catch (requestError) {
        if (requestRef.current === requestId) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : 'Failed to load observations.';
          setError(message);
          setOccurrences([]);
        }
      } finally {
        if (requestRef.current === requestId) {
          hasLoadedOnceRef.current = true;
          setLoading(false);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tileRangeKey stands in for tileRange (see its declaration above)
  }, [
    enabled,
    speciesDataSource,
    taxonId,
    tileRangeKey,
    locationGid,
    phenology,
    startTimestamp,
    endTimestamp,
  ]);

  return { occurrences, loading, error };
};
