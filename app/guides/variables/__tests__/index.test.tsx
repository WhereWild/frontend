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
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      onPress
        ? React.createElement(
            Pressable,
            { onPress },
            React.createElement(Text, null, children),
          )
        : React.createElement(Text, null, children),
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
});
