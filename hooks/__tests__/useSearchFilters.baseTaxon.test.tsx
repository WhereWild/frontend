import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  fetchEnvironmentVariables,
  fetchLocationsByHierarchy,
  fetchRelativeRankingOptions,
  fetchSpeciesList,
} from '@/data/api';
import type { SpeciesApiNormalized } from '@/data/types';
import { useSearchFilters } from '../useSearchFilters';

jest.mock('@/data/api', () => ({
  fetchLocationsByHierarchy: jest.fn(),
  fetchEnvironmentVariables: jest.fn(),
  fetchRelativeRankingOptions: jest.fn(),
  fetchSpeciesList: jest.fn(),
}));

const mockFetchLocationsByHierarchy = jest.mocked(fetchLocationsByHierarchy);
const mockFetchEnvironmentVariables = jest.mocked(fetchEnvironmentVariables);
const mockFetchRelativeRankingOptions = jest.mocked(fetchRelativeRankingOptions);
const mockFetchSpeciesList = jest.mocked(fetchSpeciesList);

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

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('useSearchFilters (base taxon)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockFetchLocationsByHierarchy.mockResolvedValue([]);
    mockFetchEnvironmentVariables.mockResolvedValue([]);
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 0,
      rank: 'SPECIES',
      options: [],
    });
    mockFetchSpeciesList.mockResolvedValue([]);
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
    mockFetchSpeciesList.mockResolvedValue([createSpecies()]);

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('canis');
    });

    expect(mockFetchSpeciesList).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(mockFetchSpeciesList).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(mockFetchSpeciesList).toHaveBeenCalledWith(5, 'canis');
      expect(result.current.baseTaxonSuggestions[0]?.taxonId).toBe(100);
    });

    jest.useRealTimers();
  });

  it('shows loading while suggestion request is in flight', async () => {
    jest.useFakeTimers();
    let resolveRequest: ((rows: SpeciesApiNormalized[]) => void) | null = null;
    mockFetchSpeciesList.mockImplementation(
      () =>
        new Promise<SpeciesApiNormalized[]>((resolve) => {
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
      resolveRequest?.([createSpecies({ taxon_id: 200, common_name: 'Coyote' })]);
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
    mockFetchSpeciesList.mockResolvedValue([createSpecies()]);

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

  it('does not show suggestions for whitespace-only query while unfocused', async () => {
    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('   ');
    });

    expect(result.current.baseTaxonSuggestionsVisible).toBe(false);
    expect(mockFetchSpeciesList).not.toHaveBeenCalled();
  });

  it('submitting a base taxon query resolves ancestor taxon id in filter params', async () => {
    mockFetchSpeciesList.mockResolvedValue([createSpecies({ taxon_id: 4242 })]);

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.onBaseTaxonSubmit('canis');
    });

    await waitFor(() => {
      expect(mockFetchSpeciesList).toHaveBeenCalledWith(1, 'canis');
      expect(result.current.filterParams.ancestorTaxonId).toBe(4242);
    });

    await waitFor(() => {
      expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith({
        taxonId: 4242,
        rank: 'SPECIES',
      });
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

    act(() => {
      result.current.onBaseTaxonSelect({
        taxonId: 222,
        commonName: 'Gray wolf',
        commonNames: ['Gray wolf'],
        scientificName: 'Canis lupus',
        description: '',
      });
    });

    expect(result.current.baseTaxonQuery).toBe('Gray wolf');
    expect(result.current.filterParams.ancestorTaxonId).toBe(222);
    expect(result.current.baseTaxonSuggestionsVisible).toBe(false);

    await waitFor(() => {
      expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith({
        taxonId: 222,
        rank: 'SPECIES',
      });
      expect(result.current.sortVariableLoading).toBe(false);
    });
  });

  it('does not refetch suggestions after selecting and hiding the base taxon list', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesList.mockResolvedValue([createSpecies({ taxon_id: 222, common_name: 'Gray wolf' })]);

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('can');
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetchSpeciesList).toHaveBeenCalledWith(5, 'can');
      expect(result.current.baseTaxonSuggestionsVisible).toBe(true);
    });

    mockFetchSpeciesList.mockClear();

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
    expect(mockFetchSpeciesList).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('normalizes scientific-name selection and nullable filter params', async () => {
    mockFetchRelativeRankingOptions.mockResolvedValueOnce({
      ancestorTaxonId: 333,
      rank: 'SPECIES',
      options: [{ variable: 'bio_12', metric: 'max', column: 'max', count: 1 }],
    });

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonSelect({
        taxonId: 333,
        commonName: '',
        commonNames: [],
        scientificName: 'Canis lupus',
        description: '',
      });
      result.current.onSortMetricChange('not-a-valid-metric');
      result.current.onRankChange('');
    });

    await waitFor(() => {
      expect(result.current.baseTaxonQuery).toBe('Canis lupus');
      expect(result.current.sortVariableValue).toBe('bio_12');
      expect(result.current.sortMetricValue).toBe('max');
      expect(result.current.filterParams.rank).toBeNull();
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

    expect(result.current.filterParams.ancestorTaxonId).toBe(321);
    expect(mockFetchSpeciesList).not.toHaveBeenCalledWith(1, '321');
  });

  it('submitting a whitespace base taxon query keeps ancestor id null', async () => {
    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.onBaseTaxonSubmit('   ');
    });

    expect(result.current.filterParams.ancestorTaxonId).toBeNull();
    expect(mockFetchSpeciesList).not.toHaveBeenCalledWith(1, '   ');
  });

  it('submitting a non-integer numeric query falls back to species lookup', async () => {
    mockFetchSpeciesList.mockResolvedValueOnce([createSpecies({ taxon_id: 654 })]);

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.onBaseTaxonSubmit('12.5');
    });

    expect(mockFetchSpeciesList).toHaveBeenCalledWith(1, '12.5');
    expect(result.current.filterParams.ancestorTaxonId).toBe(654);
  });

  it('clears ancestor taxon id when submit lookup fails', async () => {
    mockFetchSpeciesList.mockRejectedValueOnce(new Error('lookup failed'));

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.onBaseTaxonSubmit('canis');
    });

    expect(result.current.filterParams.ancestorTaxonId).toBeNull();
  });

  it('ignores stale submit results when a newer base taxon submit resolves first', async () => {
    let resolveFirst: ((rows: SpeciesApiNormalized[]) => void) | null = null;
    let resolveSecond: ((rows: SpeciesApiNormalized[]) => void) | null = null;

    mockFetchSpeciesList
      .mockImplementationOnce(
        () => new Promise<SpeciesApiNormalized[]>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockImplementationOnce(
        () => new Promise<SpeciesApiNormalized[]>((resolve) => {
          resolveSecond = resolve;
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
      expect(result.current.filterParams.ancestorTaxonId).toBe(202);
    });

    await act(async () => {
      resolveFirst?.([createSpecies({ taxon_id: 101 })]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.filterParams.ancestorTaxonId).toBe(202);
    });
  });

  it('ignores stale submit errors when a newer submit has already resolved', async () => {
    let rejectFirst: ((reason?: unknown) => void) | null = null;
    let resolveSecond: ((rows: SpeciesApiNormalized[]) => void) | null = null;

    mockFetchSpeciesList
      .mockImplementationOnce(
        () => new Promise<SpeciesApiNormalized[]>((_, reject) => {
          rejectFirst = reject;
        }),
      )
      .mockImplementationOnce(
        () => new Promise<SpeciesApiNormalized[]>((resolve) => {
          resolveSecond = resolve;
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
      expect(result.current.filterParams.ancestorTaxonId).toBe(303);
    });

    await act(async () => {
      rejectFirst?.(new Error('stale submit failed'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.filterParams.ancestorTaxonId).toBe(303);
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
    mockFetchSpeciesList.mockRejectedValueOnce(new Error('suggestion failed'));

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
    mockFetchSpeciesList.mockImplementationOnce(
      () =>
        new Promise<SpeciesApiNormalized[]>((_, reject) => {
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
    mockFetchSpeciesList.mockRejectedValueOnce(new Error('suggestion failed with real timers'));

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
      expect(mockFetchSpeciesList).toHaveBeenCalledWith(5, 'canis');
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

    mockFetchSpeciesList.mockImplementation(() => {
      return new Promise<SpeciesApiNormalized[]>((resolve) => {
        resolveFirst = resolve;
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
      resolveFirst?.([createSpecies({ taxon_id: 10, common_name: 'Wolf stale' })]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.baseTaxonSuggestions).toEqual([]);
    });

    jest.useRealTimers();
  });
});
