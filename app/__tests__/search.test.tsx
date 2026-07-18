// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SearchTaxaQueryFilters } from '@/data/apiTaxaQueryHelpers';
import { fetchLocationByGid } from '@/data/apiLocationHelpers';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import type { UseSearchFiltersInitialState } from '@/hooks/search/filters/useSearchFilters';
import type { UseSearchFiltersResult } from '@/hooks/search/filters/useSearchFilters.types';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React, { act } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Search from '../search';
import type { SearchRouteParams } from '@/hooks/search/searchRouteState';

type MockSelectOption = {
  label: string;
  value: string;
};

const mockPush = jest.fn();
let mockPathname = '/search';
const mockUseLocalSearchParams = jest.fn(
  (): SearchRouteParams => ({ query: '' }),
);
const mockHistoryPushState = jest.fn();
const mockHistoryReplaceState = jest.fn();
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({
    breakpoint: 'desktop',
    contentWidth: 1200,
    gap: 32,
    marginHorizontal: 32,
  })),
}));

jest.mock('@/data/apiLocationHelpers', () => ({
  fetchLocationByGid: jest.fn(),
}));

const mockFilterParams: SearchTaxaQueryFilters = {
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

const mockSetHeaderConfig = jest.fn();
const mockResetHeaderConfig = jest.fn();
const mockSetNativeTopAppBarConfig = jest.fn();
const mockResetNativeTopAppBarConfig = jest.fn();
let mockNativeSearchSessionState: {
  filterVisible: boolean;
  filtersState?: UseSearchFiltersInitialState;
  searchQuery: string;
};
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  'OS',
);
const originalPlatformOS = Platform.OS;

const setPlatformOS = (os: string) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
};

const restorePlatformOS = () => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    return;
  }

  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatformOS,
  });
};

const mockUseSearchFilters = jest.fn();
const mockUseTaxaQuerySearch = jest.fn();
const mockTaxaQuerySearchResult: {
  debouncedQuery: string;
  searchContext: string | null;
  searchError: string | null;
  searchResults: any[];
  searching: boolean;
} = {
  debouncedQuery: '',
  searchContext: null,
  searchError: null,
  searchResults: [] as any[],
  searching: false,
};

const mockFiltersResult = {
  countryValue: '',
  countryOptions: [] as MockSelectOption[],
  countryLoading: false,
  onCountryChange: jest.fn(),
  stateValue: '',
  stateOptions: [] as MockSelectOption[],
  stateLoading: false,
  onStateChange: jest.fn(),
  countyValue: '',
  countyOptions: [] as MockSelectOption[],
  countyLoading: false,
  onCountyChange: jest.fn(),
  baseTaxonQuery: '',
  onBaseTaxonQueryChange: jest.fn(),
  onBaseTaxonSubmit: jest.fn(),
  onBaseTaxonFocus: jest.fn(),
  onBaseTaxonBlur: jest.fn(),
  onHydrateRouteLocation: jest.fn(),
  onHydrateRouteState: jest.fn(),
  baseTaxonSuggestions: [],
  baseTaxonSuggestionsLoading: false,
  baseTaxonSuggestionsVisible: false,
  onBaseTaxonSelect: jest.fn(),
  rankValue: '',
  rankOptions: [{ label: 'All ranks', value: '' }],
  onRankChange: jest.fn(),
  includeSubspecies: true as boolean,
  onIncludeSubspeciesChange: jest.fn(),
  sortVariableValue: '',
  sortVariableOptions: [],
  sortVariableLoading: false,
  sortVariableSourceIds: [],
  sortVariableIsCircular: false,
  sortVariableCategoryValue: '',
  sortVariableCategoryOptions: [],
  onSortVariableCategoryChange: jest.fn(),
  onSortVariableChange: jest.fn(),
  sortMetricValue: 'mean',
  sortMetricOptions: [{ label: 'Average', value: 'mean' }],
  onSortMetricChange: jest.fn(),
  sortOrder: 'ascending' as 'ascending' | 'descending',
  onSortOrderChange: jest.fn(),
  sortReference: 0,
  onSortReferenceChange: jest.fn(),
  listOffset: 0,
  onListOffsetChange: jest.fn(),
  minRbar: 0.15,
  onMinRbarChange: jest.fn(),
  predicates: [],
  filterVariableDefinitions: [],
  onAddFilterPredicate: jest.fn(),
  onRemoveFilterPredicate: jest.fn(),
  onUpdateFilterPredicate: jest.fn(),
  numberOfResults: 10,
  onNumberOfResultsChange: jest.fn(),
  minimumSamples: 0,
  onMinimumSamplesChange: jest.fn(),
  onResetFilters: jest.fn(),
  filterParams: mockFilterParams,
  rankingFilterHint: null,
  hasActiveFilters: false as boolean,
  panelProps: {
    countryValue: '',
    countryOptions: [] as MockSelectOption[],
    onCountryChange: jest.fn(),
    stateValue: '',
    stateOptions: [] as MockSelectOption[],
    onStateChange: jest.fn(),
    countyValue: '',
    countyOptions: [] as MockSelectOption[],
    onCountyChange: jest.fn(),
    baseTaxonQuery: '',
    onBaseTaxonQueryChange: jest.fn(),
    onBaseTaxonSubmit: jest.fn(),
    onBaseTaxonFocus: jest.fn(),
    onBaseTaxonBlur: jest.fn(),
    baseTaxonSuggestions: [],
    baseTaxonSuggestionsLoading: false,
    baseTaxonSuggestionsVisible: false,
    onBaseTaxonSelect: jest.fn(),
    rankValue: '',
    rankOptions: [{ label: 'All ranks', value: '' }],
    onRankChange: jest.fn(),
    includeSubspecies: true as boolean,
    onIncludeSubspeciesChange: jest.fn(),
    sortVariableValue: '',
    sortVariableOptions: [],
    onSortVariableChange: jest.fn(),
    sortMetricValue: 'mean',
    sortMetricOptions: [{ label: 'Average', value: 'mean' }],
    onSortMetricChange: jest.fn(),
    sortOrder: 'ascending' as 'ascending' | 'descending',
    onSortOrderChange: jest.fn(),
    sortReference: 0,
    onSortReferenceChange: jest.fn(),
    listOffset: 0,
    onListOffsetChange: jest.fn(),
    minRbar: 0.15,
    onMinRbarChange: jest.fn(),
    rankingFilterHint: null,
    numberOfResults: 10,
    onNumberOfResultsChange: jest.fn(),
    minimumSamples: 0,
    onMinimumSamplesChange: jest.fn(),
    onResetFilters: jest.fn(),
  },
} satisfies UseSearchFiltersResult;

