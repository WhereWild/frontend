// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

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

    // Switching variables while the bio_1 request is still pending stashes
    // it onto the chain — and since bio_2 has no selection of its own, the
    // chain-only fallback effect immediately issues its own (separate,
    // freshly-mocked, not the stale deferred) request for it. That's the
    // new chaining behavior working as intended, not the thing under test
    // here — this test only cares that the ORIGINAL, now-stale request's
    // later rejection has no further effect.
    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith(['42']));

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

  describe('chained slices across variable switches', () => {
    const variableAStats: SpeciesEnvironmentStats = {
      ...continuousStats,
      variable: 'bio_1',
    };
    const variableBStats: SpeciesEnvironmentStats = {
      ...continuousStats,
      variable: 'bio_2',
    };

    type ChainTestProps = {
      variable: string;
      stats: SpeciesEnvironmentStats;
      isCategorical: boolean;
      locationGid?: string | null;
      pinnedObservation?: {
        catalogNumber: string;
        lat: number;
        lon: number;
      } | null;
    };

    const renderChainHook = (
      onHighlightChange: jest.Mock,
      initialProps: ChainTestProps,
    ) =>
      renderHook<EnvironmentHighlightsHookResult, ChainTestProps>(
        ({ variable, stats, isCategorical, locationGid, pinnedObservation }) =>
          useEnvironmentHighlights({
            taxonId: 1,
            selectedVariable: variable,
            stats,
            isCategorical,
            locationGid,
            pinnedObservation,
            onHighlightChange,
          }),
        { initialProps },
      );

    it('stashes an active density range onto the chain when switching variables, and applies it as an extra filter for the next slice', async () => {
      const onHighlightChange = jest.fn();
      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'bio_1',
        stats: variableAStats,
        isCategorical: false,
      });

      act(() => {
        result.current.handleDensitySelectionChange({ start: 10, end: 20 });
      });
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
      });
      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
      );
      mockFetchEnvironmentRangeSlice.mockClear();

      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
      });

      expect(result.current.selectedDensityRange).toBeNull();
      expect(result.current.activeChain).toEqual([
        expect.objectContaining({
          variableId: 'bio_1',
          extra: { variableId: 'bio_1', min: 10, max: 20 },
        }),
      ]);

      act(() => {
        result.current.handleDensitySelectionChange({ start: 5, end: 8 });
      });
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
      });

      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
      );
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledWith(
        expect.objectContaining({
          variableId: 'bio_2',
          min: 5,
          max: 8,
          extra: [{ variableId: 'bio_1', min: 10, max: 20 }],
        }),
      );
    });

    it('applies the chained filter on its own when the new variable has no selection of its own yet — not the unfiltered view', async () => {
      const onHighlightChange = jest.fn();
      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'bio_1',
        stats: variableAStats,
        isCategorical: false,
      });

      act(() => {
        result.current.handleDensitySelectionChange({ start: 10, end: 20 });
      });
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
      });
      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
      );
      mockFetchEnvironmentRangeSlice.mockClear();

      // Switch variables and make NO new selection on bio_2 at all.
      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
      });

      // The stashed bio_1 filter alone should still be queried/applied —
      // not left as an unfiltered "pulls up the full thing" view.
      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledWith(
          expect.objectContaining({
            variableId: 'bio_1',
            min: 10,
            max: 20,
            extra: [],
          }),
        ),
      );
      await waitFor(() =>
        expect(onHighlightChange).toHaveBeenLastCalledWith(['42']),
      );
    });

    it('combines two chained filters (no live selection on either variable) by treating the first as primary and the rest as extra', async () => {
      const onHighlightChange = jest.fn();
      const variableCStats: SpeciesEnvironmentStats = {
        ...categoricalStats,
        variable: 'landcover',
        categoricalDistribution: [
          { value: 'class_52', className: 'Forest', count: 5, fraction: 1 },
        ],
      };
      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'bio_1',
        stats: variableAStats,
        isCategorical: false,
      });

      act(() => {
        result.current.handleDensitySelectionChange({ start: 10, end: 20 });
      });
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
      });
      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
      );

      rerender({
        variable: 'landcover',
        stats: variableCStats,
        isCategorical: true,
      });
      act(() => {
        result.current.setSelectedCategoryValue('class_52');
      });
      await waitFor(() =>
        expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalled(),
      );
      mockFetchEnvironmentRangeSlice.mockClear();
      mockFetchSpeciesEnvironmentCategorySamples.mockClear();

      // Switch to a THIRD variable with no selection of its own — both
      // bio_1's range and landcover's class are now chained. bio_1 was
      // stashed first (still index 0 in the chain, since a later stash
      // only appends), so it's the one treated as primary; landcover rides
      // along as `extra`.
      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
      });

      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledWith(
          expect.objectContaining({
            variableId: 'bio_1',
            min: 10,
            max: 20,
            extra: [{ variableId: 'landcover', classValue: 52 }],
          }),
        ),
      );
      expect(mockFetchSpeciesEnvironmentCategorySamples).not.toHaveBeenCalled();
    });

    it('restores a chained range as the live selection when switching back to that variable', async () => {
      const onHighlightChange = jest.fn();
      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'bio_1',
        stats: variableAStats,
        isCategorical: false,
      });

      act(() => {
        result.current.handleDensitySelectionChange({ start: 10, end: 20 });
      });
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
      });
      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
      );

      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
      });
      expect(result.current.activeChain).toHaveLength(1);

      rerender({
        variable: 'bio_1',
        stats: variableAStats,
        isCategorical: false,
      });

      expect(result.current.activeChain).toHaveLength(0);
      expect(result.current.selectedDensityRange).toEqual({
        start: 10,
        end: 20,
      });
    });

