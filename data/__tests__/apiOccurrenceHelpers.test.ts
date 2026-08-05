// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchOccurrenceLookup } from '../apiOccurrenceHelpers';

describe('fetchOccurrenceLookup', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  it('parses an ingested observation lookup', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        catalog_number: '143391331',
        taxon_id: '6SRLS',
        scientific_name: 'Opuntia fragilis',
        common_name: 'Brittle Prickly Pear',
        slug: 'opuntia-fragilis',
        latitude: 40.5,
        longitude: -111.8,
        ingested: true,
      }),
    });

    await expect(fetchOccurrenceLookup('143391331')).resolves.toEqual({
      catalogNumber: '143391331',
      taxonId: '6SRLS',
      scientificName: 'Opuntia fragilis',
      commonName: 'Brittle Prickly Pear',
      slug: 'opuntia-fragilis',
      latitude: 40.5,
      longitude: -111.8,
      ingested: true,
      eventTimestamp: null,
      mediaUrl: null,
      mediaAttribution: null,
      mediaLicense: null,
      mediaLicenseUrl: null,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/occurrence/143391331'),
    );
  });

  it('parses a not-ingested fallback lookup with media and timestamp', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        catalog_number: '999888777',
        taxon_id: '2923970',
        scientific_name: 'Opuntia humifusa',
        common_name: null,
        slug: 'opuntia-humifusa',
        latitude: 41.0,
        longitude: -76.0,
        ingested: false,
        event_timestamp: 1536149160,
        media_url: 'https://static.inaturalist.org/photos/1/original.jpg',
        media_attribution: 'Andrew Harvey',
        media_license: 'CC BY 4.0',
        media_license_url: 'https://creativecommons.org/licenses/by/4.0/',
      }),
    });

    await expect(fetchOccurrenceLookup('999888777')).resolves.toEqual({
      catalogNumber: '999888777',
      taxonId: '2923970',
      scientificName: 'Opuntia humifusa',
      commonName: null,
      slug: 'opuntia-humifusa',
      latitude: 41.0,
      longitude: -76.0,
      ingested: false,
      eventTimestamp: 1536149160,
      mediaUrl: 'https://static.inaturalist.org/photos/1/original.jpg',
      mediaAttribution: 'Andrew Harvey',
      mediaLicense: 'CC BY 4.0',
      mediaLicenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    });
  });

  it('returns null for a 404 (observation not found)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Observation not found',
    });

    await expect(fetchOccurrenceLookup('nope')).resolves.toBeNull();
  });

  it('returns null without fetching for an empty/whitespace id', async () => {
    await expect(fetchOccurrenceLookup('  ')).resolves.toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws on a non-404 backend failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'backend unavailable',
    });

    await expect(fetchOccurrenceLookup('143391331')).rejects.toThrow(
      'Failed to fetch occurrence lookup for 143391331: 500 backend unavailable',
    );
  });

  it('passes AbortSignal through', async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        catalog_number: '143391331',
        taxon_id: '6SRLS',
        scientific_name: 'Opuntia fragilis',
        slug: 'opuntia-fragilis',
        latitude: 40.5,
        longitude: -111.8,
        ingested: true,
      }),
    });

    await fetchOccurrenceLookup('143391331', { signal: controller.signal });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/occurrence/143391331'),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('returns null when the response is missing catalog_number or taxon_id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ catalog_number: '143391331' }),
    });

    await expect(fetchOccurrenceLookup('143391331')).resolves.toBeNull();
  });
});