jest.mock('@/hooks/search/filters/useSearchFilters', () => ({
  useSearchFilters: (...args: unknown[]) => mockUseSearchFilters(...args),
}));

jest.mock('@/hooks/search/useTaxaQuerySearch', () => ({
  useTaxaQuerySearch: (...args: unknown[]) => mockUseTaxaQuerySearch(...args),
}));

jest.mock('@/context/WebPageHeaderContext', () => ({
  useWebPageHeaderConfig: () => ({
    setConfig: mockSetHeaderConfig,
    resetConfig: mockResetHeaderConfig,
  }),
}));

jest.mock('@/context/NativeTopAppBarContext', () => ({
  useNativeTopAppBarConfig: () => ({
    setConfig: mockSetNativeTopAppBarConfig,
    resetConfig: mockResetNativeTopAppBarConfig,
  }),
}));

jest.mock('@/context/NativeSearchSessionContext', () => ({
  useNativeSearchSession: () => ({
    filterVisible: mockNativeSearchSessionState.filterVisible,
    filtersState: mockNativeSearchSessionState.filtersState,
    searchQuery: mockNativeSearchSessionState.searchQuery,
    setFilterVisible: (value: boolean) => {
      mockNativeSearchSessionState.filterVisible = value;
    },
    setFiltersState: (value?: UseSearchFiltersInitialState) => {
      mockNativeSearchSessionState.filtersState = value;
    },
    setSearchQuery: (value: string) => {
      mockNativeSearchSessionState.searchQuery = value;
    },
  }),
}));

let mockFiltersProps: any;
let mockSpeciesCardPropsHistory: any[];

jest.mock('@/components', () => {
  const mockReact = jest.requireActual('react') as typeof React;
  const mockReactNative = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  const { SpeciesCard: ActualSpeciesCard } = jest.requireActual(
    '@/components/cards/SpeciesCard',
  );
  const { ThemedText } = jest.requireActual('@/components/text/ThemedText');

  return {
    SpeciesCard: function MockSpeciesCard(props: any) {
      mockSpeciesCardPropsHistory.push(props);
      return <ActualSpeciesCard {...props} />;
    },
    ThemedText,
    PageScrollContainer: ({
      children,
      style,
      testID,
      contentContainerStyle,
    }: any) =>
      mockReact.createElement(
        mockReactNative.View,
        { style, testID },
        mockReact.createElement(
          mockReactNative.View,
          { style: contentContainerStyle },
          children,
        ),
      ),
    Filters: function MockFilters(props: any) {
      mockFiltersProps = props;
      return null;
    },
  };
});

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockUseResponsive = useResponsive as jest.MockedFunction<
  typeof useResponsive
>;
const mockFetchLocationByGid = jest.mocked(fetchLocationByGid);

const getLatestHeaderConfig = () => {
  const latestCall =
    mockSetHeaderConfig.mock.calls[mockSetHeaderConfig.mock.calls.length - 1];
  if (!latestCall) {
    throw new Error('Expected Search to configure WebPageHeader');
  }
  return latestCall[0];
};

const getLatestTaxaQuerySearchCall = () => {
  const latestCall =
    mockUseTaxaQuerySearch.mock.calls[
      mockUseTaxaQuerySearch.mock.calls.length - 1
    ];
  if (!latestCall) {
    throw new Error('Expected Search to run useTaxaQuerySearch');
  }

  return latestCall[0];
};

const getLatestNativeTopAppBarConfig = () => {
  const latestCall =
    mockSetNativeTopAppBarConfig.mock.calls[
      mockSetNativeTopAppBarConfig.mock.calls.length - 1
    ];
  if (!latestCall) {
    throw new Error('Expected Search to configure native top app bar');
  }
  return latestCall[0];
};

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

const setWindowSearchRouteParams = (params: SearchRouteParams) => {
  const search = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      typeof value === 'string' && value.length > 0 ? [[key, value]] : [],
    ),
  ).toString();

  setWindowLocation(search.length > 0 ? `/search?${search}` : '/search');
};

const mockSpeciesResults = [
  {
    taxonId: 1,
    commonName: 'Test Species 1',
    scientificName: 'Testus speciesone',
    description: '12.5 | Rank 1 of 10 | Percentile 95%',
    imageSource: { uri: 'test1' },
  },
  {
    taxonId: 2,
    commonName: 'Test Species 2',
    scientificName: 'Testus speciestwo',
    description: '8.25 | Rank 2 of 10 | Percentile 90%',
    imageSource: { uri: 'test2' },
  },
];

