// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import {
  NativeHomeTabsProvider,
  useNativeHomeTabs,
} from '../NativeHomeTabsContext';
import { useHomeDashboardState } from '@/hooks/useHomeDashboardState';
import { usePathname } from 'expo-router';

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
}));

jest.mock('@/hooks/useHomeDashboardState', () => ({
  useHomeDashboardState: jest.fn(),
}));

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockUseHomeDashboardState =
  useHomeDashboardState as jest.MockedFunction<typeof useHomeDashboardState>;

function Consumer() {
  const state = useNativeHomeTabs();

  return (
    <View>
      <Text>{state.isFilterVisible ? 'visible' : 'hidden'}</Text>
      <Pressable testID='toggle-filter-visibility' onPress={state.toggleFilterVisibility}>
        <Text>Toggle</Text>
      </Pressable>
    </View>
  );
}

describe('NativeHomeTabsProvider', () => {
  beforeEach(() => {
    mockUseHomeDashboardState.mockReturnValue({
      activeGroup: 'all',
      allScored: [],
      handleBoundsChange: jest.fn(),
      hasActiveFilter: false,
      heatmapTileUrl: '',
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('disables remote hydration on non-home native routes', () => {
    mockUsePathname.mockReturnValue('/settings');

    render(
      <NativeHomeTabsProvider>
        <Consumer />
      </NativeHomeTabsProvider>,
    );

    expect(screen.getByText('hidden')).toBeTruthy();
    expect(mockUseHomeDashboardState).toHaveBeenCalledWith(undefined, {
      hydrateRemoteOnMount: false,
      remoteHydrationDelayMs: 0,
    });
  });

  it('keeps delayed remote hydration on native Explore and Map routes', () => {
    mockUsePathname.mockReturnValue('/map');

    render(
      <NativeHomeTabsProvider>
        <Consumer />
      </NativeHomeTabsProvider>,
    );

    expect(mockUseHomeDashboardState).toHaveBeenCalledWith(undefined, {
      hydrateRemoteOnMount: true,
      remoteHydrationDelayMs: 1500,
    });
  });

  it('shows filters when an active filter is restored', () => {
    mockUsePathname.mockReturnValue('/');
    mockUseHomeDashboardState.mockReturnValue({
      activeGroup: 'plants',
      allScored: [],
      handleBoundsChange: jest.fn(),
      hasActiveFilter: true,
      heatmapTileUrl: '',
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
    });

    render(
      <NativeHomeTabsProvider>
        <Consumer />
      </NativeHomeTabsProvider>,
    );

    expect(screen.getByText('visible')).toBeTruthy();
  });

  it('does not auto-hide filters when the active filter resets to default', () => {
    mockUsePathname.mockReturnValue('/');
    mockUseHomeDashboardState.mockReturnValue({
      activeGroup: 'plants',
      allScored: [],
      handleBoundsChange: jest.fn(),
      hasActiveFilter: true,
      heatmapTileUrl: '',
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
    });

    const { rerender } = render(
      <NativeHomeTabsProvider>
        <Consumer />
      </NativeHomeTabsProvider>,
    );

    expect(screen.getByText('visible')).toBeTruthy();

    mockUseHomeDashboardState.mockReturnValue({
      activeGroup: 'all',
      allScored: [],
      handleBoundsChange: jest.fn(),
      hasActiveFilter: false,
      heatmapTileUrl: '',
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
    });

    rerender(
      <NativeHomeTabsProvider>
        <Consumer />
      </NativeHomeTabsProvider>,
    );

    expect(screen.getByText('visible')).toBeTruthy();
  });

  it('still lets users manually hide filters', () => {
    mockUsePathname.mockReturnValue('/');
    mockUseHomeDashboardState.mockReturnValue({
      activeGroup: 'plants',
      allScored: [],
      handleBoundsChange: jest.fn(),
      hasActiveFilter: true,
      heatmapTileUrl: '',
      recommendations: [],
      scoresLoading: false,
      setActiveGroup: jest.fn(),
    });

    render(
      <NativeHomeTabsProvider>
        <Consumer />
      </NativeHomeTabsProvider>,
    );

    fireEvent.press(screen.getByTestId('toggle-filter-visibility'));

    expect(screen.getByText('hidden')).toBeTruthy();
  });
});