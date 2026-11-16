// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSpeciesDataSource } from '@/context/SpeciesDataSourceContext';
import { BACKEND_BASE } from '@/data/apiShared';
import type { SpeciesOccurrence } from '@/data/types';
import React from 'react';

export type StudyData = {
  taxonId: string;
  occurrences: SpeciesOccurrence[];
  /** catalogNumber -> the variable's value (display units). */
  values: Map<string, number>;
};

// Shared across hook instances: the occurrence fetch and the per-observation
// value fetch for a species, started together and reused, so a trial whose
// data was prefetched while the previous one was in progress starts instantly.
const cache = new Map<string, Promise<StudyData>>();
const MAX_CACHED = 8;

type Source = ReturnType<typeof useSpeciesDataSource>;

const startLoad = (
  source: Source,
  taxonId: string,
  variableId: string,
  units: string,
): Promise<StudyData> =>
  Promise.all([
    source.fetchSpeciesOccurrences(taxonId, {}),
    fetch(
      `${BACKEND_BASE}/species/${encodeURIComponent(taxonId)}/environment/${encodeURIComponent(variableId)}/observation-values?unit_system=${units}`,
    ).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))),
  ]).then(([occ, valuesPayload]) => {
    const values = new Map<string, number>();
    for (const obs of (
      valuesPayload as {
        observations?: { catalogNumber: string | number; value: number }[];
      }
    ).observations ?? []) {
      if (obs.catalogNumber != null && typeof obs.value === 'number') {
        values.set(String(obs.catalogNumber), obs.value);
      }
    }
    return { taxonId, occurrences: occ.occurrences, values };
  });

type UseStudyDataParams = {
  taxonId: string;
  variableId: string;
  units: string;
  /** Species to start loading now so they're ready when their trial starts. */
  prefetch?: readonly string[];
};

/** Loads one species' occurrences and variable values together (so the map is
 * never handed new dots with old values), with optional prefetching. `data`
 * is the latest loaded species, which may still be the previous one while
 * `taxonId`'s own load is in flight - compare `data.taxonId` to tell. */
export const useStudyData = ({
  taxonId,
  variableId,
  units,
  prefetch = [],
}: UseStudyDataParams) => {
  const source = useSpeciesDataSource();
  const [data, setData] = React.useState<StudyData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    (id: string) => {
      const key = `${id}|${variableId}|${units}`;
      let promise = cache.get(key);
      if (!promise) {
        promise = startLoad(source, id, variableId, units);
        promise.catch(() => cache.delete(key));
        cache.set(key, promise);
      }
      return promise;
    },
    [source, variableId, units],
  );

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    load(taxonId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load data.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load, taxonId]);

  const prefetchKey = prefetch.join(',');
  React.useEffect(() => {
    const ids = prefetchKey ? prefetchKey.split(',') : [];
    for (const id of ids) load(id).catch(() => undefined);
    // Drop the oldest entries beyond the cap, never the ones in use.
    const keep = new Set(
      [taxonId, ...ids].map((id) => `${id}|${variableId}|${units}`),
    );
    for (const key of [...cache.keys()]) {
      if (cache.size <= MAX_CACHED) break;
      if (!keep.has(key)) cache.delete(key);
    }
  }, [load, prefetchKey, taxonId, variableId, units]);

  return { data, error };
};
