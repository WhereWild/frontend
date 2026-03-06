import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  fetchEnvironmentVariables,
  fetchLocationsByHierarchy,
  fetchRelativeRankingOptions,
  fetchSpeciesList,
} from '@/data/api';
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

describe('useSearchFilters (location and sort)', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockFetchLocationsByHierarchy.mockResolvedValue([]);
    mockFetchEnvironmentVariables.mockResolvedValue([]);
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 0,
      rank: 'SPECIES',
      options: [],
    });
    mockFetchSpeciesList.mockResolvedValue([]);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('falls back to country label when state lookup by selected country value returns no rows', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'USA', name: 'United States', level: 0, hierarchy: [] }];
      }

      if (level === 'state' && parent === 'USA') {
        return [];
      }

      if (level === 'state' && parent === 'United States') {
        return [{ gid: 'US-UT', name: 'Utah', level: 1, hierarchy: ['United States'] }];
      }

      return [];
    });

    const { result } = renderHook(() => useSearchFilters());

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
        { label: 'Utah', value: 'US-UT' },
      ]);
    });

    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith('', 'state', 'USA', 300);
    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith('', 'state', 'United States', 300);
  });

  it('continues to next state parent candidate when the first candidate request fails', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'USA', name: 'United States', level: 0, hierarchy: [] }];
      }

      if (level === 'state' && parent === 'USA') {
        throw new Error('temporary backend error');
      }

      if (level === 'state' && parent === 'United States') {
        return [{ gid: 'US-CA', name: 'California', level: 1, hierarchy: ['United States'] }];
      }

      return [];
    });

    const { result } = renderHook(() => useSearchFilters());

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
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'USA', name: 'United States', level: 0, hierarchy: [] }];
      }

      if (level === 'state') {
        return [{ gid: 'US-UT', name: 'Utah', level: 1, hierarchy: ['United States'] }];
      }

      if (level === 'county') {
        throw new Error(`county lookup failed for ${parent}`);
      }

      return [];
    });

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(result.current.countryOptions).toEqual([{ label: 'United States', value: 'USA' }]);
    });

    act(() => {
      result.current.onCountryChange('USA');
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([{ label: 'Utah', value: 'US-UT' }]);
    });

    act(() => {
      result.current.onStateChange('US-UT');
    });

    await waitFor(() => {
      expect(result.current.countyOptions).toEqual([]);
      expect(result.current.countyLoading).toBe(false);
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('falls back to empty country options when loading countries fails', async () => {
    mockFetchLocationsByHierarchy.mockRejectedValueOnce(new Error('country lookup failed'));

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(result.current.countryLoading).toBe(false);
      expect(result.current.countryOptions).toEqual([]);
    });
  });

  it('debounces quantity spinner changes before updating filter params', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onNumberOfResultsChange(25);
      result.current.onMinimumSamplesChange(3);
    });

    expect(result.current.numberOfResults).toBe(25);
    expect(result.current.minimumSamples).toBe(3);
    expect(result.current.filterParams.numberOfResults).toBe(10);
    expect(result.current.filterParams.minimumSamples).toBe(10);

    act(() => {
      jest.advanceTimersByTime(299);
    });

    expect(result.current.filterParams.numberOfResults).toBe(10);
    expect(result.current.filterParams.minimumSamples).toBe(10);

    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(result.current.filterParams.numberOfResults).toBe(25);
      expect(result.current.filterParams.minimumSamples).toBe(3);
    });

    jest.useRealTimers();
  });

  it('resets all filters back to defaults', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onCountryChange('USA');
      result.current.onStateChange('US-UT');
      result.current.onCountyChange('US-UT-001');
      result.current.onBaseTaxonSelect({
        taxonId: 555,
        commonName: 'Gray wolf',
        commonNames: ['Gray wolf'],
        scientificName: 'Canis lupus',
        description: '',
      });
      result.current.onRankChange('genus');
      result.current.onIncludeSubspeciesChange(false);
      result.current.onSortVariableChange('bio_1');
      result.current.onSortMetricChange('max');
      result.current.onSortOrderChange('descending');
      result.current.onNumberOfResultsChange(25);
      result.current.onMinimumSamplesChange(4);
      jest.advanceTimersByTime(300);
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
    expect(result.current.rankValue).toBe('species');
    expect(result.current.includeSubspecies).toBe(true);
    expect(result.current.sortVariableValue).toBe('');
    expect(result.current.sortMetricValue).toBe('mean');
    expect(result.current.sortOrder).toBe('ascending');
    expect(result.current.numberOfResults).toBe(10);
    expect(result.current.minimumSamples).toBe(10);
    expect(result.current.filterParams.ancestorTaxonId).toBeNull();
    expect(result.current.filterParams.locationGid).toBeNull();
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

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
        { label: 'Precipitation', value: 'bio_12' },
      ]);
    });

    act(() => {
      result.current.onBaseTaxonSelect({
        taxonId: 77,
        commonName: 'Gray wolf',
        commonNames: ['Gray wolf'],
        scientificName: 'Canis lupus',
        description: '',
      });
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([{ label: 'Precipitation', value: 'bio_12' }]);
      expect(result.current.sortVariableValue).toBe('bio_12');
    });

    await waitFor(() => {
      expect(result.current.sortMetricOptions).toEqual([
        { label: 'Maximum', value: 'max' },
        { label: 'Minimum', value: 'min' },
      ]);
      expect(['max', 'min']).toContain(result.current.sortMetricValue);
    });
  });

  it('clears dependent location selections when country is cleared', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'USA', name: 'United States', level: 0, hierarchy: [] }];
      }

      if (level === 'state' && (parent === 'USA' || parent === 'United States')) {
        return [{ gid: 'US-UT', name: 'Utah', level: 1, hierarchy: ['United States'] }];
      }

      if (level === 'county' && (parent === 'US-UT' || parent === 'Utah')) {
        return [{ gid: 'US-UT-001', name: 'Beaver County', level: 2, hierarchy: ['United States', 'Utah'] }];
      }

      return [];
    });

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(result.current.countryOptions).toEqual([{ label: 'United States', value: 'USA' }]);
    });

    act(() => {
      result.current.onCountryChange('USA');
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([{ label: 'Utah', value: 'US-UT' }]);
    });

    act(() => {
      result.current.onStateChange('US-UT');
    });

    await waitFor(() => {
      expect(result.current.countyOptions).toEqual([{ label: 'Beaver County', value: 'US-UT-001' }]);
    });

    act(() => {
      result.current.onCountyChange('US-UT-001');
      result.current.onCountryChange('');
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([]);
      expect(result.current.countyOptions).toEqual([]);
      expect(result.current.stateValue).toBe('');
      expect(result.current.countyValue).toBe('');
      expect(result.current.filterParams.locationGid).toBeNull();
    });
  });

  it('falls back to empty sort variable options when environment variable fetch fails', async () => {
    mockFetchEnvironmentVariables.mockRejectedValueOnce(new Error('env unavailable'));

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(result.current.sortVariableLoading).toBe(false);
      expect(result.current.sortVariableOptions).toEqual([]);
    });
  });

  it('falls back to default sort options when ranking options request fails', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
    ]);
    mockFetchRelativeRankingOptions.mockRejectedValueOnce(new Error('ranking unavailable'));

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([{ label: 'Temperature', value: 'bio_1' }]);
    });

    act(() => {
      result.current.onBaseTaxonSelect({
        taxonId: 88,
        commonName: 'Gray wolf',
        commonNames: ['Gray wolf'],
        scientificName: 'Canis lupus',
        description: '',
      });
    });

    await waitFor(() => {
      expect(result.current.sortVariableLoading).toBe(false);
      expect(result.current.sortVariableOptions).toEqual([{ label: 'Temperature', value: 'bio_1' }]);
    });
  });

  it('keeps default sort options when ranking response has no valid variable ids', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio_1', name: 'Temperature' },
      { id: 'bio_12', name: 'Precipitation' },
    ]);
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 120,
      rank: 'SPECIES',
      options: [{ variable: '', metric: 'mean', column: 'mean', count: 1 }],
    });

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
        { label: 'Precipitation', value: 'bio_12' },
      ]);
    });

    act(() => {
      result.current.onBaseTaxonSelect({
        taxonId: 120,
        commonName: 'Gray wolf',
        commonNames: ['Gray wolf'],
        scientificName: 'Canis lupus',
        description: '',
      });
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
        { label: 'Precipitation', value: 'bio_12' },
      ]);
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

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([
        { label: 'Temperature', value: 'bio_1' },
        { label: 'Precipitation', value: 'bio_12' },
      ]);
    });

    act(() => {
      result.current.onSortVariableChange('bio_1');
      result.current.onBaseTaxonSelect({
        taxonId: 90,
        commonName: 'Gray wolf',
        commonNames: ['Gray wolf'],
        scientificName: 'Canis lupus',
        description: '',
      });
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([{ label: 'Precipitation', value: 'bio_12' }]);
      expect(result.current.sortVariableValue).toBe('bio_12');
    });
  });

  it('keeps ranking metric options scoped to the auto-selected ranking variable', async () => {
    mockFetchRelativeRankingOptions.mockResolvedValue({
      ancestorTaxonId: 77,
      rank: 'SPECIES',
      options: [{ variable: 'bio_12', metric: 'max', column: 'max', count: 1 }],
    });

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonSelect({
        taxonId: 77,
        commonName: 'Gray wolf',
        commonNames: ['Gray wolf'],
        scientificName: 'Canis lupus',
        description: '',
      });
    });

    await waitFor(() => {
      expect(result.current.sortVariableValue).toBe('bio_12');
    });

    await waitFor(() => {
      expect(result.current.sortMetricOptions).toEqual([{ label: 'Maximum', value: 'max' }]);
      expect(result.current.sortMetricValue).toBe('max');
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

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonSelect({
        taxonId: 1,
        commonName: 'First',
        commonNames: ['First'],
        scientificName: 'First species',
        description: '',
      });
      result.current.onBaseTaxonSelect({
        taxonId: 2,
        commonName: 'Second',
        commonNames: ['Second'],
        scientificName: 'Second species',
        description: '',
      });
    });

    act(() => {
      resolveFirst?.({
        ancestorTaxonId: 1,
        rank: 'SPECIES',
        options: [{ variable: 'ignored_var', metric: 'mean', column: 'mean', count: 1 }],
      });
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).not.toEqual([{ label: 'ignored_var', value: 'ignored_var' }]);
    });

    act(() => {
      resolveSecond?.({
        ancestorTaxonId: 2,
        rank: 'SPECIES',
        options: [{ variable: 'final_var', metric: 'max', column: 'max', count: 1 }],
      });
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([{ label: 'final_var', value: 'final_var' }]);
      expect(result.current.sortVariableValue).toBe('final_var');
    });
  });

  it('ignores stale state-options responses when country changes quickly', async () => {
    let resolveUsaStates: ((rows: any[]) => void) | null = null;

    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [
          { gid: 'USA', name: 'United States', level: 0, hierarchy: [] },
          { gid: 'CAN', name: 'Canada', level: 0, hierarchy: [] },
        ];
      }

      if (level === 'state' && (parent === 'USA' || parent === 'United States')) {
        return new Promise<any[]>((resolve) => {
          resolveUsaStates = resolve;
        });
      }

      if (level === 'state' && (parent === 'CAN' || parent === 'Canada')) {
        return [{ gid: 'CA-ON', name: 'Ontario', level: 1, hierarchy: ['Canada'] }];
      }

      return [];
    });

    const { result } = renderHook(() => useSearchFilters());

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
      resolveUsaStates?.([{ gid: 'US-UT', name: 'Utah', level: 1, hierarchy: ['United States'] }]);
    });

    await waitFor(() => {
      expect(result.current.stateOptions).toEqual([{ label: 'Ontario', value: 'CA-ON' }]);
    });
  });

  it('ignores stale state-option errors after country changes', async () => {
    let rejectUsaStates: ((reason?: unknown) => void) | null = null;

    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [
          { gid: 'USA', name: 'United States', level: 0, hierarchy: [] },
          { gid: 'CAN', name: 'Canada', level: 0, hierarchy: [] },
        ];
      }

      if (level === 'state' && (parent === 'USA' || parent === 'United States')) {
        return new Promise<any[]>((_, reject) => {
          rejectUsaStates = reject;
        });
      }

      if (level === 'state' && (parent === 'CAN' || parent === 'Canada')) {
        return [{ gid: 'CA-BC', name: 'British Columbia', level: 1, hierarchy: ['Canada'] }];
      }

      return [];
    });

    const { result } = renderHook(() => useSearchFilters());

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
      expect(result.current.stateOptions).toEqual([{ label: 'British Columbia', value: 'CA-BC' }]);
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

    const { result } = renderHook(() => useSearchFilters());

    await waitFor(() => {
      expect(mockFetchEnvironmentVariables).toHaveBeenCalled();
    });

    act(() => {
      result.current.onBaseTaxonSelect({
        taxonId: 700,
        commonName: 'First',
        commonNames: ['First'],
        scientificName: 'First species',
        description: '',
      });
    });

    await waitFor(() => {
      expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith({
        taxonId: 700,
        rank: 'SPECIES',
      });
    });

    act(() => {
      result.current.onBaseTaxonSelect({
        taxonId: 701,
        commonName: 'Second',
        commonNames: ['Second'],
        scientificName: 'Second species',
        description: '',
      });
    });

    await waitFor(() => {
      expect(mockFetchRelativeRankingOptions).toHaveBeenCalledWith({
        taxonId: 701,
        rank: 'SPECIES',
      });
    });

    await act(async () => {
      resolveFirst?.({
        ancestorTaxonId: 700,
        rank: 'SPECIES',
        options: [{ variable: 'ignored_var', metric: 'mean', column: 'mean', count: 1 }],
      });
      await Promise.resolve();
    });

    expect(result.current.sortVariableOptions).not.toEqual([{ label: 'ignored_var', value: 'ignored_var' }]);

    await act(async () => {
      resolveSecond?.({
        ancestorTaxonId: 701,
        rank: 'SPECIES',
        options: [{ variable: 'final_var', metric: 'max', column: 'max', count: 1 }],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.sortVariableOptions).toEqual([{ label: 'Final variable', value: 'final_var' }]);
    });
  });
});
