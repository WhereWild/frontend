// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
import type { ViewportTileRange } from '@/data/api';
import { isAbortError } from '@/data/apiShared';
import type { SpeciesOccurrence } from '@/data/types';
import React from 'react';

// Sane upper bound on tiles fetched for one viewport — a normal screen at a
// normal zoom never comes close to this (z=0 has 1 tile total, z=1 has 4,
// and tile count only grows with on-screen pixel width, not with taxon
// size). Exists purely as a backstop against a pathological viewport
// report, not something real usage should ever hit.
const MAX_TILES_PER_FETCH = 256;

// A drag or a scroll-wheel zoom fires many intermediate moveend/zoomend
// events in quick succession, each reporting a different tileRangeKey —
// without debouncing, every single one kicks off its own batch of up to
// dozens of tile fetches, all in flight at once, which is real, visible
// jank during continuous panning/zooming (confirmed live: rapid
// overlapping fetch batches during one gesture). Only the settled
// tileRangeKey (the one still current after this delay) actually fetches.
// Not applied to the very first fetch for a session — there's nothing on
// screen yet, so there's no reason to delay showing something.
const PAN_DEBOUNCE_MS = 200;

type UseSpeciesOccurrenceTilesParams = {
  taxonId?: string;
  enabled: boolean;
  tileRange: ViewportTileRange | null;
  locationGid?: string | null;
  phenology?: string | null;
  startTimestamp?: number | null;
  endTimestamp?: number | null;
  /** Attaches per-point values for this variable (see fetchSpeciesOccurrenceTile's
   * TileFilterOptions) — the tile-scoped counterpart to the whole-taxon
   * observation-values fetch, which is blocked for a taxon this large. */
  variableId?: string | null;
  unitSystem?: string | null;
};

type UseSpeciesOccurrenceTilesResult = {
  occurrences: SpeciesOccurrence[];
  loading: boolean;
  error: string | null;
  /** catalogNumber -> value for the requested variableId, merged across every
   * tile fetched so far this session (not just the current batch) — a point
   * scrolled out of view keeps its last known value rather than vanishing
   * from the map, matching how useSpeciesOccurrences' whole-taxon fetch
   * never drops points either. */
  observationValues: Map<string, number> | null;
  /** Color/dot-size scale, expanding-only across every tile fetched so far
   * this session (never shrinks) — panning to a new area with a narrower
   * range shouldn't visibly rescale colors that are already on screen. Not
   * a true whole-taxon range (see main.py:_viewport_variable_values), but
   * converges toward one as more of the taxon's extent gets viewed. dotMin/
   * dotMax mirror useSpeciesOccurrences' q01/q99-based scale; labelMin/
   * labelMax mirror its plain min/max. */
  dotMin: number | null;
  dotMax: number | null;
  labelMin: number | null;
  labelMax: number | null;
};

/** Viewport-tile-scoped counterpart to useSpeciesOccurrences — for taxa too
 * large for the flat/unbounded fetch (see largeTaxon in app/_species.tsx).
 * Re-fetches whichever tiles are currently visible whenever tileRange (or
 * any filter) changes, and replaces (doesn't accumulate onto) the previous
 * occurrences — a snapshot of what's on screen right now, not a running
 * total of everywhere the user has ever panned (observationValues/the
 * color scale are the one exception — see their own doc comments).
 * locationGid/phenology/startTimestamp/endTimestamp match
 * useSpeciesOccurrences' filter params exactly — the tile route accepts
 * the same ones now. */
