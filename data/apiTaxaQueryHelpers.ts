// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TaxaQueryResponse, TaxaQueryResult } from './types';
import { normalizeToJsonShape } from './apiSpeciesSearchHelpers';
import {
  asRecord,
  BACKEND_BASE,
  fetchJsonOrThrow,
  parseTaxonId,
  toOptionalString,
  toRequiredNumber,
} from './apiShared';

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toOptionalBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return null;
};

const normalizeTaxaQueryResult = (entry: unknown): TaxaQueryResult => {
  const normalized = normalizeToJsonShape(entry);
  const source = asRecord(entry);

  return {
    ...normalized,
    match_score: toFiniteNumber(source.match_score ?? source.matchScore),
    image_url: toOptionalString(source.image_url ?? source.imageUrl),
    image_file: toOptionalString(
      source.image_file ??
        source.imageFile ??
        source.image_file_name ??
        source.imageFileName,
    ),
    sort_value: toFiniteNumber(source.sort_value ?? source.sortValue),
    sort_variable: toOptionalString(
      source.sort_variable ?? source.sortVariable,
    ),
    sort_metric: toOptionalString(source.sort_metric ?? source.sortMetric),
    count: toFiniteNumber(source.count),
    sample_count: toFiniteNumber(source.sample_count ?? source.sampleCount),
    position: toFiniteNumber(source.position),
    percentile: toFiniteNumber(source.percentile),
  };
};

export type TaxaQueryParams = {
  q?: string | null;
  withinTaxon?: string | number | null;
  withinTaxonId?: string | null;
  descendantRank?: string | null;
  sortVariable?: string | null;
  sortMetric?: string | null;
  sortOrder?: 'asc' | 'desc' | null;
  sortReference?: number | null;
  listOffset?: number | null;
  minRbar?: number | null;
  limit?: number | null;
  offset?: number | null;
  minSamples?: number | null;
  includeSpeciesLike?: boolean | null;
  location?: string | null;
  units?: string | null;
  /** Chained stat predicates, each "variable:metric:op:value[:count]" — see
   * util/rankings.py::parse_stat_filter. Sent as repeated ?filter= params. */
  filters?: string[] | null;
};

export type SearchTaxaQueryFilters = Pick<
  TaxaQueryParams,
  | 'withinTaxon'
  | 'withinTaxonId'
  | 'descendantRank'
  | 'sortVariable'
  | 'sortMetric'
  | 'sortOrder'
  | 'sortReference'
  | 'listOffset'
  | 'minRbar'
  | 'limit'
  | 'minSamples'
  | 'includeSpeciesLike'
  | 'location'
  | 'filters'
>;

export type FetchTaxaQueryOptions = {
  signal?: AbortSignal;
};

export const buildTaxaQuerySearchParams = (params: TaxaQueryParams) => {
  const query = new URLSearchParams();

  if (params.limit != null) {
    query.set('limit', String(params.limit));
  }
  if (params.offset != null) {
    query.set('offset', String(params.offset));
  }

  const trimmedQuery = typeof params.q === 'string' ? params.q.trim() : '';
  if (trimmedQuery.length > 0) {
    query.set('q', trimmedQuery);
  }

  const withinTaxon =
    params.withinTaxonId != null
      ? String(params.withinTaxonId)
      : params.withinTaxon;
  if (withinTaxon != null) {
    query.set('within_taxon', String(withinTaxon));
  }

  const descendantRank =
    typeof params.descendantRank === 'string'
      ? params.descendantRank.trim().toUpperCase()
      : '';
  if (descendantRank.length > 0) {
    query.set('descendant_rank', descendantRank);
  }
  if (params.sortVariable && params.sortMetric) {
    query.set('sort_variable', params.sortVariable);
    query.set('sort_metric', params.sortMetric);
    if (params.sortOrder) {
      query.set('sort_order', params.sortOrder);
    }
    if (params.sortReference != null) {
      query.set('sort_reference', String(params.sortReference));
    }
    if (params.minRbar != null && params.minRbar > 0) {
      query.set('min_rbar', String(params.minRbar));
    }
  }
  if (params.minSamples != null && params.minSamples >= 0) {
    query.set('min_samples', String(params.minSamples));
  }
  if (typeof params.includeSpeciesLike === 'boolean') {
    query.set(
      'include_species_like',
      params.includeSpeciesLike ? 'true' : 'false',
    );
  }
  if (params.location) {
    query.set('location', params.location);
  }
  if (params.units) {
    query.set('unit_system', params.units);
  }
  if (params.filters) {
    for (const filter of params.filters) {
      if (filter) {
        query.append('filter', filter);
      }
    }
  }

  return query;
};

/**
 * Fetches normalized unified taxa query results.
 */
export async function fetchTaxaQuery(
  params: TaxaQueryParams,
  options?: FetchTaxaQueryOptions,
): Promise<TaxaQueryResponse> {
  const query = buildTaxaQuerySearchParams(params);

  const url = `${BACKEND_BASE}/api/taxa/query${query.toString() ? `?${query.toString()}` : ''}`;
  const requestOptions = options?.signal
    ? { signal: options.signal }
    : undefined;
  const payload = asRecord(
    await fetchJsonOrThrow(
      url,
      'Failed to fetch taxa query results',
      requestOptions,
    ),
  );
  const scope = asRecord(payload.scope);
  const sort = asRecord(payload.sort);

  return {
    query: toOptionalString(payload.query),
    scope: {
      withinTaxon: toOptionalString(
        scope.within_taxon ??
          scope.withinTaxon ??
          scope.within_taxon_id ??
          scope.withinTaxonId,
      ),
      withinTaxonId: parseTaxonId(
        scope.within_taxon_id ??
          scope.withinTaxonId ??
          scope.within_taxon ??
          scope.withinTaxon,
      ),
      descendantRank: toOptionalString(
        scope.descendant_rank ?? scope.descendantRank,
      ),
      location: toOptionalString(scope.location),
      minSamples: toFiniteNumber(scope.min_samples ?? scope.minSamples),
      includeSpeciesLike: toOptionalBoolean(
        scope.include_species_like ?? scope.includeSpeciesLike,
      ),
    },
    sort: {
      variable: toOptionalString(sort.variable),
      metric: toOptionalString(sort.metric),
      order:
        toOptionalString(sort.order) === 'desc'
          ? 'desc'
          : toOptionalString(sort.order) === 'asc'
            ? 'asc'
            : null,
      units: toOptionalString(sort.units),
    },
    total: toRequiredNumber(payload.total, 0),
    matchedTotal: toRequiredNumber(
      payload.matched_total ?? payload.matchedTotal,
      0,
    ),
    eligibleTotal: toRequiredNumber(
      payload.eligible_total ?? payload.eligibleTotal,
      0,
    ),
    emptyReason: toOptionalString(
      payload.empty_reason ?? payload.emptyReason,
    ) as TaxaQueryResponse['emptyReason'],
    limit: toRequiredNumber(payload.limit, params.limit ?? 0),
    offset: toRequiredNumber(payload.offset, params.offset ?? 0),
    results: Array.isArray(payload.results)
      ? payload.results.map(normalizeTaxaQueryResult)
      : [],
  };
}
