// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { InlineExpandableRows } from '../InlineExpandableRows';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

describe('InlineExpandableRows', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
  });

  it('renders provided sections and entries', () => {
    render(
      <InlineExpandableRows
        sections={[
          {
            title: 'Conditions',
            entries: [
              { dataName: 'Temperature', dataPoint: '75°F' },
              { dataName: 'Soil', dataPoint: 'Sand', expandable: false },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('Conditions')).toBeTruthy();
    expect(screen.getByText('Temperature: 75°F')).toBeTruthy();
    expect(screen.getByText('Soil: Sand')).toBeTruthy();
  });

  it('applies light mode background color when overridden to be light', () => {
    mockUseColorScheme.mockReturnValue('light');

    const tree = render(<InlineExpandableRows />).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error(
        'Expected InlineExpandableRows to render a single root view',
      );
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(
      Colors.light.background.default.secondary,
    );
  });
});
