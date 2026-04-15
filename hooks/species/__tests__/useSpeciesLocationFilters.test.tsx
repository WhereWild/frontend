import { fetchSpeciesLocations } from '@/data/api';
import { SpeciesDataSourceProvider } from '@/context/SpeciesDataSourceContext';
import {
  createSpeciesDataSource,
  type SpeciesDataSource,
} from '@/data/speciesDataSource';
import type { LocationSearchResult } from '@/data/types';
import { useSpeciesLocationFilters } from '@/hooks/species/useSpeciesLocationFilters';
import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/data/api', () => ({
  fetchSpeciesLocations: jest.fn(),
}));

const mockFetchSpeciesLocations = fetchSpeciesLocations as jest.MockedFunction<
  typeof fetchSpeciesLocations
>;

function HookHarnessInner({
  taxonId,
  locationSearchLimit = 500,
  refHandle,
}: {
  taxonId?: number;
  locationSearchLimit?: number;
  refHandle: React.ForwardedRef<ReturnType<typeof useSpeciesLocationFilters>>;
}) {
  const value = useSpeciesLocationFilters({
    taxonId,
    locationSearchLimit,
  });

  React.useImperativeHandle(refHandle, () => value, [value]);
  return null;
}

const HookHarness = React.forwardRef<
  ReturnType<typeof useSpeciesLocationFilters>,
  {
    taxonId?: number;
    locationSearchLimit?: number;
    dataSource?: SpeciesDataSource;
  }
>(({ taxonId, locationSearchLimit = 500, dataSource }, ref) => {
  if (!dataSource) {
    return (
      <HookHarnessInner
        taxonId={taxonId}
        locationSearchLimit={locationSearchLimit}
        refHandle={ref}
      />
    );
  }

  return (
    <SpeciesDataSourceProvider value={dataSource}>
      <HookHarnessInner
        taxonId={taxonId}
        locationSearchLimit={locationSearchLimit}
        refHandle={ref}
      />
    </SpeciesDataSourceProvider>
  );
});
HookHarness.displayName = 'HookHarness';

