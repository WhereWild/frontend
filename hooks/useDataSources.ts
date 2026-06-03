// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchDataSources } from '@/data/api';
import type { DataSource } from '@/data/types';
import React from 'react';

// Module-level cache that can be seeded from a bundled zip for offline use.
// The live fetch merges on top, so online and offline data coexist gracefully.
let _seededSources: Record<string, DataSource> | null = null;

const mergeDataSources = (
  previous: Record<string, DataSource>,
  incoming: Record<string, DataSource>,
) => {
  const entries = Object.entries(incoming);

  if (entries.length === 0) {
    return previous;
  }

  let changed = false;
  const next = { ...previous };

  for (const [key, value] of entries) {
    if (previous[key] === value) {
      continue;
    }

    next[key] = value;
    changed = true;
  }

  return changed ? next : previous;
};

export function seedDataSourcesCache(sources: Record<string, DataSource>) {
  _seededSources = sources;
}

/**
 * Fetches and caches the data-sources catalog for the lifetime of the component.
 * Returns the seeded (bundled) sources immediately if available, then merges
 * live data once the fetch resolves. Falls back to empty map if both unavailable.
 */
export function useDataSources(): Record<string, DataSource> {
  const [sources, setSources] = React.useState<Record<string, DataSource>>(
    _seededSources ?? {},
  );

  React.useEffect(() => {
    let cancelled = false;
    fetchDataSources()
      .then((data) => {
        if (!cancelled) {
          setSources((prev) => mergeDataSources(prev, data));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return sources;
}
