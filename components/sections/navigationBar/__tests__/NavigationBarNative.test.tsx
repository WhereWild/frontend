import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';
import { IconSearch } from '@/assets/icons';
import { Colors } from '@/constants/theme';
import {
  __NAVIGATION_BAR_TESTING__,
  NavigationBar,
} from '../NavigationBar.native';
import {
  __NAVIGATION_BAR_TAB_TESTING__,
  NavigationBarTab,
} from '../NavigationBarTab.native';

describe('NavigationBar native behavior', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders NavigationBar module without crashing', () => {
    const { toJSON } = render(<NavigationBar />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders NavigationBarTab module without crashing', () => {
    const { toJSON } = render(
      <NavigationBarTab label='Search' icon={IconSearch} />,
    );

    expect(toJSON()).toBeTruthy();
  });

  it('animates tab foreground when tone/state key changes after mount', () => {
    const start = jest.fn();
    const stop = jest.fn();
    const timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({
      start,
      stop,
    } as unknown as Animated.CompositeAnimation);

    const { rerender, unmount } = render(
      <NavigationBarTab
        label='Search'
        icon={IconSearch}
        state='default'
        foregroundTone='default'
      />,
    );

    rerender(
      <NavigationBarTab
        label='Search'
        icon={IconSearch}
        state='active'
        foregroundTone='default'
      />,
    );

    expect(timingSpy).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();

    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('covers visual-state helpers with exact native values', () => {
    expect(
      __NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('active', false, false),
    ).toBe('active');
    expect(
      __NAVIGATION_BAR_TAB_TESTING__.resolveVisualState(
        'pressed',
        false,
        false,
      ),
    ).toBe('pressed');
    expect(
      __NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', true, false),
    ).toBe('pressed');
    expect(
      __NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', false, true),
    ).toBe('pressed');
    expect(
      __NAVIGATION_BAR_TAB_TESTING__.resolveVisualState(
        'default',
        false,
        false,
      ),
    ).toBe('default');

    const lightStyles = __NAVIGATION_BAR_TAB_TESTING__.getVisualStyles(
      'light',
      'default',
    );
    const darkStyles = __NAVIGATION_BAR_TAB_TESTING__.getVisualStyles(
      'dark',
      'pressed',
    );

    expect(lightStyles).toEqual({
      textColor: Colors.light.text.default.default,
      iconColor: Colors.light.icon.default.default,
    });

    expect(darkStyles).toEqual({
      textColor: Colors.dark.text.brand.onBrand,
      iconColor: Colors.dark.icon.brand.onBrand,
    });
  });

  it('covers NavigationBar helper exports with deterministic native thresholds', () => {
    const requiredWidthForFourTabs =
      __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(
        4,
        {
          one: 100,
          two: 100,
        },
        ['one', 'two', 'three', 'four'],
      );
    const requiredWidth = __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(
      5,
      {
        one: 100,
      },
      ['one', 'two', 'three', 'four', 'five'],
    );

    expect(requiredWidthForFourTabs).toBe(100 + 100 + 96 + 96 + 3 * 8);
    expect(requiredWidth).toBe(100 + 96 + 96 + 96 + 96 + 4 * 8);
    expect(requiredWidth).toBeGreaterThan(requiredWidthForFourTabs);
    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
        640,
        5,
        { one: 100 },
        ['one', 'two', 'three', 'four', 'five'],
      ),
    ).toBe(true);
    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
        requiredWidth,
        5,
        { one: 100 },
        ['one', 'two', 'three', 'four', 'five'],
      ),
    ).toBe(true);
    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
        requiredWidth - 1,
        5,
        { one: 100 },
        ['one', 'two', 'three', 'four', 'five'],
      ),
    ).toBe(false);
    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(0, 1, {}, ['one']),
    ).toBe(true);
  });

  it('treats tabs arrays with equivalent item identities as equal', () => {
    const sharedOnPress = jest.fn();
    const first = [
      {
        key: 'search',
        label: 'Search',
        icon: IconSearch,
        state: 'default' as const,
        onPress: sharedOnPress,
        accessibilityLabel: 'Search tab',
      },
    ];

    const second = [
      {
        key: 'search',
        label: 'Search',
        icon: IconSearch,
        state: 'default' as const,
        onPress: sharedOnPress,
        accessibilityLabel: 'Search tab',
      },
    ];

    expect(
      __NAVIGATION_BAR_TESTING__.areNavigationTabsEqual(first, second),
    ).toBe(true);
  });

  it('treats tabs arrays with changed onPress identity as different', () => {
    const first = [
      {
        key: 'search',
        label: 'Search',
        icon: IconSearch,
        state: 'default' as const,
        onPress: jest.fn(),
        accessibilityLabel: 'Search tab',
      },
    ];

    const second = [
      {
        key: 'search',
        label: 'Search',
        icon: IconSearch,
        state: 'default' as const,
        onPress: jest.fn(),
        accessibilityLabel: 'Search tab',
      },
    ];

    expect(
      __NAVIGATION_BAR_TESTING__.areNavigationTabsEqual(first, second),
    ).toBe(false);
  });
});
