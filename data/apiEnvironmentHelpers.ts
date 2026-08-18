// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  EnvironmentSliceParams,
  ExtraVariableFilter,
  SpeciesEnvironmentCategorySampleResponse,
  SpeciesEnvironmentStats,
  SpeciesOccurrence,
  SpeciesOccurrencesResult,
  SpeciesEnvironmentSliceResponse,
} from './types';
import {
  parseEnvironmentCategorySampleResponse,
  parseEnvironmentSliceResponse,
  parseSpeciesEnvironmentStats,
  toFiniteNumber,
} from './environmentParsers';
import { BACKEND_BASE, asRecord, fetchJsonOrThrow } from './apiShared';

export type LocationOptions = {
  location?: string | null;
  units?: string | null;
  phenology?: string | null;
  startTs?: number | null;
  endTs?: number | null;
  extra?: ExtraVariableFilter[] | null;
  /** Encoded polyline region filter (see encodePolygonsParam) — matches the backend's `polygon` query param. */
  polygon?: string | null;
};

export type CategorySampleOptions = {
  limit?: number;
  location?: string | null;
  units?: string | null;
  phenology?: string | null;
  startTs?: number | null;
  endTs?: number | null;
  extra?: ExtraVariableFilter[] | null;
  /** Encoded polyline region filter (see encodePolygonsParam) — matches the backend's `polygon` query param. */
  polygon?: string | null;
};

/** Serializes chained per-variable filters into the `extra` query param the
 * backend's _parse_extra_variable_filters expects — a JSON array of
 * {variable, min, max}, {variable, ranges}, {variable, classValue}, or
 * {variable, classValues} entries. */
function serializeExtraFilters(
  extra?: ExtraVariableFilter[] | null,
): string | null {
  if (!extra || extra.length === 0) {
    return null;
  }
  return JSON.stringify(
    extra.map((filter) =>
      'classValues' in filter
        ? { variable: filter.variableId, classValues: filter.classValues }
        : 'classValue' in filter
          ? { variable: filter.variableId, classValue: filter.classValue }
          : 'ranges' in filter
            ? { variable: filter.variableId, ranges: filter.ranges }
            : { variable: filter.variableId, min: filter.min, max: filter.max },
    ),
  );
}

/**
 * Fetches species environment statistics and normalizes the response.
 */
export async function fetchSpeciesEnvironment(
  taxonId: string | number,
  variableId: string,
  options?: LocationOptions,
): Promise<SpeciesEnvironmentStats> {
  const encodedId = encodeURIComponent(String(taxonId));
  const encodedVariable = encodeURIComponent(variableId);
  const params = new URLSearchParams();
  if (options?.location) {
    params.set('location', options.location);
  }
  if (options?.units) {
    params.set('unit_system', options.units);
  }
  if (options?.phenology) {
    params.set('phenology', options.phenology);
  }
  if (options?.startTs != null) {
    params.set('start_ts', String(options.startTs));
  }
  if (options?.endTs != null) {
    params.set('end_ts', String(options.endTs));
  }
  if (options?.polygon) {
    params.set('polygon', options.polygon);
  }
  const serializedStatsExtra = serializeExtraFilters(options?.extra);
  if (serializedStatsExtra) {
    params.set('extra', serializedStatsExtra);
  }
  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}${query ? `?${query}` : ''}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch environment stats (${variableId}) for ${taxonId}`,
  );
  return parseSpeciesEnvironmentStats(payload, taxonId, variableId);
}

/**
 * Fetches observations for a variable constrained by a numeric value range.
 */
export async function fetchEnvironmentRangeSlice(
  params: EnvironmentSliceParams,
): Promise<SpeciesEnvironmentSliceResponse> {
  const {
    taxonId,
    variableId,
    min,
    max,
    limit,
    location,
    units,
    phenology,
    startTs,
    endTs,
    extra,
    polygon,
  } = params;
  const encodedId = encodeURIComponent(String(taxonId));
  const encodedVariable = encodeURIComponent(variableId);
  const query = new URLSearchParams({
    min: String(min),
    max: String(max),
  });
  if (typeof limit === 'number') {
    query.set('limit', String(limit));
  }
  if (location) {
    query.set('location', location);
  }
  if (units) {
    query.set('unit_system', units);
  }
  if (phenology) {
    query.set('phenology', phenology);
  }
  if (startTs != null) {
    query.set('start_ts', String(startTs));
  }
  if (endTs != null) {
    query.set('end_ts', String(endTs));
  }
  if (polygon) {
    query.set('polygon', polygon);
  }
  const serializedExtra = serializeExtraFilters(extra);
  if (serializedExtra) {
    query.set('extra', serializedExtra);
  }
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}/slice?${query.toString()}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch environment slice (${variableId}) for ${taxonId}`,
  );
  return parseEnvironmentSliceResponse(payload, {
    taxonId,
    variableId,
    min,
    max,
    limit,
  });
}

