import { fetchLocationsByHierarchy, fetchSpeciesOccurrences } from '@/data/api';
import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { useSpeciesLocationFilters } from '@/hooks/species/useSpeciesLocationFilters';

jest.mock('@/data/api', () => ({
  fetchLocationsByHierarchy: jest.fn(),
  fetchSpeciesOccurrences: jest.fn(),
}));

const mockFetchLocationsByHierarchy = fetchLocationsByHierarchy as jest.MockedFunction<
  typeof fetchLocationsByHierarchy
>;
const mockFetchSpeciesOccurrences = fetchSpeciesOccurrences as jest.MockedFunction<
  typeof fetchSpeciesOccurrences
>;

const HookHarness = React.forwardRef<
  ReturnType<typeof useSpeciesLocationFilters>,
  { taxonId?: number; occurrenceCheckConcurrency?: number; locationSearchLimit?: number }
>(({ taxonId, occurrenceCheckConcurrency = 2, locationSearchLimit = 500 }, ref) => {
  const value = useSpeciesLocationFilters({
    taxonId,
    locationSearchLimit,
    occurrenceCheckConcurrency,
  });

  React.useImperativeHandle(ref, () => value, [value]);
  return null;
});
HookHarness.displayName = 'HookHarness';

describe('useSpeciesLocationFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchLocationsByHierarchy.mockResolvedValue([]);
    mockFetchSpeciesOccurrences.mockResolvedValue([]);
  });

  it('loads country options and sanitizes malformed rows', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level) => {
      if (level === 'country') {
        return [
          { gid: 'country-us', name: undefined, level: 0, hierarchy: [] },
          { gid: '', name: 'Missing gid', level: 0, hierarchy: [] },
        ] as any;
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockImplementation(async (_taxonId, options) => {
      if (options?.location === 'country-us') {
        return [{ catalogNumber: 'country-us', latitude: 1, longitude: 2 }];
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'country-us', value: 'country-us' }]);
    });

    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith('', 'country', undefined, 500);
    expect(mockFetchSpeciesOccurrences).toHaveBeenCalledWith(13579, { location: 'country-us' });
  });

  it('does not load hierarchy when taxonId is missing', async () => {
    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={undefined} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([]);
      expect(ref.current?.countryLoading).toBe(false);
    });

    expect(mockFetchLocationsByHierarchy).not.toHaveBeenCalled();
    expect(mockFetchSpeciesOccurrences).not.toHaveBeenCalled();
  });

  it('reuses cached state results when selecting by gid then by name', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && (parent === 'United States' || parent === 'country-us')) {
        return [{ gid: 'state-ut', name: 'Utah', level: 1, hierarchy: ['Region', 'United States', 'country-us'] }];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockImplementation(async (_taxonId, options) => {
      if (!options?.location || options.location === 'country-us' || options.location === 'state-ut') {
        return [{ catalogNumber: 'ok', latitude: 1, longitude: 2 }];
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange(null);
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([{ label: 'Utah', value: 'state-ut' }]);
    });

    const getStateHierarchyCalls = () =>
      mockFetchLocationsByHierarchy.mock.calls.filter(
        (args) => args[1] === 'state' && (args[2] === 'United States' || args[2] === 'country-us'),
      ).length;

    const getStateOccurrenceChecks = () =>
      mockFetchSpeciesOccurrences.mock.calls.filter(
        (args) => args[1]?.location === 'state-ut',
      ).length;

    const stateHierarchyCallsBeforeReselect = getStateHierarchyCalls();
    const stateOccurrenceChecksBeforeReselect = getStateOccurrenceChecks();

    await act(async () => {
      ref.current?.onCountryChange(null);
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([]);
    });

    await act(async () => {
      ref.current?.onCountryChange('United States');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([{ label: 'Utah', value: 'state-ut' }]);
    });

    expect(getStateHierarchyCalls()).toBe(stateHierarchyCallsBeforeReselect);
    expect(getStateOccurrenceChecks()).toBe(stateOccurrenceChecksBeforeReselect);
  });

  it('handles inference branches for state level 0 and ignores unsupported levels', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && (parent === 'United States' || parent === 'country-us')) {
        return [
          { gid: 'state-country', name: 'Country Level', level: 0, hierarchy: ['Region', 'United States', 'country-us'] },
          { gid: 'state-mid', name: 'Odd Level', level: 1.5, hierarchy: ['Region', 'United States', 'country-us'] },
        ] as any;
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockResolvedValue([{ catalogNumber: 'ok', latitude: 1, longitude: 2 }]);

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions.length).toBe(1);
    });

    await act(async () => {
      ref.current?.onCountryChange('United States');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions.length).toBe(2);
    });

    await act(async () => {
      ref.current?.onStateChange('state-country');
    });

    await waitFor(() => {
      expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith('', 'state', 'state-country', 500);
    });

    await act(async () => {
      ref.current?.onCountryChange('United States');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions.length).toBe(2);
    });

    await act(async () => {
      ref.current?.onStateChange('state-mid');
    });

    expect(ref.current?.selectedCountyGid).toBeNull();

    await waitFor(() => {
      expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith('', 'county', 'Odd Level', 500);
    });
  });

  it('ignores stale guarded loads after taxon changes', async () => {
    let resolveOldCountry: (value: any) => void = () => { };
    const oldCountryPromise = new Promise((resolve) => {
      resolveOldCountry = resolve;
    });

    let countryCallCount = 0;
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level) => {
      if (level !== 'country') {
        return [];
      }

      countryCallCount += 1;
      if (countryCallCount === 1) {
        return oldCountryPromise as any;
      }

      return [{ gid: 'country-new', name: 'New', level: 0, hierarchy: [] }];
    });

    mockFetchSpeciesOccurrences.mockResolvedValue([{ catalogNumber: 'ok', latitude: 1, longitude: 2 }]);

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    const rendered = render(<HookHarness ref={ref} taxonId={1} />);

    rendered.rerender(<HookHarness ref={ref} taxonId={2} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'New', value: 'country-new' }]);
    });

    await act(async () => {
      resolveOldCountry([{ gid: 'country-old', name: 'Old', level: 0, hierarchy: [] }]);
    });

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'New', value: 'country-new' }]);
    });
  });

  it('falls back to empty options when state/county loading fails', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && (parent === 'United States' || parent === 'country-us')) {
        throw new Error('state failed');
      }
      if (level === 'county' && parent === 'Utah') {
        throw new Error('county failed');
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockResolvedValue([{ catalogNumber: 'ok', latitude: 1, longitude: 2 }]);

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    const rendered = render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange(null);
      ref.current?.onCountryChange('United States');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([]);
      expect(ref.current?.stateLoading).toBe(false);
    });

    rendered.unmount();

    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && (parent === 'United States' || parent === 'country-us')) {
        return [{ gid: 'state-ut', name: 'Utah', level: 1, hierarchy: ['Region', 'United States', 'country-us'] }];
      }
      if (level === 'county' && (parent === 'Utah' || parent === 'state-ut')) {
        throw new Error('county failed');
      }
      return [];
    });

    const refCounty = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={refCounty} taxonId={13579} />);

    await waitFor(() => {
      expect(refCounty.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      refCounty.current?.onCountryChange('United States');
    });

    await waitFor(() => {
      expect(refCounty.current?.stateOptions).toEqual([{ label: 'Utah', value: 'state-ut' }]);
    });

    await act(async () => {
      refCounty.current?.onStateChange('state-ut');
    });

    await waitFor(() => {
      expect(refCounty.current?.countyOptions).toEqual([]);
      expect(refCounty.current?.countyLoading).toBe(false);
    });
  });

  it('retries state hierarchy fetch after transient failure instead of caching empty', async () => {
    let stateCallCount = 0;

    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && (parent === 'United States' || parent === 'country-us')) {
        stateCallCount += 1;
        if (stateCallCount === 1) {
          throw new Error('transient state failure');
        }
        return [{ gid: 'state-ut', name: 'Utah', level: 1, hierarchy: ['Region', 'United States'] }];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockImplementation(async (_taxonId, options) => {
      if (!options?.location || options.location === 'country-us' || options.location === 'state-ut') {
        return [{ catalogNumber: 'ok', latitude: 1, longitude: 2 }];
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([]);
      expect(ref.current?.stateLoading).toBe(false);
    });

    await act(async () => {
      ref.current?.onCountryChange(null);
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([{ label: 'Utah', value: 'state-ut' }]);
    });

    const stateHierarchyCalls = mockFetchLocationsByHierarchy.mock.calls.filter(
      (args) => args[1] === 'state' && (args[2] === 'United States' || args[2] === 'country-us'),
    );
    expect(stateHierarchyCalls).toHaveLength(2);
  });

  it('ignores in-flight state results when country is cleared', async () => {
    let resolveStateSearch: (value: any) => void = () => { };
    const pendingStateSearch = new Promise((resolve) => {
      resolveStateSearch = resolve;
    });

    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && parent === 'United States') {
        return pendingStateSearch as any;
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockResolvedValue([{ catalogNumber: 'ok', latitude: 1, longitude: 2 }]);

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange('United States');
    });

    await waitFor(() => {
      expect(ref.current?.stateLoading).toBe(true);
    });

    await act(async () => {
      ref.current?.onCountryChange(null);
    });

    expect(ref.current?.stateLoading).toBe(false);
    expect(ref.current?.stateOptions).toEqual([]);

    await act(async () => {
      resolveStateSearch([
        { gid: 'state-ut', name: 'Utah', level: 1, hierarchy: ['Region', 'United States'] },
      ]);
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([]);
      expect(ref.current?.stateLoading).toBe(false);
    });
  });

  it('clamps zero occurrenceCheckConcurrency to one worker', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: [] }];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockImplementation(async (_taxonId, options) => {
      if (options?.location === 'country-us') {
        return [{ catalogNumber: 'country-us', latitude: 1, longitude: 2 }];
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} occurrenceCheckConcurrency={0} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    expect(mockFetchSpeciesOccurrences).toHaveBeenCalledWith(13579, { location: 'country-us' });
  });

  it('clamps non-finite occurrenceCheckConcurrency to one worker', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: [] }];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockImplementation(async (_taxonId, options) => {
      if (options?.location === 'country-us') {
        return [{ catalogNumber: 'country-us', latitude: 1, longitude: 2 }];
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(
      <HookHarness
        ref={ref}
        taxonId={13579}
        occurrenceCheckConcurrency={Number.POSITIVE_INFINITY}
      />,
    );

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    expect(mockFetchSpeciesOccurrences).toHaveBeenCalledWith(13579, { location: 'country-us' });
  });

  it('does not collide cache for different parent gids with same name', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [
          { gid: 'country-cg', name: 'Congo', level: 0, hierarchy: ['Region'] },
          { gid: 'country-cd', name: 'Congo', level: 0, hierarchy: ['Region'] },
        ];
      }
      if (level === 'state' && parent === 'Congo') {
        return [{ gid: 'state-congo', name: 'Congo State', level: 1, hierarchy: ['Region', 'Congo'] }];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockImplementation(async (_taxonId, options) => {
      if (!options?.location || options.location === 'country-cg' || options.location === 'country-cd' || options.location === 'state-congo') {
        return [{ catalogNumber: 'ok', latitude: 1, longitude: 2 }];
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions.length).toBe(2);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-cg');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([{ label: 'Congo State', value: 'state-congo' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-cd');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([{ label: 'Congo State', value: 'state-congo' }]);
    });

    const stateFetchCalls = mockFetchLocationsByHierarchy.mock.calls.filter(
      (args) => args[1] === 'state' && args[2] === 'Congo',
    );
    expect(stateFetchCalls).toHaveLength(2);
  });

  it('loads county options and infers parents from selected county', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && (parent === 'United States' || parent === 'country-us')) {
        return [{ gid: 'state-ut', name: 'Utah', level: 1, hierarchy: ['Region', 'United States'] }];
      }
      if (level === 'county' && (parent === 'Utah' || parent === 'state-ut')) {
        return [{ gid: 'county-slc', name: 'Salt Lake County', level: 2, hierarchy: ['Region', 'United States', 'Utah'] }];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockImplementation(async (_taxonId, options) => {
      if (!options?.location) {
        return [{ catalogNumber: 'root', latitude: 1, longitude: 2 }];
      }
      if (['country-us', 'state-ut', 'county-slc'].includes(options.location)) {
        return [{ catalogNumber: options.location, latitude: 1, longitude: 2 }];
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([{ label: 'Utah', value: 'state-ut' }]);
    });

    await act(async () => {
      ref.current?.onStateChange('state-ut');
    });

    await waitFor(() => {
      expect(ref.current?.countyOptions).toEqual([{ label: 'Salt Lake County', value: 'county-slc' }]);
    });

    await act(async () => {
      ref.current?.onCountyChange('county-slc');
    });

    expect(ref.current?.selectedCountryGid).toBe('country-us');
    expect(ref.current?.selectedStateGid).toBe('state-ut');
    expect(ref.current?.selectedCountyGid).toBe('county-slc');
  });

  it('handles parent inputs that stringify to empty names', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state') {
        return [];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockResolvedValue([{ catalogNumber: 'ok', latitude: 1, longitude: 2 }]);

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange({ toString: () => '' } as any);
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([]);
      expect(ref.current?.stateLoading).toBe(false);
    });

    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith('', 'state', undefined, 500);
  });

  it('falls back safely when guarded load catches unexpected state-load errors', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && (parent === 'United States' || parent === 'country-us')) {
        const brokenEntry: any = { gid: 'state-broken', name: 'Broken State', level: 1 };
        Object.defineProperty(brokenEntry, 'hierarchy', {
          get() {
            throw new Error('unexpected hierarchy access error');
          },
        });
        return [brokenEntry];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockResolvedValue([{ catalogNumber: 'ok', latitude: 1, longitude: 2 }]);

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([]);
      expect(ref.current?.stateLoading).toBe(false);
    });
  });

  it('ignores parent inference when selected state level is null', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && (parent === 'United States' || parent === 'country-us')) {
        return [{ gid: 'state-null', name: 'Unknown Level', level: null as any, hierarchy: ['Region', 'United States'] }];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockImplementation(async (_taxonId, options) => {
      if (!options?.location || options.location === 'country-us' || options.location === 'state-null') {
        return [{ catalogNumber: 'ok', latitude: 1, longitude: 2 }];
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([{ label: 'Unknown Level', value: 'state-null' }]);
    });

    await act(async () => {
      ref.current?.onStateChange('state-null');
    });

    expect(ref.current?.selectedStateGid).toBe('state-null');
    expect(ref.current?.selectedCountryGid).toBe('country-us');
    expect(ref.current?.selectedCountyGid).toBeNull();
  });

  it('covers selection guard false paths and inference fallbacks', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && (parent === 'United States' || parent === 'country-us')) {
        return [
          { gid: 'state-short', name: 'Short Hier State', level: 1, hierarchy: ['United States'] },
          { gid: 'state-ut', name: 'Utah', level: 1, hierarchy: ['Region', 'United States'] },
          { gid: 'state-no-hier', name: 'No Hier', level: 1, hierarchy: undefined as any },
          { gid: 'state-null-item', name: 'Null Item', level: 1, hierarchy: [null, 'United States'] as any },
        ];
      }
      if (level === 'county' && (parent === 'Utah' || parent === 'state-ut')) {
        return [
          { gid: 'county-good', name: 'Salt Lake County', level: 2, hierarchy: ['United States', 'Utah', 'Salt Lake County'] },
          { gid: 'county-fallback', name: 'Fallback County', level: 2, hierarchy: ['Utah'] },
        ];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockImplementation(async (_taxonId, options) => {
      if (!options?.location) {
        return [{ catalogNumber: 'root', latitude: 1, longitude: 2 }];
      }
      if (options.location === 'state-null-item') {
        return [];
      }
      if (
        [
          'country-us',
          'state-short',
          'state-ut',
          'county-good',
          'county-fallback',
        ].includes(options.location)
      ) {
        return [{ catalogNumber: options.location, latitude: 1, longitude: 2 }];
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'Short Hier State', value: 'state-short' },
        { label: 'Utah', value: 'state-ut' },
      ]);
    });

    await act(async () => {
      ref.current?.onStateChange(null);
      ref.current?.onStateChange('missing-state');
      ref.current?.onStateChange('state-short');
      ref.current?.onStateChange('state-ut');
    });

    await waitFor(() => {
      expect(ref.current?.countyOptions).toEqual([
        { label: 'Fallback County', value: 'county-fallback' },
        { label: 'Salt Lake County', value: 'county-good' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountyChange(null);
      ref.current?.onCountyChange('missing-county');
      ref.current?.onCountyChange('county-fallback');
      ref.current?.onCountyChange('county-good');
    });

    expect(ref.current?.selectedCountryGid).toBe('country-us');
    expect(ref.current?.selectedStateGid).toBe('state-ut');
    expect(ref.current?.selectedCountyGid).toBe('county-good');
  });

  it('does not reuse cached level results when locationSearchLimit changes', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, _parent, limit) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: [] }];
      }
      if (level === 'state') {
        return [
          { gid: `state-${String(limit)}`, name: `State ${String(limit)}`, level: 1, hierarchy: ['Region', 'United States'] },
        ];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockResolvedValue([{ catalogNumber: 'ok', latitude: 1, longitude: 2 }]);

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    const rendered = render(<HookHarness ref={ref} taxonId={13579} locationSearchLimit={1} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([{ label: 'State 1', value: 'state-1' }]);
    });

    rendered.rerender(<HookHarness ref={ref} taxonId={13579} locationSearchLimit={2} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([{ label: 'United States', value: 'country-us' }]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    const stateCallsByLimit = mockFetchLocationsByHierarchy.mock.calls.filter((args) => args[1] === 'state');
    expect(stateCallsByLimit.some((args) => args[3] === 1)).toBe(true);
    expect(stateCallsByLimit.some((args) => args[3] === 2)).toBe(true);

    const stateOccurrenceChecks = mockFetchSpeciesOccurrences.mock.calls.filter(
      (args) => args[1]?.location === 'state-2',
    );
    expect(stateOccurrenceChecks.length).toBeGreaterThan(0);
  });
});
