// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import VariableGuidesIndexScreen from '../index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/guides/variables',
}));

jest.mock('expo-router/head', () => {
  const React = jest.requireActual('react');
  function Head({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  return Head;
});

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ breakpoint: 'desktop', textWidth: 720 }),
}));

const mockFetchEnvironmentVariables = jest.fn();
jest.mock('@/data/api', () => ({
  fetchEnvironmentVariables: (...args: unknown[]) =>
    mockFetchEnvironmentVariables(...args),
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Text, View, Pressable } = jest.requireActual('react-native');

  return {
    PageScrollContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    PageTitle: ({ title }: { title: string }) =>
      React.createElement(Text, null, title),
    ThemedText: ({
      children,
      onPress,
      nativeID,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      nativeID?: string;
    }) =>
      onPress
        ? React.createElement(
            Pressable,
            { onPress },
            React.createElement(Text, { nativeID }, children),
          )
        : React.createElement(Text, { nativeID }, children),
  };
});

describe('VariableGuidesIndexScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('groups variables by category and links to each guide', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio1', name: 'Annual Mean Temperature', category: 'bioclimate' },
      { id: 'bio12', name: 'Annual Precipitation', category: 'bioclimate' },
      { id: 'elevation', name: 'Elevation', category: 'terrain' },
    ]);

    render(<VariableGuidesIndexScreen />);

    await waitFor(() =>
      expect(screen.getByText('Annual Mean Temperature')).toBeTruthy(),
    );

    expect(screen.getByText('Bioclimate')).toBeTruthy();
    expect(screen.getByText('Terrain')).toBeTruthy();
    expect(screen.getByText('Annual Precipitation')).toBeTruthy();
    expect(screen.getByText('Elevation')).toBeTruthy();

    fireEvent.press(screen.getByText('Elevation'));
    expect(mockPush).toHaveBeenCalledWith('/guides/variables/elevation');
  });

  it('falls back to the id-derived label when a variable has no name', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'soil_texture', name: undefined, category: 'soil' },
    ]);

    render(<VariableGuidesIndexScreen />);

    await waitFor(() => expect(screen.getByText('Soil Texture')).toBeTruthy());
  });

  it('assigns a slugified nativeID to each category heading on web, so /guides/variables#terrain can be linked to directly', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    try {
      mockFetchEnvironmentVariables.mockResolvedValue([
        { id: 'elevation', name: 'Elevation', category: 'terrain' },
        { id: 'bio1', name: 'Annual Mean Temperature', category: 'bioclimate' },
      ]);

      const { UNSAFE_getByProps } = render(<VariableGuidesIndexScreen />);

      await waitFor(() => {
        expect(UNSAFE_getByProps({ nativeID: 'terrain' })).toBeTruthy();
        expect(UNSAFE_getByProps({ nativeID: 'bioclimate' })).toBeTruthy();
      });
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: originalPlatform,
      });
    }
  });
});
