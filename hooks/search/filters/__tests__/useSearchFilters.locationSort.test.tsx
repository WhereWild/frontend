import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  fetchEnvironmentVariables,
  fetchLocationsByHierarchy,
  fetchRelativeRankingOptions,
  fetchSpeciesByTaxonId,
  fetchTaxaQuery,
} from '@/data/api';
import { createAbortError } from '@/test-utils/createAbortError';
import {
  resetSearchFilterTaxonLabelCache,
  useSearchFilters,
} from '../useSearchFilters';
import {
  fetchCountryHierarchyOptions,
  fetchHierarchyOptionsWithParentFallback,
  resetSearchFilterLocationOptionsCache,
} from '../searchFilterLocationHelpers';

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

const createSelectedSpecies = (
  taxonId: number,
  commonName = 'Gray wolf',
  scientificName = 'Canis lupus',
) => ({
  taxonId,
  commonName,
  commonNames: [commonName],
  scientificName,
  description: '',
});

const selectBaseTaxon = async (
  result: {
    current: Pick<
      ReturnType<typeof useSearchFilters>,
      'onBaseTaxonSelect' | 'onRankChange'
    >;
  },
  species: ReturnType<typeof createSelectedSpecies>,
) => {
  await act(async () => {
    result.current.onRankChange('species');
    result.current.onBaseTaxonSelect(species);
    await Promise.resolve();
  });
};

const flushPendingHookEffects = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const renderSearchFilters = async (
  initialState?: Parameters<typeof useSearchFilters>[0],
) => {
  const rendered = renderHook(() => useSearchFilters(initialState));
  await flushPendingHookEffects();
  return rendered;
};

