// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { IconDownload, IconStar } from '@/assets/icons';
import { PageTitle } from '../PageTitle';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

describe('PageTitle', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
  });

  it('renders the title', () => {
    render(<PageTitle title='Settings' />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders the divider', () => {
    render(<PageTitle title='Settings' />);
    expect(screen.getByTestId('page-title-divider')).toBeTruthy();
  });

  it('renders the icon button when iconButton props are provided', () => {
    const onPress = jest.fn();
    render(
      <PageTitle
        title='Settings'
        iconButton={{
          icon: <IconStar />,
          accessibilityLabel: 'Bookmark',
          onPress,
        }}
      />,
    );
    expect(screen.getByLabelText('Bookmark')).toBeTruthy();
  });

  it('renders the button when button props are provided', () => {
    const onPress = jest.fn();
    render(
      <PageTitle
        title='Settings'
        button={{ iconStart: <IconDownload />, children: 'Download', onPress }}
      />,
    );
    expect(screen.getByText('Download')).toBeTruthy();
  });

  it('calls onPress when the icon button is pressed', () => {
    const onPress = jest.fn();
    render(
      <PageTitle
        title='Settings'
        iconButton={{
          icon: <IconStar />,
          accessibilityLabel: 'Bookmark',
          onPress,
        }}
      />,
    );
    fireEvent.press(screen.getByLabelText('Bookmark'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onPress when the button is pressed', () => {
    const onPress = jest.fn();
    render(
      <PageTitle
        title='Settings'
        button={{
          children: 'Download',
          onPress,
          accessibilityLabel: 'Download',
        }}
      />,
    );
    fireEvent.press(screen.getByLabelText('Download'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('omits the buttons container when neither button prop is provided', () => {
    render(<PageTitle title='Settings' />);
    // No buttons rendered — title is the only accessible element
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('applies the light mode background color', () => {
    mockUseColorScheme.mockReturnValue('light');

    const tree = render(<PageTitle title='Settings' />).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected a single root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(
      Colors.light.background.default.default,
    );
  });

  it('applies the dark mode background color', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const tree = render(<PageTitle title='Settings' />).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected a single root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(Colors.dark.background.default.default);
  });

  it('uses the brand secondary color for the divider in light mode', () => {
    mockUseColorScheme.mockReturnValue('light');

    render(<PageTitle title='Settings' />);

    const divider = screen.getByTestId('page-title-divider');
    const dividerStyles = StyleSheet.flatten(divider.props.style);
    expect(dividerStyles.backgroundColor).toBe(
      Colors.light.border.brand.secondary,
    );
  });

  it('uses the brand secondary color for the divider in dark mode', () => {
    mockUseColorScheme.mockReturnValue('dark');

    render(<PageTitle title='Settings' />);

    const divider = screen.getByTestId('page-title-divider');
    const dividerStyles = StyleSheet.flatten(divider.props.style);
    expect(dividerStyles.backgroundColor).toBe(
      Colors.dark.border.brand.secondary,
    );
  });
});
