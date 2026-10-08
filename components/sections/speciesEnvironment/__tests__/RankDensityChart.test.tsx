// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RankDensityChart } from '../RankDensityChart';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const CURVE = {
  count: 1200,
  curve: { points: [0, 5, 10], density: [0.1, 0.3, 0.1] },
  values: null,
};

describe('RankDensityChart', () => {
  it('labels the cohort size and value range', () => {
    render(<RankDensityChart density={CURVE} units='°C' />);

    expect(screen.getByText('1,200 taxa')).toBeTruthy();
    expect(screen.getByText(/^0\.00\s*°C$/)).toBeTruthy();
    expect(screen.getByText(/^10\.00\s*°C$/)).toBeTruthy();
  });

  it('marks a value with a dashed line at its position', () => {
    render(<RankDensityChart density={CURVE} marker={5} />);

    const marker = screen.getByTestId('rank-density-marker');
    expect(marker.props.d).toBe('M50,0 L50,120');
  });

  it('omits the marker and highlight when not given', () => {
    render(<RankDensityChart density={CURVE} />);

    expect(screen.queryByTestId('rank-density-marker')).toBeNull();
    expect(screen.queryByTestId('rank-density-highlight')).toBeNull();
  });

  it('highlights a range given in either order', () => {
    render(
      <RankDensityChart density={CURVE} highlight={{ start: 7, end: 2 }} />,
    );

    expect(screen.getByTestId('rank-density-highlight')).toBeTruthy();
  });

  it('draws small cohorts as a strip of values instead of a curve', () => {
    render(
      <RankDensityChart
        density={{ count: 3, curve: null, values: [2, 4, 6] }}
      />,
    );

    expect(screen.getByText('3 taxa')).toBeTruthy();
    expect(screen.queryByTestId('rank-density-highlight')).toBeNull();
  });

  it('renders a polar chart for circular metrics', () => {
    render(
      <RankDensityChart
        density={{
          count: 50,
          curve: { points: [0, 90, 180, 270], density: [0.2, 0.4, 0.2, 0.1] },
          values: null,
        }}
        circular
      />,
    );

    expect(screen.queryByTestId('rank-density-chart')).toBeNull();
  });
});
