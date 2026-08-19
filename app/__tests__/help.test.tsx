// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import HelpScreen from '../help';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/help',
}));

jest.mock('expo-router/head', () => {
  const React = jest.requireActual('react');
  function Head({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  return Head;
});

const mockUseResponsive = jest.fn(() => ({ breakpoint: 'desktop' }));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockUseResponsive(),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/data/api', () => ({
  fetchDataSources: jest.fn(() => new Promise(() => undefined)),
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');

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
      variant?: string;
      style?: object;
      onPress?: () => void;
    }) => React.createElement(Text, { onPress }, children),
    Markdown: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

describe('Help screen', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' });
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  it('renders the tutorial video embed', () => {
    render(<HelpScreen />);
    expect(screen.getByTestId('help-video-embed')).toBeTruthy();
  });

  it('renders the shared page title on web', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    render(<HelpScreen />);

    expect(screen.getAllByText('Help').length).toBeGreaterThan(0);
  });
});
