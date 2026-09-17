// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAutoAdaptRange } from '../useAutoAdaptRange';

const baseArgs = {
  units: 'metric',
  forecastH: 0,
  catalogRenderMin: 0,
  catalogRenderMax: 100,
};

describe('useAutoAdaptRange', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('reads the range from localRangeReader instead of fetching, when provided', async () => {
    const localRangeReader = jest.fn().mockReturnValue({ min: 5, max: 42 });
    const fetchSpy = jest.spyOn(global, 'fetch');
    const { result } = renderHook(() =>
      useAutoAdaptRange({
        ...baseArgs,
        selectedVariable: 'local-raster',
        isApplicable: true,
        localRangeReader,
      }),
    );

    act(() => result.current.toggleAutoAdapt());
    act(() =>
      result.current.handleBoundsChange({ z: 4, x0: 1, y0: 1, x1: 2, y1: 2 }),
    );
    act(() => jest.advanceTimersByTime(400));

    await waitFor(() => {
      expect(result.current.effectiveRenderMin).toBe(5);
      expect(result.current.effectiveRenderMax).toBe(42);
    });
    expect(localRangeReader).toHaveBeenCalledWith({
      z: 4,
      x0: 1,
      y0: 1,
      x1: 2,
      y1: 2,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps the previous range when localRangeReader returns null for the current viewport', async () => {
    const localRangeReader = jest
      .fn()
      .mockReturnValueOnce({ min: 5, max: 42 })
      .mockReturnValueOnce(null);
    const { result } = renderHook(() =>
      useAutoAdaptRange({
        ...baseArgs,
        selectedVariable: 'local-raster',
        isApplicable: true,
        localRangeReader,
      }),
    );

    act(() => result.current.toggleAutoAdapt());
    act(() =>
      result.current.handleBoundsChange({ z: 4, x0: 1, y0: 1, x1: 2, y1: 2 }),
    );
    act(() => jest.advanceTimersByTime(400));
    await waitFor(() => expect(result.current.effectiveRenderMax).toBe(42));

    act(() =>
      result.current.handleBoundsChange({ z: 6, x0: 9, y0: 9, x1: 9, y1: 9 }),
    );
    act(() => jest.advanceTimersByTime(400));

    expect(result.current.effectiveRenderMin).toBe(5);
    expect(result.current.effectiveRenderMax).toBe(42);
  });

  it('falls back to fetch()ing tile-range/stats when no localRangeReader is given', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ min: 1, max: 9 }),
    } as Response);
    const { result } = renderHook(() =>
      useAutoAdaptRange({
        ...baseArgs,
        selectedVariable: 'bio1',
        isApplicable: true,
      }),
    );

    act(() => result.current.toggleAutoAdapt());
    act(() =>
      result.current.handleBoundsChange({ z: 4, x0: 1, y0: 1, x1: 2, y1: 2 }),
    );
    act(() => jest.advanceTimersByTime(400));

    await waitFor(() => {
      expect(result.current.effectiveRenderMin).toBe(1);
      expect(result.current.effectiveRenderMax).toBe(9);
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/layers/bio1/tile-range/stats'),
    );
  });

  it('reports the catalog range while not applicable, regardless of localRangeReader', () => {
    const localRangeReader = jest.fn().mockReturnValue({ min: 5, max: 42 });
    const { result } = renderHook(() =>
      useAutoAdaptRange({
        ...baseArgs,
        selectedVariable: 'local-raster',
        isApplicable: false,
        localRangeReader,
      }),
    );

    expect(result.current.effectiveRenderMin).toBe(0);
    expect(result.current.effectiveRenderMax).toBe(100);
  });
});
