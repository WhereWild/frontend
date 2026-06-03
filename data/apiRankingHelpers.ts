// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { RelativeRankingOptionsResponse } from './types';
import {
  asRecord,
  BACKEND_BASE,
  fetchJsonOrThrow,
  parseNumericTaxonId,
  toRequiredNumber,
  toRequiredString,
} from './apiShared';


/** Query params for ranking options requests. */
export type RelativeRankingOptionsParams = {
  taxonId: number | string;
  rank: string;
};

export type FetchRelativeRankingOptionsOptions = {
  signal?: AbortSignal;
};

/**
 * Fetches available ranking variable/metric combinations for a taxon and rank.
 */
export async function fetchRelativeRankingOptions(
  params: RelativeRankingOptionsParams,
  requestOptions?: FetchRelativeRankingOptionsOptions,
): Promise<RelativeRankingOptionsResponse> {
  const { taxonId, rank } = params;
  const query = new URLSearchParams({
    within_taxon: String(taxonId),
    descendant_rank: rank.trim().toUpperCase(),
  });
  const payload = asRecord(
    await fetchJsonOrThrow(
      `${BACKEND_BASE}/api/taxa/ranking-options?${query.toString()}`,
      'Failed to fetch ranking options',
      requestOptions?.signal ? { signal: requestOptions.signal } : undefined,
    ),
  );

  const options = Array.isArray(payload.options)
    ? payload.options.map((entry) => {
        const source = asRecord(entry);
        const metric = toRequiredString(source.metric, '');
        const label =
          typeof source.label === 'string' && source.label.trim().length > 0
            ? source.label.trim()
            : metric;
        return {
          variable: toRequiredString(source.variable, ''),
          metric,
          label,
          column: toRequiredString(source.column, ''),
          count: toRequiredNumber(source.count, 0),
        };
      })
    : [];

  const ancestorTaxonId =
    parseNumericTaxonId(payload.ancestor_taxon_id ?? payload.ancestorTaxonId) ??
    parseNumericTaxonId(taxonId);
  if (ancestorTaxonId == null) {
    throw new Error(
      'Failed to fetch ranking options: missing ancestor_taxon_id in response',
    );
  }

  return {
    ancestorTaxonId,
    rank: toRequiredString(payload.rank, rank.trim().toUpperCase()),
    options,
  };
}
