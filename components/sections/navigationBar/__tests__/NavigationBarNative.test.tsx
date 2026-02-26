import React from 'react';
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
  it('renders NavigationBar module without crashing', () => {
    const { toJSON } = render(<NavigationBar />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders NavigationBarTab module without crashing', () => {
    const { toJSON } = render(
      <NavigationBarTab
        label="Search"
        icon={IconSearch}
      />,
    );

    expect(toJSON()).toBeTruthy();
  });

  it('covers visual-state helpers with exact native values', () => {
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('active', false, false)).toBe('active');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('pressed', false, false)).toBe('pressed');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', true, false)).toBe('pressed');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', false, true)).toBe('pressed');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', false, false)).toBe('default');

    const lightStyles = __NAVIGATION_BAR_TAB_TESTING__.getVisualStyles('light', 'default');
    const darkStyles = __NAVIGATION_BAR_TAB_TESTING__.getVisualStyles('dark', 'pressed');

    expect(lightStyles).toEqual({
      backgroundColor: 'transparent',
      textColor: Colors.light.text.default.default,
      iconColor: Colors.light.icon.default.default,
      borderWidth: 0,
    });

    expect(darkStyles).toEqual({
      backgroundColor: Colors.dark.background.brand.pressed,
      textColor: Colors.dark.text.brand.onBrand,
      iconColor: Colors.dark.icon.brand.onBrand,
      borderWidth: 0,
    });
  });

  it('covers NavigationBar helper exports with deterministic native thresholds', () => {
    const requiredWidthForFourTabs = __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(
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
    expect(__NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(0, 1, {}, ['one'])).toBe(true);
  });
});