export const useSpeciesOccurrenceTiles = ({
  taxonId,
  enabled,
  tileRange,
  locationGid,
  phenology,
  startTimestamp,
  endTimestamp,
  variableId,
  unitSystem,
}: UseSpeciesOccurrenceTilesParams): UseSpeciesOccurrenceTilesResult => {
  const speciesDataSource = useSpeciesDataSource();
  const [occurrences, setOccurrences] = React.useState<SpeciesOccurrence[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [observationValues, setObservationValues] = React.useState<Map<
    string,
    number
  > | null>(null);
  const [dotMin, setDotMin] = React.useState<number | null>(null);
  const [dotMax, setDotMax] = React.useState<number | null>(null);
  const [labelMin, setLabelMin] = React.useState<number | null>(null);
  const [labelMax, setLabelMax] = React.useState<number | null>(null);
  const requestRef = React.useRef(0);
  // The map renders `loading` as a full-screen overlay covering whatever's
  // already on screen — appropriate for the very first fetch (there's
  // nothing to show yet), but panning/zooming refetches constantly after
  // that, and blanking the map out on every one of those would make already
  // -loaded dots disappear and reappear on every pan. Only the first fetch
  // for a given enabled taxon reports loading=true externally; every fetch
  // after that updates the occurrences in the background, no overlay.
  const hasLoadedOnceRef = React.useRef(false);
  // Cumulative catalogNumber -> value, expanding-only min/max — see
  // observationValues'/dotMin's doc comments above for why these persist
  // across fetches instead of resetting with each new tile batch.
  const cumulativeValuesRef = React.useRef<Map<string, number>>(new Map());
  const cumulativeDotRangeRef = React.useRef<{
    min: number;
    max: number;
  } | null>(null);
  const cumulativeLabelRangeRef = React.useRef<{
    min: number;
    max: number;
  } | null>(null);
  // Identifies the point SET (which occurrences are on screen), deliberately
  // excluding variableId/unitSystem: the backend fetches the exact same rows
  // regardless of variable (see main.py:_get_species_occurrences_viewport —
  // it annotates a `value` onto each row afterward, it doesn't filter rows
  // by variable), and that value is extracted into observationValues, never
  // baked into the occurrence objects themselves (see
  // extractOccurrenceValues/parseOccurrenceRows). So a variable-only change
  // still triggers a real refetch (to get the new values), but must NOT
  // replace the occurrences array reference — doing so would make
  // SpeciesOccurrenceMap think the point set itself changed, forcing a full
  // marker teardown/rebuild for what should just be a recolor.
  const lastGeometryKeyRef = React.useRef<string | null>(null);

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

  // A different taxon (or the hook going from disabled to enabled) means
  // there's nothing on screen yet for it — that's the one case the
  // full-screen loading overlay should reappear for. A variable change
  // alone must NOT reset this: the map already has points on screen, and
  // switching variables should just recolor them once the new values land,
  // not blank the whole map out again (see hasLoadedOnceRef's doc comment
  // above).
  const taxonSessionKey = taxonId ?? '';
  const lastTaxonSessionKeyRef = React.useRef<string>(taxonSessionKey);
  if (taxonSessionKey !== lastTaxonSessionKeyRef.current) {
    lastTaxonSessionKeyRef.current = taxonSessionKey;
    hasLoadedOnceRef.current = false;
  }

  // A different taxon or variable is a fresh session for the cumulative,
  // expanding-only color-scale signals specifically — those are inherently
  // per-variable and must reset instead of silently carrying over whatever
  // the previous variable's scale was.
  const sessionKey = `${taxonId ?? ''}:${variableId ?? ''}`;
  const lastSessionKeyRef = React.useRef<string>(sessionKey);
  if (sessionKey !== lastSessionKeyRef.current) {
    lastSessionKeyRef.current = sessionKey;
    cumulativeValuesRef.current = new Map();
    cumulativeDotRangeRef.current = null;
    cumulativeLabelRangeRef.current = null;
  }

  React.useEffect(() => {
    const fetchTile = speciesDataSource.fetchSpeciesOccurrenceTile;

    if (!taxonId || !enabled || !tileRange || !fetchTile) {
      requestRef.current += 1;
      lastGeometryKeyRef.current = null;
      setOccurrences([]);
      setError(null);
      setLoading(false);
      setObservationValues(null);
      setDotMin(null);
      setDotMax(null);
      setLabelMin(null);
      setLabelMax(null);
      return;
    }

    // Narrowed to non-nullable consts so they stay narrowed inside the
    // nested runFetch closure below — TypeScript doesn't carry the outer
    // guard's narrowing of a destructured param/prop across a function
    // boundary.
    const resolvedTaxonId = taxonId;
    const resolvedTileRange = tileRange;
    const resolvedFetchTile = fetchTile;

    // A superseded batch (e.g. an intermediate zoom level passed through on
    // the way to where the user actually stopped) previously kept running
    // to completion server-side even though its result was discarded on
    // arrival (see the requestId check below) — every tile in it still
    // consumed real backend time and added to concurrent-request
    // contention for the batch that actually matters. Aborting the
    // in-flight requests themselves (not just ignoring their result) stops
    // that waste at the source.
    const abortController = new AbortController();

    const delay = hasLoadedOnceRef.current ? PAN_DEBOUNCE_MS : 0;
    const timeoutId = setTimeout(() => {
      runFetch();
    }, delay);
    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };

    async function runFetch() {
      let aborted = false;
      const requestId = ++requestRef.current;
      const { z, x0, y0, x1, y1 } = resolvedTileRange;
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
        variableId,
        unitSystem,
      };

      try {
        const fetchStart = performance.now();
        const results = await Promise.all(
          coords.map(([x, y]) =>
            resolvedFetchTile(
              resolvedTaxonId,
              z,
              x,
              y,
              filterOptions,
              abortController.signal,
            ),
          ),
        );
        const fetchMs = performance.now() - fetchStart;
        if (requestRef.current !== requestId) return;

        const mergeStart = performance.now();
        const seen = new Set<string>();
        const merged: SpeciesOccurrence[] = [];
        for (const result of results) {
          for (const occ of result.occurrences) {
            const key = String(occ.catalogNumber);
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(occ);
          }
          if (result.values) {
            for (const [key, value] of result.values) {
              cumulativeValuesRef.current.set(key, value);
            }
          }
          const expandRange = (
            ref: React.MutableRefObject<{ min: number; max: number } | null>,
            lo: number | null,
            hi: number | null,
          ) => {
            if (lo == null || hi == null) return;
            ref.current =
              ref.current == null
                ? { min: lo, max: hi }
                : {
                    min: Math.min(ref.current.min, lo),
                    max: Math.max(ref.current.max, hi),
                  };
          };
          expandRange(
            cumulativeDotRangeRef,
            result.variableQ01,
            result.variableQ99,
          );
          expandRange(
            cumulativeLabelRangeRef,
            result.variableMin,
            result.variableMax,
          );
        }
        const mergeMs = performance.now() - mergeStart;
        // TEMPORARY diagnostic — remove once the perf issue is resolved.
        // fetchMs = network+backend round trip. mergeMs = the dedupe/
        // cumulative-value loop above, purely JS, no DOM. Neither includes
        // React's own re-render or (much more likely the real cost) the
        // WebView's marker rebuild — see the matching [occurrence-map]
        // timing log for that.
        console.log('[occurrence-tiles]', {
          tileRangeKey,
          tileCount: coords.length,
          mergedCount: merged.length,
          fetchMs: Math.round(fetchMs),
          mergeMs: Math.round(mergeMs),
        });
        const geometryKey = `${resolvedTaxonId}:${tileRangeKey}:${locationGid ?? ''}:${phenology ?? ''}:${startTimestamp ?? ''}:${endTimestamp ?? ''}`;
        if (geometryKey !== lastGeometryKeyRef.current) {
          lastGeometryKeyRef.current = geometryKey;
          setOccurrences(merged);
        }
        if (variableId) {
          setObservationValues(new Map(cumulativeValuesRef.current));
          setDotMin(cumulativeDotRangeRef.current?.min ?? null);
          setDotMax(cumulativeDotRangeRef.current?.max ?? null);
          setLabelMin(cumulativeLabelRangeRef.current?.min ?? null);
          setLabelMax(cumulativeLabelRangeRef.current?.max ?? null);
        }
      } catch (requestError) {
        // An abort means this batch was superseded, not that it failed —
        // the request that replaced it (or the disabled/cleared state)
        // owns whatever comes next, so touch nothing here (including in
        // finally below — aborted is checked there too). The requestId
        // guard alone isn't enough: the abort can be caught before the
        // superseding effect's own debounce timer has even fired (and so
        // before it's bumped requestRef), so requestId could still
        // spuriously match at this point.
        if (isAbortError(requestError)) {
          aborted = true;
          return;
        }
        if (requestRef.current === requestId) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : 'Failed to load observations.';
          setError(message);
          lastGeometryKeyRef.current = null;
          setOccurrences([]);
        }
      } finally {
        if (!aborted && requestRef.current === requestId) {
          hasLoadedOnceRef.current = true;
          setLoading(false);
        }
      }
    }
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
    variableId,
    unitSystem,
  ]);

  return {
    occurrences,
    loading,
    error,
    observationValues,
    dotMin,
    dotMax,
    labelMin,
    labelMax,
  };
};
