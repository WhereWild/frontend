// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { DataEntrySection } from '../DataEntrySection';

describe('DataEntrySection', () => {
  it('renders the section title and entries', () => {
    render(
      <DataEntrySection
        title='Environmental factors'
        entries={[
          {
            dataName: 'Average elevation',
            dataPoint: '2000 m',
            expandable: false,
          },
          {
            dataName: 'Average precipitation',
            dataPoint: '39.4 cm',
            expandable: false,
          },
        ]}
      />,
    );

    expect(screen.getByText('Environmental factors')).toBeTruthy();
    expect(screen.getByText('Average elevation: 2000 m')).toBeTruthy();
    expect(screen.getByText('Average precipitation: 39.4 cm')).toBeTruthy();
  });

  it('forwards entry props to DataEntry rows', () => {
    render(
      <DataEntrySection
        entries={[
          {
            dataName: 'Average precipitation',
            dataPoint: '39.4 cm',
            details: [{ label: 'Detail name', value: 'data point' }],
          },
        ]}
      />,
    );

    fireEvent.press(screen.getByLabelText('Average precipitation expand'));

    expect(screen.getByText('Detail name: data point')).toBeTruthy();
  });

  it('falls back to default title and renders no entries when none provided', () => {
    render(<DataEntrySection />);

    expect(screen.getByText('Section Title')).toBeTruthy();
    expect(screen.queryByText(/:/)).toBeNull();
  });
});