describe('useSearchFilters (location and sort)', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSearchFilterLocationOptionsCache();
    resetSearchFilterTaxonLabelCache();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockFetchLocationsByHierarchy.mockResolvedValue([]);
    mockFetchEnvironmentVariables.mockResolvedValue([]);
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 0,
      rank: 'SPECIES',
      options: [],
    });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      taxon_id: 77,
      scientific_name: 'Canis lupus',
      common_name: 'Gray wolf',
      common_names: ['Gray wolf'],
      image_source: null,
      _raw: {},
      description: '',
    } as any);
    mockFetchTaxaQuery.mockResolvedValue({
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
      total: 0,
      matchedTotal: 0,
      eligibleTotal: 0,
      emptyReason: 'no_query',
      limit: 0,
      offset: 0,
      results: [],
    });
  });

  afterEach(async () => {
    await flushPendingHookEffects();
    consoleWarnSpy.mockRestore();
  });

  it('falls back to country label when state lookup by selected country value returns no rows', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(
      async (_query, level, parent) => {
        if (level === 'country') {
          return [
            { gid: 'USA', name: 'United States', level: 0, hierarchy: [] },
          ];
        }

        if (level === 'state' && parent === 'USA') {
          return [];
        }

        if (level === 'state' && parent === 'United States') {
          return [
            {
              gid: 'USA.45_1',
              name: 'Utah',
              level: 1,
              hierarchy: ['United States'],
            },
          ];
        }

        return [];
      },
    );

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.countryOptions).toEqual([
        { label: 'United States', value: 'USA' },
      ]);
    });

    act(() => {
      result.current.onCountryChange('USA');
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([
        { label: 'Utah', value: 'USA.45_1' },
      ]);
    });

    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith(
      '',
      'state',
      'USA',
      300,
    );
    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith(
      '',
      'state',
      'United States',
      300,
    );
  });

  it('continues to next state parent candidate when the first candidate request fails', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(
      async (_query, level, parent) => {
        if (level === 'country') {
          return [
            { gid: 'USA', name: 'United States', level: 0, hierarchy: [] },
          ];
        }

        if (level === 'state' && parent === 'USA') {
          throw new Error('temporary backend error');
        }

        if (level === 'state' && parent === 'United States') {
          return [
            {
              gid: 'US-CA',
              name: 'California',
              level: 1,
              hierarchy: ['United States'],
            },
          ];
        }

        return [];
      },
    );

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.countryOptions).toEqual([
        { label: 'United States', value: 'USA' },
      ]);
    });

    act(() => {
      result.current.onCountryChange('USA');
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([
        { label: 'California', value: 'US-CA' },
      ]);
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('resets county options when county lookup fails for selected state', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(
      async (_query, level, parent) => {
        if (level === 'country') {
          return [
            { gid: 'USA', name: 'United States', level: 0, hierarchy: [] },
          ];
        }

        if (level === 'state') {
          return [
            {
              gid: 'USA.45_1',
              name: 'Utah',
              level: 1,
              hierarchy: ['United States'],
            },
          ];
        }

        if (level === 'county') {
          throw new Error(`county lookup failed for ${parent}`);
        }

        return [];
      },
    );

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.countryOptions).toEqual([
        { label: 'United States', value: 'USA' },
      ]);
    });

    act(() => {
      result.current.onCountryChange('USA');
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([
        { label: 'Utah', value: 'USA.45_1' },
      ]);
    });

    act(() => {
      result.current.onStateChange('USA.45_1');
    });

    await waitFor(() => {
      expect(result.current.countyOptions).toEqual([]);
      expect(result.current.countyLoading).toBe(false);
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('falls back to empty country options when loading countries fails', async () => {
    mockFetchLocationsByHierarchy.mockRejectedValueOnce(
      new Error('country lookup failed'),
    );

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.countryLoading).toBe(false);
      expect(result.current.countryOptions).toEqual([]);
    });
  });

  it('debounces quantity spinner changes before updating filter params', async () => {
    jest.useFakeTimers();

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onNumberOfResultsChange(25);
      result.current.onMinimumSamplesChange(3);
    });

    expect(result.current.numberOfResults).toBe(25);
    expect(result.current.minimumSamples).toBe(3);
    expect(result.current.filterParams.limit).toBe(10);
    expect(result.current.filterParams.minSamples).toBeNull();

    act(() => {
      jest.advanceTimersByTime(299);
    });

    expect(result.current.filterParams.limit).toBe(10);
    expect(result.current.filterParams.minSamples).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(result.current.filterParams.limit).toBe(25);
      expect(result.current.filterParams.minSamples).toBe(3);
    });

    jest.useRealTimers();
  });

  it('resets all filters back to defaults', async () => {
    jest.useFakeTimers();

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      result.current.onCountryChange('USA');
      result.current.onStateChange('USA.45_1');
      result.current.onCountyChange('USA.45.1_1');
      result.current.onBaseTaxonSelect(createSelectedSpecies(555));
      result.current.onRankChange('genus');
      result.current.onIncludeSubspeciesChange(false);
      result.current.onSortVariableChange('bio_1');
      result.current.onSortMetricChange('max');
      result.current.onSortOrderChange('descending');
      result.current.onNumberOfResultsChange(25);
      result.current.onMinimumSamplesChange(4);
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.hasActiveFilters).toBe(true);
    });

    act(() => {
      result.current.onResetFilters();
    });

    expect(result.current.countryValue).toBe('');
    expect(result.current.stateValue).toBe('');
    expect(result.current.countyValue).toBe('');
    expect(result.current.baseTaxonQuery).toBe('');
    expect(result.current.rankValue).toBe('');
    expect(result.current.includeSubspecies).toBe(true);
    expect(result.current.sortVariableValue).toBe('');
    expect(result.current.sortMetricValue).toBe('median');
    expect(result.current.sortOrder).toBe('ascending');
    expect(result.current.numberOfResults).toBe(10);
    expect(result.current.minimumSamples).toBe(0);
    expect(result.current.filterParams.withinTaxonId).toBeNull();
    expect(result.current.filterParams.location).toBeNull();
    expect(result.current.hasActiveFilters).toBe(false);

    jest.useRealTimers();
  });

  it('adapts sort variable and metric options to ranking backend capabilities', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
      { id: 'bio_12', name: 'Precipitation' },
    ]);
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 77,
      rank: 'SPECIES',
      options: [
        { variable: 'bio_12', metric: 'max', column: 'max', count: 1 },
        { variable: 'bio_12', metric: 'min', column: 'min', count: 1 },
      ],
    });

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
        { label: 'Precipitation', value: 'bio_12' },
      ]);
    });

    await selectBaseTaxon(result, createSelectedSpecies(77));

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Precipitation', value: 'bio_12' },
      ]);
      expect(result.current.sortVariableValue).toBe('');
    });

    expect(result.current.sortMetricValue).toBe('median');
  });

  it('does not auto-select a ranking variable when scoped ranking options load', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_12', name: 'Annual Precipitation' },
      { id: 'bio_1', name: 'Annual Mean Temperature' },
    ]);
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 77,
      rank: 'SPECIES',
      options: [
        { variable: 'bio_12', metric: 'max', column: 'max', count: 1 },
        { variable: 'bio_1', metric: 'median', column: 'median', count: 1 },
        { variable: 'bio_1', metric: 'max', column: 'max', count: 1 },
      ],
    });

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await selectBaseTaxon(result, createSelectedSpecies(77));

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Annual Precipitation', value: 'bio_12' },
        { label: 'Annual Mean Temperature', value: 'bio_1' },
      ]);
      expect(result.current.sortVariableValue).toBe('');
      expect(result.current.sortMetricValue).toBe('median');
    });
  });

  it('hydrates filter params from initial state', async () => {
    const { result } = await renderSearchFilters({
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
        minimumSamples: 25,
        numberOfResults: 20,
      },
    });

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(77);
    });

    expect(result.current.countyValue).toBe('USA.45.1_1');
    expect(result.current.baseTaxonQuery).toBe('Gray wolf');
    expect(result.current.filterParams).toEqual({
      location: 'USA.45.1_1',
      withinTaxonId: 77,
      descendantRank: 'genus',
      includeSpeciesLike: null,
      sortVariable: null,
      sortMetric: null,
      sortOrder: null,
      minSamples: 25,
      limit: 20,
    });
  });

  it('reuses a cached base taxon label when the same routed taxon is revisited', async () => {
    const first = await renderSearchFilters();

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      first.result.current.onBaseTaxonSelect(
        createSelectedSpecies(77, 'Gray wolf', 'Canis lupus'),
      );
      await Promise.resolve();
    });

    first.unmount();
    mockFetchSpeciesByTaxonId.mockClear();

    const { result } = await renderSearchFilters({
      taxon: { ancestorTaxonId: 77, baseTaxonQuery: '77' },
    });

    expect(result.current.baseTaxonQuery).toBe('Gray wolf');
    expect(mockFetchSpeciesByTaxonId).not.toHaveBeenCalled();
  });

  it('caches an existing human-readable base taxon query for route revisits', async () => {
    const first = await renderSearchFilters({
      taxon: { ancestorTaxonId: 77, baseTaxonQuery: 'oak' },
    });

    await act(async () => {
      await Promise.resolve();
    });

    first.unmount();
    mockFetchSpeciesByTaxonId.mockClear();

    const { result } = await renderSearchFilters({
      taxon: { ancestorTaxonId: 77, baseTaxonQuery: '77' },
    });

    expect(result.current.baseTaxonQuery).toBe('oak');
    expect(mockFetchSpeciesByTaxonId).not.toHaveBeenCalled();
  });

  it('clears dependent location selections when country is cleared', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(
      async (_query, level, parent) => {
        if (level === 'country') {
          return [
            { gid: 'USA', name: 'United States', level: 0, hierarchy: [] },
          ];
        }

        if (
          level === 'state' &&
          (parent === 'USA' || parent === 'United States')
        ) {
          return [
            {
              gid: 'USA.45_1',
              name: 'Utah',
              level: 1,
              hierarchy: ['United States'],
            },
          ];
        }

        if (
          level === 'county' &&
          (parent === 'USA.45_1' || parent === 'Utah')
        ) {
          return [
            {
              gid: 'USA.45.1_1',
              name: 'Beaver',
              level: 2,
              hierarchy: ['United States', 'Utah'],
            },
          ];
        }

        return [];
      },
    );

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.countryOptions).toEqual([
        { label: 'United States', value: 'USA' },
      ]);
    });

    act(() => {
      result.current.onCountryChange('USA');
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([
        { label: 'Utah', value: 'USA.45_1' },
      ]);
    });

    act(() => {
      result.current.onStateChange('USA.45_1');
    });

    await waitFor(() => {
      expect(result.current.countyOptions).toEqual([
        { label: 'Beaver', value: 'USA.45.1_1' },
      ]);
    });

    act(() => {
      result.current.onCountyChange('USA.45.1_1');
      result.current.onCountryChange('');
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([]);
      expect(result.current.countyOptions).toEqual([]);
      expect(result.current.stateValue).toBe('');
      expect(result.current.countyValue).toBe('');
      expect(result.current.filterParams.location).toBeNull();
    });
  });

  it('falls back to empty sort variable options when environment variable fetch fails', async () => {
    mockFetchEnvironmentVariables.mockRejectedValueOnce(
      new Error('env unavailable'),
    );

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.sortVariableLoading).toBe(false);
      expect(result.current.sortVariableOptions).toEqual([]);
    });
  });

  it('does not fetch ranking options until a rank is explicitly selected', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
      { id: 'bio_12', name: 'Precipitation' },
    ]);

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.rankValue).toBe('');
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
        { label: 'Precipitation', value: 'bio_12' },
      ]);
    });

    await act(async () => {
      result.current.onBaseTaxonSelect(createSelectedSpecies(77));
      await Promise.resolve();
    });

    expect(result.current.filterParams.withinTaxonId).toBe(77);
    expect(result.current.filterParams.descendantRank).toBeNull();
    expect(mockFetchRelativeRankingOptions).not.toHaveBeenCalled();
    expect(result.current.sortVariableOptions).toEqual([
      { label: 'Temperature', value: 'bio_1' },
      { label: 'Precipitation', value: 'bio_12' },
    ]);
  });

  it('ignores environment variable results that resolve after the hook unmounts', async () => {
    let resolveRequest: ((value: any[]) => void) | null = null;
    mockFetchEnvironmentVariables.mockImplementationOnce(
      () =>
        new Promise<any[]>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const { unmount } = await renderSearchFilters();

    expect(mockFetchEnvironmentVariables).toHaveBeenCalled();

    unmount();

    await act(async () => {
      resolveRequest?.([{ id: 'bio_1', name: 'Temperature' }]);
      await Promise.resolve();
    });
  });

  it('treats aborted environment variable requests as silent cancellations', async () => {
    mockFetchEnvironmentVariables.mockRejectedValueOnce(createAbortError());

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.sortVariableLoading).toBe(false);
      expect(result.current.sortVariableOptions).toEqual([]);
    });
  });

  it('does not let late default environment variables overwrite taxon-scoped ranking options', async () => {
    let resolveVariables: ((value: any[]) => void) | null = null;

    mockFetchEnvironmentVariables.mockImplementationOnce(
      () =>
        new Promise<any[]>((resolve) => {
          resolveVariables = resolve;
        }),
    );
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 77,
      rank: 'SPECIES',
      options: [{ variable: 'bio_12', metric: 'max', column: 'max', count: 1 }],
    });

    const { result } = await renderSearchFilters();

    await selectBaseTaxon(result, createSelectedSpecies(77));

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'bio_12', value: 'bio_12' },
      ]);
    });

    await act(async () => {
      resolveVariables?.([
        { id: 'bio_1', name: 'Temperature' },
        { id: 'bio_12', name: 'Precipitation' },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Precipitation', value: 'bio_12' },
      ]);
    });
  });

  it('clears scoped sort options when ranking options request fails', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
    ]);
    mockFetchRelativeRankingOptions.mockRejectedValueOnce(
      new Error('ranking unavailable'),
    );

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
      ]);
    });

    await selectBaseTaxon(result, createSelectedSpecies(88));

    await waitFor(() => {
      expect(result.current.sortVariableLoading).toBe(false);
      expect(result.current.sortVariableOptions).toEqual([]);
      expect(result.current.sortVariableValue).toBe('');
      expect(result.current.sortMetricValue).toBe('median');
    });
  });

  it('clears scoped sort options when ranking response has no valid variable ids', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
      { id: 'bio_12', name: 'Precipitation' },
    ]);
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 120,
      rank: 'SPECIES',
      options: [{ variable: '', metric: 'mean', column: 'mean', count: 1 }],
    });

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
        { label: 'Precipitation', value: 'bio_12' },
      ]);
    });

    await selectBaseTaxon(result, createSelectedSpecies(120));

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([]);
      expect(result.current.sortVariableValue).toBe('');
      expect(result.current.sortMetricValue).toBe('median');
      expect(result.current.rankingFilterHint).toBe(
        'No ranking variables are available for the selected Scope taxon and Rank.',
      );
    });
  });

  it('clears selected sort variable when ranking context removes it', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
      { id: 'bio_12', name: 'Precipitation' },
    ]);
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 90,
      rank: 'SPECIES',
      options: [{ variable: 'bio_12', metric: 'max', column: 'max', count: 1 }],
    });

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
        { label: 'Precipitation', value: 'bio_12' },
      ]);
    });

    await act(async () => {
      result.current.onRankChange('species');
      result.current.onSortVariableChange('bio_1');
      result.current.onBaseTaxonSelect(createSelectedSpecies(90));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Precipitation', value: 'bio_12' },
      ]);
      expect(result.current.sortVariableValue).toBe('');
    });
  });

  it('restores default sort options when the base taxon is cleared after ranking options were loaded', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
      { id: 'bio_12', name: 'Precipitation' },
    ]);
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 90,
      rank: 'SPECIES',
      options: [{ variable: 'bio_12', metric: 'max', column: 'max', count: 1 }],
    });

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
        { label: 'Precipitation', value: 'bio_12' },
      ]);
    });

    await selectBaseTaxon(result, createSelectedSpecies(90));

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Precipitation', value: 'bio_12' },
      ]);
      expect(result.current.sortVariableValue).toBe('');
    });

    act(() => {
      result.current.onBaseTaxonQueryChange('');
    });

    await waitFor(() => {
      expect(result.current.filterParams.withinTaxonId).toBeNull();
      expect(result.current.sortVariableLoading).toBe(false);
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
        { label: 'Precipitation', value: 'bio_12' },
      ]);
    });
  });

  it('keeps default ranking metric options until a ranking variable is chosen', async () => {
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 77,
      rank: 'SPECIES',
      options: [{ variable: 'bio_12', metric: 'max', column: 'max', count: 1 }],
    });

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await selectBaseTaxon(result, createSelectedSpecies(77));

    await waitFor(() => {
      expect(result.current.sortMetricOptions).toEqual([
        { label: 'Average', value: 'mean' },
        { label: 'Median', value: 'median' },
        { label: 'Minimum', value: 'min' },
        { label: 'Maximum', value: 'max' },
        { label: 'Standard deviation', value: 'std' },
      ]);
      expect(result.current.sortVariableValue).toBe('');
      expect(result.current.sortMetricValue).toBe('median');
    });
  });

  it('ignores stale ranking-options responses after ancestor taxon changes', async () => {
    let resolveFirst: ((value: any) => void) | null = null;
    let resolveSecond: ((value: any) => void) | null = null;

    mockFetchRelativeRankingOptions.mockImplementation(({ taxonId }) => {
      if (taxonId === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        }) as any;
      }

      return new Promise((resolve) => {
        resolveSecond = resolve;
      }) as any;
    });

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      result.current.onRankChange('species');
      result.current.onBaseTaxonSelect(
        createSelectedSpecies(1, 'First', 'First species'),
      );
      result.current.onBaseTaxonSelect(
        createSelectedSpecies(2, 'Second', 'Second species'),
      );
      await Promise.resolve();
    });

    act(() => {
      resolveFirst?.({
        ancestorTaxonId: 1,
        rank: 'SPECIES',
        options: [
          { variable: 'ignored_var', metric: 'mean', column: 'mean', count: 1 },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).not.toEqual([
        { label: 'ignored_var', value: 'ignored_var' },
      ]);
    });

    act(() => {
      resolveSecond?.({
        ancestorTaxonId: 2,
        rank: 'SPECIES',
        options: [
          { variable: 'final_var', metric: 'max', column: 'max', count: 1 },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'final_var', value: 'final_var' },
      ]);
      expect(result.current.sortVariableValue).toBe('');
    });
  });

  it('ignores stale state-options responses when country changes quickly', async () => {
    let resolveUsaStates: ((rows: any[]) => void) | null = null;

    mockFetchLocationsByHierarchy.mockImplementation(
      async (_query, level, parent) => {
        if (level === 'country') {
          return [
            { gid: 'USA', name: 'United States', level: 0, hierarchy: [] },
            { gid: 'CAN', name: 'Canada', level: 0, hierarchy: [] },
          ];
        }

        if (
          level === 'state' &&
          (parent === 'USA' || parent === 'United States')
        ) {
          return new Promise<any[]>((resolve) => {
            resolveUsaStates = resolve;
          });
        }

        if (level === 'state' && (parent === 'CAN' || parent === 'Canada')) {
          return [
            { gid: 'CA-ON', name: 'Ontario', level: 1, hierarchy: ['Canada'] },
          ];
        }

        return [];
      },
    );

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.countryOptions).toEqual([
        { label: 'United States', value: 'USA' },
        { label: 'Canada', value: 'CAN' },
      ]);
    });

    act(() => {
      result.current.onCountryChange('USA');
    });

    act(() => {
      result.current.onCountryChange('CAN');
    });

    act(() => {
      resolveUsaStates?.([
        {
          gid: 'USA.45_1',
          name: 'Utah',
          level: 1,
          hierarchy: ['United States'],
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([
        { label: 'Ontario', value: 'CA-ON' },
      ]);
    });
  });

  it('ignores stale state-option errors after country changes', async () => {
    let rejectUsaStates: ((reason?: unknown) => void) | null = null;

    mockFetchLocationsByHierarchy.mockImplementation(
      async (_query, level, parent) => {
        if (level === 'country') {
          return [
            { gid: 'USA', name: 'United States', level: 0, hierarchy: [] },
            { gid: 'CAN', name: 'Canada', level: 0, hierarchy: [] },
          ];
        }

        if (
          level === 'state' &&
          (parent === 'USA' || parent === 'United States')
        ) {
          return new Promise<any[]>((_, reject) => {
            rejectUsaStates = reject;
          });
        }

        if (level === 'state' && (parent === 'CAN' || parent === 'Canada')) {
          return [
            {
              gid: 'CA-BC',
              name: 'British Columbia',
              level: 1,
              hierarchy: ['Canada'],
            },
          ];
        }

        return [];
      },
    );

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.countryOptions).toEqual([
        { label: 'United States', value: 'USA' },
        { label: 'Canada', value: 'CAN' },
      ]);
    });

    act(() => {
      result.current.onCountryChange('USA');
    });

    act(() => {
      result.current.onCountryChange('CAN');
    });

    await act(async () => {
      rejectUsaStates?.(new Error('stale usa request'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([
        { label: 'British Columbia', value: 'CA-BC' },
      ]);
    });
  });

  it('ignores stale ranking option success after base taxon changes', async () => {
    let resolveFirst: ((value: any) => void) | null = null;
    let resolveSecond: ((value: any) => void) | null = null;

    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'final_var', name: 'Final variable' },
    ]);

    mockFetchRelativeRankingOptions.mockImplementation(({ taxonId }) => {
      if (taxonId === 700) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        }) as any;
      }

      return new Promise((resolve) => {
        resolveSecond = resolve;
      }) as any;
    });

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await selectBaseTaxon(
      result,
      createSelectedSpecies(700, 'First', 'First species'),
    );

    await waitFor(() => {
      expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith(
        {
          taxonId: 700,
          rank: 'SPECIES',
        },
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    await selectBaseTaxon(
      result,
      createSelectedSpecies(701, 'Second', 'Second species'),
    );

    await waitFor(() => {
      expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith(
        {
          taxonId: 701,
          rank: 'SPECIES',
        },
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    await act(async () => {
      resolveFirst?.({
        ancestorTaxonId: 700,
        rank: 'SPECIES',
        options: [
          { variable: 'ignored_var', metric: 'mean', column: 'mean', count: 1 },
        ],
      });
      await Promise.resolve();
    });

    expect(result.current.sortVariableOptions).not.toEqual([
      { label: 'ignored_var', value: 'ignored_var' },
    ]);

    await act(async () => {
      resolveSecond?.({
        ancestorTaxonId: 701,
        rank: 'SPECIES',
        options: [
          { variable: 'final_var', metric: 'max', column: 'max', count: 1 },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Final variable', value: 'final_var' },
      ]);
    });
  });

  it('treats aborted ranking option requests as silent cancellations', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
    ]);
    mockFetchRelativeRankingOptions.mockRejectedValueOnce(createAbortError());

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
      ]);
    });

    await selectBaseTaxon(result, createSelectedSpecies(88));

    await waitFor(() => {
      expect(result.current.sortVariableLoading).toBe(false);
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
      ]);
    });
  });

  it('keeps default variable labels available while scoped ranking options reload', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Annual Mean Temperature' },
      { id: 'bio_12', name: 'Annual Precipitation' },
    ]);
    mockFetchSpeciesByTaxonId.mockImplementation(
      () => new Promise(() => {}) as any,
    );
    mockFetchRelativeRankingOptions.mockImplementation(
      () => new Promise(() => {}) as any,
    );

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Annual Mean Temperature', value: 'bio_1' },
        { label: 'Annual Precipitation', value: 'bio_12' },
      ]);
    });

    act(() => {
      result.current.onHydrateRouteState({
        taxon: {
          ancestorTaxonId: 3996518,
          baseTaxonQuery: '3996518',
        },
        ranking: {
          rankValue: 'species',
          sortVariableValue: 'bio_1',
          sortMetricValue: 'median',
        },
      });
    });

    expect(result.current.sortVariableValue).toBe('bio_1');
    expect(result.current.sortVariableOptions).toEqual([
      { label: 'Annual Mean Temperature', value: 'bio_1' },
      { label: 'Annual Precipitation', value: 'bio_12' },
    ]);
  });

  it('clears a selected sort variable when ranked context is removed', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
    ]);

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
      ]);
    });

    await act(async () => {
      result.current.onRankChange('species');
      result.current.onBaseTaxonSelect(createSelectedSpecies(77));
      await Promise.resolve();
    });

    await act(async () => {
      result.current.onSortVariableChange('bio_1');
      await Promise.resolve();
    });

    expect(result.current.sortVariableValue).toBe('bio_1');

    await act(async () => {
      result.current.onRankChange('');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.sortVariableValue).toBe('');
      expect(result.current.sortMetricValue).toBe('median');
      expect(result.current.sortOrder).toBe('ascending');
    });
  });

  it('preserves hydrated country option labels when route state replays the same gid', async () => {
    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.countryLoading).toBe(false);
    });

    act(() => {
      result.current.onHydrateRouteState({
        location: {
          countryValue: 'ETH',
          countryOptions: [{ label: 'Ethiopia', value: 'ETH' }],
        },
      });
    });

    expect(result.current.countryOptions).toEqual([
      { label: 'Ethiopia', value: 'ETH' },
    ]);

    act(() => {
      result.current.onHydrateRouteState({
        location: {
          countryValue: 'ETH',
        },
      });
    });

    await waitFor(() => {
      expect(result.current.stateLoading).toBe(false);
    });

    expect(result.current.countryOptions).toEqual([
      { label: 'Ethiopia', value: 'ETH' },
    ]);
  });

  it('does not refetch identical state hierarchy options when country options reseed around the same route country', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(
      async (_query, level, parent) => {
        if (level === 'country') {
          return [{ gid: 'CHN', name: 'China', level: 0, hierarchy: [] }];
        }

        if (level === 'state' && parent === 'CHN') {
          return [
            {
              gid: 'CHN.16_1',
              name: 'Jiangsu',
              level: 1,
              hierarchy: ['China'],
            },
          ];
        }

        return [];
      },
    );

    const { result } = await renderSearchFilters({
      location: {
        countryValue: 'CHN',
        countryOptions: [{ label: 'China', value: 'CHN' }],
      },
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([
        { label: 'Jiangsu', value: 'CHN.16_1' },
      ]);
    });

    act(() => {
      result.current.onHydrateRouteLocation({
        countryValue: 'CHN',
        countryOptions: [{ label: 'China', value: 'CHN' }],
      });
    });

    await flushPendingHookEffects();

    const stateFetchesForChina =
      mockFetchLocationsByHierarchy.mock.calls.filter(
        ([, level, parent]) => level === 'state' && parent === 'CHN',
      );

    expect(stateFetchesForChina).toHaveLength(1);
  });

  it('reuses cached location option labels when the same routed country is revisited', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(
      async (_query, level, parent) => {
        if (level === 'country') {
          return [{ gid: 'CHN', name: 'China', level: 0, hierarchy: [] }];
        }

        if (level === 'state' && parent === 'CHN') {
          return [
            {
              gid: 'CHN.16_1',
              name: 'Jiangsu',
              level: 1,
              hierarchy: ['China'],
            },
          ];
        }

        return [];
      },
    );

    await fetchCountryHierarchyOptions();
    await fetchHierarchyOptionsWithParentFallback('state', ['CHN']);

    const { result } = await renderSearchFilters({
      location: {
        countryValue: 'CHN',
        stateValue: 'CHN.16_1',
      },
    });

    expect(result.current.countryOptions).toEqual([
      { label: 'China', value: 'CHN' },
    ]);
    expect(result.current.stateOptions).toEqual([
      { label: 'Jiangsu', value: 'CHN.16_1' },
    ]);
  });

  it('preserves non-location user edits when canonical route location metadata arrives late', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
    ]);

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(result.current.countryLoading).toBe(false);
    });

    await act(async () => {
      result.current.onRankChange('species');
      result.current.onBaseTaxonSelect(createSelectedSpecies(77));
      await Promise.resolve();
    });

    await act(async () => {
      result.current.onNumberOfResultsChange(25);
      result.current.onMinimumSamplesChange(3);
      result.current.onHydrateRouteLocation({
        countryValue: 'ETH',
        countryOptions: [{ label: 'Ethiopia', value: 'ETH' }],
      });
      await Promise.resolve();
    });

    expect(result.current.countryValue).toBe('ETH');
    expect(result.current.countryOptions).toEqual([
      { label: 'Ethiopia', value: 'ETH' },
    ]);
    expect(result.current.filterParams.withinTaxonId).toBe(77);
    expect(result.current.rankValue).toBe('species');
    expect(result.current.numberOfResults).toBe(25);
    expect(result.current.minimumSamples).toBe(3);
  });

  it('clears ranking loading when filters reset during an in-flight ranking options request', async () => {
    let resolveRequest: ((value: any) => void) | null = null;

    mockFetchRelativeRankingOptions.mockImplementation(() => {
      return new Promise((resolve) => {
        resolveRequest = resolve;
      }) as any;
    });

    const { result } = await renderSearchFilters();

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    await act(async () => {
      result.current.onRankChange('species');
      result.current.onBaseTaxonSelect(createSelectedSpecies(444));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.sortVariableLoading).toBe(true);
      expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith(
        {
          taxonId: 444,
          rank: 'SPECIES',
        },
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    await act(async () => {
      result.current.onResetFilters();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.sortVariableLoading).toBe(false);
    });

    await act(async () => {
      resolveRequest?.({
        ancestorTaxonId: 444,
        rank: 'SPECIES',
        options: [
          { variable: 'late_var', metric: 'mean', column: 'mean', count: 1 },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.sortVariableLoading).toBe(false);
      expect(result.current.sortVariableOptions).toEqual([]);
    });
  });
});