/**
 * Fetches observations that belong to a categorical class.
 */
export async function fetchSpeciesEnvironmentCategorySamples(
  taxonId: string | number,
  variableId: string,
  classValue: string | number,
  options?: CategorySampleOptions,
): Promise<SpeciesEnvironmentCategorySampleResponse> {
  const encodedId = encodeURIComponent(String(taxonId));
  const encodedVariable = encodeURIComponent(variableId);
  const encodedClass = encodeURIComponent(String(classValue));
  const query = new URLSearchParams();
  if (typeof options?.limit === 'number') {
    query.set('limit', String(options.limit));
  }
  if (options?.location) {
    query.set('location', options.location);
  }
  if (options?.units) {
    query.set('unit_system', options.units);
  }
  if (options?.phenology) {
    query.set('phenology', options.phenology);
  }
  if (options?.startTs != null) {
    query.set('start_ts', String(options.startTs));
  }
  if (options?.endTs != null) {
    query.set('end_ts', String(options.endTs));
  }
  if (options?.polygon) {
    query.set('polygon', options.polygon);
  }
  const serializedExtra = serializeExtraFilters(options?.extra);
  if (serializedExtra) {
    query.set('extra', serializedExtra);
  }
  const queryString = query.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/environment/${encodedVariable}/class/${encodedClass}/samples${queryString ? `?${queryString}` : ''}`;
  const payload = await fetchJsonOrThrow(
    url,
    `Failed to fetch samples for ${variableId}=${classValue}`,
  );
  return parseEnvironmentCategorySampleResponse(payload, {
    taxonId,
    variableId,
    classValue,
  });
}

/** Shared by fetchSpeciesOccurrences and fetchSpeciesOccurrenceTile — both
 * endpoints return the same per-entry shape (catalogNumber/latitude/
 * longitude + optional media fields), see main.py's
 * _occurrence_entries_from_df, the function both routes share server-side. */
function parseOccurrenceRows(rows: unknown[]): SpeciesOccurrence[] {
  return rows
    .map((entry) => {
      const source = asRecord(entry);
      return {
        catalogNumber:
          source.catalogNumber ??
          source.catalog_number ??
          source.id ??
          source.catalog ??
          null,
        latitude: toFiniteNumber(source.latitude),
        longitude: toFiniteNumber(source.longitude),
        mediaUrl:
          typeof source.media_url === 'string' ? source.media_url : null,
        mediaAttribution:
          typeof source.media_attribution === 'string'
            ? source.media_attribution
            : null,
        mediaLicense:
          typeof source.media_license === 'string'
            ? source.media_license
            : null,
        mediaLicenseUrl:
          typeof source.media_license_url === 'string'
            ? source.media_license_url
            : null,
        // Only present on tile-route rows for a taxon above species/
        // infraspecific rank — see SpeciesOccurrence.taxonId's doc comment.
        taxonId: typeof source.taxon_id === 'string' ? source.taxon_id : null,
        scientificName:
          typeof source.scientific_name === 'string'
            ? source.scientific_name
            : null,
        commonName:
          typeof source.common_name === 'string' ? source.common_name : null,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        catalogNumber: string | number;
        latitude: number;
        longitude: number;
        mediaUrl: string | null;
        mediaAttribution: string | null;
        mediaLicense: string | null;
        mediaLicenseUrl: string | null;
        taxonId: string | null;
        scientificName: string | null;
        commonName: string | null;
      } =>
        typeof entry.latitude === 'number' &&
        typeof entry.longitude === 'number',
    )
    .map((entry) => ({
      catalogNumber: entry.catalogNumber ?? '',
      latitude: entry.latitude,
      longitude: entry.longitude,
      mediaUrl: entry.mediaUrl,
      mediaAttribution: entry.mediaAttribution,
      mediaLicense: entry.mediaLicense,
      mediaLicenseUrl: entry.mediaLicenseUrl,
      taxonId: entry.taxonId,
      scientificName: entry.scientificName,
      commonName: entry.commonName,
    }));
}

/**
 * Fetches occurrence points for a species, plus the full timestamp range of the matching observations.
 */
export async function fetchSpeciesOccurrences(
  taxonId: string | number,
  options?: LocationOptions,
): Promise<SpeciesOccurrencesResult> {
  const encodedId = encodeURIComponent(String(taxonId));
  const params = new URLSearchParams();
  if (options?.location) {
    params.set('location', options.location);
  }
  if (options?.phenology) {
    params.set('phenology', options.phenology);
  }
  if (options?.startTs != null) {
    params.set('start_ts', String(options.startTs));
  }
  if (options?.endTs != null) {
    params.set('end_ts', String(options.endTs));
  }
  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/occurrences${query ? `?${query}` : ''}`;
  const payload = asRecord(
    await fetchJsonOrThrow(url, `Failed to fetch occurrences for ${taxonId}`),
  );
  const rows = Array.isArray(payload.occurrences) ? payload.occurrences : [];
  const occurrences = parseOccurrenceRows(rows);
  const phenologyCounts =
    payload.phenology_counts && typeof payload.phenology_counts === 'object'
      ? (payload.phenology_counts as Record<string, number>)
      : null;
  return {
    occurrences,
    minTimestamp:
      typeof payload.min_timestamp === 'number' ? payload.min_timestamp : null,
    maxTimestamp:
      typeof payload.max_timestamp === 'number' ? payload.max_timestamp : null,
    phenologyCounts,
  };
}

