import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import {
  fetchEnvironmentRangeSlice,
  fetchPointEnvironmentValue,
  fetchSpeciesEnvironmentCategorySamples,
} from '@/data/api';
import { SpeciesDataSourceProvider } from '@/context/SpeciesDataSourceContext';
import type { SpeciesDataSource } from '@/data/speciesDataSource';
import type {
  SpeciesEnvironmentSliceResponse,
  SpeciesEnvironmentStats,
} from '@/data/types';
import { useEnvironmentHighlights } from '../useEnvironmentHighlights';

jest.mock('@/data/api', () => ({
  fetchEnvironmentRangeSlice: jest.fn(),
  fetchPointEnvironmentValue: jest.fn(),
  fetchSpeciesEnvironmentCategorySamples: jest.fn(),
}));

const mockFetchEnvironmentRangeSlice = jest.mocked(fetchEnvironmentRangeSlice);
const mockFetchPointEnvironmentValue = jest.mocked(fetchPointEnvironmentValue);
const mockFetchSpeciesEnvironmentCategorySamples = jest.mocked(
  fetchSpeciesEnvironmentCategorySamples,
);
type EnvironmentHighlightsHookResult = ReturnType<
  typeof useEnvironmentHighlights
>;
type VariableProps = { variable: string };
type MockCategoryResponse = { observations: { catalogNumber: string }[] };
type PinnedProps = {
  pinnedObservation: { catalogNumber: string; lat: number; lon: number } | null;
};
// Slightly above the hook debounce (200ms) so debounced work reliably flushes in tests.
const DEBOUNCE_SETTLE_MS = 220;
const STALE_CATEGORY_CATALOG = 'STALE_CATEGORY_CATALOG';
const FRESH_CATEGORY_CATALOG = 'FRESH_CATEGORY_CATALOG';
const LIVE_CATEGORY_CATALOG = 'LIVE_CATEGORY_CATALOG';
const STALE_RANGE_CATALOG = 'STALE_RANGE_CATALOG';

const continuousStats: SpeciesEnvironmentStats = {
  speciesId: 1,
  variable: 'bio_1',
  variableName: 'Annual Temperature',
  units: 'C',
  variableType: 'continuous',
  summary: { count: 10, min: 1, mean: 5, max: 10, q01: 1, q99: 10 },
  histogram: { bins: [0, 5, 10], counts: [2, 8] },
  densityCurve: { points: [1, 5, 10], density: [0.2, 0.8, 0.2] },
  relativeRanks: [],
};