it('does not chain a categorical selection whose value has no resolvable numeric class code', async () => {
      const onHighlightChange = jest.fn();
      mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
        speciesId: 1,
        variable: 'landcover',
        classValue: 'forest',
        count: 2,
        observations: [
          { catalogNumber: 'A1', value: null, latitude: 0, longitude: 0 },
        ],
      } as never);

      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'landcover',
        stats: categoricalStats,
        isCategorical: true,
      });

      act(() => {
        result.current.setSelectedCategoryValue('forest');
      });
      // 'forest' is served from categoricalStats.categoricalSamples (the
      // preloaded fast path) here, not the network — wait on the highlight
      // callback instead of the fetch mock.
      await waitFor(() =>
        expect(onHighlightChange).toHaveBeenCalledWith(['A1', 'B2']),
      );

      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
      });

      expect(result.current.selectedCategoryValue).toBeNull();
      // 'forest' has no numeric class value on this fixture (a plain string,
      // no "class_"/numeric form) — there's nothing valid to send as an
      // `extra` classValue filter, so no chain entry is created at all
      // rather than one with a broken/undefined extra.
      expect(result.current.activeChain).toEqual([]);
    });

    it('resolves a numeric-coded categorical selection into a classValue extra filter', async () => {
      const onHighlightChange = jest.fn();
      const numericCategoricalStats: SpeciesEnvironmentStats = {
        ...categoricalStats,
        categoricalDistribution: [
          { value: 'class_52', className: 'Forest', count: 5, fraction: 1 },
        ],
        categoricalSamples: [
          { value: 'class_52', observationIds: ['A1', 'B2'] },
        ],
      };
      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'landcover',
        stats: numericCategoricalStats,
        isCategorical: true,
      });

      act(() => {
        result.current.setSelectedCategoryValue('class_52');
      });
      await waitFor(() =>
        expect(onHighlightChange).toHaveBeenCalledWith(['A1', 'B2']),
      );

      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
      });

      expect(result.current.activeChain).toEqual([
        expect.objectContaining({
          variableId: 'landcover',
          extra: { variableId: 'landcover', classValue: 52 },
        }),
      ]);
    });

    it('applies a chained categorical filter on its own when switching from one nominal variable to ANOTHER nominal variable with no selection yet', async () => {
      const onHighlightChange = jest.fn();
      const numericCategoricalStats: SpeciesEnvironmentStats = {
        ...categoricalStats,
        variable: 'landcover',
        categoricalDistribution: [
          { value: 'class_52', className: 'Forest', count: 5, fraction: 1 },
        ],
        categoricalSamples: [
          { value: 'class_52', observationIds: ['A1', 'B2'] },
        ],
      };
      const soilTextureStats: SpeciesEnvironmentStats = {
        ...categoricalStats,
        variable: 'soiltype',
        categoricalDistribution: [
          { value: 'class_1', className: 'Loam', count: 3, fraction: 1 },
        ],
        categoricalSamples: [],
      };
      mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
        speciesId: 1,
        variable: 'landcover',
        classValue: 52,
        count: 2,
        observations: [
          { catalogNumber: 'A1', value: null, latitude: 0, longitude: 0 },
          { catalogNumber: 'B2', value: null, latitude: 0, longitude: 0 },
        ],
      } as never);

      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'landcover',
        stats: numericCategoricalStats,
        isCategorical: true,
      });

      act(() => {
        result.current.setSelectedCategoryValue('class_52');
      });
      await waitFor(() =>
        expect(onHighlightChange).toHaveBeenCalledWith(['A1', 'B2']),
      );
      mockFetchSpeciesEnvironmentCategorySamples.mockClear();

      // Switch to ANOTHER categorical variable (isCategorical: true again,
      // unlike the sibling test above which switches to a continuous one)
      // with no selection made on it yet.
      rerender({
        variable: 'soiltype',
        stats: soilTextureStats,
        isCategorical: true,
      });

      expect(result.current.selectedCategoryValue).toBeNull();
      expect(result.current.activeChain).toEqual([
        expect.objectContaining({
          variableId: 'landcover',
          extra: { variableId: 'landcover', classValue: 52 },
        }),
      ]);

      await waitFor(() =>
        expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledWith(
          1,
          'landcover',
          52,
          expect.objectContaining({ extra: [] }),
        ),
      );
      // The map should stay showing just the chained subset — not fall back
      // to an empty/unfiltered highlight set.
      await waitFor(() =>
        expect(onHighlightChange).toHaveBeenLastCalledWith(['A1', 'B2']),
      );
    });

    it('clears the entire chain on a genuine context change like locationGid, not just on a variable switch', async () => {
      const onHighlightChange = jest.fn();
      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'bio_1',
        stats: variableAStats,
        isCategorical: false,
        locationGid: null,
      });

      act(() => {
        result.current.handleDensitySelectionChange({ start: 10, end: 20 });
      });
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
      });
      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
      );

      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
        locationGid: null,
      });
      expect(result.current.activeChain).toHaveLength(1);

      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
        locationGid: 'USA',
      });

      expect(result.current.activeChain).toHaveLength(0);
    });

    it('removeChainedFilter removes a single chained entry without touching others', async () => {
      const onHighlightChange = jest.fn();
      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'bio_1',
        stats: variableAStats,
        isCategorical: false,
      });

      act(() => {
        result.current.handleDensitySelectionChange({ start: 10, end: 20 });
      });
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
      });
      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
      );

      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
      });
      expect(result.current.activeChain).toHaveLength(1);

      act(() => {
        result.current.removeChainedFilter('bio_1');
      });

      expect(result.current.activeChain).toHaveLength(0);
    });

    it('never flashes an empty/unfiltered highlight when switching into a variable a chain will cover (no "all dots" flicker)', async () => {
      const onHighlightChange = jest.fn();
      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'bio_1',
        stats: variableAStats,
        isCategorical: false,
      });

      act(() => {
        result.current.handleDensitySelectionChange({ start: 10, end: 20 });
      });
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
      });
      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
      );
      onHighlightChange.mockClear();

      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
      });

      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalledWith(
          expect.objectContaining({ variableId: 'bio_1' }),
        ),
      );
      // Not even transiently — every call across the whole switch should
      // carry the chained (non-empty) result, never a bare [] in between.
      for (const call of onHighlightChange.mock.calls) {
        expect(call[0]).not.toEqual([]);
      }
    });

    it('never flashes an empty highlight when switching back to a variable being restored from the chain', async () => {
      const onHighlightChange = jest.fn();
      const { result, rerender } = renderChainHook(onHighlightChange, {
        variable: 'bio_1',
        stats: variableAStats,
        isCategorical: false,
      });

      act(() => {
        result.current.handleDensitySelectionChange({ start: 10, end: 20 });
      });
      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
      });
      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
      );

      rerender({
        variable: 'bio_2',
        stats: variableBStats,
        isCategorical: false,
      });
      await waitFor(() => expect(result.current.activeChain).toHaveLength(1));
      onHighlightChange.mockClear();
      mockFetchEnvironmentRangeSlice.mockClear();

      // Switch back to bio_1 — its slice should be restored as the live
      // selection, not left chained, and never flash empty in between.
      rerender({
        variable: 'bio_1',
        stats: variableAStats,
        isCategorical: false,
      });
      expect(result.current.selectedDensityRange).toEqual({
        start: 10,
        end: 20,
      });

      act(() => {
        jest.advanceTimersByTime(DEBOUNCE_SETTLE_MS);
      });
      await waitFor(() =>
        expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
      );
      for (const call of onHighlightChange.mock.calls) {
        expect(call[0]).not.toEqual([]);
      }
    });

    it('does not read a pinned observation value from rangeObservations populated by a DIFFERENT (chained) variable\'s fallback fetch', async () => {
      jest.useRealTimers();
      try {
        const onHighlightChange = jest.fn();
        // landcover=52 chained, matching the reported scenario ("filtering
        // to only ...") — its category-samples response's observations
        // carry landcover's own class code (52) as `value`, not bio_1's.
        mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
          speciesId: 1,
          variable: 'landcover',
          classValue: 52,
          count: 1,
          observations: [
            { catalogNumber: 'PIN-1', value: 52, latitude: 0, longitude: 0 },
          ],
        } as never);
        // The real per-observation lookup for bio_1 at PIN-1 — the CORRECT
        // value, unrelated to landcover's class code.
        mockFetchPointEnvironmentValue.mockResolvedValue({
          variable: 'bio_1',
          units: 'F',
          lat: 40.2,
          lon: -105.1,
          value: 47.03,
          valueLabel: null,
          valueDescription: null,
        });

        const numericCategoricalStats: SpeciesEnvironmentStats = {
          ...categoricalStats,
          variable: 'landcover',
          categoricalDistribution: [
            { value: 'class_52', className: 'Forest', count: 5, fraction: 1 },
          ],
          categoricalSamples: [],
        };
        const { result, rerender } = renderChainHook(onHighlightChange, {
          variable: 'landcover',
          stats: numericCategoricalStats,
          isCategorical: true,
        });

        act(() => {
          result.current.setSelectedCategoryValue('class_52');
        });
        await waitFor(() =>
          expect(
            mockFetchSpeciesEnvironmentCategorySamples,
          ).toHaveBeenCalled(),
        );

        // Switch to bio_1 (numeric) with nothing selected on it — landcover
        // gets chained, and the chain-only fallback effect populates
        // rangeObservations from landcover's own fetch (class code 52),
        // not bio_1's.
        rerender({
          variable: 'bio_1',
          stats: variableAStats,
          isCategorical: false,
        });
        await waitFor(() =>
          expect(result.current.activeChain).toHaveLength(1),
        );

        // Now pin the SAME catalog number the chain fallback already has
        // in rangeObservations (value: 52) — this is the exact collision
        // the bug hit. Since nothing is selected on bio_1 itself
        // (selectedDensityRange is null), the pinned-value resolver must
        // not treat rangeObservations' value as bio_1's — it should fetch
        // bio_1's real value instead.
        rerender({
          variable: 'bio_1',
          stats: variableAStats,
          isCategorical: false,
          pinnedObservation: {
            catalogNumber: 'PIN-1',
            lat: 40.2,
            lon: -105.1,
          },
        });

        await waitFor(() => expect(result.current.pinnedValue).toBe(47.03));
        expect(result.current.pinnedValue).not.toBe(52);
      } finally {
        jest.useFakeTimers();
      }
    });
  });
});
