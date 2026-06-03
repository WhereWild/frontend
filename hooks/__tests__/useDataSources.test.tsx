// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { fetchDataSources } from '@/data/api';
import { seedDataSourcesCache, useDataSources } from '../useDataSources';

jest.mock('@/data/api', () => ({
  fetchDataSources: jest.fn(),
}));

const mockFetchDataSources = fetchDataSources as jest.MockedFunction<
  typeof fetchDataSources
>;

describe('useDataSources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedDataSourcesCache({});
  });

  it('returns fetched sources once the request resolves', async () => {
    mockFetchDataSources.mockResolvedValueOnce({
      remote: {
        name: 'Remote Source',
        url: 'https://remote.example/data',
        license: 'CC BY 4.0',
        references: [],
      },
    });

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current).toEqual({
        remote: {
          name: 'Remote Source',
          url: 'https://remote.example/data',
          license: 'CC BY 4.0',
          references: [],
        },
      });
    });
  });

  it('merges fetched sources on top of the seeded cache', async () => {
    seedDataSourcesCache({
      seeded: {
        name: 'Seeded Source',
        url: 'https://seeded.example/data',
        license: 'CC BY 4.0',
        references: [],
      },
    });
    mockFetchDataSources.mockResolvedValueOnce({
      remote: {
        name: 'Remote Source',
        url: 'https://remote.example/data',
        license: 'CC BY 4.0',
        references: [],
      },
    });

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(result.current).toEqual({
        seeded: {
          name: 'Seeded Source',
          url: 'https://seeded.example/data',
          license: 'CC BY 4.0',
          references: [],
        },
        remote: {
          name: 'Remote Source',
          url: 'https://remote.example/data',
          license: 'CC BY 4.0',
          references: [],
        },
      });
    });
  });

  it('preserves the existing state reference when the fetch resolves to no sources', async () => {
    seedDataSourcesCache({
      seeded: {
        name: 'Seeded Source',
        url: 'https://seeded.example/data',
        license: 'CC BY 4.0',
        references: [],
      },
    });
    mockFetchDataSources.mockResolvedValueOnce({});

    const { result } = renderHook(() => useDataSources());
    const initialSources = result.current;

    await waitFor(() => {
      expect(mockFetchDataSources).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toBe(initialSources);
    expect(result.current).toEqual({
      seeded: {
        name: 'Seeded Source',
        url: 'https://seeded.example/data',
        license: 'CC BY 4.0',
        references: [],
      },
    });
  });

  it('preserves seeded sources when the fetch fails', async () => {
    seedDataSourcesCache({
      seeded: {
        name: 'Seeded Source',
        url: 'https://seeded.example/data',
        license: 'CC BY 4.0',
        references: [],
      },
    });
    mockFetchDataSources.mockRejectedValueOnce(new Error('fetch failed'));

    const { result } = renderHook(() => useDataSources());

    await waitFor(() => {
      expect(mockFetchDataSources).toHaveBeenCalledTimes(1);
    });

    expect(result.current).toEqual({
      seeded: {
        name: 'Seeded Source',
        url: 'https://seeded.example/data',
        license: 'CC BY 4.0',
        references: [],
      },
    });
  });

  it('does not update state after the hook unmounts', async () => {
    let resolveFetch:
      | ((value: Awaited<ReturnType<typeof fetchDataSources>>) => void)
      | null = null;
    mockFetchDataSources.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useDataSources());

    unmount();

    await act(async () => {
      resolveFetch?.({
        remote: {
          name: 'Remote Source',
          url: 'https://remote.example/data',
          license: 'CC BY 4.0',
          references: [],
        },
      });
      await Promise.resolve();
    });

    expect(result.current).toEqual({});
  });
});
