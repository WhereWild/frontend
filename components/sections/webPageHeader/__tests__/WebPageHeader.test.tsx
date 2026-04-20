import React, { act } from 'react';
import * as Haptics from 'expo-haptics';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react-native';
import { Size } from '@/constants/theme';
import { WebPageHeader } from '../WebPageHeader';
import { IconHelpCircle } from '@/assets/icons';
import type { SearchTaxaQueryFilters } from '@/data/apiTaxaQueryHelpers';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, View } from 'react-native';
import { resetTaxaQuerySessionCache } from '@/hooks/search/taxaQuerySearchCache';

const mockPush = jest.fn();
let mockPathname = '/';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(),
}));

const mockFetchTextResults = jest.fn();
const mockFetchRelativeRankings = jest.fn();
const mockFetchTaxaQuery = jest.fn();

const toNormalizedTaxaQueryTextResult = (row: any) => ({
  taxon_id: row.taxon_id,
  scientific_name: row.scientific_name ?? '',
  common_name: row.common_name ?? '',
  common_names: row.common_names ?? [],
  image_source: row.image_source ?? null,
  sample_count: row.sample_count ?? null,
  _raw: row,
});

const toTaxaQueryTextResponse = (
  rows: any[],
  params: { q?: string; limit?: number; offset?: number },
) => ({
  query: params.q ?? null,
  scope: {
    withinTaxonId: null,
    descendantRank: null,
    location: null,
    minSamples: null,
    includeSpeciesLike: false,
  },
  sort: {
    variable: null,
    metric: null,
    order: null,
    units: null,
  },
  total: rows.length,
  matchedTotal: rows.length,
  eligibleTotal: rows.length,
  emptyReason:
    rows.length > 0 ? null : params.q ? 'no_text_matches' : 'no_query',
  limit: params.limit ?? rows.length,
  offset: params.offset ?? 0,
  results: rows.map(toNormalizedTaxaQueryTextResult),
});

const toTaxaQueryRankingResponse = (
  payload: any,
  params: { q?: string; limit?: number; offset?: number },
) => ({
  query: params.q ?? null,
  scope: {
    withinTaxon:
      payload.ancestorTaxonId != null ? String(payload.ancestorTaxonId) : null,
    withinTaxonId: payload.ancestorTaxonId ?? null,
    descendantRank: payload.rank ?? null,
    location: null,
    minSamples: payload.minSamples ?? null,
    includeSpeciesLike: payload.includeSpeciesLike ?? false,
  },
  sort: {
    variable: payload.variable ?? null,
    metric: payload.metric ?? null,
    order: payload.order ?? 'asc',
    units: payload.units ?? null,
  },
  total: payload.total ?? 0,
  matchedTotal: payload.matchedTotal ?? payload.total ?? 0,
  eligibleTotal: payload.eligibleTotal ?? payload.total ?? 0,
  emptyReason: payload.emptyReason ?? null,
  limit: payload.limit ?? params.limit ?? 0,
  offset: params.offset ?? 0,
  results: Array.isArray(payload.entries)
    ? payload.entries.map((entry: any) => ({
        taxon_id: entry.taxonId,
        scientific_name: entry.scientificName,
        common_name: entry.commonName,
        common_names: entry.commonName ? [entry.commonName] : [],
        image_source: entry.image_source ?? null,
        image_url: entry.image_url ?? null,
        image_file: entry.image_file ?? null,
        sort_value: entry.value,
        count: entry.count ?? null,
        sample_count: entry.sample_count ?? entry.count ?? null,
        position: entry.position,
        percentile: entry.percentile,
        _raw: entry,
      }))
    : [],
});

jest.mock('@/data/apiTaxaQueryHelpers', () => {
  const actual = jest.requireActual('@/data/apiTaxaQueryHelpers');

  return {
    ...actual,
    fetchTaxaQuery: jest.fn((params, options) =>
      mockFetchTaxaQuery(params, options),
    ),
  };
});

jest.mock('@/data/apiShared', () => ({
  ...jest.requireActual('@/data/apiShared'),
  BACKEND_BASE: 'https://api.example.test',
}));

const mockUseResponsive = useResponsive as jest.MockedFunction<
  typeof useResponsive
>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockImpactAsync = Haptics.impactAsync as jest.MockedFunction<
  typeof Haptics.impactAsync
>;

const SEARCH_WRAPPER_LAYOUT_HEIGHT = 40;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_LOGO_LIGHT = require('@/assets/images/wherewild.png');
const DEFAULT_LOGO_DARK = require('@/assets/images/wherewild-dark-background.png');

const createFilterParams = (
  overrides: Partial<SearchTaxaQueryFilters> = {},
): SearchTaxaQueryFilters => ({
  sortVariable: 'bio_1',
  sortMetric: 'mean',
  descendantRank: 'species',
  sortOrder: 'asc',
  limit: 10,
  ...overrides,
});

