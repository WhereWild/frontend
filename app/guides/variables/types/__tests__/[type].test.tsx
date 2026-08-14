// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from '@testing-library/react-native';
import React from 'react';
import VariableTypeGuideScreen from '../[type]';

let mockTypeKey: string | undefined = 'ordinal';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/guides/variables/types/ordinal',
  useLocalSearchParams: () => ({ type: mockTypeKey }),
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

jest.mock('@/content/guides/variables/types/index', () => ({
  TYPE_GUIDES: {
    ordinal: '# Ordinal\n\n## Mode\n\nDescribes the most common category.',
  },
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
    ThemedText: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(Text, null, children),
    Markdown,
  };
});

describe('VariableTypeGuideScreen', () => {
  beforeEach(() => {
    mockTypeKey = 'ordinal';
  });

  it('renders the authored guide content for a known type', () => {
    render(<VariableTypeGuideScreen />);

    expect(
      screen.getByText('Describes the most common category.'),
    ).toBeTruthy();
  });

  it('falls back to "More coming soon." for a type with no authored content yet', () => {
    mockTypeKey = 'ratio';

    render(<VariableTypeGuideScreen />);

    expect(screen.getByText('More coming soon.')).toBeTruthy();
  });

  it('shows a not-found message for an unknown type key', () => {
    mockTypeKey = 'nonexistent';

    render(<VariableTypeGuideScreen />);

    expect(
      screen.getByText("We couldn't find that variable type."),
    ).toBeTruthy();
  });
});
