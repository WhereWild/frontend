// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SpeciesDataSourceProvider } from '@/context/SpeciesDataSourceContext';
import { createSpeciesDataSource } from '@/data/speciesDataSource';
import type { OccurrenceTileResult } from '@/data/apiEnvironmentHelpers';
import type { SpeciesOccurrence } from '@/data/types';
import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { useSpeciesOccurrenceTiles } from '../useSpeciesOccurrenceTiles';

// Hoisted to stable module-scope constants — renderHook's callback is the
// render body of an internal test component, so passing an inline object
// literal for tileRange gets a fresh reference every re-render the hook's
// own state updates cause, defeating the effect's referential-equality
// dependency check and looping forever.
const TILE_RANGE = { z: 3, x0: 0, y0: 0, x1: 1, y1: 0 };
const SINGLE_TILE_RANGE = { z: 3, x0: 0, y0: 0, x1: 0, y1: 0 };

const point = (catalogNumber: number, latitude: number): SpeciesOccurrence => ({
  catalogNumber,
  latitude,
  longitude: 0,
  mediaUrl: null,
  mediaAttribution: null,
  mediaLicense: null,
  mediaLicenseUrl: null,
});

const emptyTileResult = (): OccurrenceTileResult => ({
  occurrences: [],
  values: null,
  variableMin: null,
  variableMax: null,
  variableQ01: null,
  variableQ99: null,
});

const tileResult = (
  occurrences: SpeciesOccurrence[],
  overrides: Partial<OccurrenceTileResult> = {},
): OccurrenceTileResult => ({
  ...emptyTileResult(),
  occurrences,
  ...overrides,
});

