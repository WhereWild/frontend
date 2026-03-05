import React from 'react';
import { render } from '@testing-library/react-native';
import { IconSearch } from '@/assets/icons';
import {
  __NAVIGATION_BAR_TESTING__,
  NavigationBar,
} from '../NavigationBar.tsx';
import {
  __NAVIGATION_BAR_TAB_TESTING__,
  NavigationBarTab,
} from '../NavigationBarTab.tsx';

describe('NavigationBar stubs', () => {
  it('renders NavigationBar stub as null', () => {
    const { toJSON } = render(<NavigationBar />);
    expect(toJSON()).toBeNull();
  });

  it('renders NavigationBarTab stub as null', () => {
    const { toJSON } = render(
      <NavigationBarTab
        label="Search"
        icon={IconSearch}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it('covers stub tab helper exports', () => {
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('active', false, false)).toBe('active');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('pressed', false, false)).toBe('pressed');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', true, false)).toBe('pressed');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', false, true)).toBe('pressed');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', false, false)).toBe('default');

    const lightStyles = __NAVIGATION_BAR_TAB_TESTING__.getVisualStyles('light', 'default');
    const darkStyles = __NAVIGATION_BAR_TAB_TESTING__.getVisualStyles('dark', 'pressed');

    expect(lightStyles).toEqual({
      backgroundColor: 'transparent',
      textColor: 'transparent',
      iconColor: 'transparent',
      borderWidth: 0,
    });

    expect(darkStyles).toEqual({
      backgroundColor: 'transparent',
      textColor: 'transparent',
      iconColor: 'transparent',
      borderWidth: 0,
    });
  });

  it('covers stub NavigationBar helper exports', () => {
    expect(
      __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(
        5,
        { one: 100 },
        ['one', 'two', 'three', 'four', 'five'],
      ),
    ).toBe(0);

    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
        640,
        5,
        { one: 100 },
        ['one', 'two', 'three', 'four', 'five'],
      ),
    ).toBe(false);
  });
});
