import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Size } from '@/constants/theme';
import { WebPageHeader } from '../WebPageHeader';
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
    mockPush.mockClear();
    mockPathname = '/';
    mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' } as ReturnType<typeof useResponsive>);
    mockFetchSpeciesList.mockResolvedValue([]);
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
        actions={[{ label: 'Docs', icon: <IconHelpCircle />, onPress: handlePress }]}
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
    render(<WebPageHeader showFilterButton={false} showResetFilterButton={true} />);

    expect(screen.queryByLabelText('Filter search results')).toBeNull();
    expect(screen.queryByLabelText('Reset filters')).toBeNull();
  });
  it('supports a custom desktop filter button label', () => {
    render(<WebPageHeader filterLabel="Hide filter" />);

    expect(screen.getByText('Hide filter')).toBeTruthy();
  });

  it('renders compact layout and exposes actions behind the menu button', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<typeof useResponsive>);
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

  it('submits search queries and ignores empty submissions', async () => {
    render(<WebPageHeader />);

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
      <WebPageHeader
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
    const { rerender } = render(<WebPageHeader initialQuery="fox" />);

    expect(screen.getByLabelText('Search input').props.value).toBe('fox');

    rerender(<WebPageHeader initialQuery="owl" />);

    expect(screen.getByLabelText('Search input').props.value).toBe('owl');

    rerender(<WebPageHeader initialQuery={undefined} />);

    expect(screen.getByLabelText('Search input').props.value).toBe('');
  });

  it('reports empty results when query is cleared', async () => {
    jest.useFakeTimers();
    const handleResults = jest.fn();
    const handleSearching = jest.fn();

    render(
      <WebPageHeader
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

    render(<WebPageHeader />);
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

  it('surfaces search errors and clears results on failure', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesList.mockRejectedValue(new Error('Search failed'));
    const handleResults = jest.fn();
    const handleSearching = jest.fn();

    render(
      <WebPageHeader
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
      <WebPageHeader
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
      <WebPageHeader
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

    render(<WebPageHeader />);
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
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/species/7'));

    jest.useRealTimers();
  });

  it('hides results when dropdown visibility is disabled', async () => {
    jest.useFakeTimers();
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 99, scientific_name: 'Vulpes vulpes', common_name: 'Red Fox' },
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
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 123, scientific_name: 'Buteo jamaicensis', common_name: 'Red-tailed Hawk' },
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
    mockFetchSpeciesList.mockRejectedValue('nope');
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
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 55, scientific_name: 'Strix aluco', common_name: 'Tawny Owl' },
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

  it('toggles compact menu closed when open button is pressed twice', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<typeof useResponsive>);
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
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 77, scientific_name: 'Bubo bubo', common_name: 'Eurasian Eagle-Owl' },
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
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 88, scientific_name: 'Strix nebulosa', common_name: 'Great Gray Owl' },
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
    mockFetchSpeciesList.mockResolvedValue([
      { taxon_id: 301, scientific_name: 'Bubo scandiacus', common_name: 'Snowy Owl' },
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