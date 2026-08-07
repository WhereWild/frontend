// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OccurrenceLookup } from './types';
import { BACKEND_BASE, asRecord } from './apiShared';

export type FetchOccurrenceLookupOptions = {
  signal?: AbortSignal;
};

const toOccurrenceLookup = (payload: unknown): OccurrenceLookup | null => {
  const source = asRecord(payload);
  const catalogNumber =
    typeof source.catalog_number === 'string' ? source.catalog_number : '';
  const taxonId = typeof source.taxon_id === 'string' ? source.taxon_id : '';
  if (!catalogNumber.length || !taxonId.length) {
    return null;
  }

  return {
    catalogNumber,
    taxonId,
    scientificName:
      typeof source.scientific_name === 'string' ? source.scientific_name : '',
    commonName: typeof source.common_name === 'string' ? source.common_name : null,
    slug: typeof source.slug === 'string' ? source.slug : null,
    latitude: typeof source.latitude === 'number' ? source.latitude : null,
    longitude: typeof source.longitude === 'number' ? source.longitude : null,
    ingested: source.ingested === true,
    eventTimestamp:
      typeof source.event_timestamp === 'number' ? source.event_timestamp : null,
    mediaUrl: typeof source.media_url === 'string' ? source.media_url : null,
    mediaAttribution:
      typeof source.media_attribution === 'string' ? source.media_attribution : null,
    mediaLicense:
      typeof source.media_license === 'string' ? source.media_license : null,
    mediaLicenseUrl:
      typeof source.media_license_url === 'string' ? source.media_license_url : null,
  };
};

/**
 * Resolves an iNaturalist observation id to its taxon + location, e.g. for
 * the /occurrence/{id} deep-link route. Returns null on 404 (observation
 * not found, including when it can't be resolved live via iNaturalist
 * either) rather than throwing, matching fetchLocationByGid's convention —
 * "not found" is an expected, common outcome here, not an error state.
 */
export async function fetchOccurrenceLookup(
  catalogNumber: string,
  options?: FetchOccurrenceLookupOptions,
): Promise<OccurrenceLookup | null> {
  const trimmed = catalogNumber.trim();
  if (!trimmed.length) {
    return null;
  }

  const requestOptions = options?.signal ? { signal: options.signal } : undefined;
  const url = `${BACKEND_BASE}/occurrence/${encodeURIComponent(trimmed)}`;
  const response = requestOptions
    ? await fetch(url, requestOptions)
    : await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Failed to fetch occurrence lookup for ${trimmed}: ${response.status} ${text}`,
    );
  }

  return toOccurrenceLookup(await response.json());
}