describe('useSpeciesLocationFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchSpeciesLocations.mockResolvedValue([]);
  });

  it('loads country options and sanitizes malformed rows', async () => {
    mockFetchSpeciesLocations.mockImplementation(async (_taxonId, level) => {
      if (level === 'country') {
        return [
          { gid: 'country-us', name: undefined, level: 0, hierarchy: [] },
          { gid: '', name: 'Missing gid', level: 0, hierarchy: [] },
        ] as any;
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'country-us', value: 'country-us' },
      ]);
    });

    expect(mockFetchSpeciesLocations).toHaveBeenCalledWith(
      13579,
      'country',
      undefined,
      500,
    );
  });

  it('does not load hierarchy when taxonId is missing', async () => {
    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={undefined} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([]);
      expect(ref.current?.countryLoading).toBe(false);
    });

    expect(mockFetchSpeciesLocations).not.toHaveBeenCalled();
  });

  it('loads state and county options from selected parents', async () => {
    mockFetchSpeciesLocations.mockImplementation(
      async (_taxonId, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: ['Region'],
            },
          ];
        }
        if (level === 'state' && parent === 'United States') {
          return [
            {
              gid: 'state-ut',
              name: 'Utah',
              level: 1,
              hierarchy: ['Region', 'United States'],
            },
          ];
        }
        if (level === 'county' && parent === 'Utah') {
          return [
            {
              gid: 'county-slc',
              name: 'Salt Lake County',
              level: 2,
              hierarchy: ['Region', 'United States', 'Utah'],
            },
          ];
        }
        return [];
      },
    );

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'United States', value: 'country-us' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'Utah', value: 'state-ut' },
      ]);
    });

    await act(async () => {
      ref.current?.onStateChange('state-ut');
    });

    await waitFor(() => {
      expect(ref.current?.countyOptions).toEqual([
        { label: 'Salt Lake County', value: 'county-slc' },
      ]);
    });
  });

  it('infers parent selections from county hierarchy', async () => {
    mockFetchSpeciesLocations.mockImplementation(
      async (_taxonId, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: ['Region'],
            },
          ];
        }
        if (level === 'state' && parent === 'United States') {
          return [
            {
              gid: 'state-ut',
              name: 'Utah',
              level: 1,
              hierarchy: ['Region', 'United States'],
            },
          ];
        }
        if (level === 'county' && parent === 'Utah') {
          return [
            {
              gid: 'county-slc',
              name: 'Salt Lake County',
              level: 2,
              hierarchy: ['Region', 'United States', 'Utah'],
            },
          ];
        }
        return [];
      },
    );

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions.length).toBe(1);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions.length).toBe(1);
    });

    await act(async () => {
      ref.current?.onStateChange('state-ut');
    });

    await waitFor(() => {
      expect(ref.current?.countyOptions.length).toBe(1);
    });

    await act(async () => {
      ref.current?.onCountyChange('county-slc');
    });

    expect(ref.current?.selectedCountryGid).toBe('country-us');
    expect(ref.current?.selectedStateGid).toBe('state-ut');
    expect(ref.current?.selectedCountyGid).toBe('county-slc');
  });

  it('ignores stale guarded loads after taxon changes', async () => {
    let resolveOldCountry: (value: any) => void = () => {};
    const oldCountryPromise = new Promise((resolve) => {
      resolveOldCountry = resolve;
    });

    let countryCallCount = 0;
    mockFetchSpeciesLocations.mockImplementation(async (_taxonId, level) => {
      if (level !== 'country') {
        return [];
      }

      countryCallCount += 1;
      if (countryCallCount === 1) {
        return oldCountryPromise as any;
      }

      return [{ gid: 'country-new', name: 'New', level: 0, hierarchy: [] }];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    const rendered = render(<HookHarness ref={ref} taxonId={1} />);

    rendered.rerender(<HookHarness ref={ref} taxonId={2} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'New', value: 'country-new' },
      ]);
    });

    await act(async () => {
      resolveOldCountry([
        { gid: 'country-old', name: 'Old', level: 0, hierarchy: [] },
      ]);
    });

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'New', value: 'country-new' },
      ]);
    });
  });

  it('deduplicates in-flight country loads across remounts for the same species', async () => {
    let resolveCountry: ((value: any) => void) | null = null;
    const countryPromise = new Promise<LocationSearchResult[]>((resolve) => {
      resolveCountry = resolve;
    });

    mockFetchSpeciesLocations.mockImplementation(async (_taxonId, level) => {
      if (level === 'country') {
        return countryPromise;
      }

      return [];
    });

    const firstRef =
      React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    const firstRender = render(<HookHarness ref={firstRef} taxonId={13579} />);

    await waitFor(() => {
      expect(mockFetchSpeciesLocations).toHaveBeenCalledTimes(1);
      expect(firstRef.current?.countryLoading).toBe(true);
    });

    firstRender.unmount();

    const secondRef =
      React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={secondRef} taxonId={13579} />);

    await waitFor(() => {
      expect(secondRef.current?.countryLoading).toBe(true);
    });

    expect(mockFetchSpeciesLocations).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCountry?.([
        { gid: 'country-us', name: 'United States', level: 0, hierarchy: [] },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(secondRef.current?.countryOptions).toEqual([
        { label: 'United States', value: 'country-us' },
      ]);
      expect(secondRef.current?.countryLoading).toBe(false);
    });

    expect(mockFetchSpeciesLocations).toHaveBeenCalledTimes(1);
  });

  it('retries level fetch after transient failure instead of caching empty', async () => {
    let stateCallCount = 0;

    mockFetchSpeciesLocations.mockImplementation(
      async (_taxonId, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: [],
            },
          ];
        }

        if (level === 'state' && parent === 'United States') {
          stateCallCount += 1;
          if (stateCallCount === 1) {
            throw new Error('transient');
          }

          return [{ gid: 'state-ut', name: 'Utah', level: 1, hierarchy: [] }];
        }

        return [];
      },
    );

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'United States', value: 'country-us' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([]);
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
      expect(ref.current?.stateOptions).toEqual([
        { label: 'Utah', value: 'state-ut' },
      ]);
    });

    const stateCalls = mockFetchSpeciesLocations.mock.calls.filter(
      (args) => args[1] === 'state' && args[2] === 'United States',
    );
    expect(stateCalls).toHaveLength(2);
  });

  it('does not reuse cached level results when locationSearchLimit changes', async () => {
    mockFetchSpeciesLocations.mockImplementation(
      async (_taxonId, level, _parent, limit) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: [],
            },
          ];
        }

        if (level === 'state') {
          return [
            {
              gid: `state-${String(limit)}`,
              name: `State ${String(limit)}`,
              level: 1,
              hierarchy: [],
            },
          ];
        }

        return [];
      },
    );

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    const rendered = render(
      <HookHarness ref={ref} taxonId={13579} locationSearchLimit={1} />,
    );

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'United States', value: 'country-us' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'State 1', value: 'state-1' },
      ]);
    });

    rendered.rerender(
      <HookHarness ref={ref} taxonId={13579} locationSearchLimit={2} />,
    );

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'United States', value: 'country-us' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'State 2', value: 'state-2' },
      ]);
    });

    const stateCalls = mockFetchSpeciesLocations.mock.calls.filter(
      (args) => args[1] === 'state',
    );
    expect(stateCalls.some((args) => args[3] === 1)).toBe(true);
    expect(stateCalls.some((args) => args[3] === 2)).toBe(true);
  });

  it('reuses cached state results for the same parent selection', async () => {
    mockFetchSpeciesLocations.mockImplementation(
      async (_taxonId, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: [],
            },
          ];
        }
        if (level === 'state' && parent === 'United States') {
          return [{ gid: 'state-ut', name: 'Utah', level: 1, hierarchy: [] }];
        }
        return [];
      },
    );

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'United States', value: 'country-us' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'Utah', value: 'state-ut' },
      ]);
    });

    const stateCallsBeforeReselect =
      mockFetchSpeciesLocations.mock.calls.filter(
        (args) => args[1] === 'state' && args[2] === 'United States',
      ).length;

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
      expect(ref.current?.stateOptions).toEqual([
        { label: 'Utah', value: 'state-ut' },
      ]);
    });

    const stateCallsAfterReselect = mockFetchSpeciesLocations.mock.calls.filter(
      (args) => args[1] === 'state' && args[2] === 'United States',
    ).length;
    expect(stateCallsAfterReselect).toBe(stateCallsBeforeReselect);
  });

  it('supports level-0 state entries by promoting the selected country', async () => {
    mockFetchSpeciesLocations.mockImplementation(
      async (_taxonId, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: [],
            },
          ];
        }
        if (level === 'state' && parent === 'United States') {
          return [
            {
              gid: 'state-as-country',
              name: 'Country-Level',
              level: 0 as any,
              hierarchy: [],
            },
          ];
        }
        return [];
      },
    );

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions.length).toBe(1);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });
    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'Country-Level', value: 'state-as-country' },
      ]);
    });

    await act(async () => {
      ref.current?.onStateChange('state-as-country');
    });

    expect(ref.current?.selectedCountryGid).toBe('state-as-country');
  });

  it('ignores unsupported state levels during parent inference', async () => {
    mockFetchSpeciesLocations.mockImplementation(
      async (_taxonId, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: [],
            },
          ];
        }
        if (level === 'state' && parent === 'United States') {
          return [
            {
              gid: 'state-unknown',
              name: 'Unknown',
              level: null as any,
              hierarchy: [],
            },
          ];
        }
        return [];
      },
    );

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions.length).toBe(1);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });
    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'Unknown', value: 'state-unknown' },
      ]);
    });

    await act(async () => {
      ref.current?.onStateChange('state-unknown');
    });

    expect(ref.current?.selectedCountryGid).toBe('country-us');
    expect(ref.current?.selectedCountyGid).toBeNull();
  });

  it('handles state load errors from invalid parent token coercion', async () => {
    mockFetchSpeciesLocations.mockImplementation(async (_taxonId, level) => {
      if (level === 'country') {
        return [
          { gid: 'country-us', name: 'United States', level: 0, hierarchy: [] },
        ];
      }
      return [];
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions.length).toBe(1);
    });

    await act(async () => {
      ref.current?.onCountryChange({
        toString() {
          throw new Error('bad parent');
        },
      } as any);
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([]);
      expect(ref.current?.stateLoading).toBe(false);
    });
  });

  it('handles empty hierarchy names and invalid numeric levels during inference', async () => {
    mockFetchSpeciesLocations.mockImplementation(
      async (_taxonId, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: [],
            },
          ];
        }
        if (level === 'state' && parent === 'United States') {
          return [
            {
              gid: 'state-no-country',
              name: 'No Country',
              level: 1,
              hierarchy: [],
            },
            {
              gid: 'state-invalid-level',
              name: 'Invalid Level',
              level: 1.5 as any,
              hierarchy: [],
            },
          ];
        }
        return [];
      },
    );

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions.length).toBe(1);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });
    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'No Country', value: 'state-no-country' },
        { label: 'Invalid Level', value: 'state-invalid-level' },
      ]);
    });

    await act(async () => {
      ref.current?.onStateChange('state-no-country');
    });
    expect(ref.current?.selectedCountryGid).toBe('country-us');

    await act(async () => {
      ref.current?.onStateChange('state-invalid-level');
    });
    expect(ref.current?.selectedCountryGid).toBe('country-us');
    expect(ref.current?.selectedCountyGid).toBeNull();
  });

  it('covers state/county inference paths for found, missing, and non-array hierarchy entries', async () => {
    mockFetchSpeciesLocations.mockImplementation(
      async (_taxonId, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: [],
            },
          ];
        }
        if (level === 'state' && parent === 'United States') {
          return [
            {
              gid: 'state-ut',
              name: 'Utah',
              level: 1,
              hierarchy: ['Region', 'United States'],
            },
          ];
        }
        if (level === 'county' && parent === 'Utah') {
          return [
            {
              gid: 'county-slc',
              name: 'Salt Lake County',
              level: 2,
              hierarchy: ['Region', 'United States', 'Utah'],
            },
            {
              gid: 'county-no-hierarchy',
              name: 'No Hierarchy',
              level: 2,
              hierarchy: undefined as any,
            },
          ];
        }
        return [];
      },
    );

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(<HookHarness ref={ref} taxonId={13579} />);

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'United States', value: 'country-us' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });
    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'Utah', value: 'state-ut' },
      ]);
    });

    await act(async () => {
      ref.current?.onStateChange('missing-state');
    });
    expect(ref.current?.selectedStateGid).toBe('missing-state');

    await act(async () => {
      ref.current?.onStateChange('state-ut');
    });

    await waitFor(() => {
      expect(ref.current?.countyOptions).toEqual([
        { label: 'Salt Lake County', value: 'county-slc' },
        { label: 'No Hierarchy', value: 'county-no-hierarchy' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountyChange('missing-county');
    });
    expect(ref.current?.selectedCountyGid).toBe('missing-county');

    await act(async () => {
      ref.current?.onCountyChange('county-slc');
    });
    expect(ref.current?.selectedStateGid).toBe('state-ut');
    expect(ref.current?.selectedCountryGid).toBe('country-us');

    await act(async () => {
      ref.current?.onCountyChange('county-no-hierarchy');
    });
    expect(ref.current?.selectedCountyGid).toBe('county-no-hierarchy');
  });

  it('infers parent selections when uploaded hierarchy entries use gids', async () => {
    const localDataSource = createSpeciesDataSource({
      locationParentIdentityMode: 'gid',
      fetchSpeciesLocations: async (_taxonId, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: [],
            },
          ];
        }
        if (level === 'state' && parent === 'country-us') {
          return [
            {
              gid: 'state-ut',
              name: 'Utah',
              level: 1,
              hierarchy: ['region-1', 'country-us'],
            },
          ];
        }
        if (level === 'county' && parent === 'state-ut') {
          return [
            {
              gid: 'county-slc',
              name: 'Salt Lake County',
              level: 2,
              hierarchy: ['region-1', 'country-us', 'state-ut'],
            },
          ];
        }
        return [];
      },
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(
      <HookHarness ref={ref} taxonId={13579} dataSource={localDataSource} />,
    );

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'United States', value: 'country-us' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'Utah', value: 'state-ut' },
      ]);
    });

    await act(async () => {
      ref.current?.onStateChange('state-ut');
    });

    await waitFor(() => {
      expect(ref.current?.countyOptions).toEqual([
        { label: 'Salt Lake County', value: 'county-slc' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountyChange('county-slc');
    });

    expect(ref.current?.selectedCountryGid).toBe('country-us');
    expect(ref.current?.selectedStateGid).toBe('state-ut');
    expect(ref.current?.selectedCountyGid).toBe('county-slc');
  });

  it('keeps gid-mode uploaded location results when returned hierarchies still use names', async () => {
    const localDataSource = createSpeciesDataSource({
      locationParentIdentityMode: 'gid',
      fetchSpeciesLocations: async (_taxonId, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: [],
            },
          ];
        }
        if (level === 'state' && parent === 'country-us') {
          return [
            {
              gid: 'state-ut',
              name: 'Utah',
              level: 1,
              hierarchy: ['Region', 'United States'],
            },
          ];
        }
        if (level === 'county' && parent === 'state-ut') {
          return [
            {
              gid: 'county-slc',
              name: 'Salt Lake County',
              level: 2,
              hierarchy: ['Region', 'United States', 'Utah'],
            },
          ];
        }
        return [];
      },
    });

    const ref = React.createRef<ReturnType<typeof useSpeciesLocationFilters>>();
    render(
      <HookHarness ref={ref} taxonId={13579} dataSource={localDataSource} />,
    );

    await waitFor(() => {
      expect(ref.current?.countryOptions).toEqual([
        { label: 'United States', value: 'country-us' },
      ]);
    });

    await act(async () => {
      ref.current?.onCountryChange('country-us');
    });

    await waitFor(() => {
      expect(ref.current?.stateOptions).toEqual([
        { label: 'Utah', value: 'state-ut' },
      ]);
    });

    await act(async () => {
      ref.current?.onStateChange('state-ut');
    });

    await waitFor(() => {
      expect(ref.current?.countyOptions).toEqual([
        { label: 'Salt Lake County', value: 'county-slc' },
      ]);
    });
  });
});