describe('WebPageHeader', () => {
  const setupSearchVisibility = () => {
    const searchWrapper = screen.getByTestId('page-header-search-wrapper');
    act(() => {
      searchWrapper.props.onLayout?.({
        nativeEvent: { layout: { height: SEARCH_WRAPPER_LAYOUT_HEIGHT } },
      });
    });

    const searchInput = screen.getByLabelText('Search input');
    act(() => {
      searchInput.props.onFocus?.({});
    });

    return { searchInput };
  };

  beforeEach(() => {
    resetTaxaQuerySessionCache();
    mockImpactAsync.mockClear();
    mockPush.mockClear();
    mockPathname = '/';
    mockFetchTextResults.mockReset();
    mockFetchRelativeRankings.mockReset();
    mockFetchTaxaQuery.mockReset();
    mockUseColorScheme.mockReturnValue('light');
    mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' } as ReturnType<
      typeof useResponsive
    >);
    mockFetchTaxaQuery.mockImplementation(async (params) => {
      if (
        (params.withinTaxonId || params.q) &&
        params.sortVariable &&
        params.sortMetric
      ) {
        const rankingPayload = await mockFetchRelativeRankings({
          taxonId: params.withinTaxonId,
          rank: params.descendantRank,
          variableId: params.sortVariable,
          metric: params.sortMetric,
          units: params.units,
          limit: params.limit,
          order: params.sortOrder,
          minSamples: params.minSamples,
          includeSpeciesLike: params.includeSpeciesLike,
          location: params.location,
        });
        return toTaxaQueryRankingResponse(rankingPayload, params);
      }

      const rows = await mockFetchTextResults(params);
      return toTaxaQueryTextResponse(rows, params);
    });
    mockFetchTextResults.mockResolvedValue([]);
    mockFetchRelativeRankings.mockResolvedValue({
      ancestorTaxonId: 212,
      rank: 'SPECIES',
      variable: 'bio_1',
      metric: 'mean',
      total: 0,
      matchedTotal: 0,
      eligibleTotal: 0,
      emptyReason: 'no_text_matches',
      limit: 10,
      entries: [],
      order: 'asc',
      includeSpeciesLike: false,
      distribution: null,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders title, search input, and default actions', () => {
    render(<WebPageHeader />);

    expect(screen.getByText('WhereWild')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search').props.value).toBe('');
    expect(screen.getByLabelText('Help')).toBeTruthy();
    expect(screen.getByLabelText('About')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
    expect(screen.getByLabelText('Filter search results')).toBeTruthy();
    expect(screen.getByLabelText('Reset filters')).toBeTruthy();
  });

  it('uses the dark-background logo asset in dark mode', () => {
    mockUseColorScheme.mockReturnValue('dark');

    render(<WebPageHeader />);

    expect(screen.getByLabelText('WhereWild logo').props.source).toBe(
      DEFAULT_LOGO_DARK,
    );
  });

  it('uses the light logo asset by default in light mode', () => {
    render(<WebPageHeader />);

    expect(screen.getByLabelText('WhereWild logo').props.source).toBe(
      DEFAULT_LOGO_LIGHT,
    );
  });

  it('navigates to about when default About action is pressed', () => {
    render(<WebPageHeader />);

    fireEvent.press(screen.getByLabelText('About'));

    expect(mockPush).toHaveBeenCalledWith('/about');
  });

  it('does not navigate when already on About', () => {
    mockPathname = '/about';
    render(<WebPageHeader />);

    fireEvent.press(screen.getByLabelText('About'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('invokes action handler when pressed', () => {
    const handlePress = jest.fn();
    render(
      <WebPageHeader
        actions={[
          { label: 'Docs', icon: <IconHelpCircle />, onPress: handlePress },
        ]}
      />,
    );

    fireEvent.press(screen.getByLabelText('Docs'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('navigates home when logo is pressed from another page', () => {
    mockPathname = '/about';
    render(<WebPageHeader />);

    const logoLink = screen.getByLabelText('Go to home');
    expect(logoLink.props.accessibilityRole).toBe('link');
    fireEvent.press(logoLink);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('does not navigate when already on the home page', () => {
    render(<WebPageHeader />);

    fireEvent.press(screen.getByLabelText('Go to home'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('invokes filter handler when filter button is pressed', () => {
    const handleFilter = jest.fn();
    render(<WebPageHeader onFilterPress={handleFilter} />);

    fireEvent.press(screen.getByLabelText('Filter search results'));
    expect(handleFilter).toHaveBeenCalledTimes(1);
  });

  it('invokes reset filter handler when reset button is pressed', () => {
    const handleResetFilter = jest.fn();
    render(<WebPageHeader onResetFilterPress={handleResetFilter} />);

    fireEvent.press(screen.getByLabelText('Reset filters'));
    expect(handleResetFilter).toHaveBeenCalledTimes(1);
  });

  it('can hide the filter button', () => {
    render(<WebPageHeader showFilterButton={false} />);

    expect(screen.queryByLabelText('Filter search results')).toBeNull();
    expect(screen.queryByLabelText('Reset filters')).toBeNull();
  });

  it('can hide the reset filter button only', () => {
    render(<WebPageHeader showResetFilterButton={false} />);

    expect(screen.queryByLabelText('Reset filters')).toBeNull();
    expect(screen.getByLabelText('Filter search results')).toBeTruthy();
  });

  it('does not show reset filter button when filter button is hidden, even if explicitly enabled', () => {
    render(
      <WebPageHeader showFilterButton={false} showResetFilterButton={true} />,
    );

    expect(screen.queryByLabelText('Filter search results')).toBeNull();
    expect(screen.queryByLabelText('Reset filters')).toBeNull();
  });
  it('supports a custom desktop filter button label', () => {
    render(<WebPageHeader filterLabel='Hide filter' />);

    expect(screen.getByText('Hide filter')).toBeTruthy();
  });

  it('renders compact layout and exposes actions behind the menu button', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<
      typeof useResponsive
    >);
    render(<WebPageHeader />);

    expect(screen.queryByText('WhereWild')).toBeNull();
    expect(screen.getByLabelText('Filter search results')).toBeTruthy();
    expect(screen.getByLabelText('Reset filters')).toBeTruthy();

    expect(screen.queryByLabelText('About')).toBeNull();
    fireEvent.press(screen.getByLabelText('Open menu'));
    expect(screen.getByLabelText('Help')).toBeTruthy();
    expect(screen.getByLabelText('About')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();

    // Close the menu before unmounting to avoid Portal cleanup timeout
    const backdrop = screen.getByTestId('page-header-menu-backdrop');
    fireEvent.press(backdrop);
  });

  it('plays a light impact haptic when dismissing the compact menu from the backdrop', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<
      typeof useResponsive
    >);
    render(<WebPageHeader />);

    fireEvent.press(screen.getByLabelText('Open menu'));
    fireEvent.press(screen.getByTestId('page-header-menu-backdrop'));

    expect(mockImpactAsync).toHaveBeenCalledTimes(2);
    expect(mockImpactAsync).toHaveBeenNthCalledWith(
      1,
      Haptics.ImpactFeedbackStyle.Light,
    );
    expect(mockImpactAsync).toHaveBeenNthCalledWith(
      2,
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it('submits search queries and routes empty submissions to the search page', async () => {
    jest.useFakeTimers();
    render(<WebPageHeader />);

    const searchInput = screen.getByLabelText('Search input');
    fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: '' } });
    fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: '   ' } });
    expect(mockPush).toHaveBeenNthCalledWith(1, '/search');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/search');

    fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'owl' } });
    expect(mockPush).toHaveBeenNthCalledWith(3, {
      pathname: '/search',
      params: { query: 'owl' },
    });

    fireEvent(searchInput, 'submitEditing', {
      nativeEvent: { text: '  hawk  ' },
    });
    expect(mockPush).toHaveBeenNthCalledWith(4, {
      pathname: '/search',
      params: { query: 'hawk' },
    });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('does not navigate when submitting search from /search route', () => {
    mockPathname = '/search';
    render(<WebPageHeader />);

    const searchInput = screen.getByLabelText('Search input');
    fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'owl' } });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('updates search query when controlled searchQuery prop changes', () => {
    const { rerender } = render(<WebPageHeader searchQuery='fox' />);

    expect(screen.getByLabelText('Search input').props.value).toBe('fox');

    rerender(<WebPageHeader searchQuery='owl' />);

    expect(screen.getByLabelText('Search input').props.value).toBe('owl');

    rerender(<WebPageHeader searchQuery='' />);

    expect(screen.getByLabelText('Search input').props.value).toBe('');
  });

  it('clears a locally typed query when navigation leaves the search route', () => {
    mockPathname = '/search';
    const { rerender } = render(<WebPageHeader />);

    const searchInput = screen.getByLabelText('Search input');
    fireEvent.changeText(searchInput, 'oak');

    expect(screen.getByLabelText('Search input').props.value).toBe('oak');

    mockPathname = '/about';
    rerender(<WebPageHeader />);

    expect(screen.getByLabelText('Search input').props.value).toBe('');
  });

  it('clears a locally typed query when navigation moves between non-search routes', () => {
    mockPathname = '/about';
    const { rerender } = render(<WebPageHeader />);

    const searchInput = screen.getByLabelText('Search input');
    fireEvent.changeText(searchInput, 'oak');

    expect(screen.getByLabelText('Search input').props.value).toBe('oak');

    mockPathname = '/settings';
    rerender(<WebPageHeader />);

    expect(screen.getByLabelText('Search input').props.value).toBe('');
  });

  it('reports search query changes through onSearchQueryChange', () => {
    const handleSearchQueryChange = jest.fn();

    render(<WebPageHeader onSearchQueryChange={handleSearchQueryChange} />);

    const searchInput = screen.getByLabelText('Search input');
    fireEvent.changeText(searchInput, 'canis');

    expect(handleSearchQueryChange).toHaveBeenLastCalledWith('canis');
  });

  it('shows sample counts in text-search descriptions when a minimum samples filter is applied', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 91,
        scientific_name: 'Canis lupus',
        common_name: 'Gray Wolf',
        common_names: ['Gray Wolf', 'Wolf'],
        sample_count: 7,
      },
    ]);

    render(
      <WebPageHeader
        filterParams={{
          location: null,
          withinTaxonId: null,
          descendantRank: null,
          includeSpeciesLike: null,
          sortVariable: null,
          sortMetric: null,
          sortOrder: 'asc',
          minSamples: 3,
          limit: 10,
        }}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'wolf');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    const result = await screen.findByTestId('search-result-91');
    expect(result.props.accessibilityLabel).toContain('7 samples');

    jest.useRealTimers();
  });

  it('does not persist header search query across remounts', () => {
    const { unmount } = render(<WebPageHeader />);

    const searchInput = screen.getByLabelText('Search input');
    fireEvent.changeText(searchInput, 'canis');

    unmount();

    render(<WebPageHeader />);
    expect(screen.getByLabelText('Search input').props.value).toBe('');
  });

  it('shows search results after querying and navigates on selection', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 12,
        scientific_name: 'Canis lupus',
        common_name: 'Gray Wolf',
      },
      { taxon_id: 'invalid' },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'wolf');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchTextResults).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'wolf' }),
      );
    });

    const result = await screen.findByTestId('search-result-12');
    expect(screen.queryByTestId('search-result-invalid')).toBeNull();
    expect(screen.getAllByTestId(/search-result-/)).toHaveLength(1);
    fireEvent.press(result);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['12', 'canis-lupus'] },
    });

    jest.useRealTimers();
  });

  it('renders thumbnails for ranking results when image_url is provided', async () => {
    jest.useFakeTimers();
    mockFetchRelativeRankings.mockResolvedValue({
      ancestorTaxonId: 212,
      rank: 'SPECIES',
      variable: 'bio_1',
      metric: 'mean',
      total: 1,
      limit: 10,
      entries: [
        {
          taxonId: 12,
          scientificName: 'Canis lupus',
          commonName: 'Gray Wolf',
          image_url: 'https://example.com/wolf.png',
          value: 1,
          position: 1,
          count: 99,
        },
      ],
      order: 'asc',
      includeSpeciesLike: false,
      distribution: null,
    });

    render(
      <WebPageHeader
        filterParams={createFilterParams({ withinTaxonId: 212 })}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'wolf');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchRelativeRankings).toHaveBeenCalled();
    });

    const result = await screen.findByTestId('search-result-12');
    expect(within(result).getByTestId('species-card-image')).toBeTruthy();

    jest.useRealTimers();
  });

  it('normalizes ranked names and includes ranked value in card description', async () => {
    jest.useFakeTimers();
    mockFetchRelativeRankings.mockResolvedValue({
      ancestorTaxonId: 212,
      rank: 'SPECIES',
      variable: 'bio_1',
      metric: 'mean',
      total: 1,
      limit: 10,
      entries: [
        {
          taxonId: 77,
          scientificName: 'Canis_lupus',
          commonName: 'Gray_wolf',
          value: 12.5,
          position: 1,
          count: 9,
        },
      ],
      order: 'asc',
      includeSpeciesLike: false,
      distribution: null,
    });

    render(
      <WebPageHeader
        filterParams={createFilterParams({ withinTaxonId: 212 })}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'wolf');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    const result = await screen.findByTestId('search-result-77');
    expect(screen.getByText('Canis lupus')).toBeTruthy();
    expect(result.props.accessibilityLabel).toContain(
      '12.5 | Rank 1 of 1 | Percentile 100% | 9 samples',
    );

    jest.useRealTimers();
  });

  it('scales fractional ranked percentile values to percentage display', async () => {
    jest.useFakeTimers();
    mockFetchRelativeRankings.mockResolvedValue({
      ancestorTaxonId: 212,
      rank: 'SPECIES',
      variable: 'bio_1',
      metric: 'mean',
      total: 10,
      limit: 10,
      entries: [
        {
          taxonId: 78,
          scientificName: 'Vulpes vulpes',
          commonName: 'Red fox',
          value: 7,
          position: 2,
          percentile: 0.95,
          count: 9,
        },
      ],
      order: 'asc',
      includeSpeciesLike: false,
      distribution: null,
    });

    render(
      <WebPageHeader
        filterParams={createFilterParams({ withinTaxonId: 212 })}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'fox');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    const result = await screen.findByTestId('search-result-78');
    expect(result.props.accessibilityLabel).toContain(
      '7 | Rank 2 of 10 | Percentile 95% | 9 samples',
    );

    jest.useRealTimers();
  });

  it('supports search-driven ranking without a base taxon when sort fields are set', async () => {
    jest.useFakeTimers();
    mockFetchRelativeRankings.mockClear();
    mockFetchTaxaQuery.mockClear();
    mockFetchRelativeRankings.mockResolvedValue({
      ancestorTaxonId: 0,
      rank: 'SPECIES',
      variable: 'bio_1',
      metric: 'mean',
      total: 3,
      limit: 10,
      entries: [
        {
          taxonId: 501,
          scientificName: 'Quercus alba',
          commonName: 'White Oak',
          value: 15.2,
          position: 1,
          count: 12,
        },
      ],
      order: 'asc',
      includeSpeciesLike: false,
      distribution: null,
    });

    render(
      <WebPageHeader
        filterParams={createFilterParams({ descendantRank: undefined })}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'oak');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchRelativeRankings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          taxonId: null,
          variableId: 'bio_1',
          metric: 'mean',
        }),
      );
    });

    const result = await screen.findByTestId('search-result-501');
    expect(result.props.accessibilityLabel).toContain(
      '15.2 | Rank 1 of 3 | Percentile 100% | 12 samples',
    );
    expect(mockFetchTaxaQuery).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('does not refetch when rerendered with semantically identical filter params', async () => {
    jest.useFakeTimers();
    mockFetchRelativeRankings.mockClear();
    mockFetchTaxaQuery.mockClear();
    mockFetchRelativeRankings.mockResolvedValue({
      ancestorTaxonId: 2519,
      rank: 'SPECIES',
      variable: 'bio_1',
      metric: 'median',
      total: 1,
      matchedTotal: 1,
      eligibleTotal: 1,
      emptyReason: null,
      limit: 10,
      entries: [
        {
          taxonId: 701,
          scientificName: 'Felis catus',
          commonName: 'Cat',
          value: 3.2,
          position: 1,
          percentile: 100,
          count: 14,
        },
      ],
      order: 'asc',
      includeSpeciesLike: true,
      distribution: null,
    });

    const { rerender } = render(
      <WebPageHeader
        filterParams={createFilterParams({
          withinTaxonId: 2519,
          sortMetric: 'median',
          includeSpeciesLike: true,
        })}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'cat');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await screen.findByTestId('search-result-701');
    const callCountAfterInitialSearch = mockFetchTaxaQuery.mock.calls.length;

    await act(async () => {
      rerender(
        <WebPageHeader
          filterParams={createFilterParams({
            withinTaxonId: 2519,
            sortMetric: 'median',
            includeSpeciesLike: true,
          })}
        />,
      );
      await Promise.resolve();
    });

    expect(mockFetchTaxaQuery).toHaveBeenCalledTimes(
      callCountAfterInitialSearch,
    );

    jest.useRealTimers();
  });

  it('aborts replaced requests and only applies the latest typed query', async () => {
    jest.useFakeTimers();
    const requests: {
      query: string;
      signal?: AbortSignal;
      resolve: (value: any) => void;
    }[] = [];

    mockFetchTaxaQuery.mockImplementation(
      (params: { q?: string }, options?: { signal?: AbortSignal }) => {
        return new Promise((resolve) => {
          requests.push({
            query: params.q ?? '',
            signal: options?.signal,
            resolve,
          });
        });
      },
    );

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');

    await act(async () => {
      fireEvent.changeText(searchInput, 'cac');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchTaxaQuery).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      fireEvent.changeText(searchInput, 'cact');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchTaxaQuery).toHaveBeenCalledTimes(2);
    });

    expect(requests[0]?.signal?.aborted).toBe(true);

    await act(async () => {
      fireEvent.changeText(searchInput, 'cactus');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchTaxaQuery).toHaveBeenCalledTimes(3);
    });

    expect(requests[1]?.signal?.aborted).toBe(true);

    await act(async () => {
      requests[0]?.resolve(
        toTaxaQueryTextResponse(
          [
            {
              taxon_id: 90,
              scientific_name: 'Old cactus',
              common_name: 'Old cactus',
            },
          ],
          { q: 'cac', limit: 10, offset: 0 },
        ),
      );
      requests[1]?.resolve(
        toTaxaQueryTextResponse(
          [
            {
              taxon_id: 91,
              scientific_name: 'Older cactus',
              common_name: 'Older cactus',
            },
          ],
          { q: 'cact', limit: 10, offset: 0 },
        ),
      );
      requests[2]?.resolve(
        toTaxaQueryTextResponse(
          [
            {
              taxon_id: 92,
              scientific_name: 'Carnegiea gigantea',
              common_name: 'Saguaro',
            },
          ],
          { q: 'cactus', limit: 10, offset: 0 },
        ),
      );
      await Promise.resolve();
    });

    expect(await screen.findByText('Saguaro')).toBeTruthy();
    expect(screen.queryByText('Old cactus')).toBeNull();
    expect(screen.queryByText('Older cactus')).toBeNull();

    jest.useRealTimers();
  });

  it('reuses cached identical searches within the session', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValueOnce([
      {
        taxon_id: 201,
        scientific_name: 'Carnegiea gigantea',
        common_name: 'Saguaro',
      },
    ] as any);
    mockFetchTextResults.mockResolvedValueOnce([
      {
        taxon_id: 202,
        scientific_name: 'Opuntia ficus-indica',
        common_name: 'Prickly Pear',
      },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'cactus');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(await screen.findByText('Saguaro')).toBeTruthy();
    expect(mockFetchTaxaQuery).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.changeText(searchInput, 'cact');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(await screen.findByText('Prickly Pear')).toBeTruthy();
    expect(mockFetchTaxaQuery).toHaveBeenCalledTimes(2);

    await act(async () => {
      fireEvent.changeText(searchInput, 'cactus');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(await screen.findByText('Saguaro')).toBeTruthy();
    expect(mockFetchTaxaQuery).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('does not let an older in-flight request overwrite cached active results', async () => {
    jest.useFakeTimers();
    let resolveCact: ((value: any[]) => void) | null = null;

    mockFetchTextResults.mockResolvedValueOnce([
      {
        taxon_id: 301,
        scientific_name: 'Carnegiea gigantea',
        common_name: 'Saguaro',
      },
    ] as any);
    mockFetchTextResults.mockImplementationOnce(
      () =>
        new Promise<any[]>((resolve) => {
          resolveCact = resolve;
        }),
    );

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');

    await act(async () => {
      fireEvent.changeText(searchInput, 'cactus');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('Saguaro')).toBeTruthy();

    await act(async () => {
      fireEvent.changeText(searchInput, 'cact');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchTaxaQuery).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      fireEvent.changeText(searchInput, 'cactus');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(await screen.findByText('Saguaro')).toBeTruthy();
    expect(mockFetchTaxaQuery).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveCact?.([
        {
          taxon_id: 302,
          scientific_name: 'Older cactus',
          common_name: 'Older cactus',
        },
      ]);
      await Promise.resolve();
    });

    expect(await screen.findByText('Saguaro')).toBeTruthy();
    expect(screen.queryByText('Older cactus')).toBeNull();

    jest.useRealTimers();
  });

  it('renders ranking thumbnails when image_source is provided directly', async () => {
    jest.useFakeTimers();
    mockFetchRelativeRankings.mockResolvedValue({
      ancestorTaxonId: 212,
      rank: 'SPECIES',
      variable: 'bio_1',
      metric: 'mean',
      total: 1,
      limit: 10,
      entries: [
        {
          taxonId: 45,
          scientificName: 'Canis latrans',
          commonName: 'Coyote',
          image_source: 'https://example.com/coyote.png',
          value: 1,
          position: 1,
          count: 12,
        },
      ],
      order: 'asc',
      includeSpeciesLike: false,
      distribution: null,
    });

    render(
      <WebPageHeader
        filterParams={createFilterParams({ withinTaxonId: 212 })}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'coyote');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    const result = await screen.findByTestId('search-result-45');
    const image = within(result).getByTestId('species-card-image');
    expect(image.props.source).toEqual({
      uri: 'https://example.com/coyote.png',
    });

    jest.useRealTimers();
  });

  it('renders thumbnails for ranking results when only image_file is provided', async () => {
    jest.useFakeTimers();
    mockFetchRelativeRankings.mockResolvedValue({
      ancestorTaxonId: 212,
      rank: 'SPECIES',
      variable: 'bio_1',
      metric: 'mean',
      total: 1,
      limit: 10,
      entries: [
        {
          taxonId: 44,
          scientificName: 'Vulpes vulpes',
          commonName: 'Red Fox',
          image_file: 'images/mammals/red fox.png',
          value: 1,
          position: 1,
          count: 10,
        },
      ],
      order: 'asc',
      includeSpeciesLike: false,
      distribution: null,
    });

    render(
      <WebPageHeader
        filterParams={createFilterParams({ withinTaxonId: 212 })}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'fox');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    const result = await screen.findByTestId('search-result-44');
    const image = within(result).getByTestId('species-card-image');
    expect(image.props.source).toEqual({
      uri: 'https://api.example.test/static/species_images/red%20fox.png',
    });

    jest.useRealTimers();
  });

  it('filters out ranking entries with invalid taxon ids', async () => {
    jest.useFakeTimers();
    mockFetchRelativeRankings.mockResolvedValue({
      ancestorTaxonId: 212,
      rank: 'SPECIES',
      variable: 'bio_1',
      metric: 'mean',
      total: 1,
      limit: 10,
      entries: [
        {
          taxonId: 'not-a-number',
          scientificName: 'Invalid taxon',
          commonName: 'Invalid',
          value: 1,
          position: 1,
          count: 1,
        },
      ],
      order: 'asc',
      includeSpeciesLike: false,
      distribution: null,
    });

    render(
      <WebPageHeader
        filterParams={createFilterParams({ withinTaxonId: 212 })}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'invalid');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(screen.queryByTestId(/search-result-/)).toBeNull();

    jest.useRealTimers();
  });

  it('does not render image source when ranking image fields are blank strings', async () => {
    jest.useFakeTimers();
    mockFetchRelativeRankings.mockResolvedValue({
      ancestorTaxonId: 212,
      rank: 'SPECIES',
      variable: 'bio_1',
      metric: 'mean',
      total: 1,
      limit: 10,
      entries: [
        {
          taxonId: 46,
          scientificName: 'Urocyon cinereoargenteus',
          commonName: 'Gray Fox',
          image_source: '   ',
          image_url: '  ',
          image_file: '   ',
          value: 1,
          position: 1,
          count: 5,
        },
      ],
      order: 'asc',
      includeSpeciesLike: false,
      distribution: null,
    });

    render(
      <WebPageHeader
        filterParams={createFilterParams({ withinTaxonId: 212 })}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'fox');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(await screen.findByTestId('search-result-46')).toBeTruthy();

    jest.useRealTimers();
  });

  it('surfaces unified ranked query errors', async () => {
    jest.useFakeTimers();
    mockFetchRelativeRankings.mockRejectedValue(
      new Error('Ranked query unavailable'),
    );

    render(
      <WebPageHeader
        filterParams={createFilterParams({
          withinTaxonId: 2519,
          includeSpeciesLike: true,
        })}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'spinystar');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });
    expect(await screen.findByText('Ranked query unavailable')).toBeTruthy();

    jest.useRealTimers();
  });

  it('keeps results mounted long enough to navigate when click blurs input first', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 312,
        scientific_name: 'Puma concolor',
        common_name: 'Mountain Lion',
      },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'puma');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await screen.findByTestId('header-search-results');
    const result = await screen.findByTestId('search-result-312');

    act(() => {
      searchInput.props.onBlur?.({});
    });

    fireEvent.press(result);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['312', 'puma-concolor'] },
    });

    jest.useRealTimers();
  });

  it('surfaces search errors on failure', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockRejectedValue(new Error('Search failed'));

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'error');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchTextResults).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'error' }),
      );
    });
    expect(await screen.findByText('Search failed')).toBeTruthy();

    jest.useRealTimers();
  });

  it('maps fallback fields when results are missing data', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: '42',
        scientific_name: '',
        common_name: 'snowy_owl',
        _raw: { description: 'Seen at dusk' },
        image_source: { uri: 'https://example.com/owl.png' },
      },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'owl');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchTextResults).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'owl' }),
      );
    });

    expect(await screen.findByText('snowy owl')).toBeTruthy();

    jest.useRealTimers();
  });

  it('suppresses navigation when scientific name normalizes to empty', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      { taxon_id: 7, scientific_name: '   ', common_name: 'Silent Owl' },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'silent');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    const result = await screen.findByTestId('search-result-7');
    fireEvent.press(result);
    expect(mockPush).not.toHaveBeenCalledWith(
      expect.stringContaining('/species/7'),
    );

    jest.useRealTimers();
  });

  it('moves the preview highlight down with arrow keys and selects the active result on enter', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 11,
        scientific_name: 'Vulpes vulpes',
        common_name: 'Red Fox',
      },
      { taxon_id: 12, scientific_name: 'Canis latrans', common_name: 'Coyote' },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'ca');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await screen.findByTestId('header-search-results');

    const firstArrowPreventDefault = jest.fn();
    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'ArrowDown' },
      preventDefault: firstArrowPreventDefault,
    });

    const secondArrowPreventDefault = jest.fn();
    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'ArrowDown' },
      preventDefault: secondArrowPreventDefault,
    });

    const enterPreventDefault = jest.fn();
    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'Enter' },
      preventDefault: enterPreventDefault,
    });

    expect(firstArrowPreventDefault).toHaveBeenCalledTimes(1);
    expect(secondArrowPreventDefault).toHaveBeenCalledTimes(1);
    expect(enterPreventDefault).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['12', 'canis-latrans'] },
    });

    jest.useRealTimers();
  });

  it('moves the preview highlight up to the last result when nothing is active yet', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 21,
        scientific_name: 'Buteo jamaicensis',
        common_name: 'Red-tailed Hawk',
      },
      {
        taxon_id: 22,
        scientific_name: 'Strix varia',
        common_name: 'Barred Owl',
      },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'owl');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await screen.findByTestId('header-search-results');

    const arrowPreventDefault = jest.fn();
    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'ArrowUp' },
      preventDefault: arrowPreventDefault,
    });

    const enterPreventDefault = jest.fn();
    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'Enter' },
      preventDefault: enterPreventDefault,
    });

    expect(arrowPreventDefault).toHaveBeenCalledTimes(1);
    expect(enterPreventDefault).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['22', 'strix-varia'] },
    });

    jest.useRealTimers();
  });

  it('moves the preview highlight up from an active result and wraps to the previous item', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      { taxon_id: 31, scientific_name: 'Lynx rufus', common_name: 'Bobcat' },
      {
        taxon_id: 32,
        scientific_name: 'Puma concolor',
        common_name: 'Mountain Lion',
      },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'cat');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await screen.findByTestId('header-search-results');

    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'ArrowDown' },
      preventDefault: jest.fn(),
    });

    const arrowPreventDefault = jest.fn();
    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'ArrowUp' },
      preventDefault: arrowPreventDefault,
    });

    const enterPreventDefault = jest.fn();
    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'Enter' },
      preventDefault: enterPreventDefault,
    });

    expect(arrowPreventDefault).toHaveBeenCalledTimes(1);
    expect(enterPreventDefault).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['32', 'puma-concolor'] },
    });

    jest.useRealTimers();
  });

  it('ignores preview key presses when the event does not expose a key', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 41,
        scientific_name: 'Canis lupus',
        common_name: 'Gray Wolf',
      },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'wolf');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await screen.findByTestId('header-search-results');

    const preventDefault = jest.fn();
    fireEvent(searchInput, 'keyPress', { preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('closes the preview on escape without clearing the query and reopens on query change', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      { taxon_id: 61, scientific_name: 'Canis latrans', common_name: 'Coyote' },
      {
        taxon_id: 62,
        scientific_name: 'Canis lupus',
        common_name: 'Gray Wolf',
      },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'can');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(await screen.findByTestId('header-search-results')).toBeTruthy();

    const escapePreventDefault = jest.fn();
    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'Escape' },
      preventDefault: escapePreventDefault,
    });

    expect(escapePreventDefault).toHaveBeenCalledTimes(1);
    expect(searchInput.props.value).toBe('can');
    expect(screen.queryByTestId('header-search-results')).toBeNull();

    await act(async () => {
      fireEvent.changeText(searchInput, 'cani');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(searchInput.props.value).toBe('cani');
    expect(await screen.findByTestId('header-search-results')).toBeTruthy();

    jest.useRealTimers();
  });

  it('clears the active preview selection when refreshed results shrink below the active index', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 51,
        scientific_name: 'Vulpes vulpes',
        common_name: 'Red Fox',
      },
      {
        taxon_id: 52,
        scientific_name: 'Urocyon cinereoargenteus',
        common_name: 'Gray Fox',
      },
    ] as any);

    const { rerender } = render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'fox');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await screen.findByTestId('header-search-results');

    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'ArrowDown' },
      preventDefault: jest.fn(),
    });
    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'ArrowDown' },
      preventDefault: jest.fn(),
    });

    await act(async () => {
      rerender(<WebPageHeader filterParams={{ limit: 1 }} />);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchTextResults).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 1, q: 'fox' }),
      );
    });

    mockPush.mockClear();

    const enterPreventDefault = jest.fn();
    fireEvent(searchInput, 'keyPress', {
      nativeEvent: { key: 'Enter' },
      preventDefault: enterPreventDefault,
    });

    expect(enterPreventDefault).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('hides results when dropdown visibility is disabled', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 99,
        scientific_name: 'Vulpes vulpes',
        common_name: 'Red Fox',
      },
    ] as any);

    render(<WebPageHeader showSearchResultsDropdown={false} />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'fox');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('header-search-results')).toBeNull();

    jest.useRealTimers();
  });

  it('hides results when focus moves from search input to filter button', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 123,
        scientific_name: 'Buteo jamaicensis',
        common_name: 'Red-tailed Hawk',
      },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'hawk');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(await screen.findByTestId('header-search-results')).toBeTruthy();

    act(() => {
      searchInput.props.onBlur?.({});
    });

    await act(async () => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    const filterButton = screen.getByLabelText('Filter search results');
    fireEvent(filterButton, 'focus');

    expect(screen.queryByTestId('header-search-results')).toBeNull();

    jest.useRealTimers();
  });

  it('uses default error message for non-Error rejections', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockRejectedValue('nope');
    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'fail');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(await screen.findByText('Search failed')).toBeTruthy();

    jest.useRealTimers();
  });

  it('hides results when search input blur grace expires', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 55,
        scientific_name: 'Strix aluco',
        common_name: 'Tawny Owl',
      },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'owl');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(await screen.findByTestId('header-search-results')).toBeTruthy();

    act(() => {
      searchInput.props.onBlur?.({});
    });

    await act(async () => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('header-search-results')).toBeNull();

    jest.useRealTimers();
  });

  it('clears previous blur-grace timer when blur happens repeatedly', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      { taxon_id: 56, scientific_name: 'Tyto alba', common_name: 'Barn Owl' },
    ] as any);

    const { unmount } = render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'owl');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    act(() => {
      searchInput.props.onBlur?.({});
      jest.advanceTimersByTime(50);
      searchInput.props.onBlur?.({});
    });

    await act(async () => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('header-search-results')).toBeNull();

    unmount();
    jest.useRealTimers();
  });

  it('cleans up blur-grace timer on unmount before timeout fires', async () => {
    jest.useFakeTimers();
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 57,
        scientific_name: 'Athene cunicularia',
        common_name: 'Burrowing Owl',
      },
    ] as any);

    const { unmount } = render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'owl');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    act(() => {
      searchInput.props.onBlur?.({});
    });

    unmount();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    jest.useRealTimers();
  });

  it('toggles compact menu closed when open button is pressed twice', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<
      typeof useResponsive
    >);
    render(<WebPageHeader />);

    const menuButton = screen.getByLabelText('Open menu');
    fireEvent.press(menuButton);
    expect(screen.getByLabelText('Help')).toBeTruthy();

    fireEvent.press(menuButton);
    expect(screen.queryByLabelText('Help')).toBeNull();
  });

  it('applies compact overlay edge insets from responsive margin', async () => {
    jest.useFakeTimers();
    mockUseResponsive.mockReturnValue({
      breakpoint: 'phone',
      marginHorizontal: 32,
    } as ReturnType<typeof useResponsive>);
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 77,
        scientific_name: 'Bubo bubo',
        common_name: 'Eurasian Eagle-Owl',
      },
    ] as any);

    render(<WebPageHeader />);
    const searchWrapper = screen.getByTestId('page-header-search-wrapper');
    act(() => {
      searchWrapper.props.onLayout?.({
        nativeEvent: { layout: { height: SEARCH_WRAPPER_LAYOUT_HEIGHT } },
      });
    });
    const searchInput = screen.getByLabelText('Search input');
    act(() => {
      searchInput.props.onFocus?.({});
    });

    await act(async () => {
      fireEvent.changeText(searchInput, 'owl');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    const panel = await screen.findByTestId('header-search-results');
    const flattenedStyle = StyleSheet.flatten(panel.props.style);

    expect(flattenedStyle?.left).toBe(32);
    expect(flattenedStyle?.right).toBe(32);

    jest.useRealTimers();
  });

  it('uses compact header row frame to position overlay top', async () => {
    jest.useFakeTimers();
    mockUseResponsive.mockReturnValue({
      breakpoint: 'tablet',
      marginHorizontal: 24,
    } as ReturnType<typeof useResponsive>);
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 88,
        scientific_name: 'Strix nebulosa',
        common_name: 'Great Gray Owl',
      },
    ] as any);

    const rendered = render(<WebPageHeader />);
    const allViews = rendered.UNSAFE_getAllByType(View);
    const desktopTop = SEARCH_WRAPPER_LAYOUT_HEIGHT + Size.space['200'];

    act(() => {
      allViews
        .filter((viewNode) => typeof viewNode.props.onLayout === 'function')
        .forEach((viewNode) => {
          viewNode.props.onLayout?.({
            nativeEvent: { layout: { y: 12, height: 56 } },
          });
        });
    });

    const searchWrapper = screen.getByTestId('page-header-search-wrapper');
    act(() => {
      searchWrapper.props.onLayout?.({
        nativeEvent: { layout: { height: SEARCH_WRAPPER_LAYOUT_HEIGHT } },
      });
    });
    const searchInput = screen.getByLabelText('Search input');
    act(() => {
      searchInput.props.onFocus?.({});
    });

    await act(async () => {
      fireEvent.changeText(searchInput, 'gray');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    const panel = await screen.findByTestId('header-search-results');
    const flattenedStyle = StyleSheet.flatten(panel.props.style);

    expect(typeof flattenedStyle?.top).toBe('number');
    expect(flattenedStyle?.top as number).toBeGreaterThan(desktopTop);

    jest.useRealTimers();
  });

  it('shows compact results only while input/results are active', async () => {
    jest.useFakeTimers();
    mockUseResponsive.mockReturnValue({
      breakpoint: 'phone',
      marginHorizontal: 32,
    } as ReturnType<typeof useResponsive>);
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 91,
        scientific_name: 'Asio otus',
        common_name: 'Long-eared Owl',
      },
    ] as any);

    render(<WebPageHeader />);
    const searchWrapper = screen.getByTestId('page-header-search-wrapper');
    act(() => {
      searchWrapper.props.onLayout?.({
        nativeEvent: { layout: { height: SEARCH_WRAPPER_LAYOUT_HEIGHT } },
      });
    });

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'owl');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('header-search-results')).toBeNull();

    act(() => {
      searchInput.props.onFocus?.({});
    });

    expect(await screen.findByTestId('header-search-results')).toBeTruthy();

    act(() => {
      searchInput.props.onBlur?.({});
    });

    await act(async () => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('header-search-results')).toBeNull();

    jest.useRealTimers();
  });

  it('navigates to tapped result on mobile when input blurs before tap', async () => {
    jest.useFakeTimers();
    mockUseResponsive.mockReturnValue({
      breakpoint: 'phone',
      marginHorizontal: 32,
    } as ReturnType<typeof useResponsive>);
    mockFetchTextResults.mockResolvedValue([
      {
        taxon_id: 301,
        scientific_name: 'Bubo scandiacus',
        common_name: 'Snowy Owl',
      },
    ] as any);

    render(<WebPageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'snowy');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await screen.findByTestId('header-search-results');

    act(() => {
      searchInput.props.onBlur?.({});
    });

    const result = await screen.findByTestId('search-result-301');
    fireEvent.press(result);

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/species/[...identifier]',
      params: { identifier: ['301', 'bubo-scandiacus'] },
    });

    jest.useRealTimers();
  });
});
