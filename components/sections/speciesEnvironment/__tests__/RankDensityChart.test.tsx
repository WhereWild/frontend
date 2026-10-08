// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { layoutMarkerLabels, RankDensityChart } from '../RankDensityChart';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const CURVE = {
  count: 1200,
  mean: 4,
  curve: { points: [0, 5, 10], density: [0.1, 0.3, 0.1] },
  values: null,
};

const layOut = (width: number) =>
  fireEvent(screen.getByTestId('rank-density-chart'), 'layout', {
    nativeEvent: { layout: { width } },
  });

describe('RankDensityChart', () => {
  it('labels min, mean, and max like the species density chart', () => {
    render(<RankDensityChart density={CURVE} />);
    layOut(400);

    expect(screen.getByText('min')).toBeTruthy();
    expect(screen.getByText('0.00')).toBeTruthy();
    expect(screen.getByText('mean')).toBeTruthy();
    expect(screen.getByText('4.00')).toBeTruthy();
    expect(screen.getByText('max')).toBeTruthy();
    expect(screen.getByText('10.00')).toBeTruthy();
    expect(screen.getByTestId('rank-density-mean').props.d).toBe(
      'M40,0 L40,120',
    );
  });

  it('marks a value with a dashed line and labels it right below', () => {
    render(<RankDensityChart density={CURVE} marker={5} />);
    layOut(400);

    expect(screen.getByTestId('rank-density-marker').props.d).toBe(
      'M50,0 L50,120',
    );
    expect(screen.getByText('5.00')).toBeTruthy();
    expect(screen.getByText('This taxon')).toBeTruthy();
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
        density={{ count: 3, mean: 4, curve: null, values: [2, 4, 6] }}
      />,
    );
    layOut(400);

    expect(screen.getByText('2.00')).toBeTruthy();
    expect(screen.getByText('6.00')).toBeTruthy();
  });

  it('renders a polar chart for circular metrics', () => {
    render(
      <RankDensityChart
        density={{
          count: 50,
          mean: 90,
          curve: { points: [0, 90, 180, 270], density: [0.2, 0.4, 0.2, 0.1] },
          values: null,
        }}
        circular
      />,
    );

    expect(screen.queryByTestId('rank-density-chart')).toBeNull();
  });
});

describe('layoutMarkerLabels', () => {
  it('leaves well-separated labels centered under their lines', () => {
    expect(layoutMarkerLabels(400, 150, 250)).toEqual({
      mean: 150,
      marker: 250,
    });
  });

  it('shifts a label in clear of the min/max edge labels', () => {
    // Edge labels are 48px wide; a 72px marker label must clear them by 4px.
    expect(layoutMarkerLabels(400, null, 10).marker).toBe(88);
    expect(layoutMarkerLabels(400, null, 395).marker).toBe(312);
  });

  it('nudges overlapping mean and marker labels apart', () => {
    const { mean, marker } = layoutMarkerLabels(400, 200, 210);
    expect(marker! - mean!).toBeGreaterThanOrEqual(24 + 36 + 4);
  });
});
