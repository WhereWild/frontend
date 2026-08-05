// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchSpeciesOccurrences } from '@/data/api';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSpeciesOccurrences } from '../useSpeciesOccurrences';

jest.mock('@/data/api', () => ({
  fetchSpeciesOccurrences: jest.fn(),
}));

const mockFetchSpeciesOccurrences = jest.mocked(fetchSpeciesOccurrences);

describe('useSpeciesOccurrences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchSpeciesOccurrences.mockResolvedValue({ occurrences: [], minTimestamp: null, maxTimestamp: null, phenologyCounts: null });
  });

  it('loads occurrences for a valid taxon and location', async () => {
    mockFetchSpeciesOccurrences.mockResolvedValueOnce({
      occurrences: [{ catalogNumber: 1, latitude: 10, longitude: 20 }],
      minTimestamp: null,
      maxTimestamp: null,
      phenologyCounts: null,
    });

    const { result } = renderHook(() =>
      useSpeciesOccurrences({ taxonId: '12', locationGid: 'state-ut' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.occurrences).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    expect(mockFetchSpeciesOccurrences).toHaveBeenCalledWith(12, { location: 'state-ut' });
  });

  it('surfaces friendly fallback error for non-Error failures', async () => {
    mockFetchSpeciesOccurrences.mockRejectedValueOnce('network');

    const { result } = renderHook(() => useSpeciesOccurrences({ taxonId: '12', locationGid: null }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Failed to load observations.');
      expect(result.current.occurrences).toEqual([]);
    });
  });

  it('returns no error and does not call API when taxon is missing', async () => {
    const { result } = renderHook(() => useSpeciesOccurrences({ taxonId: undefined, locationGid: null }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.occurrences).toEqual([]);
    });

    expect(mockFetchSpeciesOccurrences).not.toHaveBeenCalled();
  });

  it('sets phenologyNoData true when phenology is active and counts are empty', async () => {
    mockFetchSpeciesOccurrences.mockResolvedValueOnce({
      occurrences: [],
      minTimestamp: null,
      maxTimestamp: null,
      phenologyCounts: {},
    });

    const { result } = renderHook(() =>
      useSpeciesOccurrences({ taxonId: '12', locationGid: 'state-ut', phenology: 'flowers' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.phenologyNoData).toBe(true);
    });
  });

  it('sets phenologyNoData false and updates phenologyCounts when no phenology filter', async () => {
    mockFetchSpeciesOccurrences.mockResolvedValueOnce({
      occurrences: [],
      minTimestamp: null,
      maxTimestamp: null,
      phenologyCounts: { flowers: 10, 'fruits or seeds': 5 },
    });

    const { result } = renderHook(() =>
      useSpeciesOccurrences({ taxonId: '12', locationGid: 'state-ut' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.phenologyNoData).toBe(false);
      expect(result.current.phenologyCounts).toEqual({ flowers: 10, 'fruits or seeds': 5 });
    });
  });

  it('sets phenologyNoData false when phenology is active and counts are non-empty', async () => {
    mockFetchSpeciesOccurrences.mockResolvedValueOnce({
      occurrences: [{ catalogNumber: 1, latitude: 10, longitude: 20 }],
      minTimestamp: null,
      maxTimestamp: null,
      phenologyCounts: { flowers: 3 },
    });

    const { result } = renderHook(() =>
      useSpeciesOccurrences({ taxonId: '12', locationGid: 'state-ut', phenology: 'flowers' }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.phenologyNoData).toBe(false);
    });
  });
});