describe('useSpeciesOccurrenceTiles', () => {
  it('fetches and merges every tile in the visible range, deduping by catalogNumber', async () => {
    const mockFetchTile = jest.fn(async (_taxonId, _z, x: number, y: number) => {
      if (x === 0 && y === 0) return tileResult([point(1, 10)]);
      if (x === 1 && y === 0) return tileResult([point(1, 10), point(2, 20)]);
      return emptyTileResult();
    });
    const dataSource = createSpeciesDataSource({
      fetchSpeciesOccurrenceTile: mockFetchTile,
    });

    const { result } = renderHook(
      () =>
        useSpeciesOccurrenceTiles({
          taxonId: '12',
          enabled: true,
          tileRange: TILE_RANGE,
        }),
      {
        wrapper: ({ children }) => (
          <SpeciesDataSourceProvider value={dataSource}>
            {children}
          </SpeciesDataSourceProvider>
        ),
      },
    );

    // Not `loading === false` — that's trivially true before the debounced
    // fetch even runs (loading starts false and only flips once runFetch
    // actually fires — see PAN_DEBOUNCE_MS). Wait on the real signal.
    await waitFor(() => {
      expect(mockFetchTile).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const emptyFilters = {
      location: undefined,
      phenology: undefined,
      startTs: undefined,
      endTs: undefined,
      variableId: undefined,
      unitSystem: undefined,
    };
    expect(mockFetchTile).toHaveBeenCalledTimes(2);
    expect(mockFetchTile).toHaveBeenCalledWith(
      '12', 3, 0, 0, emptyFilters, expect.any(AbortSignal),
    );
    expect(mockFetchTile).toHaveBeenCalledWith(
      '12', 3, 1, 0, emptyFilters, expect.any(AbortSignal),
    );
    expect(result.current.occurrences).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('passes location/phenology/timestamp filters through to each tile fetch', async () => {
    const mockFetchTile = jest.fn(async () => emptyTileResult());
    const dataSource = createSpeciesDataSource({
      fetchSpeciesOccurrenceTile: mockFetchTile,
    });

    const { result } = renderHook(
      () =>
        useSpeciesOccurrenceTiles({
          taxonId: '12',
          enabled: true,
          tileRange: SINGLE_TILE_RANGE,
          locationGid: 'state-ut',
          phenology: 'flowers',
          startTimestamp: 100,
          endTimestamp: 200,
        }),
      {
        wrapper: ({ children }) => (
          <SpeciesDataSourceProvider value={dataSource}>
            {children}
          </SpeciesDataSourceProvider>
        ),
      },
    );

    await waitFor(() => {
      expect(mockFetchTile).toHaveBeenCalled();
    });

    expect(mockFetchTile).toHaveBeenCalledWith(
      '12', 3, 0, 0,
      {
        location: 'state-ut',
        phenology: 'flowers',
        startTs: 100,
        endTs: 200,
        variableId: undefined,
        unitSystem: undefined,
      },
      expect.any(AbortSignal),
    );
  });

  it('merges per-point values and expands the color scale across fetches without shrinking', async () => {
    // First fetch: one tile, values 10-20. Second fetch (simulating a pan):
    // a different tile with a narrower range (12-15) plus a new point — the
    // scale should stay at 10-20 (not shrink to 12-15), and point 1's value
    // from the first fetch should still be there even though this batch
    // doesn't mention it.
    const mockFetchTile = jest
      .fn()
      .mockResolvedValueOnce(
        tileResult([point(1, 10), point(2, 20)], {
          values: new Map([
            ['1', 10],
            ['2', 20],
          ]),
          variableMin: 10,
          variableMax: 20,
          variableQ01: 10,
          variableQ99: 20,
        }),
      )
      .mockResolvedValueOnce(
        tileResult([point(3, 30)], {
          values: new Map([['3', 15]]),
          variableMin: 12,
          variableMax: 15,
          variableQ01: 12,
          variableQ99: 15,
        }),
      );
    const dataSource = createSpeciesDataSource({
      fetchSpeciesOccurrenceTile: mockFetchTile,
    });

    const { result, rerender } = renderHook(
      ({ tileRange }: { tileRange: typeof SINGLE_TILE_RANGE }) =>
        useSpeciesOccurrenceTiles({
          taxonId: '12',
          enabled: true,
          tileRange,
          variableId: 'bio1',
        }),
      {
        initialProps: { tileRange: SINGLE_TILE_RANGE },
        wrapper: ({ children }) => (
          <SpeciesDataSourceProvider value={dataSource}>
            {children}
          </SpeciesDataSourceProvider>
        ),
      },
    );

    await waitFor(() => {
      expect(mockFetchTile).toHaveBeenCalledTimes(1);
    });
    expect(result.current.dotMin).toBe(10);
    expect(result.current.dotMax).toBe(20);
    expect(result.current.observationValues?.get('1')).toBe(10);

    const secondTileRange = { z: 3, x0: 1, y0: 1, x1: 1, y1: 1 };
    rerender({ tileRange: secondTileRange });

    await waitFor(() => {
      expect(result.current.occurrences.some((o) => o.catalogNumber === 3)).toBe(
        true,
      );
    });

    // Scale expanded-only: still 10-20, not narrowed to 12-15.
    expect(result.current.dotMin).toBe(10);
    expect(result.current.dotMax).toBe(20);
    // Point 1's value from the first fetch is still remembered.
    expect(result.current.observationValues?.get('1')).toBe(10);
    expect(result.current.observationValues?.get('3')).toBe(15);
  });

  it('aborts a superseded batch instead of letting it run to completion', async () => {
    // First tile range's fetch never resolves on its own (simulating a
    // slow backend request) — the test asserts its signal gets aborted
    // once a newer tileRange supersedes it, rather than waiting for it to
    // "finish" naturally.
    let firstCallSignal: AbortSignal | undefined;
    const mockFetchTile = jest
      .fn()
      .mockImplementationOnce((..._args: unknown[]) => {
        firstCallSignal = _args[5] as AbortSignal;
        return new Promise(() => {}); // never resolves
      })
      .mockResolvedValue(emptyTileResult());
    const dataSource = createSpeciesDataSource({
      fetchSpeciesOccurrenceTile: mockFetchTile,
    });

    const { rerender } = renderHook(
      ({ tileRange }: { tileRange: typeof SINGLE_TILE_RANGE }) =>
        useSpeciesOccurrenceTiles({
          taxonId: '12',
          enabled: true,
          tileRange,
        }),
      {
        initialProps: { tileRange: SINGLE_TILE_RANGE },
        wrapper: ({ children }) => (
          <SpeciesDataSourceProvider value={dataSource}>
            {children}
          </SpeciesDataSourceProvider>
        ),
      },
    );

    await waitFor(() => {
      expect(mockFetchTile).toHaveBeenCalledTimes(1);
    });
    expect(firstCallSignal?.aborted).toBe(false);

    rerender({ tileRange: { z: 3, x0: 1, y0: 1, x1: 1, y1: 1 } });

    await waitFor(() => {
      expect(firstCallSignal?.aborted).toBe(true);
    });
  });

  it('does not fetch when disabled', async () => {
    const mockFetchTile = jest.fn(async () => emptyTileResult());
    const dataSource = createSpeciesDataSource({
      fetchSpeciesOccurrenceTile: mockFetchTile,
    });

    const { result } = renderHook(
      () =>
        useSpeciesOccurrenceTiles({
          taxonId: '12',
          enabled: false,
          tileRange: { z: 3, x0: 0, y0: 0, x1: 1, y1: 0 },
        }),
      {
        wrapper: ({ children }) => (
          <SpeciesDataSourceProvider value={dataSource}>
            {children}
          </SpeciesDataSourceProvider>
        ),
      },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchTile).not.toHaveBeenCalled();
    expect(result.current.occurrences).toEqual([]);
  });

  it('does not fetch when tileRange is null', async () => {
    const mockFetchTile = jest.fn(async () => emptyTileResult());
    const dataSource = createSpeciesDataSource({
      fetchSpeciesOccurrenceTile: mockFetchTile,
    });

    renderHook(
      () =>
        useSpeciesOccurrenceTiles({
          taxonId: '12',
          enabled: true,
          tileRange: null,
        }),
      {
        wrapper: ({ children }) => (
          <SpeciesDataSourceProvider value={dataSource}>
            {children}
          </SpeciesDataSourceProvider>
        ),
      },
    );

    expect(mockFetchTile).not.toHaveBeenCalled();
  });

  it('surfaces a friendly fallback error for non-Error failures', async () => {
    const dataSource = createSpeciesDataSource({
      fetchSpeciesOccurrenceTile: jest.fn(async () => {
        throw 'network';
      }),
    });

    const { result } = renderHook(
      () =>
        useSpeciesOccurrenceTiles({
          taxonId: '12',
          enabled: true,
          tileRange: SINGLE_TILE_RANGE,
        }),
      {
        wrapper: ({ children }) => (
          <SpeciesDataSourceProvider value={dataSource}>
            {children}
          </SpeciesDataSourceProvider>
        ),
      },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Failed to load observations.');
      expect(result.current.occurrences).toEqual([]);
    });
  });

  it('is a no-op when the data source has no tile fetcher', async () => {
    const dataSource = createSpeciesDataSource({
      fetchSpeciesOccurrenceTile: undefined,
    });

    const { result } = renderHook(
      () =>
        useSpeciesOccurrenceTiles({
          taxonId: '12',
          enabled: true,
          tileRange: SINGLE_TILE_RANGE,
        }),
      {
        wrapper: ({ children }) => (
          <SpeciesDataSourceProvider value={dataSource}>
            {children}
          </SpeciesDataSourceProvider>
        ),
      },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.occurrences).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
