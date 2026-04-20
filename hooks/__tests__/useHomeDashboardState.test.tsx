import { act, renderHook, waitFor } from '@testing-library/react-native';
import { fetchSpeciesWithModels, fetchViewportScores } from '@/data/api';
import { useHomeDashboardState } from '../useHomeDashboardState';

jest.mock('@/data/api', () => ({
  fetchSpeciesWithModels: jest.fn(() => Promise.resolve([])),
  fetchViewportScores: jest.fn(() =>
    Promise.resolve({ scores: {}, reasons: {} }),
  ),
  BACKEND_BASE: 'https://api.test',
}));

const mockFetchSpeciesWithModels =
  fetchSpeciesWithModels as jest.MockedFunction<typeof fetchSpeciesWithModels>;
const mockFetchViewportScores = fetchViewportScores as jest.MockedFunction<
  typeof fetchViewportScores
>;

describe('useHomeDashboardState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('reports whether the homepage group filter is at its default value', () => {
    const { result } = renderHook(() =>
      useHomeDashboardState(undefined, { hydrateRemoteOnMount: false }),
    );
    const selectableGroup =
      result.current.allScored.find((item) => item.taxonGroup != null)
        ?.taxonGroup ?? 'all';

    expect(result.current.activeGroup).toBe('all');
    expect(result.current.hasActiveFilter).toBe(false);

    act(() => {
      result.current.setActiveGroup(selectableGroup);
    });

    expect(result.current.activeGroup).toBe(selectableGroup);
    expect(result.current.hasActiveFilter).toBe(selectableGroup !== 'all');

    act(() => {
      result.current.setActiveGroup('all');
    });

    expect(result.current.activeGroup).toBe('all');
    expect(result.current.hasActiveFilter).toBe(false);
  });

  it('normalizes invalid group selections in shared state', async () => {
    const data = {
      map: {
        heatmapImage: { uri: 'heatmap' },
        controlsImage: { uri: 'controls' },
      },
      recommendations: {
        items: [
          {
            taxonId: 101,
            commonName: 'Hydrated First',
            commonNames: ['Hydrated First'],
            scientificName: 'Hydratus firstus',
            description: '',
            imageSource: undefined,
            taxonGroup: 'plants',
          },
        ],
      },
    };

    const { result } = renderHook(() =>
      useHomeDashboardState(data, { hydrateRemoteOnMount: false }),
    );

    act(() => {
      result.current.setActiveGroup('birds');
    });

    await waitFor(() => {
      expect(result.current.activeGroup).toBe('all');
      expect(result.current.hasActiveFilter).toBe(false);
    });
  });

  it('preserves a valid active group when seed data changes', async () => {
    const initialData = {
      map: {
        heatmapImage: { uri: 'heatmap' },
        controlsImage: { uri: 'controls' },
      },
      recommendations: {
        items: [
          {
            taxonId: 101,
            commonName: 'Plant One',
            commonNames: ['Plant One'],
            scientificName: 'Plantus one',
            description: '',
            imageSource: undefined,
            taxonGroup: 'plants',
          },
          {
            taxonId: 202,
            commonName: 'Bird Two',
            commonNames: ['Bird Two'],
            scientificName: 'Birdus two',
            description: '',
            imageSource: undefined,
            taxonGroup: 'birds',
          },
        ],
      },
    };

    const updatedData = {
      map: {
        heatmapImage: { uri: 'updated-heatmap' },
        controlsImage: { uri: 'updated-controls' },
      },
      recommendations: {
        items: [
          {
            taxonId: 303,
            commonName: 'Plant Three',
            commonNames: ['Plant Three'],
            scientificName: 'Plantus three',
            description: '',
            imageSource: undefined,
            taxonGroup: 'plants',
          },
          {
            taxonId: 404,
            commonName: 'Bird Four',
            commonNames: ['Bird Four'],
            scientificName: 'Birdus four',
            description: '',
            imageSource: undefined,
            taxonGroup: 'birds',
          },
        ],
      },
    };

    const { result, rerender } = renderHook(
      ({ data }: { data: typeof initialData }) =>
        useHomeDashboardState(data, { hydrateRemoteOnMount: false }),
      {
        initialProps: { data: initialData },
      },
    );

    act(() => {
      result.current.setActiveGroup('plants');
    });

    expect(result.current.activeGroup).toBe('plants');
    expect(result.current.hasActiveFilter).toBe(true);

    rerender({ data: updatedData });

    await waitFor(() => {
      expect(result.current.activeGroup).toBe('plants');
      expect(result.current.hasActiveFilter).toBe(true);
      expect(result.current.allScored[0]?.commonName).toBe('Plant Three');
    });
  });

  it('preserves the initial active group until remote grouped data is available', async () => {
    mockFetchSpeciesWithModels.mockResolvedValueOnce([
      {
        taxon_id: 101,
        scientific_name: 'Hydratus firstus',
        common_name: 'Hydrated First',
        common_names: ['Hydrated First'],
        image_source: null,
        taxon_group: 'plants',
      },
      {
        taxon_id: 202,
        scientific_name: 'Hydratus secondus',
        common_name: 'Hydrated Second',
        common_names: ['Hydrated Second'],
        image_source: null,
        taxon_group: 'birds',
      },
    ] as never);

    const { result } = renderHook(() =>
      useHomeDashboardState(undefined, {
        initialActiveGroup: 'plants',
      }),
    );

    expect(result.current.activeGroup).toBe('plants');
    expect(result.current.hasActiveFilter).toBe(true);

    await waitFor(() => {
      expect(result.current.allScored.map((item) => item.taxonGroup)).toContain(
        'plants',
      );
      expect(result.current.activeGroup).toBe('plants');
      expect(result.current.hasActiveFilter).toBe(true);
    });
  });

  it('falls back to all when hydrated data does not contain the initial active group', async () => {
    mockFetchSpeciesWithModels.mockResolvedValueOnce([
      {
        taxon_id: 101,
        scientific_name: 'Hydratus firstus',
        common_name: 'Hydrated First',
        common_names: ['Hydrated First'],
        image_source: null,
        taxon_group: 'plants',
      },
    ] as never);

    const { result } = renderHook(() =>
      useHomeDashboardState(undefined, {
        initialActiveGroup: 'fungi',
      }),
    );

    expect(result.current.activeGroup).toBe('fungi');

    await waitFor(() => {
      expect(result.current.activeGroup).toBe('all');
      expect(result.current.hasActiveFilter).toBe(false);
    });
  });

  it('falls back to all when remote hydration resolves to an empty dataset', async () => {
    mockFetchSpeciesWithModels.mockResolvedValueOnce([] as never);

    const { result } = renderHook(() =>
      useHomeDashboardState(undefined, {
        initialActiveGroup: 'fungi',
      }),
    );

    expect(result.current.activeGroup).toBe('fungi');
    expect(result.current.hasActiveFilter).toBe(true);
    expect(result.current.heatmapTileUrl).toContain('&group=fungi');

    await waitFor(() => {
      expect(result.current.activeGroup).toBe('all');
      expect(result.current.hasActiveFilter).toBe(false);
      expect(result.current.heatmapTileUrl).not.toContain('&group=');
      expect(result.current.allScored).toEqual([]);
    });
  });

  it('can defer remote hydration without disabling it permanently', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesWithModels.mockResolvedValueOnce([
      {
        taxon_id: 101,
        scientific_name: 'Hydratus firstus',
        common_name: 'Hydrated First',
        common_names: ['Hydrated First'],
        image_source: null,
        taxon_group: 'plants',
      },
    ] as never);

    const { result } = renderHook(() =>
      useHomeDashboardState(undefined, { remoteHydrationDelayMs: 1500 }),
    );

    expect(mockFetchSpeciesWithModels).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1499);
    });

    expect(mockFetchSpeciesWithModels).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchSpeciesWithModels).toHaveBeenCalledTimes(1);
      expect(result.current.recommendations[0]?.commonName).toBe(
        'Hydrated First',
      );
    });
  });

  it('keeps recommendations aligned to the latest bounds when delayed hydration resolves', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesWithModels.mockResolvedValueOnce([
      {
        taxon_id: 101,
        scientific_name: 'Hydratus firstus',
        common_name: 'Hydrated First',
        common_names: ['Hydrated First'],
        image_source: null,
        taxon_group: 'plants',
      },
      {
        taxon_id: 202,
        scientific_name: 'Hydratus secondus',
        common_name: 'Hydrated Second',
        common_names: ['Hydrated Second'],
        image_source: null,
        taxon_group: 'birds',
      },
    ] as never);
    mockFetchViewportScores.mockResolvedValueOnce({
      scores: {},
      reasons: {},
    } as never);
    mockFetchViewportScores.mockResolvedValueOnce({
      scores: { '101': 0.1, '202': 0.9 },
      reasons: { '202': ['best match'] },
    } as never);

    const { result } = renderHook(() =>
      useHomeDashboardState(undefined, { remoteHydrationDelayMs: 1500 }),
    );

    act(() => {
      result.current.handleBoundsChange({
        z: 8,
        x0: 40,
        y0: 90,
        x1: 42,
        y1: 92,
      });
      jest.advanceTimersByTime(1200);
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetchSpeciesWithModels).toHaveBeenCalledTimes(1);
      expect(mockFetchViewportScores).toHaveBeenNthCalledWith(2, {
        z: 8,
        x0: 40,
        y0: 90,
        x1: 42,
        y1: 92,
      });
      expect(result.current.recommendations[0]?.commonName).toBe(
        'Hydrated Second',
      );
      expect(result.current.allScored[0]?.description).toBe('Best match');
    });
  });

  it('cancels delayed remote hydration on unmount', () => {
    jest.useFakeTimers();

    const { unmount } = renderHook(() =>
      useHomeDashboardState(undefined, { remoteHydrationDelayMs: 1500 }),
    );

    unmount();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockFetchSpeciesWithModels).not.toHaveBeenCalled();
  });

  it('falls back to hydrated species order when ranking latest bounds fails', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesWithModels.mockResolvedValueOnce([
      {
        taxon_id: 101,
        scientific_name: 'Hydratus firstus',
        common_name: 'Hydrated First',
        common_names: ['Hydrated First'],
        image_source: null,
        taxon_group: 'plants',
      },
      {
        taxon_id: 202,
        scientific_name: 'Hydratus secondus',
        common_name: 'Hydrated Second',
        common_names: ['Hydrated Second'],
        image_source: null,
        taxon_group: 'birds',
      },
    ] as never);
    mockFetchViewportScores.mockResolvedValueOnce({
      scores: {},
      reasons: {},
    } as never);
    mockFetchViewportScores.mockRejectedValueOnce(new Error('rank failed'));

    const { result } = renderHook(() =>
      useHomeDashboardState(undefined, { remoteHydrationDelayMs: 1500 }),
    );

    act(() => {
      result.current.handleBoundsChange({
        z: 8,
        x0: 40,
        y0: 90,
        x1: 42,
        y1: 92,
      });
      jest.advanceTimersByTime(1200);
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetchSpeciesWithModels).toHaveBeenCalledTimes(1);
      expect(
        result.current.recommendations.map((item) => item.commonName),
      ).toEqual(['Hydrated First', 'Hydrated Second']);
      expect(result.current.allScored[0]?.description).toBe('');
    });
  });

  it('ignores stale ranking results that resolve after delayed hydration applies a newer ranking', async () => {
    jest.useFakeTimers();

    let resolveSeedRanking:
      | ((value: Awaited<ReturnType<typeof fetchViewportScores>>) => void)
      | undefined;
    let resolveHydratedRanking:
      | ((value: Awaited<ReturnType<typeof fetchViewportScores>>) => void)
      | undefined;

    mockFetchSpeciesWithModels.mockResolvedValueOnce([
      {
        taxon_id: 101,
        scientific_name: 'Hydratus firstus',
        common_name: 'Hydrated First',
        common_names: ['Hydrated First'],
        image_source: null,
        taxon_group: 'plants',
      },
      {
        taxon_id: 202,
        scientific_name: 'Hydratus secondus',
        common_name: 'Hydrated Second',
        common_names: ['Hydrated Second'],
        image_source: null,
        taxon_group: 'birds',
      },
    ] as never);
    mockFetchViewportScores
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSeedRanking = resolve;
          }) as ReturnType<typeof fetchViewportScores>,
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveHydratedRanking = resolve;
          }) as ReturnType<typeof fetchViewportScores>,
      );

    const { result } = renderHook(() =>
      useHomeDashboardState(undefined, { remoteHydrationDelayMs: 1500 }),
    );

    act(() => {
      result.current.handleBoundsChange({
        z: 8,
        x0: 40,
        y0: 90,
        x1: 42,
        y1: 92,
      });
      jest.advanceTimersByTime(1200);
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetchSpeciesWithModels).toHaveBeenCalledTimes(1);
      expect(mockFetchViewportScores).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveHydratedRanking?.({
        scores: { '101': 0.1, '202': 0.9 },
        reasons: { '202': ['best match'] },
      } as never);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        result.current.recommendations.map((item) => item.commonName),
      ).toEqual(['Hydrated Second', 'Hydrated First']);
      expect(result.current.allScored[0]?.description).toBe('Best match');
    });

    await act(async () => {
      resolveSeedRanking?.({ scores: {}, reasons: {} } as never);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        result.current.recommendations.map((item) => item.commonName),
      ).toEqual(['Hydrated Second', 'Hydrated First']);
      expect(result.current.allScored[0]?.description).toBe('Best match');
    });
  });

  it('keeps the current order and clears loading when viewport scoring fails', async () => {
    jest.useFakeTimers();
    mockFetchViewportScores.mockRejectedValueOnce(new Error('score failed'));

    const data = {
      map: {
        heatmapImage: { uri: 'heatmap' },
        controlsImage: { uri: 'controls' },
      },
      recommendations: {
        items: [
          {
            taxonId: 101,
            commonName: 'Plant One',
            commonNames: ['Plant One'],
            scientificName: 'Plantus one',
            description: '',
            imageSource: undefined,
            taxonGroup: 'plants',
          },
          {
            taxonId: 202,
            commonName: 'Bird Two',
            commonNames: ['Bird Two'],
            scientificName: 'Birdus two',
            description: '',
            imageSource: undefined,
            taxonGroup: 'birds',
          },
        ],
      },
    };

    const { result } = renderHook(() =>
      useHomeDashboardState(data, { hydrateRemoteOnMount: false }),
    );

    act(() => {
      result.current.handleBoundsChange({
        z: 7,
        x0: 10,
        y0: 20,
        x1: 11,
        y1: 21,
      });
    });

    expect(result.current.scoresLoading).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    await waitFor(() => {
      expect(result.current.scoresLoading).toBe(false);
      expect(
        result.current.recommendations.map((item) => item.commonName),
      ).toEqual(['Plant One', 'Bird Two']);
    });
  });
});
