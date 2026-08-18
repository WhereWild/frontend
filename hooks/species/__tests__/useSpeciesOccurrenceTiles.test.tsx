// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SpeciesDataSourceProvider } from '@/context/SpeciesDataSourceContext';
import { createSpeciesDataSource } from '@/data/speciesDataSource';
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

describe('useSpeciesOccurrenceTiles', () => {
  it('fetches and merges every tile in the visible range, deduping by catalogNumber', async () => {
    const mockFetchTile = jest.fn(async (_taxonId, _z, x: number, y: number) => {
      if (x === 0 && y === 0) return [point(1, 10)];
      if (x === 1 && y === 0) return [point(1, 10), point(2, 20)];
      return [];
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

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const emptyFilters = {
      location: undefined,
      phenology: undefined,
      startTs: undefined,
      endTs: undefined,
    };
    expect(mockFetchTile).toHaveBeenCalledTimes(2);
    expect(mockFetchTile).toHaveBeenCalledWith('12', 3, 0, 0, emptyFilters);
    expect(mockFetchTile).toHaveBeenCalledWith('12', 3, 1, 0, emptyFilters);
    expect(result.current.occurrences).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('passes location/phenology/timestamp filters through to each tile fetch', async () => {
    const mockFetchTile = jest.fn(async () => []);
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
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchTile).toHaveBeenCalledWith('12', 3, 0, 0, {
      location: 'state-ut',
      phenology: 'flowers',
      startTs: 100,
      endTs: 200,
    });
  });

  it('does not fetch when disabled', async () => {
    const mockFetchTile = jest.fn(async () => []);
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
    const mockFetchTile = jest.fn(async () => []);
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
