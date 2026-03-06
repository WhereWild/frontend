import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { TopAppBar } from '../TopAppBar';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { IconFilter, IconRotateCcw } from '@/assets/icons';
import { mockAnimatedTiming, resolveAnimatedNumeric } from '../topAppBarTestUtils';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Link: 'Link',
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseResponsive = useResponsive as jest.MockedFunction<typeof useResponsive>;

const HOME_PROPS = {
  variant: 'home' as const,
  title: 'Page Title',
  logoSource: require('@/assets/images/wherewild.png'),
  logoAccessibilityLabel: 'WhereWild logo',
  secondaryAction: {
    icon: <IconRotateCcw />,
    accessibilityLabel: 'Refresh',
    onPress: () => {},
  },
  primaryAction: {
    icon: <IconFilter />,
    buttonLabel: 'Filter',
    buttonAccessibilityLabel: 'Filter',
    iconAccessibilityLabel: 'Filter action',
  },
};

describe('TopAppBar', () => {
  beforeAll(() => {
    mockAnimatedTiming();
  });

  beforeEach(() => {
    mockRouterPush.mockClear();
    mockUseResponsive.mockReturnValue({ breakpoint: 'tablet' } as ReturnType<typeof useResponsive>);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('renders home variant with title and actions', () => {
    render(<TopAppBar {...HOME_PROPS} />);

    expect(screen.getByText('Page Title')).toBeTruthy();
    expect(screen.getByLabelText('Refresh')).toBeTruthy();
    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.queryByLabelText('Search input')).toBeNull();
  });

  it('uses default action icons and labels when action props are omitted', () => {
    render(
      <TopAppBar
        variant="home"
        title="Page Title"
        logoSource={require('@/assets/images/wherewild.png')}
        logoAccessibilityLabel="WhereWild logo"
      />,
    );

    expect(screen.getByLabelText('Reset filters')).toBeTruthy();
    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.queryByLabelText('Filter action')).toBeNull();
  });

  it('uses default home logo and navigates to home when onPressLogo is omitted', () => {
    const wherewildLogo = require('@/assets/images/wherewild.png');

    render(
      <TopAppBar
        variant="home"
        title="Page Title"
      />,
    );

    const logoButton = screen.getByLabelText('Go to home');
    fireEvent.press(logoButton);
    expect(mockRouterPush).toHaveBeenCalledWith('/');

    const logoImage = screen.getByTestId('top-app-bar-home-logo-image');
    expect(logoImage.props.source).toBe(wherewildLogo);
  });

  it('calls onPressLogo when home logo is tapped', () => {
    const onPressLogo = jest.fn();

    render(<TopAppBar {...HOME_PROPS} onPressLogo={onPressLogo} />);

    fireEvent.press(screen.getByLabelText('WhereWild logo'));
    expect(onPressLogo).toHaveBeenCalledTimes(1);
  });

  it('renders page variant and calls back action', () => {
    const onPressBack = jest.fn();
    render(
      <TopAppBar
        variant="page"
        title="Species"
        onPressBack={onPressBack}
        secondaryAction={{
          icon: <IconRotateCcw />,
          accessibilityLabel: 'Refresh',
        }}
        primaryAction={{
          icon: <IconFilter />,
          buttonLabel: 'Filter',
          buttonAccessibilityLabel: 'Filter',
          iconAccessibilityLabel: 'Filter action',
        }}
      />,
    );

    expect(screen.getByText('Species')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back'));
    expect(onPressBack).toHaveBeenCalledTimes(1);
  });

  it('renders search variant and forwards search events', () => {
    const onSearchValueChange = jest.fn();
    const onSubmitSearch = jest.fn();

    render(
      <TopAppBar
        variant="search"
        searchValue=""
        onSearchValueChange={onSearchValueChange}
        onSubmitSearch={onSubmitSearch}
        secondaryAction={{
          icon: <IconRotateCcw />,
          accessibilityLabel: 'Refresh',
        }}
        primaryAction={{
          icon: <IconFilter />,
          buttonLabel: 'Filter',
          buttonAccessibilityLabel: 'Filter',
          iconAccessibilityLabel: 'Filter action',
        }}
      />,
    );

    const searchInput = screen.getByLabelText('Search input');
    fireEvent.changeText(searchInput, 'lynx');
    expect(onSearchValueChange).toHaveBeenCalledWith('lynx');

    fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'lynx' } });
    expect(onSubmitSearch).toHaveBeenCalledWith('lynx');
  });

  it('does not reserve action-row space in search when both actions are hidden', () => {
    render(
      <TopAppBar
        variant="search"
        searchValue=""
        onSearchValueChange={() => {}}
        onSubmitSearch={() => {}}
        secondaryAction={{
          icon: <IconRotateCcw />,
          accessibilityLabel: 'Refresh',
          isVisible: false,
        }}
        primaryAction={{
          icon: <IconFilter />,
          buttonLabel: 'Filter',
          buttonAccessibilityLabel: 'Filter',
          iconAccessibilityLabel: 'Filter action',
          isVisible: false,
        }}
      />,
    );

    expect(screen.queryByLabelText('Refresh')).toBeNull();
    expect(screen.queryByLabelText('Filter')).toBeNull();
    expect(screen.queryByLabelText('Filter action')).toBeNull();
    expect(screen.queryByTestId('top-app-bar-actions-row')).toBeNull();
  });

  it('hides secondary button when secondaryAction.isVisible is false', () => {
    render(
      <TopAppBar
        {...HOME_PROPS}
        secondaryAction={{
          ...HOME_PROPS.secondaryAction,
          isVisible: false,
        }}
      />,
    );

    const secondarySlotStyle = StyleSheet.flatten(
      screen.getByTestId('top-app-bar-secondary-action-slot').props.style,
    );
    expect(resolveAnimatedNumeric(secondarySlotStyle.width)).toBe(0);
  });

  it('collapses actions-row gap when secondary action is hidden and primary is visible in search', () => {
    render(
      <TopAppBar
        variant="search"
        searchValue=""
        onSearchValueChange={() => {}}
        onSubmitSearch={() => {}}
        secondaryAction={{
          icon: <IconRotateCcw />,
          accessibilityLabel: 'Refresh',
          isVisible: false,
        }}
        primaryAction={{
          icon: <IconFilter />,
          buttonLabel: 'Filter',
          buttonAccessibilityLabel: 'Filter',
          iconAccessibilityLabel: 'Filter action',
          isVisible: true,
          mode: 'icon',
        }}
      />,
    );

    const actionsRowStyle = StyleSheet.flatten(screen.getByTestId('top-app-bar-actions-row').props.style);
    expect(actionsRowStyle.gap).toBe(0);

  });

  it('renders primary button as icon when explicitly configured', () => {
    render(
      <TopAppBar
        {...HOME_PROPS}
        primaryAction={{
          ...HOME_PROPS.primaryAction,
          mode: 'icon',
        }}
      />,
    );

    expect(screen.getByLabelText('Filter action')).toBeTruthy();
    expect(screen.queryByLabelText('Filter')).toBeNull();
  });

  it('hides primary button when primaryAction.isVisible is false', () => {
    render(
      <TopAppBar
        {...HOME_PROPS}
        primaryAction={{
          ...HOME_PROPS.primaryAction,
          isVisible: false,
        }}
      />,
    );

    expect(screen.getByTestId('top-app-bar-primary-action-slot')).toBeTruthy();
    expect(screen.getByLabelText('Filter')).toBeTruthy();
  });

  it('keeps actions row mounted briefly when both actions are hidden, then unmounts', () => {
    jest.useFakeTimers();

    const { rerender } = render(<TopAppBar {...HOME_PROPS} />);

    rerender(
      <TopAppBar
        variant="home"
        title="Page Title"
        primaryAction={{
          icon: <IconFilter />,
          buttonLabel: 'Filter',
          buttonAccessibilityLabel: 'Filter',
          iconAccessibilityLabel: 'Filter action',
          isVisible: false,
        }}
        secondaryAction={{
          icon: <IconRotateCcw />,
          accessibilityLabel: 'Refresh',
          isVisible: false,
        }}
      />,
    );

    expect(screen.getByTestId('top-app-bar-actions-row')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(screen.queryByTestId('top-app-bar-actions-row')).toBeNull();
  });

  it('cleans up action-row unmount timer on unmount', () => {
    jest.useFakeTimers();

    const { rerender, unmount } = render(<TopAppBar {...HOME_PROPS} />);

    rerender(
      <TopAppBar
        variant="home"
        title="Page Title"
        primaryAction={{
          icon: <IconFilter />,
          buttonLabel: 'Filter',
          buttonAccessibilityLabel: 'Filter',
          iconAccessibilityLabel: 'Filter action',
          isVisible: false,
        }}
        secondaryAction={{
          icon: <IconRotateCcw />,
          accessibilityLabel: 'Refresh',
          isVisible: false,
        }}
      />,
    );

    unmount();

    act(() => {
      jest.runOnlyPendingTimers();
    });
  });

  it('disables secondary button when handler is missing', () => {
    render(
      <TopAppBar
        {...HOME_PROPS}
        secondaryAction={{
          ...HOME_PROPS.secondaryAction,
          onPress: undefined,
        }}
      />,
    );

    expect(screen.getByLabelText('Refresh')).toBeDisabled();
  });

  it('disables primary action when handler is missing', () => {
    render(
      <TopAppBar
        {...HOME_PROPS}
        primaryAction={{
          ...HOME_PROPS.primaryAction,
          onPress: undefined,
        }}
      />,
    );

    expect(screen.getByLabelText('Filter')).toBeDisabled();
  });

  it('disables icon primary action when handler is missing on phone breakpoint', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<typeof useResponsive>);

    render(
      <TopAppBar
        {...HOME_PROPS}
        primaryAction={{
          ...HOME_PROPS.primaryAction,
          onPress: undefined,
        }}
      />,
    );

    expect(screen.getByLabelText('Filter action')).toBeDisabled();
  });

  it('uses one filter handler for text and icon modes', () => {
    const onPressPrimaryButton = jest.fn();

    const { rerender } = render(
      <TopAppBar
        {...HOME_PROPS}
        primaryAction={{
          ...HOME_PROPS.primaryAction,
          onPress: onPressPrimaryButton,
        }}
      />,
    );

    fireEvent.press(screen.getByLabelText('Filter'));

    rerender(
      <TopAppBar
        {...HOME_PROPS}
        primaryAction={{
          ...HOME_PROPS.primaryAction,
          mode: 'icon',
          onPress: onPressPrimaryButton,
        }}
      />,
    );

    fireEvent.press(screen.getByLabelText('Filter action'));
    expect(onPressPrimaryButton).toHaveBeenCalledTimes(2);
  });

  it('renders primary icon button on phone breakpoint', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<typeof useResponsive>);

    render(<TopAppBar {...HOME_PROPS} />);

    expect(screen.getByLabelText('Filter action')).toBeTruthy();
    expect(screen.queryByLabelText('Filter')).toBeNull();
  });

  it('renders primary text button on tablet breakpoint', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'tablet' } as ReturnType<typeof useResponsive>);

    render(<TopAppBar {...HOME_PROPS} />);

    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.queryByLabelText('Filter action')).toBeNull();
  });

  it('renders primary text button on desktop breakpoint', () => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' } as ReturnType<typeof useResponsive>);

    render(<TopAppBar {...HOME_PROPS} />);

    expect(screen.getByLabelText('Filter')).toBeTruthy();
    expect(screen.queryByLabelText('Filter action')).toBeNull();
  });

  it('always applies safe-area top inset', () => {
    const insets = { top: 24, bottom: 0, left: 0, right: 0 };

    render(
      <SafeAreaInsetsContext.Provider value={insets}>
        <TopAppBar {...HOME_PROPS} />
      </SafeAreaInsetsContext.Provider>,
    );

    const withInsetStyles = StyleSheet.flatten(screen.getByTestId('top-app-bar-safe-area').props.style);
    expect(withInsetStyles.paddingTop).toBe(24);
  });

});
