// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { RankDensity } from './types';
import { asRecord, BACKEND_BASE, fetchJsonOrThrow } from './apiShared';

const toFiniteNumbers = (value: unknown): number[] | null =>
  Array.isArray(value) &&
  value.every((v) => typeof v === 'number' && Number.isFinite(v))
    ? (value as number[])
    : null;

/** Parses a backend rank-density payload: a KDE curve, or raw values for small cohorts. */
export const parseRankDensity = (value: unknown): RankDensity | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const source = asRecord(value);
  const points = toFiniteNumbers(source.points);
  const density = toFiniteNumbers(source.density);
  const values = toFiniteNumbers(source.values);
  const curve =
    points && density && points.length === density.length && points.length > 0
      ? { points, density }
      : null;
  if (!curve && !values?.length) {
    return null;
  }
  return {
    count:
      typeof source.count === 'number' ? source.count : (values?.length ?? 0),
    curve,
    values: curve ? null : values,
  };
};

export type RankDensityParams = {
  contextTaxonId: string;
  contextRank: string;
  variable: string;
  metric: string;
  units?: string | null;
};

const cache = new Map<string, Promise<RankDensity | null>>();

/**
 * Fetches the distribution behind one relative-rank percentile. Memoized per
 * session, since hovering back and forth over the same box is the common case;
 * failed requests are evicted so a later hover retries.
 */
export function fetchRankDensity(
  params: RankDensityParams,
): Promise<RankDensity | null> {
  const query = new URLSearchParams({
    context_taxon: params.contextTaxonId,
    rank: params.contextRank,
    variable: params.variable,
    metric: params.metric,
  });
  if (params.units) {
    query.set('unit_system', params.units);
  }
  const url = `${BACKEND_BASE}/api/taxa/rank-density?${query.toString()}`;
  const cached = cache.get(url);
  if (cached) {
    return cached;
  }
  const request = fetchJsonOrThrow(url, 'Failed to fetch rank density')
    .then((payload) => parseRankDensity(asRecord(payload).density))
    .catch((error: unknown) => {
      cache.delete(url);
      throw error;
    });
  cache.set(url, request);
  return request;
}

/** Test-only: forget memoized requests. */
export const clearRankDensityCache = () => cache.clear();
