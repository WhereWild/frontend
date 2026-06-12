// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  fetchEnvironmentVariables,
  fetchLocationsByHierarchy,
  fetchRelativeRankingOptions,
  fetchSpeciesByTaxonId,
  fetchTaxaQuery,
} from '@/data/api';
import { createAbortError } from '@/test-utils/createAbortError';
import type { SpeciesApiNormalized, TaxaQueryResponse } from '@/data/types';
import {
  resetSearchFilterTaxonLabelCache,
  useSearchFilters,
} from '../useSearchFilters';

jest.mock('@/data/api', () => ({
  fetchLocationsByHierarchy: jest.fn(),
  fetchEnvironmentVariables: jest.fn(),
  fetchRelativeRankingOptions: jest.fn(),
  fetchSpeciesByTaxonId: jest.fn(),
  fetchTaxaQuery: jest.fn(),
}));

const mockFetchLocationsByHierarchy = jest.mocked(fetchLocationsByHierarchy);
const mockFetchEnvironmentVariables = jest.mocked(fetchEnvironmentVariables);
const mockFetchRelativeRankingOptions = jest.mocked(
  fetchRelativeRankingOptions,
);
const mockFetchSpeciesByTaxonId = jest.mocked(fetchSpeciesByTaxonId);
const mockFetchTaxaQuery = jest.mocked(fetchTaxaQuery);

const BASE_TAXON_BLUR_GRACE_MS = 140;

const createSpecies = (
  overrides: Partial<SpeciesApiNormalized> = {},
): SpeciesApiNormalized => ({
  taxon_id: 100,
  scientific_name: 'Canis lupus',
  common_name: 'Gray wolf',
  common_names: ['Gray wolf'],
  image_source: 'https://example.com/wolf.jpg',
  _raw: {},
  ...overrides,
});

const createTaxaQueryResponse = (
  results: SpeciesApiNormalized[],
): TaxaQueryResponse => ({
  query: null,
  scope: {
    withinTaxonId: null,
    descendantRank: null,
    location: null,
    minSamples: null,
    includeSpeciesLike: false,
  },
  sort: {
    variable: null,
    metric: null,
    order: null,
    units: null,
  },
  total: results.length,
  matchedTotal: results.length,
  eligibleTotal: results.length,
  emptyReason: results.length > 0 ? null : 'no_query',
  limit: results.length,
  offset: 0,
  results,
});

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const waitForRankingEffectsToSettle = async (
  result: { current: ReturnType<typeof useSearchFilters> },
  taxonId: number,
  rank = 'SPECIES',
) => {
  await act(async () => {
    result.current.onRankChange(rank.toLowerCase());
    await Promise.resolve();
  });

  await waitFor(() => {
    expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith(
      {
        taxonId,
        rank,
      },
      expect.objectContaining({ signal: expect.any(Object) }),
    );
  });

  await waitFor(() => {
    expect(result.current.sortVariableLoading).toBe(false);
  });
};

