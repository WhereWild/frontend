// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { StyleSheet } from 'react-native';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { SummaryItem, SummaryRowPressContext } from '../SummaryItem';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const mockFetchRankDensity = jest.fn();
jest.mock('@/data/apiRankDensity', () => ({
  fetchRankDensity: (...args: unknown[]) => mockFetchRankDensity(...args),
}));

describe('SummaryItem', () => {
  it('renders comparison text branch', () => {
    render(
      <SummaryItem label='Mean' value='12.3' comparison='vs. 10 (+23%)' />,
    );

    expect(screen.getByText(/Mean\s*:\s*12\.3/)).toBeTruthy();
    expect(screen.getByText('vs. 10 (+23%)')).toBeTruthy();
  });

  it('renders rank branch with percentile', () => {
    render(
      <SummaryItem
        label='Max'
        value='22'
        rank={{
          metric: 'max',
          label: 'Mammalia',
          rank: 2,
          count: 100,
          percentile: 0.9,
        }}
      />,
    );

    expect(screen.getByText(/Max\s*:\s*22/)).toBeTruthy();
    expect(screen.getByText(/Ranks/)).toBeTruthy();
    expect(screen.getByText(/percentile/)).toBeTruthy();
  });

  it('renders only label/value when no rank/comparison', () => {
    render(<SummaryItem label='Min' value='1.0' />);

    expect(screen.getByText(/Min\s*:\s*1\.0/)).toBeTruthy();
  });

  it('formats low percentile as less than one percent', () => {
    render(
      <SummaryItem
        label='Min'
        value='1'
        rank={{
          metric: 'min',
          label: 'Context',
          rank: 1,
          count: 99,
          percentile: 0.009,
        }}
      />,
    );

    expect(screen.getByText(/<1st percentile/)).toBeTruthy();
  });

  it('formats ordinal percentile suffixes for second and third', () => {
    const { rerender } = render(
      <SummaryItem
        label='Mean'
        value='2'
        rank={{
          metric: 'mean',
          label: 'Context',
          rank: 2,
          count: 100,
          percentile: 0.02,
        }}
      />,
    );

    expect(screen.getByText(/2nd percentile/)).toBeTruthy();

    rerender(
      <SummaryItem
        label='Mean'
        value='3'
        rank={{
          metric: 'mean',
          label: 'Context',
          rank: 3,
          count: 100,
          percentile: 0.03,
        }}
      />,
    );

    expect(screen.getByText(/3rd percentile/)).toBeTruthy();
  });

  it('renders percentile-only rank details when rank/count are missing', () => {
    render(
      <SummaryItem
        label='Max'
        value='30'
        rank={{ metric: 'max', label: 'Context', percentile: 0.5 }}
      />,
    );

    expect(screen.queryByText(/Ranks/)).toBeNull();
    expect(screen.getByText(/50th percentile/)).toBeTruthy();
  });

  it('does not render percentile text for non-finite percentile values', () => {
    render(
      <SummaryItem
        label='Mean'
        value='5'
        rank={{
          metric: 'mean',
          label: 'Context',
          rank: 1,
          count: 10,
          percentile: Number.NaN,
        }}
      />,
    );

    expect(screen.queryByText(/percentile/)).toBeNull();
  });

  it('formats 11th percentile suffix correctly', () => {
    render(
      <SummaryItem
        label='Mean'
        value='11'
        rank={{ metric: 'mean', label: 'Context', percentile: 0.11 }}
      />,
    );

    expect(screen.getByText(/11th percentile/)).toBeTruthy();
  });

  describe('stacked prop', () => {
    it('renders rank content correctly when stacked', () => {
      render(
        <SummaryItem
          label='Min'
          value='1.0'
          rank={{
            metric: 'min',
            label: 'Mammalia',
            rank: 3,
            count: 41,
            percentile: 0.08,
          }}
          stacked
        />,
      );

      expect(screen.getByText(/Min\s*:\s*1\.0/)).toBeTruthy();
      expect(screen.getByText(/Ranks 3 \/ 41 in Mammalia/)).toBeTruthy();
      expect(screen.getByText(/percentile/)).toBeTruthy();
    });

    it('applies full-width container style when stacked', () => {
      const { toJSON } = render(
        <SummaryItem label='Min' value='1.0' stacked />,
      );
      const tree = toJSON() as unknown as { props: { style: object } };
      const style = StyleSheet.flatten(tree.props.style);

      expect(style).toMatchObject({ width: '100%' });
    });

    it('uses left-aligned rank text when stacked', () => {
      render(
        <SummaryItem
          label='Min'
          value='1.0'
          rank={{
            metric: 'min',
            label: 'Mammalia',
            rank: 3,
            count: 41,
            percentile: 0.08,
          }}
          stacked
        />,
      );

      const rankText = screen.getByText(/Ranks/);
      const style = StyleSheet.flatten(rankText.props.style);
      expect(style.textAlign).toBe('left');
    });

    it('uses centered rank text when not stacked', () => {
      render(
        <SummaryItem
          label='Min'
          value='1.0'
          rank={{
            metric: 'min',
            label: 'Mammalia',
            rank: 3,
            count: 41,
            percentile: 0.08,
          }}
        />,
      );

      const rankText = screen.getByText(/Ranks/);
      const style = StyleSheet.flatten(rankText.props.style);
      expect(style.textAlign).toBe('center');
    });

    it('sets borderBottomColor on non-last stacked item', () => {
      const { toJSON } = render(
        <SummaryItem label='Min' value='1.0' stacked />,
      );
      const tree = toJSON() as unknown as { props: { style: object } };
      const style = StyleSheet.flatten(tree.props.style);

      expect(style).toHaveProperty('borderBottomColor');
    });

    it('does not set borderBottomColor on last stacked item', () => {
      const { toJSON } = render(
        <SummaryItem label='Max' value='10.0' stacked isLast />,
      );
      const tree = toJSON() as unknown as { props: { style: object } };
      const style = StyleSheet.flatten(tree.props.style);

      expect(style).not.toHaveProperty('borderBottomColor');
    });
  });
});

