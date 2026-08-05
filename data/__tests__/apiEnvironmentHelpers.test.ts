// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  fetchEnvironmentRangeSlice,
  fetchSpeciesEnvironmentCategorySamples,
} from '../apiEnvironmentHelpers';

describe('chained extra-variable filters (extra query param)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  const calledUrl = () => (global.fetch as jest.Mock).mock.calls[0][0] as string;

  it('omits the extra param from a slice request when no chained filters are given', async () => {
    await fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio1',
      min: 0,
      max: 30,
    });
    expect(calledUrl()).not.toContain('extra=');
  });

  it('serializes a chained categorical filter onto a numeric slice request', async () => {
    await fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio1',
      min: 0,
      max: 30,
      extra: [{ variableId: 'kg2', classValue: 1 }],
    });
    const url = new URL(calledUrl());
    const extra = JSON.parse(url.searchParams.get('extra') as string);
    expect(extra).toEqual([{ variable: 'kg2', classValue: 1 }]);
  });

  it('serializes a chained numeric range filter onto a categorical samples request', async () => {
    await fetchSpeciesEnvironmentCategorySamples(1, 'kg2', 1, {
      extra: [{ variableId: 'bio1', min: 15, max: 100 }],
    });
    const url = new URL(calledUrl());
    const extra = JSON.parse(url.searchParams.get('extra') as string);
    expect(extra).toEqual([{ variable: 'bio1', min: 15, max: 100 }]);
  });

  it('serializes a chained multi-class (OR) filter onto a numeric slice request', async () => {
    await fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio1',
      min: 0,
      max: 30,
      extra: [{ variableId: 'kg2', classValues: [1, 3] }],
    });
    const url = new URL(calledUrl());
    const extra = JSON.parse(url.searchParams.get('extra') as string);
    expect(extra).toEqual([{ variable: 'kg2', classValues: [1, 3] }]);
  });

  it('serializes a chained multi-range (OR) filter onto a numeric slice request', async () => {
    await fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'kg2',
      min: 0,
      max: 30,
      extra: [
        {
          variableId: 'bio1',
          ranges: [
            { min: 5, max: 15 },
            { min: 35, max: 45 },
          ],
        },
      ],
    });
    const url = new URL(calledUrl());
    const extra = JSON.parse(url.searchParams.get('extra') as string);
    expect(extra).toEqual([
      {
        variable: 'bio1',
        ranges: [
          { min: 5, max: 15 },
          { min: 35, max: 45 },
        ],
      },
    ]);
  });

  it('serializes multiple chained filters in order', async () => {
    await fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio1',
      min: 0,
      max: 30,
      extra: [
        { variableId: 'kg2', classValue: 1 },
        { variableId: 'elevation', min: 500, max: 1500 },
      ],
    });
    const url = new URL(calledUrl());
    const extra = JSON.parse(url.searchParams.get('extra') as string);
    expect(extra).toEqual([
      { variable: 'kg2', classValue: 1 },
      { variable: 'elevation', min: 500, max: 1500 },
    ]);
  });
});
