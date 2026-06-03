// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  fetchLocationByGid,
  fetchLocationsByHierarchy,
} from '../apiLocationHelpers';

describe('fetchLocationsByHierarchy', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  it('omits q when query is empty but keeps level, parent, and limit', async () => {
    await fetchLocationsByHierarchy('', 'state', 'USA', 25);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain('/api/locations/search_hierarchy?');
    expect(url).toContain('level=1');
    expect(url).toContain('parent=USA');
    expect(url).toContain('limit=25');
    expect(url).not.toContain('q=');
  });

  it('includes q when query is non-empty', async () => {
    await fetchLocationsByHierarchy('utah', 'state', 'USA', 25);

    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain('q=utah');
  });

  it('throws when hierarchy lookup returns a backend failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'backend unavailable',
    });

    await expect(
      fetchLocationsByHierarchy('', 'state', 'USA', 25),
    ).rejects.toThrow(
      'Failed to search locations by hierarchy: 500 backend unavailable',
    );
  });

  it('fetches canonical location hierarchy by gid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gid: 'USA.45.1_1',
        name: 'Beaver',
        level: 2,
        parent_gid: 'USA.45_1',
        hierarchy: ['United States', 'Utah'],
        ancestors: [
          { gid: 'USA', name: 'United States', level: 0 },
          { gid: 'USA.45_1', name: 'Utah', level: 1 },
        ],
      }),
    });

    await expect(fetchLocationByGid('USA.45.1_1')).resolves.toEqual({
      gid: 'USA.45.1_1',
      name: 'Beaver',
      level: 2,
      parent_gid: 'USA.45_1',
      hierarchy: ['United States', 'Utah'],
      ancestors: [
        { gid: 'USA', name: 'United States', level: 0 },
        { gid: 'USA.45_1', name: 'Utah', level: 1 },
      ],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/locations/USA.45.1_1'),
    );
  });

  it('returns null for missing canonical location gids', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'not found',
    });

    await expect(fetchLocationByGid('county-us-ca-sf')).resolves.toBeNull();
  });

  it('passes AbortSignal through canonical location lookup', async () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        gid: 'USA.45.1_1',
        name: 'Beaver',
        level: 2,
        parent_gid: 'USA.45_1',
        hierarchy: ['United States', 'Utah'],
        ancestors: [],
      }),
    });

    await fetchLocationByGid('USA.45.1_1', { signal: controller.signal });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/locations/USA.45.1_1'),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
