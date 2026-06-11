// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render } from '@testing-library/react-native';
import { MapVariableLegend } from '../speciesOccurrenceMap/MapVariableLegend';

describe('MapVariableLegend', () => {
  it('renders with basic min/max', () => {
    expect(() => render(<MapVariableLegend min={0} max={100} />)).not.toThrow();
  });

  it('renders with pinned value in range', () => {
    expect(() =>
      render(<MapVariableLegend min={0} max={100} pinnedValue={50} />),
    ).not.toThrow();
  });

  it('renders with pinned value clipped below 0', () => {
    expect(() =>
      render(<MapVariableLegend min={0} max={100} pinnedValue={-10} />),
    ).not.toThrow();
  });

  it('renders with pinned value clipped above max', () => {
    expect(() =>
      render(<MapVariableLegend min={0} max={100} pinnedValue={150} />),
    ).not.toThrow();
  });

  it('renders with null pinnedValue (no pin marker)', () => {
    expect(() =>
      render(<MapVariableLegend min={0} max={100} pinnedValue={null} />),
    ).not.toThrow();
  });

  it('renders with equal min and max (avoids divide-by-zero)', () => {
    expect(() =>
      render(<MapVariableLegend min={50} max={50} pinnedValue={50} />),
    ).not.toThrow();
  });

  it('renders with units', () => {
    expect(() =>
      render(<MapVariableLegend min={0} max={100} units='°C' />),
    ).not.toThrow();
  });

  it('renders with null units', () => {
    expect(() =>
      render(<MapVariableLegend min={0} max={100} units={null} />),
    ).not.toThrow();
  });

  it('renders with custom bar colors', () => {
    expect(() =>
      render(
        <MapVariableLegend
          min={0}
          max={100}
          barColors={['#ff0000', '#00ff00', '#0000ff']}
          barCss='linear-gradient(to right, red, blue)'
        />,
      ),
    ).not.toThrow();
  });

  it('renders large min/max values using integer formatting', () => {
    expect(() =>
      render(<MapVariableLegend min={1000} max={5000} />),
    ).not.toThrow();
  });

  it('renders in light mode', () => {
    const { useColorScheme } = require('@/hooks/useColorScheme');
    (useColorScheme as jest.Mock).mockReturnValueOnce('light');
    expect(() => render(<MapVariableLegend min={0} max={100} />)).not.toThrow();
  });
});
