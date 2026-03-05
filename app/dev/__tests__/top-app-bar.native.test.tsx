import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import TopAppBarDevScreenNative from '../top-app-bar.native';
import {
  NavigationPillList,
  SwitchField,
  TopAppBar,
} from '@/components';

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    marginHorizontal: 16,
  }),
}));

jest.mock('@/components', () => ({
  TopAppBar: jest.fn(() => null),
  ThemedText: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  NavigationPillList: jest.fn(() => null),
  SwitchField: jest.fn(() => null),
}));

const mockTopAppBar = TopAppBar as jest.Mock;
const mockNavigationPillList = NavigationPillList as jest.Mock;
const mockSwitchField = SwitchField as jest.Mock;

describe('TopAppBar dev native screen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockTopAppBar.mockClear();
    mockNavigationPillList.mockClear();
    mockSwitchField.mockClear();
  });

  it('renders home variant by default', () => {
    render(<TopAppBarDevScreenNative />);

    expect(mockTopAppBar).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'home',
        logoAccessibilityLabel: 'WhereWild logo',
      }),
      undefined,
    );
  });

  it('switches to page variant and wires back action', () => {
    render(<TopAppBarDevScreenNative />);

    const selectorProps = mockNavigationPillList.mock.calls.at(-1)?.[0];
    act(() => {
      selectorProps?.onSelectionChange?.('page');
    });

    const latestTopAppBarProps = mockTopAppBar.mock.calls.at(-1)?.[0];
    expect(latestTopAppBarProps).toEqual(
      expect.objectContaining({
        variant: 'page',
        title: 'Page Title',
      }),
    );

    act(() => {
      latestTopAppBarProps?.onPressBack?.();
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('switches to search variant and updates search value', () => {
    render(<TopAppBarDevScreenNative />);

    const selectorProps = mockNavigationPillList.mock.calls.at(-1)?.[0];
    act(() => {
      selectorProps?.onSelectionChange?.('search');
    });

    let latestTopAppBarProps = mockTopAppBar.mock.calls.at(-1)?.[0];
    expect(latestTopAppBarProps).toEqual(
      expect.objectContaining({
        variant: 'search',
        searchValue: '',
      }),
    );

    act(() => {
      latestTopAppBarProps?.onSearchValueChange?.('lynx');
    });

    latestTopAppBarProps = mockTopAppBar.mock.calls.at(-1)?.[0];
    expect(latestTopAppBarProps).toEqual(
      expect.objectContaining({
        variant: 'search',
        searchValue: 'lynx',
      }),
    );

    act(() => {
      latestTopAppBarProps?.onSubmitSearch?.('otter');
    });

    latestTopAppBarProps = mockTopAppBar.mock.calls.at(-1)?.[0];
    expect(latestTopAppBarProps).toEqual(
      expect.objectContaining({
        variant: 'search',
        searchValue: 'otter',
      }),
    );
  });

  it('keeps home variant when selection key is invalid', () => {
    render(<TopAppBarDevScreenNative />);

    const selectorProps = mockNavigationPillList.mock.calls.at(-1)?.[0];
    act(() => {
      selectorProps?.onSelectionChange?.('invalid-variant');
    });

    const latestTopAppBarProps = mockTopAppBar.mock.calls.at(-1)?.[0];
    expect(latestTopAppBarProps).toEqual(
      expect.objectContaining({
        variant: 'home',
      }),
    );
  });

  it('wires home logo press to router push', () => {
    render(<TopAppBarDevScreenNative />);

    const latestTopAppBarProps = mockTopAppBar.mock.calls.at(-1)?.[0];
    act(() => {
      latestTopAppBarProps?.onPressLogo?.();
    });

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('updates page title and action visibility/mode through controls', () => {
    render(<TopAppBarDevScreenNative />);

    let latestTopAppBarProps = mockTopAppBar.mock.calls.at(-1)?.[0];
    act(() => {
      latestTopAppBarProps?.onPressLogo?.();
    });

    const pageTitleInput = screen.getByLabelText('Page title input');
    act(() => {
      pageTitleInput.props.onChangeText?.('Details');
    });

    latestTopAppBarProps = mockTopAppBar.mock.calls.at(-1)?.[0];
    expect(latestTopAppBarProps).toEqual(
      expect.objectContaining({
        title: 'Details',
      }),
    );

    const secondarySwitchProps = mockSwitchField.mock.calls[0]?.[0];
    const primarySwitchProps = mockSwitchField.mock.calls[1]?.[0];
    const iconModeSwitchProps = mockSwitchField.mock.calls[2]?.[0];

    act(() => {
      secondarySwitchProps?.onValueChange?.(false);
      primarySwitchProps?.onValueChange?.(false);
      iconModeSwitchProps?.onValueChange?.(true);
    });

    latestTopAppBarProps = mockTopAppBar.mock.calls.at(-1)?.[0];
    expect(latestTopAppBarProps?.secondaryAction).toEqual(
      expect.objectContaining({
        isVisible: false,
      }),
    );
    expect(latestTopAppBarProps?.primaryAction).toEqual(
      expect.objectContaining({
        isVisible: false,
        mode: 'icon',
      }),
    );
  });
});
