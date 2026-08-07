// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useOptionalSettings } from '@/context/SettingsContext';
import {
  fetchTaxaQuery,
  type SearchTaxaQueryFilters,
} from '@/data/apiTaxaQueryHelpers';
import { renderHook, waitFor } from '@testing-library/react-native';
import {
  buildTaxaQueryCacheKey,
  readCachedTaxaQuery,
  writeCachedTaxaQuery,
} from '../taxaQuerySearchCache';
import { useTaxaQuerySearch } from '../useTaxaQuerySearch';

jest.mock('@/context/SettingsContext', () => ({
  useOptionalSettings: jest.fn(),
}));

jest.mock('@/data/apiTaxaQueryHelpers', () => {
  const actual = jest.requireActual('@/data/apiTaxaQueryHelpers');

  return {
    ...actual,
    fetchTaxaQuery: jest.fn(),
  };
});

jest.mock('../taxaQuerySearchCache', () => ({
  buildTaxaQueryCacheKey: jest.fn(),
  readCachedTaxaQuery: jest.fn(),
  writeCachedTaxaQuery: jest.fn(),
}));

const mockUseOptionalSettings = jest.mocked(useOptionalSettings);
const mockFetchTaxaQuery = jest.mocked(fetchTaxaQuery);
const mockBuildTaxaQueryCacheKey = jest.mocked(buildTaxaQueryCacheKey);
const mockReadCachedTaxaQuery = jest.mocked(readCachedTaxaQuery);
const mockWriteCachedTaxaQuery = jest.mocked(writeCachedTaxaQuery);

describe('useTaxaQuerySearch', () => {
  const rankedDescendantFilters: SearchTaxaQueryFilters = {
    location: null,
    withinTaxonId: '9703',
    descendantRank: 'genus',
    includeSpeciesLike: null,
    sortVariable: 'bio_1',
    sortMetric: 'median',
    sortOrder: null,
    minSamples: 0,
    limit: 10,
  };

  beforeEach(() => {
    mockUseOptionalSettings.mockReturnValue(undefined);
    mockBuildTaxaQueryCacheKey.mockReturnValue('ranked-descendant-key');
    mockReadCachedTaxaQuery.mockReturnValue(null);
    mockWriteCachedTaxaQuery.mockReset();
    mockFetchTaxaQuery.mockReset();
    mockFetchTaxaQuery.mockResolvedValue({
      query: null,
      scope: {
        withinTaxon: '9703',
        withinTaxonId: '9703',
        descendantRank: 'GENUS',
        location: null,
        minSamples: 0,
        includeSpeciesLike: false,
      },
      sort: {
        variable: 'bio_1',
        metric: 'median',
        order: 'asc',
        units: '°C',
      },
      total: 0,
      matchedTotal: 0,
      eligibleTotal: 7,
      emptyReason: null,
      limit: 10,
      offset: 0,
      results: [],
    });
  });

  it('requests ranked descendant results without a text query when rank is present', async () => {
    renderHook(() =>
      useTaxaQuerySearch({
        query: '',
        filterParams: rankedDescendantFilters,
      }),
    );
    await waitFor(() => {
      expect(mockFetchTaxaQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          q: '',
          withinTaxonId: '9703',
          descendantRank: 'genus',
          sortVariable: 'bio_1',
          sortMetric: 'median',
          limit: 10,
          offset: 0,
        }),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });
});
