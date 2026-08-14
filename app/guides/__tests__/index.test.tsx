// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import GuidesIndexScreen from '../index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/guides',
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
  const { Text, View } = jest.requireActual('react-native');

  return {
    PageScrollContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    PageTitle: ({ title }: { title: string }) =>
      React.createElement(Text, null, title),
    ThemedText: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

describe('GuidesIndexScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('lists Variables and Variable Types with links to each', () => {
    render(<GuidesIndexScreen />);

    for (const label of ['Variables', 'Variable Types']) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    fireEvent.press(screen.getByText('Variable Types'));
    expect(mockPush).toHaveBeenCalledWith('/guides/variables/types');
  });
});