const categoricalStats: SpeciesEnvironmentStats = {
  speciesId: 1,
  variable: 'landcover',
  variableName: 'Land Cover',
  units: null,
  variableType: 'categorical',
  summary: { count: 5, min: null, mean: null, max: null, q01: null, q99: null },
  histogram: null,
  densityCurve: null,
  categoricalDistribution: [
    { value: 'forest', className: 'Forest', count: 5, fraction: 1 },
  ],
  categoricalSamples: [{ value: 'forest', observationIds: ['A1', 'B2'] }],
  relativeRanks: [],
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useEnvironmentHighlights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockFetchEnvironmentRangeSlice.mockResolvedValue({
      speciesId: 1,
      variable: 'bio_1',
      range: { min: 1, max: 2 },
      limit: null,
      count: 1,
      observations: [
        { catalogNumber: '42', value: 1.5, latitude: 0, longitude: 0 },
      ],
    } satisfies SpeciesEnvironmentSliceResponse);
    mockFetchPointEnvironmentValue.mockResolvedValue({
      variable: 'bio_1',
      units: 'C',
      lat: 40.2,
      lon: -105.1,
      value: 3.5,
      valueLabel: null,
      valueDescription: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses preloaded categorical sample IDs and ignores malformed preloads', async () => {
    const onHighlightChange = jest.fn();
    const statsWithMalformed: SpeciesEnvironmentStats = {
      ...categoricalStats,
      categoricalSamples: [
        { value: 'forest', observationIds: ['A1', 'B2'] },
        { value: 'bad', observationIds: [] },
      ],
    };

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: statsWithMalformed,
        isCategorical: true,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['A1', 'B2']),
    );
    expect(mockFetchSpeciesEnvironmentCategorySamples).not.toHaveBeenCalled();
  });

  it('supports function-updater category selection and preloaded resolution before cache sync', async () => {
    const onHighlightChange = jest.fn();

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: categoricalStats,
        isCategorical: true,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue((previous) =>
        previous ? null : 'forest',
      );
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['A1', 'B2']),
    );
  });

  it('clears category selection when selecting the same value again', async () => {
    const onHighlightChange = jest.fn();

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: categoricalStats,
        isCategorical: true,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['A1', 'B2']),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
    expect(result.current.selectedCategoryValue).toBeNull();
  });

  it('emits empty highlights when categorical fetch is bypassed by missing categorical conditions', async () => {
    const onHighlightChange = jest.fn();

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: undefined,
        selectedVariable: 'landcover',
        stats: categoricalStats,
        isCategorical: false,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
    expect(mockFetchSpeciesEnvironmentCategorySamples).not.toHaveBeenCalled();
  });

  it('skips preloaded category cache hydration when location filtering is active', async () => {
    const onHighlightChange = jest.fn();
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValueOnce({
      observations: [
        {
          catalogNumber: 'LOC-1',
          value: null,
          latitude: null,
          longitude: null,
        },
      ],
    } as never);

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: categoricalStats,
        isCategorical: true,
        locationGid: 'USA.1_1',
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledTimes(
        1,
      ),
    );
    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['LOC-1']),
    );
  });

  it('emits empty highlights via non-categorical early return when preloaded path is unavailable', async () => {
    const onHighlightChange = jest.fn();

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: { ...categoricalStats, categoricalSamples: [] },
        isCategorical: false,
        locationGid: 'USA.1_1',
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
    expect(mockFetchSpeciesEnvironmentCategorySamples).not.toHaveBeenCalled();
  });

  it('ignores stale category request success responses', async () => {
    const onHighlightChange = jest.fn();
    const first = createDeferred<MockCategoryResponse>();
    const second = createDeferred<MockCategoryResponse>();

    mockFetchSpeciesEnvironmentCategorySamples
      .mockImplementationOnce(() => first.promise as never)
      .mockImplementationOnce(() => second.promise as never);

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: { ...categoricalStats, categoricalSamples: [] },
        isCategorical: true,
        locationGid: 'USA.1_1',
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
      result.current.setSelectedCategoryValue('desert');
    });

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledTimes(
        2,
      ),
    );

    await act(async () => {
      first.resolve({
        observations: [{ catalogNumber: STALE_CATEGORY_CATALOG }],
      });
      await Promise.resolve();
    });

    expect(onHighlightChange).not.toHaveBeenCalledWith([
      STALE_CATEGORY_CATALOG,
    ]);

    await act(async () => {
      second.resolve({
        observations: [{ catalogNumber: FRESH_CATEGORY_CATALOG }],
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith([FRESH_CATEGORY_CATALOG]),
    );
  });

  it('ignores stale category request failure responses', async () => {
    const onHighlightChange = jest.fn();
    const first = createDeferred<MockCategoryResponse>();
    const second = createDeferred<MockCategoryResponse>();

    mockFetchSpeciesEnvironmentCategorySamples
      .mockImplementationOnce(() => first.promise as never)
      .mockImplementationOnce(() => second.promise as never);

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: { ...categoricalStats, categoricalSamples: [] },
        isCategorical: true,
        locationGid: 'USA.1_1',
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
      result.current.setSelectedCategoryValue('desert');
    });

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledTimes(
        2,
      ),
    );

    const callsBeforeStaleReject = onHighlightChange.mock.calls.length;

    await act(async () => {
      first.reject(new Error('old request failed'));
      await Promise.resolve();
    });

    expect(onHighlightChange.mock.calls.length).toBe(callsBeforeStaleReject);

    await act(async () => {
      second.resolve({
        observations: [{ catalogNumber: LIVE_CATEGORY_CATALOG }],
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith([LIVE_CATEGORY_CATALOG]),
    );
  });

  it('falls back to generic error handling for non-Error category fetch rejections', async () => {
    const onHighlightChange = jest.fn();
    mockFetchSpeciesEnvironmentCategorySamples.mockRejectedValueOnce(
      'network down',
    );

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: { ...categoricalStats, categoricalSamples: [] },
        isCategorical: true,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledTimes(
        1,
      ),
    );
    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
  });

  it('filters invalid catalog IDs from category API observations before emitting highlights', async () => {
    const onHighlightChange = jest.fn();
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValueOnce({
      observations: [
        {
          catalogNumber: 'CAT-1',
          value: null,
          latitude: null,
          longitude: null,
        },
        { catalogNumber: 2, value: null, latitude: null, longitude: null },
        { catalogNumber: null, value: null, latitude: null, longitude: null },
        {
          catalogNumber: undefined,
          value: null,
          latitude: null,
          longitude: null,
        },
        {
          catalogNumber: true as any,
          value: null,
          latitude: null,
          longitude: null,
        },
        {
          catalogNumber: { id: 'OBJ-1' } as any,
          value: null,
          latitude: null,
          longitude: null,
        },
      ],
    } as never);

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: { ...categoricalStats, categoricalSamples: [] },
        isCategorical: true,
        locationGid: 'USA.1_1',
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledTimes(
        1,
      ),
    );
    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['CAT-1', 2]),
    );
  });

  it('fetches category observations when no matching preloaded category sample exists', async () => {
    const onHighlightChange = jest.fn();
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValueOnce({
      observations: [
        {
          catalogNumber: 'FETCH-1',
          value: null,
          latitude: null,
          longitude: null,
        },
      ],
    } as never);

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: {
          ...categoricalStats,
          categoricalSamples: [{ value: 'desert', observationIds: ['D-1'] }],
        },
        isCategorical: true,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledTimes(
        1,
      ),
    );
    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['FETCH-1']),
    );
  });

  it('preserves loaded cached category observations when stats rerender with duplicate preloaded ids', async () => {
    const onHighlightChange = jest.fn();

    const { result, rerender } = renderHook<
      EnvironmentHighlightsHookResult,
      { stats: SpeciesEnvironmentStats }
    >(
      ({ stats }) =>
        useEnvironmentHighlights({
          taxonId: 1,
          selectedVariable: 'landcover',
          stats,
          isCategorical: true,
          onHighlightChange,
        }),
      {
        initialProps: { stats: categoricalStats },
      },
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['A1', 'B2']),
    );

    rerender({
      stats: {
        ...categoricalStats,
        categoricalSamples: [
          { value: 'forest', observationIds: ['NEW-1', 'NEW-2'] },
        ],
      },
    });

    act(() => {
      result.current.setSelectedCategoryValue(null);
    });

    await waitFor(() => expect(onHighlightChange).toHaveBeenLastCalledWith([]));

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenLastCalledWith(['A1', 'B2']),
    );
    expect(mockFetchSpeciesEnvironmentCategorySamples).not.toHaveBeenCalled();
  });

  it('emits empty highlights when category API omits observations', async () => {
    const onHighlightChange = jest.fn();
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValueOnce(
      {} as never,
    );

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: { ...categoricalStats, categoricalSamples: [] },
        isCategorical: true,
        locationGid: 'USA.1_1',
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledTimes(
        1,
      ),
    );
    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
  });

  it('clears highlights when category selection is explicitly reset to null', async () => {
    const onHighlightChange = jest.fn();

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'landcover',
        stats: categoricalStats,
        isCategorical: true,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['A1', 'B2']),
    );

    act(() => {
      result.current.setSelectedCategoryValue(null);
    });

    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
    expect(result.current.selectedCategoryValue).toBeNull();
  });

  it('cancels in-flight debounced range slice updates on dependency changes (success and failure)', async () => {
    const onHighlightChange = jest.fn();
    const firstSlice = createDeferred<SpeciesEnvironmentSliceResponse>();
    const secondSlice = createDeferred<SpeciesEnvironmentSliceResponse>();

    mockFetchEnvironmentRangeSlice
      .mockImplementationOnce(() => firstSlice.promise)
      .mockImplementationOnce(() => secondSlice.promise);

    const { result, rerender } = renderHook<
      EnvironmentHighlightsHookResult,
      VariableProps
    >(
      ({ variable }) =>
        useEnvironmentHighlights({
          taxonId: 1,
          selectedVariable: variable,
          stats: continuousStats,
          isCategorical: false,
          onHighlightChange,
        }),
      {
        initialProps: { variable: 'bio_1' },
      },
    );

    act(() => {
      result.current.handleDensitySelectionChange({ start: 1, end: 2 });
      jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
    });

    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledTimes(1),
    );

    rerender({ variable: 'bio_2' });

    await act(async () => {
      firstSlice.resolve({
        speciesId: 1,
        variable: 'bio_1',
        range: { min: 1, max: 2 },
        limit: null,
        count: 1,
        observations: [
          {
            catalogNumber: STALE_RANGE_CATALOG,
            value: 1.5,
            latitude: 0,
            longitude: 0,
          },
        ],
      });
      await Promise.resolve();
    });

    expect(onHighlightChange).not.toHaveBeenCalledWith([STALE_RANGE_CATALOG]);

    act(() => {
      result.current.handleDensitySelectionChange({ start: 3, end: 4 });
      jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
    });

    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      secondSlice.reject(new Error('failed new slice'));
      await Promise.resolve();
    });

    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
  });

  it('ignores rejected range slice responses when request is cancelled', async () => {
    const onHighlightChange = jest.fn();
    const deferred = createDeferred<SpeciesEnvironmentSliceResponse>();
    mockFetchEnvironmentRangeSlice.mockImplementationOnce(
      () => deferred.promise,
    );

    const { result, rerender } = renderHook<
      EnvironmentHighlightsHookResult,
      VariableProps
    >(
      ({ variable }) =>
        useEnvironmentHighlights({
          taxonId: 1,
          selectedVariable: variable,
          stats: continuousStats,
          isCategorical: false,
          onHighlightChange,
        }),
      {
        initialProps: { variable: 'bio_1' },
      },
    );

    act(() => {
      result.current.handleDensitySelectionChange({ start: 1, end: 2 });
      jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
    });

    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledTimes(1),
    );

    rerender({ variable: 'bio_2' });
    const callsBeforeReject = onHighlightChange.mock.calls.length;

    await act(async () => {
      deferred.reject(new Error('cancelled request should be ignored'));
      await Promise.resolve();
    });

    expect(onHighlightChange.mock.calls.length).toBe(callsBeforeReject);
  });

  it('emits empty highlights when range slice observations are missing or invalid', async () => {
    const onHighlightChange = jest.fn();
    mockFetchEnvironmentRangeSlice
      .mockResolvedValueOnce({
        speciesId: 1,
        variable: 'bio_1',
        range: { min: 1, max: 2 },
        limit: null,
        count: 0,
      } as SpeciesEnvironmentSliceResponse)
      .mockResolvedValueOnce({
        speciesId: 1,
        variable: 'bio_1',
        range: { min: 3, max: 4 },
        limit: null,
        count: 1,
        observations: [
          { catalogNumber: null, value: 3.5, latitude: 0, longitude: 0 },
        ] as never,
      } as SpeciesEnvironmentSliceResponse);

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'bio_1',
        stats: continuousStats,
        isCategorical: false,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.handleDensitySelectionChange({ start: 1, end: 2 });
      jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
    });

    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));

    act(() => {
      result.current.handleDensitySelectionChange({ start: 3, end: 4 });
      jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
    });

    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
  });

  it('loads pinned values and updates loading state for pinned observations', async () => {
    jest.useRealTimers();
    try {
      mockFetchPointEnvironmentValue.mockResolvedValue({
        variable: 'bio_1',
        units: 'C',
        lat: 40.2,
        lon: -105.1,
        value: 7.25,
        valueLabel: null,
        valueDescription: null,
      });

      const { result } = renderHook(() =>
        useEnvironmentHighlights({
          taxonId: 1,
          selectedVariable: 'bio_1',
          stats: continuousStats,
          isCategorical: false,
          pinnedObservation: { catalogNumber: 'PIN-1', lat: 40.2, lon: -105.1 },
        }),
      );

      expect(mockFetchPointEnvironmentValue).toHaveBeenCalledWith(
        40.2,
        -105.1,
        'bio_1',
        { units: undefined, taxonId: 1, catalogNumber: 'PIN-1' },
      );

      await waitFor(() => {
        expect(result.current.pinnedValue).toBe(7.25);
        expect(result.current.pinnedLoading).toBe(false);
      });
    } finally {
      jest.useFakeTimers();
    }
  });

  it('uses the species data source pinned-value lookup when available', async () => {
    jest.useRealTimers();
    try {
      const localDataSource = {
        fetchEnvironmentVariables: jest.fn(),
        fetchSpeciesEnvironment: jest.fn(),
        fetchEnvironmentRangeSlice: jest.fn(),
        fetchSpeciesEnvironmentCategorySamples: jest.fn(),
        fetchObservationEnvironmentValue: jest.fn().mockResolvedValue({
          variable: 'landcover',
          value: 'forest',
          valueLabel: 'Forest',
          valueDescription: 'Dense tree cover',
          units: null,
        }),
        fetchSpeciesOccurrences: jest.fn(),
        fetchSpeciesLocations: jest.fn(),
      } as unknown as SpeciesDataSource;

      const SpeciesDataSourceProviderComponent =
        SpeciesDataSourceProvider as React.ComponentType<{
          value: SpeciesDataSource;
          children?: React.ReactNode;
        }>;
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          SpeciesDataSourceProviderComponent,
          { value: localDataSource },
          children,
        );

      const { result } = renderHook(
        () =>
          useEnvironmentHighlights({
            taxonId: 1,
            selectedVariable: 'landcover',
            stats: categoricalStats,
            isCategorical: true,
            pinnedObservation: {
              catalogNumber: 'PIN-1',
              lat: 40.2,
              lon: -105.1,
            },
          }),
        { wrapper },
      );

      await waitFor(() => {
        expect(
          localDataSource.fetchObservationEnvironmentValue,
        ).toHaveBeenCalledWith(1, 'PIN-1', 'landcover', {
          location: undefined,
          units: undefined,
        });
        expect(result.current.pinnedValue).toBe('forest');
        expect(result.current.pinnedLoading).toBe(false);
      });

      expect(mockFetchPointEnvironmentValue).not.toHaveBeenCalled();
    } finally {
      jest.useFakeTimers();
    }
  });

  it('falls back to coordinate lookup for synthetic map-click pins even when a local data source is present', async () => {
    jest.useRealTimers();
    try {
      mockFetchPointEnvironmentValue.mockResolvedValue({
        variable: 'bio_1',
        units: 'C',
        lat: 40.2,
        lon: -105.1,
        value: 7.25,
        valueLabel: null,
        valueDescription: null,
      });

      const localDataSource = {
        fetchEnvironmentVariables: jest.fn(),
        fetchSpeciesEnvironment: jest.fn(),
        fetchEnvironmentRangeSlice: jest.fn(),
        fetchSpeciesEnvironmentCategorySamples: jest.fn(),
        fetchObservationEnvironmentValue: jest.fn(),
        fetchSpeciesOccurrences: jest.fn(),
        fetchSpeciesLocations: jest.fn(),
      } as unknown as SpeciesDataSource;

      const SpeciesDataSourceProviderComponent =
        SpeciesDataSourceProvider as React.ComponentType<{
          value: SpeciesDataSource;
          children?: React.ReactNode;
        }>;
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          SpeciesDataSourceProviderComponent,
          { value: localDataSource },
          children,
        );

      const { result } = renderHook(
        () =>
          useEnvironmentHighlights({
            taxonId: 1,
            selectedVariable: 'bio_1',
            stats: continuousStats,
            isCategorical: false,
            pinnedObservation: {
              catalogNumber: 'point:40.200000,-105.100000',
              lat: 40.2,
              lon: -105.1,
            },
          }),
        { wrapper },
      );

      await waitFor(() => {
        expect(mockFetchPointEnvironmentValue).toHaveBeenCalledWith(
          40.2,
          -105.1,
          'bio_1',
          {
            units: undefined,
          },
        );
        expect(
          localDataSource.fetchObservationEnvironmentValue,
        ).not.toHaveBeenCalled();
        expect(result.current.pinnedValue).toBe(7.25);
        expect(result.current.pinnedLoading).toBe(false);
      });
    } finally {
      jest.useFakeTimers();
    }
  });

  it('ignores stale pinned responses after pinned observation changes', async () => {
    const first = createDeferred<{
      value: number | string | null;
      valueLabel?: string | null;
      valueDescription?: string | null;
    }>();
    const second = createDeferred<{
      value: number | string | null;
      valueLabel?: string | null;
      valueDescription?: string | null;
    }>();
    mockFetchPointEnvironmentValue
      .mockImplementationOnce(() => first.promise as never)
      .mockImplementationOnce(() => second.promise as never);

    const { result, rerender } = renderHook<
      EnvironmentHighlightsHookResult,
      PinnedProps
    >(
      ({ pinnedObservation }) =>
        useEnvironmentHighlights({
          taxonId: 1,
          selectedVariable: 'bio_1',
          stats: continuousStats,
          isCategorical: false,
          pinnedObservation,
        }),
      {
        initialProps: {
          pinnedObservation: { catalogNumber: 'PIN-1', lat: 40.2, lon: -105.1 },
        },
      },
    );

    await waitFor(() =>
      expect(mockFetchPointEnvironmentValue).toHaveBeenCalledTimes(1),
    );

    rerender({
      pinnedObservation: { catalogNumber: 'PIN-2', lat: 40.3, lon: -105.2 },
    });
    await waitFor(() =>
      expect(mockFetchPointEnvironmentValue).toHaveBeenCalledTimes(2),
    );

    await act(async () => {
      first.resolve({ value: 1.11, valueLabel: null, valueDescription: null });
      await Promise.resolve();
    });

    expect(result.current.pinnedValue).toBeNull();

    await act(async () => {
      second.resolve({ value: 8.88, valueLabel: null, valueDescription: null });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.pinnedValue).toBe(8.88);
      expect(result.current.pinnedLoading).toBe(false);
    });
  });

  it('resets pinned value to null when pinned fetch fails or pin is cleared', async () => {
    mockFetchPointEnvironmentValue.mockRejectedValueOnce(
      new Error('pin failed'),
    );

    const { result, rerender } = renderHook<
      EnvironmentHighlightsHookResult,
      PinnedProps
    >(
      ({ pinnedObservation }) =>
        useEnvironmentHighlights({
          taxonId: 1,
          selectedVariable: 'bio_1',
          stats: continuousStats,
          isCategorical: false,
          pinnedObservation,
        }),
      {
        initialProps: {
          pinnedObservation: { catalogNumber: 'PIN-1', lat: 40.2, lon: -105.1 },
        },
      },
    );

    await waitFor(() =>
      expect(mockFetchPointEnvironmentValue).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => {
      expect(result.current.pinnedValue).toBeNull();
      expect(result.current.pinnedLoading).toBe(false);
    });

    rerender({ pinnedObservation: null });
    await waitFor(() => expect(result.current.pinnedValue).toBeNull());
  });

  it('ignores stale pinned success responses after the pin is cleared', async () => {
    const deferred = createDeferred<{
      value: number | string | null;
      valueLabel?: string | null;
      valueDescription?: string | null;
    }>();
    mockFetchPointEnvironmentValue.mockImplementationOnce(
      () => deferred.promise as never,
    );

    const { result, rerender } = renderHook<
      EnvironmentHighlightsHookResult,
      PinnedProps
    >(
      ({ pinnedObservation }) =>
        useEnvironmentHighlights({
          taxonId: 1,
          selectedVariable: 'bio_1',
          stats: continuousStats,
          isCategorical: false,
          pinnedObservation,
        }),
      {
        initialProps: {
          pinnedObservation: { catalogNumber: 'PIN-1', lat: 40.2, lon: -105.1 },
        },
      },
    );

    await waitFor(() =>
      expect(mockFetchPointEnvironmentValue).toHaveBeenCalledTimes(1),
    );
    expect(result.current.pinnedLoading).toBe(true);

    rerender({ pinnedObservation: null });

    await waitFor(() => {
      expect(result.current.pinnedValue).toBeNull();
      expect(result.current.pinnedLoading).toBe(false);
    });

    await act(async () => {
      deferred.resolve({
        value: 9.99,
        valueLabel: null,
        valueDescription: null,
      });
      await Promise.resolve();
    });

    expect(result.current.pinnedValue).toBeNull();
    expect(result.current.pinnedLoading).toBe(false);
  });

  it('issues a single range slice for a non-wrapping circular selection (start <= end)', async () => {
    const onHighlightChange = jest.fn();
    mockFetchEnvironmentRangeSlice.mockResolvedValue({
      speciesId: 1,
      variable: 'aspect_deg',
      range: { min: 45, max: 135 },
      limit: null,
      count: 1,
      observations: [
        { catalogNumber: 'E-1', value: 90, latitude: 1, longitude: 1 },
      ],
    } satisfies SpeciesEnvironmentSliceResponse);

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'aspect_deg',
        stats: continuousStats,
        isCategorical: false,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.handleDensitySelectionChange({ start: 45, end: 135 });
      jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['E-1']),
    );
    expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledTimes(1);
    expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledWith(
      expect.objectContaining({ min: 45, max: 135 }),
    );
  });

  it('issues two range slices and merges results for a wrap-around circular selection (start > end)', async () => {
    const onHighlightChange = jest.fn();
    mockFetchEnvironmentRangeSlice
      .mockResolvedValueOnce({
        speciesId: 1,
        variable: 'aspect_deg',
        range: { min: 315, max: 360 },
        limit: null,
        count: 1,
        observations: [
          { catalogNumber: 'NW-1', value: 340, latitude: 1, longitude: 1 },
        ],
      } satisfies SpeciesEnvironmentSliceResponse)
      .mockResolvedValueOnce({
        speciesId: 1,
        variable: 'aspect_deg',
        range: { min: 0, max: 45 },
        limit: null,
        count: 1,
        observations: [
          { catalogNumber: 'NE-1', value: 20, latitude: 2, longitude: 2 },
        ],
      } satisfies SpeciesEnvironmentSliceResponse);

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'aspect_deg',
        stats: continuousStats,
        isCategorical: false,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.handleDensitySelectionChange({ start: 315, end: 45 });
      jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
    });

    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledTimes(2),
    );

    expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledWith(
      expect.objectContaining({ min: 315, max: 360 }),
    );
    expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledWith(
      expect.objectContaining({ min: 0, max: 45 }),
    );

    await waitFor(() => {
      const emitted = onHighlightChange.mock.calls.at(-1)?.[0] as string[];
      expect(emitted).toEqual(expect.arrayContaining(['NW-1', 'NE-1']));
      expect(emitted).toHaveLength(2);
    });
  });

  it('deduplicates observations that appear in both slices of a wrap-around range', async () => {
    const onHighlightChange = jest.fn();
    const sharedObs = {
      catalogNumber: 'DUP-1',
      value: 0,
      latitude: 0,
      longitude: 0,
    };
    mockFetchEnvironmentRangeSlice
      .mockResolvedValueOnce({
        speciesId: 1,
        variable: 'aspect_deg',
        range: { min: 350, max: 360 },
        limit: null,
        count: 1,
        observations: [sharedObs],
      } satisfies SpeciesEnvironmentSliceResponse)
      .mockResolvedValueOnce({
        speciesId: 1,
        variable: 'aspect_deg',
        range: { min: 0, max: 10 },
        limit: null,
        count: 1,
        observations: [sharedObs],
      } satisfies SpeciesEnvironmentSliceResponse);

    const { result } = renderHook(() =>
      useEnvironmentHighlights({
        taxonId: 1,
        selectedVariable: 'aspect_deg',
        stats: continuousStats,
        isCategorical: false,
        onHighlightChange,
      }),
    );

    act(() => {
      result.current.handleDensitySelectionChange({ start: 350, end: 10 });
      jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
    });

    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledTimes(2),
    );

    await waitFor(() => {
      const emitted = onHighlightChange.mock.calls.at(-1)?.[0] as string[];
      expect(emitted).toEqual(['DUP-1']);
    });
  });

  it('defers category resolution until stats become available', async () => {
    const onHighlightChange = jest.fn();
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValueOnce({
      observations: [
        { catalogNumber: 'X-1', value: null, latitude: null, longitude: null },
      ],
    } as never);

    const { result, rerender } = renderHook<
      EnvironmentHighlightsHookResult,
      { stats: SpeciesEnvironmentStats | null }
    >(
      ({ stats }) =>
        useEnvironmentHighlights({
          taxonId: 1,
          selectedVariable: 'landcover',
          stats,
          isCategorical: true,
          locationGid: 'USA.1_1',
          onHighlightChange,
        }),
      {
        initialProps: { stats: null },
      },
    );

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    expect(mockFetchSpeciesEnvironmentCategorySamples).not.toHaveBeenCalled();

    rerender({ stats: { ...categoricalStats, categoricalSamples: [] } });

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledTimes(
        1,
      ),
    );
    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['X-1']),
    );
  });
});
