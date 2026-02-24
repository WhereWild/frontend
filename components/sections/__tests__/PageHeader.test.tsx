import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Size } from '@/constants/theme';
import { PageHeader } from '../PageHeader';
import { IconHelpCircle } from '@/assets/icons';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, View } from 'react-native';

const mockPush = jest.fn();
let mockPathname = '/';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockFetchSpeciesList = jest.fn();

jest.mock('@/data/api', () => ({
  fetchSpeciesList: jest.fn((...args) => mockFetchSpeciesList(...args)),
}));

const mockUseResponsive = useResponsive as jest.MockedFunction<typeof useResponsive>;

const SEARCH_WRAPPER_LAYOUT_HEIGHT = 40;
const SEARCH_DEBOUNCE_MS = 400;

describe('PageHeader', () => {
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
    mockPush.mockClear();
    mockPathname = '/';
    mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' } as ReturnType<typeof useResponsive>);
    mockFetchSpeciesList.mockResolvedValue([]);
  });

  it('renders title, search input, and default actions', () => {
    render(<PageHeader />);

    expect(screen.getByText('WhereWild')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search').props.value).toBe('');
    expect(screen.getByLabelText('Help')).toBeTruthy();
    expect(screen.getByLabelText('About')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
    expect(screen.getByLabelText('Filter search results')).toBeTruthy();
  });

  it('navigates to about when default About action is pressed', () => {
    render(<PageHeader />);

    fireEvent.press(screen.getByLabelText('About'));

    expect(mockPush).toHaveBeenCalledWith('/about');
  });

  it('does not navigate when already on About', () => {
    mockPathname = '/about';
    render(<PageHeader />);

    fireEvent.press(screen.getByLabelText('About'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('invokes action handler when pressed', () => {
    const handlePress = jest.fn();
    render(
      <PageHeader
        actions={[{ label: 'Docs', icon: <IconHelpCircle />, onPress: handlePress }]}
      />,
    );

    fireEvent.press(screen.getByLabelText('Docs'));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('navigates home when logo is pressed from another page', () => {
    mockPathname = '/about';
    render(<PageHeader />);

    const logoLink = screen.getByLabelText('Go to home');
    expect(logoLink.props.accessibilityRole).toBe('link');
    fireEvent.press(logoLink);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('does not navigate when already on the home page', () => {
    render(<PageHeader />);

    fireEvent.press(screen.getByLabelText('Go to home'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('invokes filter handler when filter button is pressed', () => {
    const handleFilter = jest.fn();
    render(<PageHeader onFilterPress={handleFilter} />);

    fireEvent.press(screen.getByLabelText('Filter search results'));
    expect(handleFilter).toHaveBeenCalledTimes(1);
  });

  it('can hide the filter button', () => {
    render(<PageHeader showFilterButton={false} />);

    expect(screen.queryByLabelText('Filter search results')).toBeNull();
  });

  it('renders compact layout and exposes actions behind the menu button', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<typeof useResponsive>);
    render(<PageHeader />);

    expect(screen.queryByText('WhereWild')).toBeNull();
    expect(screen.getByLabelText('Filter search results')).toBeTruthy();

    expect(screen.queryByLabelText('About')).toBeNull();
    fireEvent.press(screen.getByLabelText('Open menu'));
    expect(screen.getByLabelText('Help')).toBeTruthy();
    expect(screen.getByLabelText('About')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();

    // Close the menu before unmounting to avoid Portal cleanup timeout
    const backdrop = screen.getByTestId('page-header-menu-backdrop');
    fireEvent.press(backdrop);
  });

  it('submits search queries and ignores empty submissions', async () => {
    render(<PageHeader />);

    const searchInput = screen.getByLabelText('Search input');
    fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: '' } });
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'owl' } });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/search', params: { query: 'owl' } });
  });

  it('seeds initial query and triggers search callbacks', async () => {
    jest.useFakeTimers();
    const handleResults = jest.fn();
    const handleSearching = jest.fn();

    render(
      <PageHeader
        initialQuery="fox"
        onSearchResultsChanged={handleResults}
        onSearchingChanged={handleSearching}
      />,
    );

    const searchInput = screen.getByLabelText('Search input');
    expect(searchInput.props.value).toBe('fox');

    await act(async () => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(handleSearching).toHaveBeenCalledWith(true);
    expect(handleSearching).toHaveBeenCalledWith(false);
    expect(handleResults).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('updates search query when initialQuery prop changes', () => {
    const { rerender } = render(<PageHeader initialQuery="fox" />);

    expect(screen.getByLabelText('Search input').props.value).toBe('fox');

    rerender(<PageHeader initialQuery="owl" />);

    expect(screen.getByLabelText('Search input').props.value).toBe('owl');

    rerender(<PageHeader initialQuery={undefined} />);

    expect(screen.getByLabelText('Search input').props.value).toBe('');
  });

  it('reports empty results when query is cleared', async () => {
    jest.useFakeTimers();
    const handleResults = jest.fn();
    const handleSearching = jest.fn();

    render(
      <PageHeader
        onSearchResultsChanged={handleResults}
        onSearchingChanged={handleSearching}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'fox');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.changeText(searchInput, '');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(handleResults).toHaveBeenCalledWith([]);
    expect(handleSearching).toHaveBeenCalledWith(true);
    expect(handleSearching).toHaveBeenCalledWith(false);

    jest.useRealTimers();
  });

  it('shows search results after querying and navigates on selection', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 12, scientific_name: 'Canis lupus', common_name: 'Gray Wolf' },
      { taxon_id: 'invalid' },
    ] as any);

    render(<PageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'wolf');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchSpeciesList).toHaveBeenCalledWith(expect.any(Number), 'wolf');
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

  it('keeps results mounted long enough to navigate when click blurs input first', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 312, scientific_name: 'Puma concolor', common_name: 'Mountain Lion' },
    ] as any);

    render(<PageHeader />);
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

  it('surfaces search errors and clears results on failure', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesList.mockRejectedValue(new Error('Search failed'));
    const handleResults = jest.fn();
    const handleSearching = jest.fn();

    render(
      <PageHeader
        onSearchResultsChanged={handleResults}
        onSearchingChanged={handleSearching}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'error');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchSpeciesList).toHaveBeenCalledWith(expect.any(Number), 'error');
    });

    await waitFor(() => {
      expect(handleSearching).toHaveBeenCalledWith(true);
    });

    await waitFor(() => {
      expect(handleSearching).toHaveBeenCalledWith(false);
    });

    expect(handleResults).toHaveBeenCalledWith([]);
    expect(await screen.findByText('Search failed')).toBeTruthy();

    jest.useRealTimers();
  });

  it('drops pending search results when unmounted', async () => {
    jest.useFakeTimers();
    let resolvePromise: (value: any) => void;
    const pending = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockFetchSpeciesList.mockReturnValue(pending as any);
    const handleResults = jest.fn();
    const handleSearching = jest.fn();

    const { unmount } = render(
      <PageHeader
        onSearchResultsChanged={handleResults}
        onSearchingChanged={handleSearching}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'lynx');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchSpeciesList).toHaveBeenCalledWith(expect.any(Number), 'lynx');
    });

    const resultsCallsBeforeUnmount = handleResults.mock.calls.length;
    const searchingCallsBeforeUnmount = handleSearching.mock.calls.length;

    unmount();
    await act(async () => {
      resolvePromise?.([]);
      await Promise.resolve();
    });

    expect(handleResults).toHaveBeenCalledTimes(resultsCallsBeforeUnmount);
    expect(handleSearching).toHaveBeenCalledTimes(searchingCallsBeforeUnmount);

    jest.useRealTimers();
  });

  it('ignores in-flight search errors after unmount', async () => {
    jest.useFakeTimers();
    let rejectPromise: (reason?: unknown) => void;
    const pending = new Promise((_, reject) => {
      rejectPromise = reject;
    });
    // Prevent unhandled rejection warning when rejecting after unmount
    pending.catch(() => undefined);
    mockFetchSpeciesList.mockReturnValue(pending as any);
    const handleResults = jest.fn();
    const handleSearching = jest.fn();

    const { unmount } = render(
      <PageHeader
        onSearchResultsChanged={handleResults}
        onSearchingChanged={handleSearching}
      />,
    );
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'bad');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchSpeciesList).toHaveBeenCalledWith(expect.any(Number), 'bad');
    });

    const resultsCallsBeforeUnmount = handleResults.mock.calls.length;
    const searchingCallsBeforeUnmount = handleSearching.mock.calls.length;

    unmount();
    await act(async () => {
      rejectPromise?.(new Error('Search failed'));
      await Promise.resolve();
    });

    expect(handleResults).toHaveBeenCalledTimes(resultsCallsBeforeUnmount);
    expect(handleSearching).toHaveBeenCalledTimes(searchingCallsBeforeUnmount);

    jest.useRealTimers();
  });

  it('maps fallback fields when results are missing data', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesList.mockResolvedValue([
      {
        taxon_id: '42',
        scientific_name: '',
        common_name: 'snowy_owl',
        _raw: { description: 'Seen at dusk' },
        image_source: { uri: 'https://example.com/owl.png' },
      },
    ] as any);

    render(<PageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'owl');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchSpeciesList).toHaveBeenCalledWith(expect.any(Number), 'owl');
    });

    expect(await screen.findByText('snowy owl')).toBeTruthy();

    jest.useRealTimers();
  });

  it('suppresses navigation when scientific name normalizes to empty', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 7, scientific_name: '   ', common_name: 'Silent Owl' },
    ] as any);

    render(<PageHeader />);
    setupSearchVisibility();

    const searchInput = screen.getByLabelText('Search input');
    await act(async () => {
      fireEvent.changeText(searchInput, 'silent');
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await Promise.resolve();
    });

    const result = await screen.findByTestId('search-result-7');
    fireEvent.press(result);
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/species/7'));

    jest.useRealTimers();
  });

  it('hides results when dropdown visibility is disabled', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 99, scientific_name: 'Vulpes vulpes', common_name: 'Red Fox' },
    ] as any);

    render(<PageHeader showSearchResultsDropdown={false} />);
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
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 123, scientific_name: 'Buteo jamaicensis', common_name: 'Red-tailed Hawk' },
    ] as any);

    render(<PageHeader />);
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
    mockFetchSpeciesList.mockRejectedValue('nope');
    render(<PageHeader />);
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
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 55, scientific_name: 'Strix aluco', common_name: 'Tawny Owl' },
    ] as any);

    render(<PageHeader />);
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

  it('toggles compact menu closed when open button is pressed twice', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<typeof useResponsive>);
    render(<PageHeader />);

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
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 77, scientific_name: 'Bubo bubo', common_name: 'Eurasian Eagle-Owl' },
    ] as any);

    render(<PageHeader />);
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
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 88, scientific_name: 'Strix nebulosa', common_name: 'Great Gray Owl' },
    ] as any);

    const rendered = render(<PageHeader />);
    const allViews = rendered.UNSAFE_getAllByType(View);
    const desktopTop = SEARCH_WRAPPER_LAYOUT_HEIGHT + Size.space['100'];

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
    expect((flattenedStyle?.top as number)).toBeGreaterThan(desktopTop);

    jest.useRealTimers();
  });

  it('shows compact results only while input/results are active', async () => {
    jest.useFakeTimers();
    mockUseResponsive.mockReturnValue({
      breakpoint: 'phone',
      marginHorizontal: 32,
    } as ReturnType<typeof useResponsive>);
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 91, scientific_name: 'Asio otus', common_name: 'Long-eared Owl' },
    ] as any);

    render(<PageHeader />);
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
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 301, scientific_name: 'Bubo scandiacus', common_name: 'Snowy Owl' },
    ] as any);

    render(<PageHeader />);
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