describe('Search screen', () => {
  beforeEach(() => {
    let historyState: unknown = null;

    mockNativeSearchSessionState = {
      filterVisible: false,
      filtersState: undefined,
      searchQuery: '',
    };

    mockHistoryPushState.mockImplementation(
      (state: unknown, _unused, url?: string) => {
        historyState = state;
        if (typeof url === 'string') {
          setWindowLocation(url);
        }
      },
    );

    mockHistoryReplaceState.mockImplementation(
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
        ...window.history,
        pushState: mockHistoryPushState,
        replaceState: mockHistoryReplaceState,
        get state() {
          return historyState;
        },
      },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: mockSessionStorage,
    });
    window.sessionStorage.clear();
    setPlatformOS('ios');
    mockPathname = '/search';
    mockUseLocalSearchParams.mockReturnValue({ query: '' });
    mockFetchLocationByGid.mockClear();
    mockFetchLocationByGid.mockResolvedValue(null);
    mockUseColorScheme.mockReturnValue('dark');
    mockUseResponsive.mockReturnValue({
      breakpoint: 'desktop',
      contentWidth: 1200,
      gap: 32,
      marginHorizontal: 32,
    } as any);
    mockPush.mockClear();
    mockHistoryPushState.mockClear();
    mockHistoryReplaceState.mockClear();
    mockSessionStorage.getItem.mockClear();
    mockSessionStorage.setItem.mockClear();
    mockSessionStorage.removeItem.mockClear();
    mockSessionStorage.clear.mockClear();
    mockSetHeaderConfig.mockClear();
    mockResetHeaderConfig.mockClear();
    mockSetNativeTopAppBarConfig.mockClear();
    mockResetNativeTopAppBarConfig.mockClear();
    mockUseSearchFilters.mockReset();
    mockUseSearchFilters.mockReturnValue(mockFiltersResult);
    mockUseTaxaQuerySearch.mockReset();
    mockUseTaxaQuerySearch.mockReturnValue(mockTaxaQuerySearchResult);
    mockFiltersProps = undefined;
    mockSpeciesCardPropsHistory = [];
    mockFiltersResult.onCountryChange.mockClear();
    mockFiltersResult.onStateChange.mockClear();
    mockFiltersResult.onCountyChange.mockClear();
    mockFiltersResult.onHydrateRouteLocation.mockClear();
    mockFiltersResult.onHydrateRouteState.mockClear();
    mockFiltersResult.countryValue = '';
    mockFiltersResult.countryOptions = [];
    mockFiltersResult.stateValue = '';
    mockFiltersResult.stateOptions = [];
    mockFiltersResult.countyValue = '';
    mockFiltersResult.countyOptions = [];
    mockFiltersResult.baseTaxonQuery = '';
    mockFiltersResult.rankValue = '';
    mockFiltersResult.includeSubspecies = true;
    mockFiltersResult.sortVariableValue = '';
    mockFiltersResult.sortMetricValue = 'mean';
    mockFiltersResult.sortOrder = 'ascending';
    mockFiltersResult.numberOfResults = 10;
    mockFiltersResult.minimumSamples = 0;
    mockFiltersResult.filterParams = mockFilterParams;
    mockFiltersResult.hasActiveFilters = false;
    mockFiltersResult.onResetFilters.mockClear();
    mockTaxaQuerySearchResult.debouncedQuery = '';
    mockTaxaQuerySearchResult.searchContext = null;
    mockTaxaQuerySearchResult.searchError = null;
    mockTaxaQuerySearchResult.searchResults = [];
    mockTaxaQuerySearchResult.searching = false;
  });

  afterEach(() => {
    restorePlatformOS();
  });

  it('configures shared header props', () => {
    render(<Search />);
    expect(mockSetHeaderConfig).toHaveBeenCalled();
  });

  it('displays the Results heading', () => {
    render(<Search />);
    expect(screen.getByText('Results')).toBeTruthy();
  });

  it('configures native top app bar through shared layout context on native', () => {
    setPlatformOS('ios');
    render(<Search />);

    expect(mockSetNativeTopAppBarConfig).toHaveBeenCalled();
    expect(getLatestHeaderConfig().showFilterButton).toBe(true);
  });

  it('does not configure native top app bar context on web', () => {
    setPlatformOS('web');
    render(<Search />);

    expect(mockSetNativeTopAppBarConfig).not.toHaveBeenCalled();
  });

  it('hydrates the native top app bar search value from a deep link query', () => {
    setPlatformOS('ios');
    mockUseLocalSearchParams.mockReturnValue({ query: 'owl' });

    render(<Search />);

    expect(getLatestNativeTopAppBarConfig().searchValue).toBe('owl');
    expect(mockHistoryPushState).not.toHaveBeenCalled();
    expect(mockHistoryReplaceState).not.toHaveBeenCalled();
  });

  it('updates the native top app bar search value when the native route query changes', async () => {
    setPlatformOS('ios');
    mockUseLocalSearchParams.mockReturnValue({ query: 'owl' });

    const rendered = render(<Search />);

    expect(getLatestNativeTopAppBarConfig().searchValue).toBe('owl');

    mockUseLocalSearchParams.mockReturnValue({ query: 'wolf' });

    await act(async () => {
      rendered.rerender(<Search />);
      await Promise.resolve();
    });

    expect(getLatestNativeTopAppBarConfig().searchValue).toBe('wolf');
    expect(mockHistoryPushState).not.toHaveBeenCalled();
    expect(mockHistoryReplaceState).not.toHaveBeenCalled();
  });

  it('preserves native query and filters across remounts', async () => {
    setPlatformOS('ios');
    mockFiltersResult.countryValue = 'USA';
    mockFiltersResult.countryOptions = [
      { label: 'United States', value: 'USA' },
    ];
    mockFiltersResult.stateValue = 'USA.45_1';
    mockFiltersResult.stateOptions = [{ label: 'Oregon', value: 'USA.45_1' }];
    mockFiltersResult.countyValue = 'USA.45.1_1';
    mockFiltersResult.countyOptions = [
      { label: 'Baker County', value: 'USA.45.1_1' },
    ];
    mockFiltersResult.baseTaxonQuery = 'Blue oak';
    mockFiltersResult.rankValue = 'species';
    mockFiltersResult.includeSubspecies = false;
    mockFiltersResult.sortVariableValue = 'bio_1';
    mockFiltersResult.sortMetricValue = 'median';
    mockFiltersResult.sortOrder = 'descending';
    mockFiltersResult.numberOfResults = 20;
    mockFiltersResult.minimumSamples = 5;
    mockFiltersResult.filterParams = {
      ...mockFilterParams,
      location: 'USA.45.1_1',
      withinTaxonId: 77,
      descendantRank: 'species',
      includeSpeciesLike: false,
      sortVariable: 'bio_1',
      sortMetric: 'median',
      sortOrder: 'desc',
      minSamples: 5,
      limit: 20,
    };

    const rendered = render(<Search />);

    act(() => {
      getLatestNativeTopAppBarConfig().onSearchValueChange('owl');
    });

    await act(async () => {
      getLatestNativeTopAppBarConfig().primaryAction?.onPress?.();
      await Promise.resolve();
    });

    expect(mockNativeSearchSessionState.searchQuery).toBe('owl');
    expect(mockNativeSearchSessionState.filterVisible).toBe(true);
    expect(mockNativeSearchSessionState.filtersState).toEqual({
      location: {
        countryValue: 'USA',
        stateValue: 'USA.45_1',
        countyValue: 'USA.45.1_1',
        countryOptions: [{ label: 'United States', value: 'USA' }],
        stateOptions: [{ label: 'Oregon', value: 'USA.45_1' }],
        countyOptions: [{ label: 'Baker County', value: 'USA.45.1_1' }],
      },
      taxon: {
        ancestorTaxonId: 77,
        baseTaxonQuery: 'Blue oak',
      },
      ranking: {
        rankValue: 'species',
        includeSubspecies: false,
        sortVariableValue: 'bio_1',
        sortMetricValue: 'median',
        sortOrder: 'descending',
        sortReference: 0,
        minRbar: 0.15,
        listOffset: 0,
        predicates: [],
      },
      quantity: {
        numberOfResults: 20,
        minimumSamples: 5,
      },
    });

    rendered.unmount();
    mockUseSearchFilters.mockClear();

    render(<Search />);

    expect(getLatestNativeTopAppBarConfig().searchValue).toBe('owl');
    expect(getLatestNativeTopAppBarConfig().primaryAction?.buttonLabel).toBe(
      'Hide filter',
    );
    expect(mockUseSearchFilters).toHaveBeenLastCalledWith(
      expect.objectContaining({
        location: expect.objectContaining({
          countryValue: 'USA',
          stateValue: 'USA.45_1',
          countyValue: 'USA.45.1_1',
        }),
        taxon: expect.objectContaining({
          ancestorTaxonId: 77,
          baseTaxonQuery: 'Blue oak',
        }),
        ranking: expect.objectContaining({
          rankValue: 'species',
          includeSubspecies: false,
          sortVariableValue: 'bio_1',
          sortMetricValue: 'median',
          sortOrder: 'descending',
        }),
        quantity: expect.objectContaining({
          numberOfResults: 20,
          minimumSamples: 5,
        }),
      }),
    );
  });

  it('hydrates native initial filters without an implicit rank or minimum sample threshold', () => {
    setPlatformOS('ios');

    render(<Search />);

    expect(mockUseSearchFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        ranking: expect.objectContaining({
          rankValue: '',
          includeSubspecies: true,
          sortVariableValue: '',
          sortMetricValue: '',
          sortOrder: 'ascending',
        }),
        quantity: expect.objectContaining({
          minimumSamples: undefined,
          numberOfResults: undefined,
        }),
      }),
    );
  });

  it('updates the search URL when the native search query changes', () => {
    setPlatformOS('web');
    render(<Search />);

    act(() => {
      getLatestHeaderConfig().onSearchQueryChange('owl');
    });

    expect(mockHistoryPushState).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({
          filterVisible: false,
        }),
      }),
      '',
      '/search?query=owl',
    );
  });

  it('replaces the current history entry when refining an existing non-empty query', () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({ query: 'ow' });
    setWindowSearchRouteParams({ query: 'ow' });

    render(<Search />);

    act(() => {
      getLatestHeaderConfig().onSearchQueryChange('owl');
    });

    expect(mockHistoryPushState).not.toHaveBeenCalled();
    expect(mockHistoryReplaceState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({
          filterVisible: false,
        }),
      }),
      '',
      '/search?query=owl',
    );
  });

  it('does not rewrite browser history with stale local query during route-driven navigation', async () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({ query: 'cactus' });
    setWindowSearchRouteParams({ query: 'cactus' });

    const rendered = render(<Search />);

    act(() => {
      getLatestHeaderConfig().onSearchQueryChange('owl');
    });

    expect(mockHistoryReplaceState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({
          filterVisible: false,
        }),
      }),
      '',
      '/search?query=owl',
    );

    mockHistoryReplaceState.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ query: 'cactus' });

    await act(async () => {
      rendered.rerender(<Search />);
      await Promise.resolve();
    });

    expect(mockHistoryReplaceState).not.toHaveBeenCalledWith(
      expect.anything(),
      '',
      '/search?query=owl',
    );
  });

  it('does not pin the URL back to search when navigation leaves the search page', async () => {
    setPlatformOS('web');
    const rendered = render(<Search />);

    act(() => {
      getLatestHeaderConfig().onSearchQueryChange('oak');
    });

    expect(mockHistoryPushState).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({
          filterVisible: false,
        }),
      }),
      '',
      '/search?query=oak',
    );

    mockHistoryReplaceState.mockClear();
    mockPathname = '/about';
    mockUseLocalSearchParams.mockReturnValue({});

    await act(async () => {
      rendered.rerender(<Search />);
      await Promise.resolve();
    });

    expect(mockHistoryReplaceState).not.toHaveBeenCalled();
  });

  it('updates the search URL when filter params change', () => {
    setPlatformOS('web');
    const rendered = render(<Search />);

    mockFiltersResult.filterParams = {
      ...mockFilterParams,
      withinTaxonId: 77,
      sortVariable: 'bio_1',
      sortMetric: 'median',
      sortOrder: 'desc',
      minSamples: 25,
      limit: 20,
    };

    rendered.rerender(<Search />);

    expect(mockHistoryPushState).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({
          filterVisible: false,
        }),
      }),
      '',
      '/search?withinTaxonId=77&minSamples=25&limit=20',
    );
  });

  it('does not rewrite the URL while external route hydration still has stale filter state', async () => {
    setPlatformOS('web');
    const rendered = render(<Search />);

    mockUseLocalSearchParams.mockReturnValue({ withinTaxonId: '77' });
    setWindowSearchRouteParams({ withinTaxonId: '77' });

    await act(async () => {
      rendered.rerender(<Search />);
      await Promise.resolve();
    });

    mockHistoryReplaceState.mockClear();
    mockFiltersResult.filterParams = {
      ...mockFilterParams,
      withinTaxonId: 77,
      sortVariable: 'bio_1',
      sortMetric: 'median',
    };

    rendered.rerender(<Search />);

    expect(mockHistoryPushState).not.toHaveBeenCalled();
    expect(mockHistoryReplaceState).not.toHaveBeenCalled();
  });

  it('suspends direct taxa-query execution during route filter hydration after external navigation', async () => {
    setPlatformOS('web');
    const rendered = render(<Search />);

    expect(getLatestTaxaQuerySearchCall()).toEqual(
      expect.objectContaining({ enabled: true }),
    );

    mockUseTaxaQuerySearch.mockClear();
    mockUseLocalSearchParams.mockReturnValue({ withinTaxonId: '77' });
    setWindowSearchRouteParams({ withinTaxonId: '77' });

    await act(async () => {
      rendered.rerender(<Search />);
      await Promise.resolve();
    });

    expect(getLatestTaxaQuerySearchCall()).toEqual(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('hydrates initial filter state from route params', () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({
      location: 'USA.45.1_1',
      withinTaxonId: '77',
      descendantRank: 'genus',
      includeSpeciesLike: 'false',
      sortVariable: 'bio_1',
      sortMetric: 'median',
      sortOrder: 'desc',
      minSamples: '25',
      limit: '20',
    });
    setWindowSearchRouteParams({
      location: 'USA.45.1_1',
      withinTaxonId: '77',
      descendantRank: 'genus',
      includeSpeciesLike: 'false',
      sortVariable: 'bio_1',
      sortMetric: 'median',
      sortOrder: 'desc',
      minSamples: '25',
      limit: '20',
    });

    render(<Search />);

    expect(mockUseSearchFilters).toHaveBeenCalledWith({
      location: {
        countryValue: 'USA',
        stateValue: 'USA.45_1',
        countyValue: 'USA.45.1_1',
      },
      taxon: { ancestorTaxonId: 77, baseTaxonQuery: '77' },
      ranking: {
        rankValue: 'genus',
        includeSubspecies: true,
        sortVariableValue: 'bio_1',
        sortMetricValue: 'median',
        sortOrder: 'descending',
        predicates: [],
      },
      quantity: {
        minimumSamples: 25,
        numberOfResults: 20,
      },
    });
  });

  it('hydrates mounted filter state when route params change', () => {
    setPlatformOS('web');
    const rendered = render(<Search />);

    mockUseLocalSearchParams.mockReturnValue({
      location: 'USA.45.1_1',
      withinTaxonId: '77',
      descendantRank: 'genus',
      includeSpeciesLike: 'false',
      sortVariable: 'bio_1',
      sortMetric: 'median',
      sortOrder: 'desc',
      minSamples: '25',
      limit: '20',
    });
    setWindowSearchRouteParams({
      location: 'USA.45.1_1',
      withinTaxonId: '77',
      descendantRank: 'genus',
      includeSpeciesLike: 'false',
      sortVariable: 'bio_1',
      sortMetric: 'median',
      sortOrder: 'desc',
      minSamples: '25',
      limit: '20',
    });

    rendered.rerender(<Search />);

    return waitFor(() => {
      expect(mockFiltersResult.onHydrateRouteState).toHaveBeenCalledWith({
        location: {
          countryValue: 'USA',
          stateValue: 'USA.45_1',
          countyValue: 'USA.45.1_1',
        },
        taxon: { ancestorTaxonId: 77, baseTaxonQuery: '77' },
        ranking: {
          rankValue: 'genus',
          includeSubspecies: true,
          sortVariableValue: 'bio_1',
          sortMetricValue: 'median',
          sortOrder: 'descending',
          predicates: [],
        },
        quantity: {
          minimumSamples: 25,
          numberOfResults: 20,
        },
      });
    });
  });

  it('does not repeatedly hydrate the same external route state across rerenders', async () => {
    setPlatformOS('web');
    const rendered = render(<Search />);

    mockUseLocalSearchParams.mockReturnValue({
      location: 'USA.45.1_1',
      withinTaxonId: '77',
      descendantRank: 'genus',
      includeSpeciesLike: 'false',
      sortVariable: 'bio_1',
      sortMetric: 'median',
      sortOrder: 'desc',
      minSamples: '25',
      limit: '20',
    });
    setWindowSearchRouteParams({
      location: 'USA.45.1_1',
      withinTaxonId: '77',
      descendantRank: 'genus',
      includeSpeciesLike: 'false',
      sortVariable: 'bio_1',
      sortMetric: 'median',
      sortOrder: 'desc',
      minSamples: '25',
      limit: '20',
    });

    rendered.rerender(<Search />);

    await waitFor(() => {
      expect(mockFiltersResult.onHydrateRouteState).toHaveBeenCalledTimes(1);
    });

    rendered.rerender(<Search />);
    rendered.rerender(<Search />);

    expect(mockFiltersResult.onHydrateRouteState).toHaveBeenCalledTimes(1);
  });

  it('clears the header search query when the routed query param is removed', async () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({ query: 'owl' });
    setWindowSearchRouteParams({ query: 'owl' });

    const rendered = render(<Search />);

    expect(getLatestHeaderConfig().searchQuery).toBe('owl');

    mockUseLocalSearchParams.mockReturnValue({});
    setWindowSearchRouteParams({});

    await act(async () => {
      rendered.rerender(<Search />);
      await Promise.resolve();
    });

    expect(getLatestHeaderConfig().searchQuery).toBe('');
  });

  it('hydrates canonical route location hierarchy from backend metadata', async () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({
      location: 'USA.45.1_1',
    });
    setWindowSearchRouteParams({ location: 'USA.45.1_1' });
    mockFetchLocationByGid.mockResolvedValue({
      gid: 'USA.45.1_1',
      name: 'Beaver',
      level: 2,
      parent_gid: 'USA.45_1',
      hierarchy: ['United States', 'Utah'],
      ancestors: [
        { gid: 'USA', name: 'United States', level: 0 },
        { gid: 'USA.45_1', name: 'Utah', level: 1 },
      ],
    });

    render(<Search />);

    await waitFor(() => {
      expect(mockFetchLocationByGid).toHaveBeenCalledWith(
        'USA.45.1_1',
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    expect(mockFiltersResult.onHydrateRouteLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        countryValue: 'USA',
        stateValue: 'USA.45_1',
        countyValue: 'USA.45.1_1',
      }),
    );
  });

  it('reapplies the routed county after canonical parent hydration clears dependent state', async () => {
    setPlatformOS('web');
    mockFiltersResult.countryValue = '';
    mockFiltersResult.stateValue = '';
    mockFiltersResult.countyValue = 'USA.45.1_1';
    mockUseLocalSearchParams.mockReturnValue({
      location: 'USA.45.1_1',
    });
    setWindowSearchRouteParams({ location: 'USA.45.1_1' });
    mockFetchLocationByGid.mockResolvedValue({
      gid: 'USA.45.1_1',
      name: 'Beaver',
      level: 2,
      parent_gid: 'USA.45_1',
      hierarchy: ['United States', 'Utah'],
      ancestors: [
        { gid: 'USA', name: 'United States', level: 0 },
        { gid: 'USA.45_1', name: 'Utah', level: 1 },
      ],
    });

    render(<Search />);

    await waitFor(() => {
      expect(mockFetchLocationByGid).toHaveBeenCalledWith(
        'USA.45.1_1',
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    expect(mockFiltersResult.onHydrateRouteLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        countryValue: 'USA',
        stateValue: 'USA.45_1',
        countyValue: 'USA.45.1_1',
      }),
    );

    mockFiltersResult.countyValue = '';
  });

  it('hydrates canonical route location hierarchy on native deep links', async () => {
    setPlatformOS('ios');
    mockUseLocalSearchParams.mockReturnValue({
      location: 'USA.45.1_1',
    });
    mockFetchLocationByGid.mockResolvedValue({
      gid: 'USA.45.1_1',
      name: 'Beaver',
      level: 2,
      parent_gid: 'USA.45_1',
      hierarchy: ['United States', 'Utah'],
      ancestors: [
        { gid: 'USA', name: 'United States', level: 0 },
        { gid: 'USA.45_1', name: 'Utah', level: 1 },
      ],
    });

    render(<Search />);

    await waitFor(() => {
      expect(mockFetchLocationByGid).toHaveBeenCalledWith(
        'USA.45.1_1',
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    expect(mockFiltersResult.onHydrateRouteLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        countryValue: 'USA',
        stateValue: 'USA.45_1',
        countyValue: 'USA.45.1_1',
      }),
    );
  });

  it('clears a stale county selection when a broader state route is hydrated in the same hierarchy', async () => {
    setPlatformOS('web');
    mockFiltersResult.countryValue = 'USA';
    mockFiltersResult.stateValue = 'USA.45_1';
    mockFiltersResult.countyValue = 'USA.45.1_1';
    mockUseLocalSearchParams.mockReturnValue({
      location: 'USA.45_1',
    });
    setWindowSearchRouteParams({ location: 'USA.45_1' });
    mockFetchLocationByGid.mockResolvedValue({
      gid: 'USA.45_1',
      name: 'Utah',
      level: 1,
      parent_gid: 'USA',
      hierarchy: ['United States'],
      ancestors: [{ gid: 'USA', name: 'United States', level: 0 }],
    });

    render(<Search />);

    await waitFor(() => {
      expect(mockFetchLocationByGid).toHaveBeenCalledWith(
        'USA.45_1',
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    expect(mockFiltersResult.onHydrateRouteLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        countryValue: 'USA',
        stateValue: 'USA.45_1',
        countyValue: '',
      }),
    );

    mockFiltersResult.countryValue = '';
    mockFiltersResult.stateValue = '';
    mockFiltersResult.countyValue = '';
  });

  it('clears stale state and county selections when a broader country route is hydrated in the same hierarchy', async () => {
    setPlatformOS('web');
    mockFiltersResult.countryValue = 'USA';
    mockFiltersResult.stateValue = 'USA.45_1';
    mockFiltersResult.countyValue = 'USA.45.1_1';
    mockUseLocalSearchParams.mockReturnValue({
      location: 'USA',
    });
    setWindowSearchRouteParams({ location: 'USA' });
    mockFetchLocationByGid.mockResolvedValue({
      gid: 'USA',
      name: 'United States',
      level: 0,
      parent_gid: null,
      hierarchy: [],
      ancestors: [],
    });

    render(<Search />);

    await waitFor(() => {
      expect(mockFetchLocationByGid).toHaveBeenCalledWith(
        'USA',
        expect.objectContaining({ signal: expect.any(Object) }),
      );
    });

    expect(mockFiltersResult.onHydrateRouteLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        countryValue: 'USA',
        stateValue: '',
        countyValue: '',
      }),
    );

    mockFiltersResult.countryValue = '';
    mockFiltersResult.stateValue = '';
    mockFiltersResult.countyValue = '';
  });

  it('does not refetch canonical location metadata when rerendered with the same route location', async () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({ location: 'USA.45.1_1' });
    setWindowSearchRouteParams({ location: 'USA.45.1_1' });
    mockFetchLocationByGid.mockResolvedValue({
      gid: 'USA.45.1_1',
      name: 'Beaver',
      level: 2,
      parent_gid: 'USA.45_1',
      hierarchy: ['United States', 'Utah'],
      ancestors: [
        { gid: 'USA', name: 'United States', level: 0 },
        { gid: 'USA.45_1', name: 'Utah', level: 1 },
      ],
    });

    const rendered = render(<Search />);

    await waitFor(() => {
      expect(mockFetchLocationByGid.mock.calls.length).toBeGreaterThan(0);
    });

    const callCountAfterInitialRender =
      mockFetchLocationByGid.mock.calls.length;

    rendered.rerender(<Search />);

    expect(mockFetchLocationByGid).toHaveBeenCalledTimes(
      callCountAfterInitialRender,
    );
  });

  it('warns when canonical route location hydration still fails after retrying', async () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({ location: 'USA.45.1_1' });
    setWindowSearchRouteParams({ location: 'USA.45.1_1' });
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    mockFetchLocationByGid.mockRejectedValue(new Error('location failed'));

    render(<Search />);

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[search] Failed to hydrate route location "USA.45.1_1" from canonical hierarchy',
        expect.any(Error),
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('does not retry canonical route location hydration on rerender after a terminal failure', async () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({ location: 'USA.45.1_1' });
    setWindowSearchRouteParams({ location: 'USA.45.1_1' });
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    mockFetchLocationByGid.mockRejectedValue(new Error('location failed'));

    const rendered = render(<Search />);

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    const callCountAfterFailure = mockFetchLocationByGid.mock.calls.length;

    rendered.rerender(<Search />);

    expect(mockFetchLocationByGid).toHaveBeenCalledTimes(callCountAfterFailure);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

    consoleWarnSpy.mockRestore();
  });

  it('retries canonical route location hydration for the same route after a transient failure', async () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({ location: 'USA.45.1_1' });
    setWindowSearchRouteParams({ location: 'USA.45.1_1' });
    mockFetchLocationByGid
      .mockRejectedValueOnce(new Error('location failed'))
      .mockResolvedValueOnce({
        gid: 'USA.45.1_1',
        name: 'Beaver',
        level: 2,
        parent_gid: 'USA.45_1',
        hierarchy: ['United States', 'Utah'],
        ancestors: [
          { gid: 'USA', name: 'United States', level: 0 },
          { gid: 'USA.45_1', name: 'Utah', level: 1 },
        ],
      });
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    render(<Search />);

    await waitFor(() => {
      expect(mockFetchLocationByGid.mock.calls.length).toBeGreaterThan(1);
    });

    await waitFor(() => {
      expect(mockFiltersResult.onHydrateRouteLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          countryValue: 'USA',
          stateValue: 'USA.45_1',
          countyValue: 'USA.45.1_1',
        }),
      );
    });

    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('treats unresolved route locations as non-canonical and does not warn', async () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({ location: 'county-us-ca-sf' });
    setWindowSearchRouteParams({ location: 'county-us-ca-sf' });
    mockFetchLocationByGid.mockReset();
    mockFetchLocationByGid.mockResolvedValueOnce(null);
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const initialCallCount = mockFetchLocationByGid.mock.calls.length;

    const rendered = render(<Search />);

    await waitFor(() => {
      expect(mockFetchLocationByGid.mock.calls.length).toBe(
        initialCallCount + 1,
      );
    });

    rendered.rerender(<Search />);

    expect(mockFetchLocationByGid.mock.calls.length).toBe(initialCallCount + 1);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(mockFiltersResult.onHydrateRouteLocation).not.toHaveBeenCalled();
    expect(mockFiltersResult.onCountryChange).not.toHaveBeenCalled();
    expect(mockFiltersResult.onStateChange).not.toHaveBeenCalled();
    expect(mockFiltersResult.onCountyChange).not.toHaveBeenCalledWith('');

    consoleWarnSpy.mockRestore();
  });

  it('skips canonical route location fetch when the routed selection already has labels', () => {
    setPlatformOS('web');
    mockUseLocalSearchParams.mockReturnValue({ location: 'USA.45_1' });
    setWindowSearchRouteParams({ location: 'USA.45_1' });
    mockFetchLocationByGid.mockClear();
    mockFiltersResult.countryValue = 'USA';
    mockFiltersResult.countryOptions = [
      { label: 'United States', value: 'USA' },
    ];
    mockFiltersResult.stateValue = 'USA.45_1';
    mockFiltersResult.stateOptions = [{ label: 'Utah', value: 'USA.45_1' }];

    render(<Search />);

    expect(mockFetchLocationByGid).not.toHaveBeenCalled();
    expect(mockFiltersResult.onHydrateRouteLocation).not.toHaveBeenCalled();

    mockFiltersResult.countryValue = '';
    mockFiltersResult.countryOptions = [];
    mockFiltersResult.stateValue = '';
    mockFiltersResult.stateOptions = [];
  });

  it('restores the filter panel as open from browser history state', () => {
    setPlatformOS('web');
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        ...window.history,
        pushState: mockHistoryPushState,
        replaceState: mockHistoryReplaceState,
        state: { search: { filterVisible: true } },
      },
    });

    render(<Search />);

    expect(getLatestHeaderConfig().filterLabel).toBe('Hide filter');
  });

  it('restores the filter panel as open from session storage across routes', () => {
    setPlatformOS('web');
    window.sessionStorage.setItem('wherewild.search.filterVisible', 'true');

    render(<Search />);

    expect(getLatestHeaderConfig().filterLabel).toBe('Hide filter');
  });

  it('persists the filter panel state to browser history state on web', () => {
    setPlatformOS('web');
    render(<Search />);

    act(() => {
      getLatestHeaderConfig().onFilterPress();
    });

    expect(mockHistoryReplaceState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({
          filterVisible: true,
        }),
      }),
      '',
      '/search',
    );
    expect(
      window.sessionStorage.getItem('wherewild.search.filterVisible'),
    ).toBe('true');
  });

  it('rehydrates filter visibility from browser history during popstate navigation', () => {
    setPlatformOS('web');
    let popStateListener: (() => void) | undefined;
    const addEventListener = jest.fn(
      (event: string, listener: EventListener) => {
        if (event === 'popstate') {
          popStateListener = listener as unknown as () => void;
        }
      },
    );
    const removeEventListener = jest.fn();

    Object.defineProperty(window, 'addEventListener', {
      configurable: true,
      value: addEventListener,
    });
    Object.defineProperty(window, 'removeEventListener', {
      configurable: true,
      value: removeEventListener,
    });

    render(<Search />);

    expect(getLatestHeaderConfig().filterLabel).toBe('Filter');

    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        ...window.history,
        pushState: mockHistoryPushState,
        replaceState: mockHistoryReplaceState,
        state: { search: { filterVisible: true } },
      },
    });

    act(() => {
      popStateListener?.();
    });

    expect(getLatestHeaderConfig().filterLabel).toBe('Hide filter');

    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        ...window.history,
        pushState: mockHistoryPushState,
        replaceState: mockHistoryReplaceState,
        state: { search: { filterVisible: false } },
      },
    });

    act(() => {
      popStateListener?.();
    });

    expect(getLatestHeaderConfig().filterLabel).toBe('Filter');
  });

  it('does not rewrite the route when native search query changes', () => {
    setPlatformOS('ios');
    render(<Search />);

    act(() => {
      getLatestNativeTopAppBarConfig().onSearchValueChange('owl');
    });

    expect(mockHistoryReplaceState).not.toHaveBeenCalled();
  });

  it('shows loading species card placeholders while searching', () => {
    mockTaxaQuerySearchResult.searching = true;
    const rendered = render(<Search />);
    rendered.rerender(<Search />);

    expect(screen.getAllByLabelText('Species card loading')).toHaveLength(10);
  });

  it('shows empty state message when no results', () => {
    render(<Search />);

    expect(
      screen.getByText('Enter a search term to see results.'),
    ).toBeTruthy();
  });

  it('shows ranked eligibility explanation when text matches exist but ranking returns none', () => {
    mockTaxaQuerySearchResult.searchContext =
      'Taxa matched "spinystar", but none were eligible for ranking with the selected filters.';
    const rendered = render(<Search />);
    rendered.rerender(<Search />);

    expect(
      screen.getByText(
        'Taxa matched "spinystar", but none were eligible for ranking with the selected filters.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText('Enter a search term to see results.'),
    ).toBeNull();
  });

  it('shows query failure context message when search fails', () => {
    mockTaxaQuerySearchResult.searchContext =
      'Search failed. Please try again.';
    const rendered = render(<Search />);
    rendered.rerender(<Search />);

    expect(screen.getByText('Search failed. Please try again.')).toBeTruthy();
    expect(
      screen.queryByText('Enter a search term to see results.'),
    ).toBeNull();
  });

  it('updates species card list when search results change', () => {
    mockTaxaQuerySearchResult.searchResults = mockSpeciesResults;
    const rendered = render(<Search />);
    rendered.rerender(<Search />);

    expect(
      screen.queryByText('Enter a search term to see results.'),
    ).toBeNull();
    expect(screen.getByText('Test Species 1')).toBeTruthy();
    expect(screen.getByText('Test Species 2')).toBeTruthy();
    expect(
      screen.getByText('12.5 | Rank 1 of 10 | Percentile 95%'),
    ).toBeTruthy();
  });

  it('uses compact species cards on phone displays', () => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'phone',
      contentWidth: 360,
      gap: 16,
      marginHorizontal: 16,
    } as any);

    mockTaxaQuerySearchResult.searchResults = mockSpeciesResults;
    const rendered = render(<Search />);
    rendered.rerender(<Search />);

    const renderedCardProps = mockSpeciesCardPropsHistory.filter(
      (props) => props.taxonId != null,
    );
    expect(renderedCardProps.length).toBeGreaterThan(0);
    renderedCardProps.forEach((props) => {
      expect(props.size).toBe('compact');
    });
  });

  describe('filter panel', () => {
    it('does not pass web search execution callbacks through WebPageHeader', () => {
      render(<Search />);
      expect(getLatestHeaderConfig().filterParams).toBeUndefined();
    });

    it('passes a query change callback to WebPageHeader on web', () => {
      setPlatformOS('web');
      render(<Search />);

      expect(typeof getLatestHeaderConfig().onSearchQueryChange).toBe(
        'function',
      );
    });

    it('shows the WebPageHeader filter button', () => {
      render(<Search />);
      expect(getLatestHeaderConfig().showFilterButton).toBe(true);
    });

    it('defaults the filter control to the closed state', () => {
      render(<Search />);
      expect(getLatestHeaderConfig().filterLabel).toBe('Filter');
    });

    it('shows the filters panel when header filter button is pressed once', () => {
      render(<Search />);
      const headerConfig = getLatestHeaderConfig();
      mockFiltersProps = undefined;
      act(() => {
        headerConfig.onFilterPress();
      });
      expect(mockFiltersProps).toBeDefined();
    });

    it('hides the filters panel again on a second header filter button press', () => {
      render(<Search />);
      const headerConfig = getLatestHeaderConfig();
      mockFiltersProps = undefined;
      act(() => {
        headerConfig.onFilterPress();
      });
      expect(mockFiltersProps).toBeDefined();
      expect(getLatestHeaderConfig().filterLabel).toBe('Hide filter');

      act(() => {
        headerConfig.onFilterPress();
      });
      expect(getLatestHeaderConfig().filterLabel).toBe('Filter');
    });

    it('hides reset handler in WebPageHeader when no filter is active', () => {
      render(<Search />);
      expect(getLatestHeaderConfig().showResetFilterButton).toBe(false);
    });

    it('shows reset handler in WebPageHeader when a filter is active', () => {
      mockFiltersResult.hasActiveFilters = true;
      render(<Search />);
      const headerConfig = getLatestHeaderConfig();
      expect(headerConfig.showResetFilterButton).toBe(true);
      act(() => {
        headerConfig.onResetFilterPress();
      });
      expect(mockFiltersResult.onResetFilters).toHaveBeenCalledTimes(1);
    });

    it('passes filter callbacks to the Filters panel', () => {
      render(<Search />);
      const headerConfig = getLatestHeaderConfig();
      act(() => {
        headerConfig.onFilterPress();
      });
      expect(typeof mockFiltersProps.onCountryChange).toBe('function');
      expect(typeof mockFiltersProps.onResetFilters).toBe('function');
    });

    it('does not pass a shared web-header query on native when route query is missing', () => {
      mockUseLocalSearchParams.mockReturnValue({ query: undefined as any });

      render(<Search />);

      expect(getLatestHeaderConfig().searchQuery).toBeUndefined();
    });

    it('updates layout width from layout events', () => {
      const rendered = render(<Search />);
      const layoutView = rendered
        .UNSAFE_getAllByType(View)
        .find((viewNode) => typeof viewNode.props.onLayout === 'function');

      expect(layoutView).toBeDefined();

      act(() => {
        fireEvent(layoutView!, 'layout', {
          nativeEvent: { layout: { width: 420 } },
        });
      });
    });

    it('handles hide animation completion callbacks', () => {
      let latestCallback: ((result: { finished: boolean }) => void) | undefined;
      const startMock = jest.fn(
        (callback?: (result: { finished: boolean }) => void) => {
          latestCallback = callback;
        },
      );
      const stopMock = jest.fn();
      const parallelSpy = jest
        .spyOn(Animated, 'parallel')
        .mockReturnValue({ start: startMock, stop: stopMock } as any);

      const rendered = render(<Search />);
      const headerConfig = getLatestHeaderConfig();
      const getFilterPanelStyle = () =>
        StyleSheet.flatten(
          rendered.UNSAFE_getByProps({ testID: 'search-filter-panel' }).props
            .style,
        );

      act(() => {
        headerConfig.onFilterPress();
      });

      act(() => {
        headerConfig.onFilterPress();
      });

      expect(startMock).toHaveBeenCalled();
      expect(getFilterPanelStyle()?.maxHeight).toBeUndefined();

      act(() => {
        latestCallback?.({ finished: true });
      });

      expect(getFilterPanelStyle()).toEqual(
        expect.objectContaining({
          maxHeight: 0,
          overflow: 'hidden',
        }),
      );
      parallelSpy.mockRestore();
    });

    it('does not replay the open animation when the filter starts visible', () => {
      setPlatformOS('web');
      Object.defineProperty(window, 'history', {
        configurable: true,
        value: {
          ...window.history,
          pushState: mockHistoryPushState,
          replaceState: mockHistoryReplaceState,
          state: { search: { filterVisible: true } },
        },
      });

      const setValueSpy = jest.spyOn(Animated.Value.prototype, 'setValue');

      render(<Search />);

      expect(getLatestHeaderConfig().filterLabel).toBe('Hide filter');
      expect(setValueSpy).not.toHaveBeenCalledWith(480);
      expect(setValueSpy).not.toHaveBeenCalledWith(-480);

      setValueSpy.mockRestore();
    });

    it('uses stacked filter slide offsets when layout cannot fit side-by-side columns', () => {
      const setValueSpy = jest.spyOn(Animated.Value.prototype, 'setValue');
      const rendered = render(<Search />);
      const layoutView = rendered
        .UNSAFE_getAllByType(View)
        .find((viewNode) => typeof viewNode.props.onLayout === 'function');

      act(() => {
        fireEvent(layoutView!, 'layout', {
          nativeEvent: { layout: { width: 420 } },
        });
      });

      const headerConfig = getLatestHeaderConfig();
      act(() => {
        headerConfig.onFilterPress();
      });

      expect(setValueSpy).toHaveBeenCalledWith(-480);
      setValueSpy.mockRestore();
    });
  });
});
