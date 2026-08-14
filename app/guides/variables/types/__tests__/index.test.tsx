// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import VariableTypesIndexScreen from '../index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/guides/variables/types',
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

describe('VariableTypesIndexScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('lists all five measurement types and links to each', () => {
    render(<VariableTypesIndexScreen />);

    for (const label of [
      'Nominal',
      'Ordinal',
      'Interval',
      'Ratio',
      'Circular',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    fireEvent.press(screen.getByText('Ordinal'));
    expect(mockPush).toHaveBeenCalledWith('/guides/variables/types/ordinal');
  });
});
