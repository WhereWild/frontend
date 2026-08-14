// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import HomeScreen from '../index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    breakpoint: 'desktop',
    contentWidth: 1200,
    gap: 24,
    marginHorizontal: 32,
  }),
}));

jest.mock('@/constants/responsiveStyles', () => ({
  getResponsiveContentContainerStyle: () => undefined,
}));

jest.mock('@/utils/webMetadata', () => ({
  WebMetadata: () => null,
}));

jest.mock('@/components/PageSurface', () => ({
  PageSurface: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  const { Markdown } = jest.requireActual('@/components/markdown/Markdown');

  return {
    PageScrollContainer: ({ children }: { children?: React.ReactNode }) => (
      <View>{children}</View>
    ),
    PageTitle: ({ title }: { title: string }) => (
      <Text testID='page-title'>{title}</Text>
    ),
    Markdown,
  };
});

describe('Home screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the WhereWild page title', () => {
    const original = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    render(<HomeScreen />);
    expect(screen.getByTestId('page-title').props.children).toBe('WhereWild');
    if (original) Object.defineProperty(Platform, 'OS', original);
  });

  it('navigates to search when search filters link is pressed', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText('search filters'));
    expect(mockPush).toHaveBeenCalledWith('/search');
  });

  it('navigates to maps when maps link is pressed', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText('maps'));
    expect(mockPush).toHaveBeenCalledWith('/maps');
  });

  it('navigates to settings when settings link is pressed', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText('settings'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('navigates to help when help page link is pressed', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByText('help page'));
    expect(mockPush).toHaveBeenCalledWith('/help');
  });
});
