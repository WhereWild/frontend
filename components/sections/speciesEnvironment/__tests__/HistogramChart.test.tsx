import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { HistogramChart } from '../HistogramChart';
import type { HistogramBar } from '../utils';

const baseBars: HistogramBar[] = [
  { index: 0, start: 0, end: 10, count: 5 },
  { index: 1, start: 10, end: 20, count: 15 },
];

const emptyBars: HistogramBar[] = [
  { index: 0, start: 0, end: 5, count: 0 },
  { index: 1, start: 5, end: 10, count: 0 },
];

describe('HistogramChart', () => {
  it('shows a placeholder when no histogram bars are provided', () => {
    render(
      <HistogramChart
        bars={[]}
        barColor="#000"
        tooltipColor="#fff"
        totalCount={0}
        selectedIndex={null}
        selectionColor="#111"
      />,
    );

    expect(screen.getByText('Histogram data unavailable.')).toBeTruthy();
  });

  it('renders vertical bars and exposes tooltip for the selected bin', () => {
    const onSelect = jest.fn();

    render(
      <HistogramChart
        bars={baseBars}
        barColor="#123456"
        tooltipColor="#cccccc"
        totalCount={20}
        selectedIndex={1}
        onSelectBin={onSelect}
        selectionColor="#abcdef"
      />,
    );

    fireEvent.press(screen.getByTestId('histogram-bar-0'));
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(screen.getByText(/10 to 20 • Samples 15 \(75.0%\)/i)).toBeTruthy();
  });

  it('supports horizontal orientation and shows transient hover tooltips', () => {
    render(
      <HistogramChart
        bars={baseBars}
        barColor="#ff6600"
        tooltipColor="#333333"
        trackColor="#999999"
        totalCount={0}
        selectedIndex={null}
        selectionColor="#00ff00"
        orientation="horizontal"
      />,
    );

    expect(screen.getByTestId('histogram-horizontal-track-0')).toBeTruthy();

    const firstBar = screen.getByTestId('histogram-bar-0');
    fireEvent(firstBar, 'pressIn');
    expect(screen.getByText(/0 to 10 • Samples 5 \(0%\)/i)).toBeTruthy();

    fireEvent(firstBar, 'pressOut');
    expect(screen.queryByText(/Samples 5/)).toBeNull();
  });

  it('falls back to a safe max when all bars are empty and clears hover on leave', () => {
    render(
      <HistogramChart
        bars={emptyBars}
        barColor="#225588"
        tooltipColor="#111111"
        totalCount={0}
        selectedIndex={null}
        selectionColor="#00aa00"
      />,
    );

    const firstBar = screen.getByTestId('histogram-bar-0');
    const secondBar = screen.getByTestId('histogram-bar-1');
    fireEvent(firstBar, 'hoverIn');
    expect(screen.getByText(/0 to 5 • Samples 0 \(0%\)/i)).toBeTruthy();

    fireEvent(firstBar, 'hoverOut');
    expect(screen.queryByText(/Samples 0/)).toBeNull();

    fireEvent(secondBar, 'hoverIn');
    expect(screen.getByText(/5 to 10 • Samples 0 \(0%\)/i)).toBeTruthy();

    fireEvent(secondBar, 'hoverOut');
    expect(screen.queryByText(/Samples 0/)).toBeNull();
  });

  it('highlights horizontal selections and restores selection tooltip after hover leaves', () => {
    render(
      <HistogramChart
        bars={baseBars}
        barColor="#663399"
        tooltipColor="#222222"
        totalCount={20}
        selectedIndex={0}
        selectionColor="#ff00ff"
        orientation="horizontal"
      />,
    );

    const secondBar = screen.getByTestId('histogram-bar-1');
    const firstBar = screen.getByTestId('histogram-bar-0');
    fireEvent(secondBar, 'hoverIn');
    expect(screen.getByText(/10 to 20 • Samples 15 \(75.0%\)/i)).toBeTruthy();

    // Hovering another bar shouldn't clear the current tooltip until that bar leaves.
    fireEvent(firstBar, 'hoverIn');
    expect(screen.getByText(/0 to 10 • Samples 5 \(25.0%\)/i)).toBeTruthy();

    // When the second bar leaves, selection tooltip returns.
    fireEvent(secondBar, 'hoverOut');
    expect(screen.getByText(/0 to 10 • Samples 5 \(25.0%\)/i)).toBeTruthy();
  });
});
