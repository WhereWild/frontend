import { renderHook, waitFor } from '@testing-library/react-native';
import { fetchLocationByGid } from '@/data/apiLocationHelpers';
import { useSearchRouteLocationHydration } from '../useSearchRouteLocationHydration';

jest.mock('@/data/apiLocationHelpers', () => ({
  fetchLocationByGid: jest.fn(),
}));

const mockFetchLocationByGid = jest.mocked(fetchLocationByGid);

describe('useSearchRouteLocationHydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not start a duplicate fetch when the same route is rerendered while hydration is in flight', () => {
    const onHydrateRouteLocation = jest.fn();
    const emptyOptions: { label: string; value: string }[] = [];

    mockFetchLocationByGid.mockImplementation(
      () => new Promise(() => undefined),
    );

    const { rerender } = renderHook(
      ({ routeLocation }: { routeLocation?: string }) =>
        useSearchRouteLocationHydration({
          routeLocation,
          countryValue: '',
          countryOptions: emptyOptions,
          stateValue: '',
          stateOptions: emptyOptions,
          countyValue: '',
          countyOptions: emptyOptions,
          onHydrateRouteLocation,
        }),
      {
        initialProps: { routeLocation: 'USA.45_1' },
      },
    );

    rerender({ routeLocation: 'USA.45_1' });

    expect(mockFetchLocationByGid).toHaveBeenCalledTimes(1);
    expect(onHydrateRouteLocation).not.toHaveBeenCalled();
  });

  it('skips canonical hydration when the routed selection already has option labels', () => {
    const onHydrateRouteLocation = jest.fn();

    renderHook(() =>
      useSearchRouteLocationHydration({
        routeLocation: 'USA.45_1',
        countryValue: 'USA',
        countryOptions: [{ label: 'United States', value: 'USA' }],
        stateValue: 'USA.45_1',
        stateOptions: [{ label: 'Utah', value: 'USA.45_1' }],
        countyValue: '',
        countyOptions: [],
        onHydrateRouteLocation,
      }),
    );

    expect(mockFetchLocationByGid).not.toHaveBeenCalled();
    expect(onHydrateRouteLocation).not.toHaveBeenCalled();
  });

  it('clears internal hydration state when the route location becomes empty and hydrates a later route', async () => {
    const onHydrateRouteLocation = jest.fn();

    mockFetchLocationByGid.mockResolvedValue({
      gid: 'USA.45_1',
      name: 'Utah',
      level: 1,
      parent_gid: 'USA',
      hierarchy: ['United States'],
      ancestors: [{ gid: 'USA', name: 'United States', level: 0 }],
    });

    const { rerender } = renderHook(
      ({ routeLocation }: { routeLocation?: string }) =>
        useSearchRouteLocationHydration({
          routeLocation,
          countryValue: '',
          countryOptions: [],
          stateValue: '',
          stateOptions: [],
          countyValue: '',
          countyOptions: [],
          onHydrateRouteLocation,
        }),
      {
        initialProps: { routeLocation: 'USA' },
      },
    );

    rerender({ routeLocation: '' });
    rerender({ routeLocation: 'USA.45_1' });

    await waitFor(() => {
      expect(mockFetchLocationByGid).toHaveBeenCalledWith(
        'USA.45_1',
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    expect(onHydrateRouteLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        countryValue: 'USA',
        stateValue: 'USA.45_1',
        countyValue: '',
      }),
    );
  });

  it('hydrates sparse state metadata without a country ancestor using the route gid and location name fallbacks', async () => {
    const onHydrateRouteLocation = jest.fn();

    mockFetchLocationByGid.mockResolvedValue({
      gid: 'state-us-ca',
      name: 'California',
      level: 1,
      parent_gid: null,
      hierarchy: [],
      ancestors: [],
    });

    renderHook(() =>
      useSearchRouteLocationHydration({
        routeLocation: 'state-us-ca',
        countryValue: '',
        countryOptions: [],
        stateValue: '',
        stateOptions: [],
        countyValue: '',
        countyOptions: [],
        onHydrateRouteLocation,
      }),
    );

    await waitFor(() => {
      expect(onHydrateRouteLocation).toHaveBeenCalledWith({
        countryValue: '',
        stateValue: 'state-us-ca',
        countyValue: '',
        countryOptions: [],
        stateOptions: [{ label: 'California', value: 'state-us-ca' }],
        countyOptions: [],
      });
    });
  });

  it('hydrates sparse country metadata using the location gid and name fallbacks', async () => {
    const onHydrateRouteLocation = jest.fn();

    mockFetchLocationByGid.mockResolvedValue({
      gid: 'USA',
      name: 'United States',
      level: 0,
      parent_gid: null,
      hierarchy: [],
      ancestors: [],
    });

    renderHook(() =>
      useSearchRouteLocationHydration({
        routeLocation: 'USA',
        countryValue: '',
        countryOptions: [],
        stateValue: '',
        stateOptions: [],
        countyValue: '',
        countyOptions: [],
        onHydrateRouteLocation,
      }),
    );

    await waitFor(() => {
      expect(onHydrateRouteLocation).toHaveBeenCalledWith({
        countryValue: 'USA',
        stateValue: '',
        countyValue: '',
        countryOptions: [{ label: 'United States', value: 'USA' }],
        stateOptions: [],
        countyOptions: [],
      });
    });
  });

  it('does not refetch after successful hydration when the same route rerenders with new option array references', async () => {
    const onHydrateRouteLocation = jest.fn();

    mockFetchLocationByGid.mockResolvedValue({
      gid: 'USA.45_1',
      name: 'Utah',
      level: 1,
      parent_gid: 'USA',
      hierarchy: ['United States'],
      ancestors: [{ gid: 'USA', name: 'United States', level: 0 }],
    });

    const { rerender } = renderHook(
      ({
        stateOptions,
      }: {
        stateOptions: { label: string; value: string }[];
      }) =>
        useSearchRouteLocationHydration({
          routeLocation: 'USA.45_1',
          countryValue: '',
          countryOptions: [],
          stateValue: '',
          stateOptions,
          countyValue: '',
          countyOptions: [],
          onHydrateRouteLocation,
        }),
      {
        initialProps: { stateOptions: [] },
      },
    );

    await waitFor(() => {
      expect(mockFetchLocationByGid).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onHydrateRouteLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          countryValue: 'USA',
          stateValue: 'USA.45_1',
          countyValue: '',
        }),
      );
    });

    rerender({ stateOptions: [] });

    expect(mockFetchLocationByGid).toHaveBeenCalledTimes(1);
  });
});
