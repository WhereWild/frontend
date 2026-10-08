// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BACKEND_BASE } from '../apiShared';
import {
  clearRankDensityCache,
  fetchRankDensity,
  parseRankDensity,
} from '../apiRankDensity';

describe('parseRankDensity', () => {
  it('parses a KDE curve', () => {
    expect(
      parseRankDensity({
        count: 500,
        points: [1, 2, 3],
        density: [0.1, 0.5, 0.2],
      }),
    ).toEqual({
      count: 500,
      mean: null,
      curve: { points: [1, 2, 3], density: [0.1, 0.5, 0.2] },
      values: null,
    });
  });

  it('parses raw values for a cohort too small for a curve', () => {
    expect(
      parseRankDensity({ count: 3, mean: 4.67, values: [1, 4, 9] }),
    ).toEqual({
      count: 3,
      mean: 4.67,
      curve: null,
      values: [1, 4, 9],
    });
  });

  it('rejects missing, empty, and mismatched payloads', () => {
    expect(parseRankDensity(null)).toBeNull();
    expect(parseRankDensity({ count: 0, values: [] })).toBeNull();
    expect(
      parseRankDensity({ count: 2, points: [1, 2], density: [0.5] }),
    ).toBeNull();
    expect(parseRankDensity({ count: 2, values: [1, Number.NaN] })).toBeNull();
  });
});

describe('fetchRankDensity', () => {
  const originalFetch = global.fetch;
  const params = {
    contextTaxonId: '10',
    contextRank: 'SPECIES',
    variable: 'bio1',
    metric: 'mean',
    units: 'imperial',
  };

  beforeEach(() => {
    clearRankDensityCache();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('requests the cohort and memoizes repeat requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ density: { count: 2, values: [1, 2] } }),
    });

    const first = await fetchRankDensity(params);
    const second = await fetchRankDensity(params);

    expect(first).toEqual({
      count: 2,
      mean: null,
      curve: null,
      values: [1, 2],
    });
    expect(second).toBe(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/rank-density?context_taxon=10&rank=SPECIES&variable=bio1&metric=mean&unit_system=imperial`,
    );
  });

  it('forgets a failed request so the next attempt retries', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'boom',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ density: null }),
      });

    await expect(fetchRankDensity(params)).rejects.toThrow(
      'Failed to fetch rank density',
    );
    await expect(fetchRankDensity(params)).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
