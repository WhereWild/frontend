// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { act } from '@testing-library/react-native';
import { create } from 'react-test-renderer';
import { NavigationBar } from '../NavigationBar.native';
import { NavigationBarTab } from '../NavigationBarTab.native';
import { useNavigationBarIndicator } from '../useNavigationBarIndicator';
import { useNavigationBarLayoutModel } from '../useNavigationBarLayoutModel';
import { useNavigationBarSelectionModel } from '../useNavigationBarSelectionModel';
import { useNavigationBarPanResponder } from '../useNavigationBarPanResponder';

type MockTabLayout = { x: number; y: number; width: number; height: number };

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ marginHorizontal: 0 }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaInsetsContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Consumer: ({
      children,
    }: {
      children: (value: { bottom: number } | null) => React.ReactNode;
    }) => children(null),
    _currentValue: null,
  },
}));

jest.mock('../useNavigationBarLayoutModel', () => ({
  useNavigationBarLayoutModel: jest.fn(() => ({
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
  })),
}));

jest.mock('../useNavigationBarIndicator', () => ({
  useNavigationBarIndicator: jest.fn(() => ({
    indicatorX: { __mock: 'x' },
    indicatorWidth: { __mock: 'w' },
    indicatorScaleX: { __mock: 'sx' },
    indicatorBackgroundColor: '#000',
  })),
}));

jest.mock('../useNavigationBarSelectionModel');
jest.mock('../useNavigationBarPanResponder');

const TEST_TABS = [
  { key: 'home', label: 'Home', icon: () => null },
  { key: 'search', label: 'Search', icon: () => null },
];

describe('NavigationBar press guard integration', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('blocks the first press after pan-release and allows the next press', () => {
    const commitTabSelection = jest.fn();
    const setPreviewIndex = jest.fn();

    (useNavigationBarSelectionModel as jest.Mock).mockReturnValue({
      activeIndex: 0,
      previewIndex: null,
      setPreviewIndex,
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
      visibleTabs[0]?.props.onPressIn?.();
      visibleTabs[0]?.props.onPress?.();
      visibleTabs[0]?.props.onPress?.();
    });

    expect(setPreviewIndex).toHaveBeenCalledWith(0);
    expect(shouldHandleTabPress).toHaveBeenCalledTimes(2);
    expect(commitTabSelection).toHaveBeenCalledTimes(1);
    expect(commitTabSelection).toHaveBeenCalledWith(0);

    act(() => {
      stableRenderer.unmount();
    });
  });

  it('wires pan responder host props and measures before previewing a press', () => {
    const commitTabSelection = jest.fn();
    const setPreviewIndex = jest.fn();
    const measureTabsHostInWindow = jest.fn();

    (useNavigationBarSelectionModel as jest.Mock).mockReturnValue({
      activeIndex: 0,
      previewIndex: null,
      setPreviewIndex,
      commitTabSelection,
      resolveDerivedState: () => 'default',
      resolveTabForegroundTone: () => 'default',
    });

    (useNavigationBarPanResponder as jest.Mock).mockReturnValue({
      tabsHostRef: { current: null },
      measureTabsHostInWindow,
      panHandlers: { onStartShouldSetResponderCapture: jest.fn() },
      shouldHandleTabPress: jest.fn(() => true),
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

    act(() => {
      visibleTabs[1]?.props.onPressIn?.();
    });

    expect(measureTabsHostInWindow).toHaveBeenCalled();
    expect(setPreviewIndex).toHaveBeenCalledWith(1);

    act(() => {
      stableRenderer.unmount();
    });
  });

  it('keeps the indicator and measuring hosts mounted in the native tree', () => {
    const layoutModel = {
      tabKeySignature: 'home|search',
      resolvedVariant: 'horizontal',
      isMeasuring: false,
      tabLayouts: {
        home: { x: 0, y: 0, width: 120, height: 40 },
        search: { x: 130, y: 0, width: 120, height: 40 },
      } as Record<string, MockTabLayout>,
      isResizingRef: { current: false },
      onTabWidthLayout: jest.fn(),
      handleTabsLayout: jest.fn(),
      handleTabContainerLayout: jest.fn(),
      getTabIndexAtPoint: jest.fn(() => null),
    };
    const commitTabSelection = jest.fn();
    const setPreviewIndex = jest.fn();

    (useNavigationBarLayoutModel as jest.Mock).mockImplementation(
      () => layoutModel,
    );
    (useNavigationBarIndicator as jest.Mock).mockReturnValue({
      indicatorX: { __mock: 'x' },
      indicatorWidth: { __mock: 'w' },
      indicatorScaleX: { __mock: 'sx' },
      indicatorBackgroundColor: '#000',
    });

    (useNavigationBarSelectionModel as jest.Mock).mockReturnValue({
      activeIndex: 0,
      previewIndex: null,
      setPreviewIndex,
      commitTabSelection,
      resolveDerivedState: () => 'default',
      resolveTabForegroundTone: () => 'default',
    });

    (useNavigationBarPanResponder as jest.Mock).mockReturnValue({
      tabsHostRef: { current: null },
      measureTabsHostInWindow: jest.fn(),
      panHandlers: {},
      shouldHandleTabPress: jest.fn(() => true),
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

    const getMeasuringHost = () =>
      stableRenderer.root
        .findAllByProps({
          testID: 'navigation-bar-measuring-layer',
        })
        .filter((node) => typeof node.type === 'string');

    const getIndicatorHost = () =>
      stableRenderer.root
        .findAllByProps({
          testID: 'navigation-bar-active-indicator',
        })
        .filter((node) => typeof node.type === 'string');

    expect(getMeasuringHost()).toHaveLength(1);
    expect(getIndicatorHost()).toHaveLength(1);

    layoutModel.isMeasuring = true;
    layoutModel.tabLayouts = {};

    act(() => {
      stableRenderer.update(<NavigationBar tabs={TEST_TABS} />);
    });

    expect(getMeasuringHost()).toHaveLength(1);
    expect(getIndicatorHost()).toHaveLength(1);

    layoutModel.isMeasuring = false;
    layoutModel.tabLayouts = {
      home: { x: 0, y: 0, width: 120, height: 40 },
      search: { x: 130, y: 0, width: 120, height: 40 },
    };

    act(() => {
      stableRenderer.update(<NavigationBar tabs={TEST_TABS} />);
    });

    expect(getMeasuringHost()).toHaveLength(1);
    expect(getIndicatorHost()).toHaveLength(1);

    act(() => {
      stableRenderer.unmount();
    });
  });
});
