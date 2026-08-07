// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  useSearchRouteInitialState,
  useSearchRouteSync,
} from '../useSearchRouteState';
import type { SearchRouteParams } from '../searchRouteState';
import type { SearchTaxaQueryFilters } from '@/data/api';

let mockPathname = '/search';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useLocalSearchParams: jest.fn(),
}));

const japaneseRouteParams: SearchRouteParams = {
  query: 'japanese',
  withinTaxonId: '2877951',
  sortVariable: 'bio_12',
  sortMetric: 'median',
  sortOrder: 'desc',
};

const oakRouteParams: SearchRouteParams = {
  query: 'oak',
};

const japaneseFilters: SearchTaxaQueryFilters = {
  location: null,
  withinTaxonId: '2877951',
  descendantRank: 'species',
  includeSpeciesLike: true,
  sortVariable: 'bio_12',
  sortMetric: 'median',
  sortOrder: 'desc',
  minSamples: 1,
  limit: 10,
};

const oakFilters: SearchTaxaQueryFilters = {
  location: null,
  withinTaxonId: null,
  descendantRank: null,
  includeSpeciesLike: true,
  sortVariable: null,
  sortMetric: null,
  sortOrder: null,
  minSamples: null,
  limit: 10,
};

type UseSearchRouteSyncTestProps = {
  searchRouteParams: SearchRouteParams;
  filterParams: SearchTaxaQueryFilters;
};

const useSearchRouteTestHarness = (filterParams: SearchTaxaQueryFilters) => {
  const routeState = useSearchRouteInitialState(true);

  return useSearchRouteSync({
    isWeb: true,
    searchRouteParams: routeState.searchRouteParams,
    initialFilterVisible: routeState.initialFilterVisible,
    filterParams,
  });
};