describe('useSearchFilters (base taxon)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSearchFilterTaxonLabelCache();

    mockFetchLocationsByHierarchy.mockResolvedValue([]);
    mockFetchEnvironmentVariables.mockResolvedValue([]);
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 0,
      rank: 'SPECIES',
      options: [],
    });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      taxon_id: 100,
      scientific_name: 'Canis lupus',
      common_name: 'Gray wolf',
      common_names: ['Gray wolf'],
      scientificName: 'Canis lupus',
      commonName: 'Gray wolf',
      commonNames: ['Gray wolf'],
      image_source: null,
      _raw: {},
      description: '',
      image_attribution: null,
      image_license: null,
      image_caption: null,
      image_file: null,
      overview: null,
      overview_sections: [],
      overview_lines: [],
      environment: [],
      nearby_species: [],
      heatmap: null,
      taxonomy_path: null,
    } as any);
    mockFetchTaxaQuery.mockResolvedValue(createTaxaQueryResponse([]));
  });

  it('hydrates a readable base taxon label for numeric route ids', async () => {
    const { result } = renderHook(() =>
      useSearchFilters({
        taxon: {
          ancestorTaxonId: 77,
          baseTaxonQuery: '77',
        },
      }),
    );

    await waitFor(() => {
      expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(77);
    });

    await waitForRankingEffectsToSettle(result, 77);

    await waitFor(() => {
      expect(result.current.baseTaxonQuery).toBe('Gray wolf');
      expect(result.current.filterParams.withinTaxonId).toBe(77);
    });
  });

  it('does not refetch a base taxon label when the query is already readable', async () => {
    const { result } = renderHook(() =>
      useSearchFilters({
        taxon: {
          ancestorTaxonId: 77,
          baseTaxonQuery: 'Gray wolf',
        },
      }),
    );

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await waitForRankingEffectsToSettle(result, 77);

    expect(mockFetchSpeciesByTaxonId).not.toHaveBeenCalled();
    expect(result.current.baseTaxonQuery).toBe('Gray wolf');
  });

  it('falls back to scientific name when species detail has no common name', async () => {
    mockFetchSpeciesByTaxonId.mockResolvedValueOnce({
      taxon_id: 77,
      scientific_name: 'Canis lupus',
      common_name: '',
      common_names: [],
      image_source: null,
      _raw: {},
      description: '',
    } as any);

    const { result } = renderHook(() =>
      useSearchFilters({
        taxon: {
          ancestorTaxonId: 77,
          baseTaxonQuery: '77',
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.baseTaxonQuery).toBe('Canis lupus');
    });

    await waitForRankingEffectsToSettle(result, 77);
  });

  it('keeps the raw numeric taxon query when detail hydration fails', async () => {
    mockFetchSpeciesByTaxonId.mockRejectedValueOnce(new Error('lookup failed'));

    const { result } = renderHook(() =>
      useSearchFilters({
        taxon: {
          ancestorTaxonId: 77,
          baseTaxonQuery: '77',
        },
      }),
    );

    await waitFor(() => {
      expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(77);
    });

    await waitForRankingEffectsToSettle(result, 77);

    expect(result.current.baseTaxonQuery).toBe('77');
    expect(result.current.filterParams.withinTaxonId).toBe(77);
  });

  it('hydrates state from route payloads after mount', async () => {
    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onHydrateRouteState({
        location: { countyValue: 'USA.45.1_1' },
        taxon: { ancestorTaxonId: 77, baseTaxonQuery: '77' },
        ranking: {
          rankValue: 'genus',
          includeSubspecies: false,
          sortVariableValue: 'bio_1',
          sortMetricValue: 'median',
          sortOrder: 'descending',
        },
        quantity: {
          numberOfResults: 20,
          minimumSamples: 25,
        },
      });
    });

    expect(result.current.countyValue).toBe('USA.45.1_1');
    expect(result.current.rankValue).toBe('genus');
    expect(result.current.includeSubspecies).toBe(true);
    expect(result.current.sortVariableValue).toBe('bio_1');
    expect(result.current.sortMetricValue).toBe('median');
    expect(result.current.sortOrder).toBe('descending');
    expect(result.current.numberOfResults).toBe(20);
    expect(result.current.minimumSamples).toBe(25);

    await waitFor(() => {
      expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(77);
    });

    await waitForRankingEffectsToSettle(result, 77, 'GENUS');
  });

  it('reopens base taxon suggestions when field regains focus with existing query', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
    });
    expect(result.current.baseTaxonSuggestionsVisible).toBe(true);

    act(() => {
      result.current.onBaseTaxonBlur();
      jest.advanceTimersByTime(BASE_TAXON_BLUR_GRACE_MS);
    });
    expect(result.current.baseTaxonSuggestionsVisible).toBe(false);

    act(() => {
      result.current.onBaseTaxonFocus();
    });
    expect(result.current.baseTaxonSuggestionsVisible).toBe(true);

    jest.useRealTimers();
  });

  it('debounces base taxon suggestion requests', async () => {
    jest.useFakeTimers();
    mockFetchTaxaQuery.mockResolvedValue(
      createTaxaQueryResponse([createSpecies()]),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
    });

    expect(mockFetchTaxaQuery).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(mockFetchTaxaQuery).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(mockFetchTaxaQuery).toHaveBeenCalledWith({
        q: 'canis',
        limit: 5,
        offset: 0,
        minSamples: 0,
      });
      expect(result.current.baseTaxonSuggestions[0]?.taxonId).toBe(100);
    });

    jest.useRealTimers();
  });

  it('shows loading while suggestion request is in flight', async () => {
    jest.useFakeTimers();
    let resolveRequest: ((rows: SpeciesApiNormalized[]) => void) | null = null;
    mockFetchTaxaQuery.mockImplementation(
      () =>
        new Promise<TaxaQueryResponse>((resolve) => {
          resolveRequest = (rows) => resolve(createTaxaQueryResponse(rows));
        }),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestionsLoading).toBe(true);
    });

    act(() => {
      resolveRequest?.([
        createSpecies({ taxon_id: 200, common_name: 'Coyote' }),
      ]);
    });
    await flushMicrotasks();

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestionsLoading).toBe(false);
      expect(result.current.baseTaxonSuggestions[0]?.taxonId).toBe(200);
    });

    jest.useRealTimers();
  });

  it('clears suggestions and hides portal when query is cleared while unfocused', async () => {
    jest.useFakeTimers();
    mockFetchTaxaQuery.mockResolvedValue(
      createTaxaQueryResponse([createSpecies()]),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestions.length).toBeGreaterThan(0);
      expect(result.current.baseTaxonSuggestionsVisible).toBe(true);
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('');
    });

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestions).toEqual([]);
      expect(result.current.baseTaxonSuggestionsVisible).toBe(false);
    });

    jest.useRealTimers();
  });

  it('ignores stale suggestion results after the base taxon query is cleared', async () => {
    jest.useFakeTimers();
    let resolveRequest: ((value: TaxaQueryResponse) => void) | null = null;
    mockFetchTaxaQuery.mockImplementationOnce(
      () =>
        new Promise<TaxaQueryResponse>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestionsLoading).toBe(true);
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('');
    });

    await act(async () => {
      resolveRequest?.(createTaxaQueryResponse([createSpecies()]));
      await Promise.resolve();
    });

    expect(result.current.baseTaxonSuggestions).toEqual([]);
    expect(result.current.baseTaxonSuggestionsLoading).toBe(false);

    jest.useRealTimers();
  });

  it('does not show suggestions for whitespace-only query while unfocused', async () => {
    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('   ');
    });

    expect(result.current.baseTaxonSuggestionsVisible).toBe(false);
    expect(mockFetchTaxaQuery).not.toHaveBeenCalled();
  });

  it('submitting a base taxon query resolves ancestor taxon id in filter params', async () => {
    mockFetchTaxaQuery.mockResolvedValue(
      createTaxaQueryResponse([createSpecies({ taxon_id: 4242 })]),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.onBaseTaxonSubmit('canis');
    });

    await waitFor(() => {
      expect(mockFetchTaxaQuery).toHaveBeenCalledWith({
        q: 'canis',
        limit: 1,
        offset: 0,
        minSamples: 0,
      });
      expect(result.current.filterParams.withinTaxonId).toBe(4242);
    });

    act(() => {
      result.current.onRankChange('species');
    });

    await waitFor(() => {
      expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith(
        {
          taxonId: 4242,
          rank: 'SPECIES',
        },
        expect.objectContaining({ signal: expect.any(Object) }),
      );
      expect(result.current.sortVariableLoading).toBe(false);
    });
  });

  it('selecting a base taxon suggestion updates query, id, and closes suggestions', async () => {
    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('can');
    });

    expect(result.current.baseTaxonSuggestionsVisible).toBe(true);

    await act(async () => {
      result.current.onBaseTaxonSelect({
        taxonId: 222,
        commonName: 'Gray wolf',
        commonNames: ['Gray wolf'],
        scientificName: 'Canis lupus',
        description: '',
      });
      await Promise.resolve();
    });

    expect(result.current.baseTaxonQuery).toBe('Gray wolf');
    expect(result.current.filterParams.withinTaxonId).toBe(222);
    expect(result.current.baseTaxonSuggestionsVisible).toBe(false);

    act(() => {
      result.current.onRankChange('species');
    });

    await waitFor(() => {
      expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith(
        {
          taxonId: 222,
          rank: 'SPECIES',
        },
        expect.objectContaining({ signal: expect.any(Object) }),
      );
      expect(result.current.sortVariableLoading).toBe(false);
    });
  });

  it('does not refetch suggestions after selecting and hiding the base taxon list', async () => {
    jest.useFakeTimers();
    mockFetchTaxaQuery.mockResolvedValue(
      createTaxaQueryResponse([
        createSpecies({ taxon_id: 222, common_name: 'Gray wolf' }),
      ]),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('can');
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetchTaxaQuery).toHaveBeenCalledWith({
        q: 'can',
        limit: 5,
        offset: 0,
        minSamples: 0,
      });
      expect(result.current.baseTaxonSuggestionsVisible).toBe(true);
    });

    mockFetchTaxaQuery.mockClear();

    act(() => {
      result.current.onBaseTaxonSelect({
        taxonId: 222,
        commonName: 'Gray wolf',
        commonNames: ['Gray wolf'],
        scientificName: 'Canis lupus',
        description: '',
      });
      jest.advanceTimersByTime(300);
    });

    expect(result.current.baseTaxonSuggestionsVisible).toBe(false);
    expect(mockFetchTaxaQuery).not.toHaveBeenCalled();

    act(() => {
      result.current.onRankChange('species');
    });

    await waitFor(() => {
      expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith(
        {
          taxonId: 222,
          rank: 'SPECIES',
        },
        expect.objectContaining({ signal: expect.any(Object) }),
      );
      expect(result.current.sortVariableLoading).toBe(false);
    });

    jest.useRealTimers();
  });

  it('normalizes scientific-name selection and nullable filter params', async () => {
    mockFetchRelativeRankingOptions.mockResolvedValueOnce({
      ancestorTaxonId: 333,
      rank: 'SPECIES',
      options: [{ variable: 'bio_12', metric: 'max', label: 'max', column: 'max', count: 1 }],
    });

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onRankChange('species');
    });

    await act(async () => {
      result.current.onBaseTaxonSelect({
        taxonId: 333,
        commonName: '',
        commonNames: [],
        scientificName: 'Canis lupus',
        description: '',
      });
      result.current.onSortMetricChange('not-a-valid-metric');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.baseTaxonQuery).toBe('Canis lupus');
      expect(result.current.sortVariableValue).toBe('');
      expect(result.current.filterParams.sortVariable).toBeNull();
      expect(result.current.filterParams.sortMetric).toBeNull();
    });

    act(() => {
      result.current.onRankChange('');
    });

    await waitFor(() => {
      expect(result.current.baseTaxonQuery).toBe('Canis lupus');
      expect(result.current.filterParams.descendantRank).toBeNull();
    });
  });

  it('submitting a numeric base taxon query sets ancestor id without lookup', async () => {
    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.onBaseTaxonSubmit('321');
    });

    expect(result.current.filterParams.withinTaxonId).toBe(321);
    expect(mockFetchTaxaQuery).not.toHaveBeenCalledWith({
      q: '321',
      limit: 1,
      offset: 0,
    });
  });

  it('preserves a readable base taxon label when route hydration keeps the same taxon id', async () => {
    const { result } = renderHook(() =>
      useSearchFilters({
        taxon: {
          ancestorTaxonId: 77,
          baseTaxonQuery: 'Oak',
        },
      }),
    );

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onHydrateRouteState({
        taxon: {
          ancestorTaxonId: 77,
          baseTaxonQuery: '77',
        },
      });
    });

    await waitForRankingEffectsToSettle(result, 77);

    expect(result.current.baseTaxonQuery).toBe('Oak');
    expect(mockFetchSpeciesByTaxonId).not.toHaveBeenCalledWith(77);
  });

  it('submitting a whitespace base taxon query keeps ancestor id null', async () => {
    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.onBaseTaxonSubmit('   ');
    });

    expect(result.current.filterParams.withinTaxonId).toBeNull();
    expect(mockFetchTaxaQuery).not.toHaveBeenCalledWith({
      q: '   ',
      limit: 1,
      offset: 0,
    });
  });

  it('submitting a non-integer numeric query falls back to species lookup', async () => {
    mockFetchTaxaQuery.mockResolvedValueOnce(
      createTaxaQueryResponse([createSpecies({ taxon_id: 654 })]),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.onBaseTaxonSubmit('12.5');
    });

    expect(mockFetchTaxaQuery).toHaveBeenCalledWith({
      q: '12.5',
      limit: 1,
      offset: 0,
      minSamples: 0,
    });
    expect(result.current.filterParams.withinTaxonId).toBe(654);
  });

  it('clears ancestor taxon id when submit lookup fails', async () => {
    mockFetchTaxaQuery.mockRejectedValueOnce(new Error('lookup failed'));

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.onBaseTaxonSubmit('canis');
    });

    expect(result.current.filterParams.withinTaxonId).toBeNull();
  });

  it('ignores stale submit results when a newer base taxon submit resolves first', async () => {
    let resolveFirst: ((rows: SpeciesApiNormalized[]) => void) | null = null;
    let resolveSecond: ((rows: SpeciesApiNormalized[]) => void) | null = null;

    mockFetchTaxaQuery
      .mockImplementationOnce(
        () =>
          new Promise<TaxaQueryResponse>((resolve) => {
            resolveFirst = (rows) => resolve(createTaxaQueryResponse(rows));
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<TaxaQueryResponse>((resolve) => {
            resolveSecond = (rows) => resolve(createTaxaQueryResponse(rows));
          }),
      );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      void result.current.onBaseTaxonSubmit('first');
      void result.current.onBaseTaxonSubmit('second');
    });

    await act(async () => {
      resolveSecond?.([createSpecies({ taxon_id: 202 })]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.filterParams.withinTaxonId).toBe(202);
    });

    await act(async () => {
      resolveFirst?.([createSpecies({ taxon_id: 101 })]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.filterParams.withinTaxonId).toBe(202);
    });
  });

  it('ignores stale submit errors when a newer submit has already resolved', async () => {
    let rejectFirst: ((reason?: unknown) => void) | null = null;
    let resolveSecond: ((rows: SpeciesApiNormalized[]) => void) | null = null;

    mockFetchTaxaQuery
      .mockImplementationOnce(
        () =>
          new Promise<TaxaQueryResponse>((_, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<TaxaQueryResponse>((resolve) => {
            resolveSecond = (rows) => resolve(createTaxaQueryResponse(rows));
          }),
      );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      void result.current.onBaseTaxonSubmit('first');
      void result.current.onBaseTaxonSubmit('second');
    });

    await act(async () => {
      resolveSecond?.([createSpecies({ taxon_id: 303 })]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.filterParams.withinTaxonId).toBe(303);
    });

    await act(async () => {
      rejectFirst?.(new Error('stale submit failed'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.filterParams.withinTaxonId).toBe(303);
    });
  });

  it('ignores stale base taxon submit results after filters reset', async () => {
    let resolveSubmit: ((rows: SpeciesApiNormalized[]) => void) | null = null;

    mockFetchTaxaQuery.mockImplementationOnce(
      () =>
        new Promise<TaxaQueryResponse>((resolve) => {
          resolveSubmit = (rows) => resolve(createTaxaQueryResponse(rows));
        }),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      void result.current.onBaseTaxonSubmit('canis');
    });

    act(() => {
      result.current.onResetFilters();
    });

    await act(async () => {
      resolveSubmit?.([
        createSpecies({ taxon_id: 404, common_name: 'Late canis' }),
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.filterParams.withinTaxonId).toBeNull();
      expect(result.current.baseTaxonQuery).toBe('');
    });
  });

  it('ignores stale base taxon submit results after route hydration replaces the scope', async () => {
    let resolveSubmit: ((rows: SpeciesApiNormalized[]) => void) | null = null;

    mockFetchTaxaQuery.mockImplementationOnce(
      () =>
        new Promise<TaxaQueryResponse>((resolve) => {
          resolveSubmit = (rows) => resolve(createTaxaQueryResponse(rows));
        }),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      void result.current.onBaseTaxonSubmit('canis');
    });

    act(() => {
      result.current.onHydrateRouteState({
        taxon: {
          ancestorTaxonId: 77,
          baseTaxonQuery: '77',
        },
      });
    });

    await act(async () => {
      resolveSubmit?.([
        createSpecies({ taxon_id: 505, common_name: 'Late canis' }),
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.filterParams.withinTaxonId).toBe(77);
      expect(result.current.baseTaxonQuery).not.toBe('Late canis');
    });
  });

  it('hides suggestions only after blur grace period expires', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
      result.current.onBaseTaxonFocus();
      result.current.onBaseTaxonBlur();
    });

    expect(result.current.baseTaxonSuggestionsVisible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(BASE_TAXON_BLUR_GRACE_MS - 1);
    });
    expect(result.current.baseTaxonSuggestionsVisible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestionsVisible).toBe(false);
    });

    jest.useRealTimers();
  });

  it('clears suggestions when suggestion request fails', async () => {
    jest.useFakeTimers();
    mockFetchTaxaQuery.mockRejectedValueOnce(new Error('suggestion failed'));

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestions).toEqual([]);
      expect(result.current.baseTaxonSuggestionsLoading).toBe(false);
    });

    jest.useRealTimers();
  });

  it('handles rejected in-flight suggestion request without stale-cancel path', async () => {
    jest.useFakeTimers();
    let rejectRequest: ((reason?: unknown) => void) | null = null;
    mockFetchTaxaQuery.mockImplementationOnce(
      () =>
        new Promise<TaxaQueryResponse>((_, reject) => {
          rejectRequest = reject;
        }),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
      jest.advanceTimersByTime(300);
    });

    await act(async () => {
      rejectRequest?.(new Error('suggestion failed deterministically'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestions).toEqual([]);
      expect(result.current.baseTaxonSuggestionsLoading).toBe(false);
    });

    jest.useRealTimers();
  });

  it('handles suggestion request failure without cancellation using real timers', async () => {
    mockFetchTaxaQuery.mockRejectedValueOnce(
      new Error('suggestion failed with real timers'),
    );

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320));
    });

    await waitFor(() => {
      expect(mockFetchTaxaQuery).toHaveBeenCalledWith({
        q: 'canis',
        limit: 5,
        offset: 0,
        minSamples: 0,
      });
      expect(result.current.baseTaxonSuggestions).toEqual([]);
      expect(result.current.baseTaxonSuggestionsLoading).toBe(false);
    });
  });

  it('clears pending blur-dismiss timeout when refocusing base taxon input', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
      result.current.onBaseTaxonFocus();
      result.current.onBaseTaxonBlur();
      result.current.onBaseTaxonFocus();
      jest.advanceTimersByTime(200);
    });

    expect(result.current.baseTaxonSuggestionsVisible).toBe(true);

    jest.useRealTimers();
  });

  it('ignores stale suggestion responses after query is cleared', async () => {
    jest.useFakeTimers();
    let resolveFirst: ((rows: SpeciesApiNormalized[]) => void) | null = null;

    mockFetchTaxaQuery.mockImplementation(() => {
      return new Promise<TaxaQueryResponse>((resolve) => {
        resolveFirst = (rows) => resolve(createTaxaQueryResponse(rows));
      });
    });

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('wolf');
      jest.advanceTimersByTime(300);
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('');
    });

    await act(async () => {
      resolveFirst?.([
        createSpecies({ taxon_id: 10, common_name: 'Wolf stale' }),
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestions).toEqual([]);
      expect(result.current.baseTaxonSuggestionsLoading).toBe(false);
    });

    jest.useRealTimers();
  });

  it('clears suggestion loading when filters reset during an in-flight suggestion request', async () => {
    jest.useFakeTimers();
    let resolveRequest: ((rows: SpeciesApiNormalized[]) => void) | null = null;

    mockFetchTaxaQuery.mockImplementation(() => {
      return new Promise<TaxaQueryResponse>((resolve) => {
        resolveRequest = (rows) => resolve(createTaxaQueryResponse(rows));
      });
    });

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('wolf');
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestionsLoading).toBe(true);
    });

    act(() => {
      result.current.onResetFilters();
    });

    expect(result.current.baseTaxonSuggestionsLoading).toBe(false);
    expect(result.current.baseTaxonSuggestions).toEqual([]);

    await act(async () => {
      resolveRequest?.([
        createSpecies({ taxon_id: 88, common_name: 'Late wolf' }),
      ]);
      await Promise.resolve();
    });

    expect(result.current.baseTaxonSuggestions).toEqual([]);

    jest.useRealTimers();
  });
});