describe('SummaryItem rank density peek', () => {
  const peekableBearing = {
    metric: 'circular_mean',
    label: 'Opuntia',
    rank: 12,
    count: 40,
    percentile: 0.3,
    contextTaxonId: '2923968',
    contextRank: 'SPECIES',
    variable: 'aspect',
    value: 92,
  };
  const peekableRank = {
    metric: 'mean',
    label: 'Opuntia',
    rank: 3,
    count: 40,
    percentile: 0.075,
    contextTaxonId: '2923968',
    contextRank: 'SPECIES',
    variable: 'bio1',
    value: 5,
  };

  beforeEach(() => {
    mockFetchRankDensity.mockReset();
  });

  it('fetches and shows the cohort distribution on hover, and hides it on leave', async () => {
    mockFetchRankDensity.mockResolvedValue({
      count: 40,
      curve: { points: [0, 5, 10], density: [0.1, 0.3, 0.1] },
    });
    render(<SummaryItem label='Mean' value='5' rank={peekableRank} />);
    const item = screen.getByTestId('summary-item-peekable');

    fireEvent(item, 'hoverIn');

    expect(screen.getByText('Loading distribution…')).toBeTruthy();
    expect(await screen.findByTestId('rank-density-chart')).toBeTruthy();
    expect(screen.getByTestId('rank-density-marker')).toBeTruthy();
    expect(mockFetchRankDensity).toHaveBeenCalledWith(
      expect.objectContaining({
        contextTaxonId: '2923968',
        contextRank: 'SPECIES',
        variable: 'bio1',
        metric: 'mean',
      }),
    );

    fireEvent(item, 'hoverOut');

    expect(
      screen.getByTestId('rank-density-peek', { includeHiddenElements: true }),
    ).not.toBeVisible();
  });

  it('peeks while long-pressed and closes on release', async () => {
    mockFetchRankDensity.mockResolvedValue(null);
    render(<SummaryItem label='Mean' value='5' rank={peekableRank} />);
    const item = screen.getByTestId('summary-item-peekable');

    fireEvent(item, 'longPress');
    expect(screen.getByTestId('rank-density-peek')).toBeVisible();
    await waitFor(() => expect(mockFetchRankDensity).toHaveBeenCalled());

    fireEvent(item, 'pressOut');
    expect(
      screen.getByTestId('rank-density-peek', { includeHiddenElements: true }),
    ).not.toBeVisible();
  });

  it('reports an unavailable distribution when the request fails', async () => {
    mockFetchRankDensity.mockRejectedValue(new Error('boom'));
    render(<SummaryItem label='Mean' value='5' rank={peekableRank} />);

    fireEvent(screen.getByTestId('summary-item-peekable'), 'hoverIn');

    expect(await screen.findByText('Distribution unavailable.')).toBeTruthy();
  });

  it('forwards a plain tap to the enclosing summary row', () => {
    const onRowPress = jest.fn();
    render(
      <SummaryRowPressContext.Provider value={onRowPress}>
        <SummaryItem label='Mean' value='5' rank={peekableRank} />
      </SummaryRowPressContext.Provider>,
    );

    fireEvent.press(screen.getByTestId('summary-item-peekable'));

    expect(onRowPress).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('rank-density-peek', { includeHiddenElements: true }),
    ).not.toBeVisible();
  });

  it('is not peekable without a cohort to fetch, or while comparing', () => {
    const { rerender } = render(
      <SummaryItem
        label='Mean'
        value='5'
        rank={{ ...peekableRank, contextTaxonId: null }}
      />,
    );
    expect(screen.queryByTestId('summary-item-peekable')).toBeNull();

    rerender(
      <SummaryItem
        label='Mean'
        value='5'
        rank={peekableRank}
        comparison='vs. 4 (+25%)'
      />,
    );
    expect(screen.queryByTestId('summary-item-peekable')).toBeNull();
  });

  it('charts a bearing cohort on a polar chart without showing rank text', async () => {
    mockFetchRankDensity.mockResolvedValue({
      count: 40,
      mean: 90,
      curve: { points: [0, 90, 180, 270], density: [0.2, 0.4, 0.2, 0.1] },
    });
    render(
      <SummaryItem
        label='Mean'
        value='92°'
        densityRank={{ ...peekableBearing }}
        circular
      />,
    );

    expect(screen.queryByText(/Ranks/)).toBeNull();
    fireEvent(screen.getByTestId('summary-item-peekable'), 'hoverIn');

    await waitFor(() =>
      expect(mockFetchRankDensity).toHaveBeenCalledWith(
        expect.objectContaining({ metric: 'circular_mean' }),
      ),
    );
    // Polar chart, not the linear one.
    expect(screen.queryByTestId('rank-density-chart')).toBeNull();
  });
});