describe('useSearchRouteSync', () => {
  const mockPushState = jest.fn();
  const mockReplaceState = jest.fn();

  const setWindowLocation = (url: string) => {
    const parsedUrl = new URL(url, 'http://localhost:8081');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: parsedUrl.pathname,
        search: parsedUrl.search,
      },
    });
  };

  beforeEach(() => {
    mockPathname = '/search';
    mockPushState.mockReset();
    mockReplaceState.mockReset();

    let historyState: unknown = null;

    mockPushState.mockImplementation(
      (state: unknown, _unused, url?: string) => {
        historyState = state;
        if (typeof url === 'string') {
          setWindowLocation(url);
        }
      },
    );

    mockReplaceState.mockImplementation(
      (state: unknown, _unused, url?: string) => {
        historyState = state;
        if (typeof url === 'string') {
          setWindowLocation(url);
        }
      },
    );

    setWindowLocation('/search');

    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        get state() {
          return historyState;
        },
        pushState: mockPushState,
        replaceState: mockReplaceState,
      },
    });
  });

  it('does not rewrite the URL with mixed local state during external route hydration', async () => {
    setWindowLocation(
      '/search?query=japanese&withinTaxonId=2877951&sortVariable=bio_12&sortMetric=median&sortOrder=desc',
    );

    const { rerender } = renderHook(
      ({ searchRouteParams, filterParams }: UseSearchRouteSyncTestProps) =>
        useSearchRouteSync({
          isWeb: true,
          searchRouteParams,
          initialFilterVisible: false,
          filterParams,
        }),
      {
        initialProps: {
          searchRouteParams: japaneseRouteParams,
          filterParams: japaneseFilters,
        },
      },
    );

    mockPushState.mockClear();
    mockReplaceState.mockClear();

    rerender({
      searchRouteParams: oakRouteParams,
      filterParams: japaneseFilters,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockPushState).not.toHaveBeenCalled();
    expect(mockReplaceState).not.toHaveBeenCalled();

    rerender({
      searchRouteParams: oakRouteParams,
      filterParams: oakFilters,
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/search',
        search: '?query=oak',
      },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockPushState).not.toHaveBeenCalledWith(
      expect.anything(),
      '',
      '/search?query=oak',
    );
    expect(mockReplaceState).not.toHaveBeenCalledWith(
      expect.anything(),
      '',
      '/search?query=oak',
    );
    expect(mockPushState).not.toHaveBeenCalledWith(
      expect.anything(),
      '',
      '/search?query=japanese&withinTaxonId=2877951&sortVariable=bio_12&sortMetric=median&sortOrder=desc',
    );
    expect(mockReplaceState).not.toHaveBeenCalledWith(
      expect.anything(),
      '',
      '/search?query=oak&withinTaxonId=2877951&sortVariable=bio_12&sortMetric=median&sortOrder=desc',
    );
  });

  it('rehydrates the URL on popstate even when filter visibility stays false', async () => {
    let popStateListener: ((event: Event) => void) | null = null;
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;

    Object.defineProperty(window, 'addEventListener', {
      configurable: true,
      value: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === 'popstate') {
          popStateListener =
            typeof listener === 'function'
              ? listener
              : listener.handleEvent.bind(listener);
        }
      },
    });

    Object.defineProperty(window, 'removeEventListener', {
      configurable: true,
      value: () => {},
    });

    setWindowLocation(
      '/search?query=japanese&withinTaxonId=2877951&sortVariable=bio_12&sortMetric=median&sortOrder=desc',
    );

    const { result, unmount } = renderHook(() =>
      useSearchRouteTestHarness(oakFilters),
    );

    expect(result.current.searchQuery).toBe('japanese');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/search',
        search: '?query=oak',
      },
    });

    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: {
          search: {
            filterVisible: false,
          },
        },
        pushState: mockPushState,
        replaceState: mockReplaceState,
      },
    });

    try {
      expect(popStateListener).not.toBeNull();

      await act(async () => {
        popStateListener?.(new Event('popstate'));
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.searchQuery).toBe('oak');
        expect(result.current.routeChangedExternally).toBe(false);
      });
    } finally {
      unmount();
      Object.defineProperty(window, 'addEventListener', {
        configurable: true,
        value: originalAddEventListener,
      });
      Object.defineProperty(window, 'removeEventListener', {
        configurable: true,
        value: originalRemoveEventListener,
      });
    }
  });

  it('does not treat an internally synced matching URL as external navigation', async () => {
    const { result, rerender } = renderHook(
      ({ searchRouteParams, filterParams }: UseSearchRouteSyncTestProps) =>
        useSearchRouteSync({
          isWeb: true,
          searchRouteParams,
          initialFilterVisible: false,
          filterParams,
        }),
      {
        initialProps: {
          searchRouteParams: oakRouteParams,
          filterParams: oakFilters,
        },
      },
    );

    const syncedRouteParams: SearchRouteParams = {
      query: 'wolf',
      withinTaxonId: '5219142',
      descendantRank: 'species',
      sortVariable: 'bio_1',
      sortMetric: 'median',
    };
    const syncedFilters: SearchTaxaQueryFilters = {
      ...oakFilters,
      withinTaxonId: '5219142',
      descendantRank: 'species',
      sortVariable: 'bio_1',
      sortMetric: 'median',
    };

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/search',
        search:
          '?query=wolf&withinTaxonId=5219142&descendantRank=species&sortVariable=bio_1&sortMetric=median',
      },
    });

    rerender({
      searchRouteParams: syncedRouteParams,
      filterParams: syncedFilters,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.routeChangedExternally).toBe(false);
    expect(result.current.routeStateHydrationPending).toBe(false);
  });

  it('preserves the normalized URL when syncing filter visibility history state', async () => {
    const invalidRankedRouteParams: SearchRouteParams = {
      query: 'cat',
      sortVariable: 'bio_1',
      sortMetric: 'median',
    };

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/search',
        search: '?query=cat&sortVariable=bio_1&sortMetric=median',
      },
    });

    renderHook(() =>
      useSearchRouteSync({
        isWeb: true,
        searchRouteParams: invalidRankedRouteParams,
        initialFilterVisible: true,
        filterParams: oakFilters,
      }),
    );

    await waitFor(() => {
      expect(window.location.search).toBe('?query=cat');
      expect(window.history.state).toEqual(
        expect.objectContaining({
          search: expect.objectContaining({
            filterVisible: true,
          }),
        }),
      );
    });

    expect(mockPushState).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({
          filterVisible: true,
        }),
      }),
      '',
      '/search?query=cat',
    );
  });

  it('keeps a cleared query across rerenders while the browser URL stays cleared', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/search',
        search: '?query=oak',
      },
    });

    const { result, rerender } = renderHook(
      ({ searchRouteParams, filterParams }: UseSearchRouteSyncTestProps) =>
        useSearchRouteSync({
          isWeb: true,
          searchRouteParams,
          initialFilterVisible: false,
          filterParams,
        }),
      {
        initialProps: {
          searchRouteParams: oakRouteParams,
          filterParams: oakFilters,
        },
      },
    );

    await act(async () => {
      result.current.setSearchQuery('');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(window.location.search).toBe('');
      expect(result.current.searchQuery).toBe('');
    });

    rerender({
      searchRouteParams: {},
      filterParams: oakFilters,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.routeChangedExternally).toBe(false);
    expect(result.current.routeStateHydrationPending).toBe(false);
  });

  it('cancels URL reaffirmation after leaving the search route', async () => {
    jest.useFakeTimers();

    try {
      const { result } = renderHook(() =>
        useSearchRouteSync({
          isWeb: true,
          searchRouteParams: {},
          initialFilterVisible: false,
          filterParams: oakFilters,
        }),
      );

      mockPushState.mockClear();
      mockReplaceState.mockClear();

      act(() => {
        result.current.setSearchQuery('wolf');
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockPushState).toHaveBeenCalledWith(
        expect.anything(),
        '',
        '/search?query=wolf',
      );

      setWindowLocation('/settings');

      act(() => {
        jest.runOnlyPendingTimers();
      });

      expect(mockReplaceState).not.toHaveBeenCalledWith(
        expect.anything(),
        '',
        '/search?query=wolf',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not let a stale reaffirmation overwrite a newer search URL on the same path', async () => {
    jest.useFakeTimers();

    try {
      const { result } = renderHook(() =>
        useSearchRouteSync({
          isWeb: true,
          searchRouteParams: {},
          initialFilterVisible: false,
          filterParams: oakFilters,
        }),
      );

      act(() => {
        result.current.setSearchQuery('wolf');
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(window.location.search).toBe('?query=wolf');

      mockReplaceState.mockClear();
      setWindowLocation('/search?query=oak');

      act(() => {
        jest.runOnlyPendingTimers();
      });

      expect(window.location.search).toBe('?query=oak');
      expect(mockReplaceState).not.toHaveBeenCalledWith(
        expect.anything(),
        '',
        '/search?query=wolf',
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
