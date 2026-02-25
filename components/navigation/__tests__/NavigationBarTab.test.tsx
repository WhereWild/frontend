import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Svg } from 'react-native-svg';
import { Colors } from '@/constants/theme';
import { IconSearch } from '@/assets/icons';
import {
  __NAVIGATION_BAR_TAB_TESTING__,
  NavigationBarTab,
} from '../../sections/NavigationBarTab';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('NavigationBarTab', () => {
  it('renders icon and label', () => {
    render(
      <NavigationBarTab
        label="Search"
        icon={IconSearch}
      />,
    );

    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByText('Search')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(
      <NavigationBarTab
        label="Search"
        icon={IconSearch}
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByLabelText('Search'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('supports icon as an element and falls back to injected color/size', () => {
    render(
      <NavigationBarTab
        label="Search"
        icon={<IconSearch />}
      />,
    );

    const icon = screen.UNSAFE_getByType(Svg);
    expect(icon.props.width).toBe(24);
    expect(icon.props.height).toBe(24);
  });

  it('keeps explicit icon element color/size overrides', () => {
    render(
      <NavigationBarTab
        label="Search"
        icon={<IconSearch color="#123456" size="20" />}
      />,
    );

    const icon = screen.UNSAFE_getByType(Svg);
    expect(icon.props.width).toBe(20);
    expect(icon.props.height).toBe(20);
  });

  it('reports measured width through onLayout callback', () => {
    const onLayout = jest.fn();
    render(
      <NavigationBarTab
        label="Search"
        icon={IconSearch}
        onLayout={onLayout}
      />,
    );

    const tab = screen.getByLabelText('Search');

    act(() => {
      tab.props.onLayout?.({
        nativeEvent: {
          layout: {
            width: 142,
          },
        },
      });
    });

    expect(onLayout).toHaveBeenCalledWith(142);
  });

  it('resolves visual states correctly', () => {
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('active', false, false)).toBe('active');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('pressed', false, false)).toBe('pressed');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', true, false)).toBe('pressed');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', false, true)).toBe('pressed');
    expect(__NAVIGATION_BAR_TAB_TESTING__.resolveVisualState('default', false, false)).toBe('default');
  });

  it('uses expected token colors for active and default states', () => {
    const active = __NAVIGATION_BAR_TAB_TESTING__.getVisualStyles('light', 'active');
    const pressed = __NAVIGATION_BAR_TAB_TESTING__.getVisualStyles('light', 'pressed');
    const idle = __NAVIGATION_BAR_TAB_TESTING__.getVisualStyles('light', 'default');
    const darkIdle = __NAVIGATION_BAR_TAB_TESTING__.getVisualStyles('dark', 'default');

    expect(active.backgroundColor).toBe(Colors.light.background.brand.default);
    expect(active.textColor).toBe(Colors.light.text.brand.onBrand);
    expect(active.iconColor).toBe(Colors.light.icon.brand.onBrand);

    expect(pressed.backgroundColor).toBe(Colors.light.background.brand.pressed);
    expect(pressed.textColor).toBe(Colors.light.text.brand.onBrand);
    expect(pressed.iconColor).toBe(Colors.light.icon.brand.onBrand);

    expect(idle.backgroundColor).toBe('transparent');
    expect(idle.textColor).toBe(Colors.light.text.default.default);
    expect(idle.iconColor).toBe(Colors.light.icon.default.default);

    expect(darkIdle.backgroundColor).toBe('transparent');
    expect(darkIdle.textColor).toBe(Colors.dark.text.default.default);
    expect(darkIdle.iconColor).toBe(Colors.dark.icon.default.default);
  });
});
