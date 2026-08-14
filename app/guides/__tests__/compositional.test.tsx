// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react-native';
import React from 'react';
import CompositionalGuideScreen from '../compositional';

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
  const { Markdown } = jest.requireActual('@/components/markdown/Markdown');

  return {
    PageScrollContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    PageTitle: ({ title }: { title: string }) =>
      React.createElement(Text, null, title),
    Markdown,
  };
});

describe('CompositionalGuideScreen', () => {
  it('renders the compositional guide content', () => {
    render(<CompositionalGuideScreen />);

    expect(screen.getByText('Compositional')).toBeTruthy();
  });
});
