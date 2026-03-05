import React from 'react';
import { act } from '@testing-library/react-native';
import { create } from 'react-test-renderer';
import { NavigationBar } from '../NavigationBar.native';
import { NavigationBarTab } from '../NavigationBarTab.native';
import { useNavigationBarSelectionModel } from '../useNavigationBarSelectionModel';
import { useNavigationBarPanResponder } from '../useNavigationBarPanResponder';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ marginHorizontal: 0 }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaInsetsContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Consumer: ({ children }: { children: (value: { bottom: number } | null) => React.ReactNode }) => children(null),
    _currentValue: null,
  },
}));

jest.mock('../useNavigationBarLayoutModel', () => ({
  useNavigationBarLayoutModel: () => ({
    tabKeySignature: 'home|search',
    resolvedVariant: 'horizontal',
    isMeasuring: false,
    tabLayouts: {
      home: { x: 0, y: 0, width: 120, height: 40 },
      search: { x: 130, y: 0, width: 120, height: 40 },
    },
    isResizingRef: { current: false },
    onTabWidthLayout: jest.fn(),
    handleTabsLayout: jest.fn(),
    handleTabContainerLayout: jest.fn(),
    getTabIndexAtPoint: jest.fn(() => null),
  }),
}));

jest.mock('../useNavigationBarIndicator', () => ({
  useNavigationBarIndicator: () => ({
    indicatorX: { __mock: 'x' },
    indicatorWidth: { __mock: 'w' },
    indicatorBackgroundColor: '#000',
  }),
}));

jest.mock('../useNavigationBarSelectionModel');
jest.mock('../useNavigationBarPanResponder');

describe('NavigationBar press guard integration', () => {
  it('blocks the first press after pan-release and allows the next press', () => {
    const commitTabSelection = jest.fn();

    (useNavigationBarSelectionModel as jest.Mock).mockReturnValue({
      activeIndex: 0,
      previewIndex: null,
      setPreviewIndex: jest.fn(),
      commitTabSelection,
      resolveDerivedState: () => 'default',
      resolveTabForegroundTone: () => 'default',
    });

    const shouldHandleTabPress = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    (useNavigationBarPanResponder as jest.Mock).mockReturnValue({
      tabsHostRef: { current: null },
      measureTabsHostInWindow: jest.fn(),
      panHandlers: {},
      shouldHandleTabPress,
    });

    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(
        <NavigationBar
          tabs={[
            { key: 'home', label: 'Home', icon: () => null },
            { key: 'search', label: 'Search', icon: () => null },
          ]}
        />,
      );
    });

    if (!renderer) {
      throw new Error('Renderer was not created.');
    }

    const stableRenderer = renderer;

    const visibleTabs = stableRenderer.root
      .findAllByType(NavigationBarTab)
      .filter((node) => node.props.onPress !== undefined);

    expect(visibleTabs.length).toBeGreaterThan(0);

    act(() => {
      visibleTabs[0]?.props.onPress?.();
      visibleTabs[0]?.props.onPress?.();
    });

    expect(shouldHandleTabPress).toHaveBeenCalledTimes(2);
    expect(commitTabSelection).toHaveBeenCalledTimes(1);
    expect(commitTabSelection).toHaveBeenCalledWith(0);

    act(() => {
      stableRenderer.unmount();
    });
  });
});
