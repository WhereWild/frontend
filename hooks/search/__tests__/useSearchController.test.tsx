// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook, act } from '@testing-library/react-native';
import type { SearchTaxaQueryFilters } from '@/data/api';
import { useSearchController } from '../useSearchController';
import { useTaxaQuerySearch } from '../useTaxaQuerySearch';

jest.mock('../useTaxaQuerySearch', () => ({
  useTaxaQuerySearch: jest.fn(),
}));

const mockUseTaxaQuerySearch = jest.mocked(useTaxaQuerySearch);

describe('useSearchController', () => {
  const filterParams: SearchTaxaQueryFilters = {
    location: null,
    withinTaxonId: null,
    descendantRank: null,
    includeSpeciesLike: true,
    sortVariable: null,
    sortMetric: null,
    sortOrder: null,
    minSamples: 0,
    limit: 10,
  };

  beforeEach(() => {
    mockUseTaxaQuerySearch.mockReturnValue({
      debouncedQuery: '',
      searchContext: null,
      searchError: null,
      searchResults: [],
      searchTotal: 0,
      searching: false,
    });
  });

  it('uses the native query and keeps it synced to nativeInitialQuery on native', () => {
    const { result, rerender } = renderHook(
      ({ nativeInitialQuery }: { nativeInitialQuery?: string }) =>
        useSearchController({
          filterParams,
          nativeInitialQuery,
          isNative: true,
          isWeb: false,
          searchEnabled: true,
          searchQuery: 'web query',
        }),
      {
        initialProps: { nativeInitialQuery: 'oak' },
      },
    );

    expect(result.current.nativeSearchQuery).toBe('oak');
    expect(mockUseTaxaQuerySearch).toHaveBeenLastCalledWith({
      enabled: true,
      query: 'oak',
      filterParams,
    });

    act(() => {
      result.current.setNativeSearchQuery('cedar');
    });

    expect(mockUseTaxaQuerySearch).toHaveBeenLastCalledWith({
      enabled: true,
      query: 'cedar',
      filterParams,
    });

    rerender({ nativeInitialQuery: 'pine' });

    expect(result.current.nativeSearchQuery).toBe('pine');
    expect(mockUseTaxaQuerySearch).toHaveBeenLastCalledWith({
      enabled: true,
      query: 'pine',
      filterParams,
    });
  });

  it('uses the web search query when not native', () => {
    renderHook(() =>
      useSearchController({
        filterParams,
        nativeInitialQuery: 'oak',
        isNative: false,
        isWeb: true,
        searchEnabled: true,
        searchQuery: 'wolf',
      }),
    );

    expect(mockUseTaxaQuerySearch).toHaveBeenLastCalledWith({
      enabled: true,
      query: 'wolf',
      filterParams,
    });
  });

  it('disables search when neither native nor web search surface is active', () => {
    renderHook(() =>
      useSearchController({
        filterParams,
        nativeInitialQuery: 'oak',
        isNative: false,
        isWeb: false,
        searchEnabled: true,
        searchQuery: 'wolf',
      }),
    );

    expect(mockUseTaxaQuerySearch).toHaveBeenLastCalledWith({
      enabled: false,
      query: 'wolf',
      filterParams,
    });
  });

  it('keeps search disabled when searchEnabled is false even on web', () => {
    renderHook(() =>
      useSearchController({
        filterParams,
        nativeInitialQuery: 'oak',
        isNative: false,
        isWeb: true,
        searchEnabled: false,
        searchQuery: 'wolf',
      }),
    );

    expect(mockUseTaxaQuerySearch).toHaveBeenLastCalledWith({
      enabled: false,
      query: 'wolf',
      filterParams,
    });
  });

  it('defaults the native query to an empty string when no initial native query is provided', () => {
    const { result } = renderHook(() =>
      useSearchController({
        filterParams,
        isNative: true,
        isWeb: false,
        searchEnabled: true,
        searchQuery: 'ignored on native',
      }),
    );

    expect(result.current.nativeSearchQuery).toBe('');
    expect(mockUseTaxaQuerySearch).toHaveBeenLastCalledWith({
      enabled: true,
      query: '',
      filterParams,
    });
  });
});