export type TileFilterOptions = {
  location?: string | null;
  phenology?: string | null;
  startTs?: number | null;
  endTs?: number | null;
  /** Attaches each entry's value for this variable (see OccurrenceTileResult.values) — the tile-scoped counterpart to fetchObservationVariableValues, for a taxon too large for that whole-taxon endpoint. */
  variableId?: string | null;
  unitSystem?: string | null;
};

export type OccurrenceTileResult = {
  occurrences: SpeciesOccurrence[];
  /** catalogNumber -> unit-converted value for options.variableId, only present when it was requested and resolved. */
  values: Map<string, number> | null;
  /** This tile's own min/max/q01/q99 for options.variableId — not a whole-taxon aggregate, see main.py:_viewport_variable_values. */
  variableMin: number | null;
  variableMax: number | null;
  variableQ01: number | null;
  variableQ99: number | null;
};

/** catalogNumber -> value from raw tile response rows, built alongside
 * parseOccurrenceRows (not folded into it — "value" only ever appears on
 * tile responses, never on fetchSpeciesOccurrences' flat/whole-taxon
 * rows). */
function extractOccurrenceValues(rows: unknown[]): Map<string, number> {
  const values = new Map<string, number>();
  for (const row of rows) {
    const source = asRecord(row);
    const catalogNumber =
      source.catalogNumber ??
      source.catalog_number ??
      source.id ??
      source.catalog ??
      null;
    const value = toFiniteNumber(source.value);
    if (catalogNumber != null && value != null) {
      values.set(String(catalogNumber), value);
    }
  }
  return values;
}

/**
 * Fetches occurrence points for one slippy-map tile — the viewport-bounded
 * counterpart to fetchSpeciesOccurrences, safe to call for any taxon size
 * (including genus/family/kingdom rank) since a tile's bbox is bounded by
 * construction (see main.py:get_species_occurrences_tile). Same
 * location/phenology/start_ts/end_ts semantics as fetchSpeciesOccurrences.
 * No phenologyCounts/minTimestamp/maxTimestamp in the response though —
 * those are whole-taxon aggregates with no honest meaning over one tile,
 * so the tile route never returns them regardless of filters.
 */
export async function fetchSpeciesOccurrenceTile(
  taxonId: string | number,
  z: number,
  x: number,
  y: number,
  options?: TileFilterOptions,
  signal?: AbortSignal,
): Promise<OccurrenceTileResult> {
  const encodedId = encodeURIComponent(String(taxonId));
  const params = new URLSearchParams();
  if (options?.location) {
    params.set('location', options.location);
  }
  if (options?.phenology) {
    params.set('phenology', options.phenology);
  }
  if (options?.startTs != null) {
    params.set('start_ts', String(options.startTs));
  }
  if (options?.endTs != null) {
    params.set('end_ts', String(options.endTs));
  }
  if (options?.variableId) {
    params.set('variable', options.variableId);
  }
  if (options?.unitSystem) {
    params.set('unit_system', options.unitSystem);
  }
  const query = params.toString();
  const url = `${BACKEND_BASE}/species/${encodedId}/occurrences/${z}/${x}/${y}${query ? `?${query}` : ''}`;
  const payload = asRecord(
    await fetchJsonOrThrow(
      url,
      `Failed to fetch occurrence tile for ${taxonId}`,
      signal ? { signal } : undefined,
    ),
  );
  const rows = Array.isArray(payload.occurrences) ? payload.occurrences : [];
  return {
    occurrences: parseOccurrenceRows(rows),
    values: options?.variableId ? extractOccurrenceValues(rows) : null,
    variableMin: toFiniteNumber(payload.variable_min),
    variableMax: toFiniteNumber(payload.variable_max),
    variableQ01: toFiniteNumber(payload.variable_q01),
    variableQ99: toFiniteNumber(payload.variable_q99),
  };
}
