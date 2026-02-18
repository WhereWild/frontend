import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SummaryItem } from '../SummaryItem';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

describe('SummaryItem', () => {
  it('renders comparison text branch', () => {
    render(<SummaryItem label="Mean" value="12.3" comparison="vs. 10 (+23%)" />);

    expect(screen.getByText(/Mean\s*:\s*12\.3/)).toBeTruthy();
    expect(screen.getByText('vs. 10 (+23%)')).toBeTruthy();
  });

  it('renders rank branch with percentile', () => {
    render(
      <SummaryItem
        label="Max"
        value="22"
        rank={{ metric: 'max', label: 'Mammalia', rank: 2, count: 100, percentile: 0.9 }}
      />,
    );

    expect(screen.getByText(/Max\s*:\s*22/)).toBeTruthy();
    expect(screen.getByText(/Ranks/)).toBeTruthy();
    expect(screen.getByText(/percentile/)).toBeTruthy();
  });

  it('renders only label/value when no rank/comparison', () => {
    render(<SummaryItem label="Min" value="1.0" />);

    expect(screen.getByText(/Min\s*:\s*1\.0/)).toBeTruthy();
  });

  it('formats low percentile as less than one percent', () => {
    render(
      <SummaryItem
        label="Min"
        value="1"
        rank={{ metric: 'min', label: 'Context', rank: 1, count: 99, percentile: 0.009 }}
      />,
    );

    expect(screen.getByText(/<1st percentile/)).toBeTruthy();
  });

  it('formats ordinal percentile suffixes for second and third', () => {
    const { rerender } = render(
      <SummaryItem
        label="Mean"
        value="2"
        rank={{ metric: 'mean', label: 'Context', rank: 2, count: 100, percentile: 0.02 }}
      />,
    );

    expect(screen.getByText(/2nd percentile/)).toBeTruthy();

    rerender(
      <SummaryItem
        label="Mean"
        value="3"
        rank={{ metric: 'mean', label: 'Context', rank: 3, count: 100, percentile: 0.03 }}
      />,
    );

    expect(screen.getByText(/3rd percentile/)).toBeTruthy();
  });

  it('renders percentile-only rank details when rank/count are missing', () => {
    render(
      <SummaryItem
        label="Max"
        value="30"
        rank={{ metric: 'max', label: 'Context', percentile: 0.5 }}
      />,
    );

    expect(screen.queryByText(/Ranks/)).toBeNull();
    expect(screen.getByText(/50th percentile/)).toBeTruthy();
  });

  it('does not render percentile text for non-finite percentile values', () => {
    render(
      <SummaryItem
        label="Mean"
        value="5"
        rank={{ metric: 'mean', label: 'Context', rank: 1, count: 10, percentile: Number.NaN }}
      />,
    );

    expect(screen.queryByText(/percentile/)).toBeNull();
  });

  it('formats 11th percentile suffix correctly', () => {
    render(
      <SummaryItem
        label="Mean"
        value="11"
        rank={{ metric: 'mean', label: 'Context', percentile: 0.11 }}
      />,
    );

    expect(screen.getByText(/11th percentile/)).toBeTruthy();
  });
});
