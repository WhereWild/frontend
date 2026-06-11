// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SpeciesTimestampFilters } from '../SpeciesTimestampFilters';

jest.mock('@/components/inputs/DateRangeSlider', () => ({
  DateRangeSlider: ({
    onStartChange,
    onEndChange,
    minDate,
    maxDate,
  }: {
    onStartChange: (d: { year: number; month: number; day?: number }) => void;
    onEndChange: (d: { year: number; month: number; day?: number }) => void;
    minDate: { year: number; month: number; day?: number };
    maxDate: { year: number; month: number; day?: number };
  }) => {
    const React = jest.requireActual('react');
    const { View, Pressable } = jest.requireActual('react-native');
    return React.createElement(
      View,
      { testID: 'date-range-slider' },
      React.createElement(Pressable, {
        testID: 'fire-start-at-min',
        onPress: () => onStartChange(minDate),
      }),
      React.createElement(Pressable, {
        testID: 'fire-start-after-min',
        onPress: () => onStartChange({ year: 2020, month: 6, day: 1 }),
      }),
      React.createElement(Pressable, {
        testID: 'fire-end-at-max',
        onPress: () => onEndChange(maxDate),
      }),
      React.createElement(Pressable, {
        testID: 'fire-end-before-max',
        onPress: () => onEndChange({ year: 2020, month: 6, day: 1 }),
      }),
    );
  },
}));

describe('SpeciesTimestampFilters', () => {
  const baseProps = {
    startTimestamp: null,
    endTimestamp: null,
    minTimestamp: null,
    maxTimestamp: null,
    onStartChange: jest.fn(),
    onEndChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with all null timestamps (uses fallback min/max)', () => {
    const { getByTestId } = render(<SpeciesTimestampFilters {...baseProps} />);
    expect(getByTestId('date-range-slider')).toBeTruthy();
  });

  it('renders with explicit timestamps', () => {
    const { getByTestId } = render(
      <SpeciesTimestampFilters
        {...baseProps}
        startTimestamp={1000000}
        endTimestamp={2000000}
        minTimestamp={500000}
        maxTimestamp={3000000}
      />,
    );
    expect(getByTestId('date-range-slider')).toBeTruthy();
  });

  it('calls onStartChange with null when start is at or before min', () => {
    const onStartChange = jest.fn();
    const { getByTestId } = render(
      <SpeciesTimestampFilters
        {...baseProps}
        minTimestamp={null}
        onStartChange={onStartChange}
      />,
    );
    fireEvent.press(getByTestId('fire-start-at-min'));
    expect(onStartChange).toHaveBeenCalledWith(null);
  });

  it('calls onStartChange with timestamp when start is after min', () => {
    const onStartChange = jest.fn();
    const { getByTestId } = render(
      <SpeciesTimestampFilters
        {...baseProps}
        minTimestamp={null}
        onStartChange={onStartChange}
      />,
    );
    fireEvent.press(getByTestId('fire-start-after-min'));
    expect(onStartChange).toHaveBeenCalledWith(expect.any(Number));
    expect(onStartChange.mock.calls[0][0]).not.toBeNull();
  });

  it('calls onEndChange with null when end is at or after max', () => {
    const onEndChange = jest.fn();
    const { getByTestId } = render(
      <SpeciesTimestampFilters
        {...baseProps}
        maxTimestamp={null}
        onEndChange={onEndChange}
      />,
    );
    fireEvent.press(getByTestId('fire-end-at-max'));
    expect(onEndChange).toHaveBeenCalledWith(null);
  });

  it('calls onEndChange with timestamp when end is before max', () => {
    const onEndChange = jest.fn();
    const { getByTestId } = render(
      <SpeciesTimestampFilters
        {...baseProps}
        maxTimestamp={null}
        onEndChange={onEndChange}
      />,
    );
    fireEvent.press(getByTestId('fire-end-before-max'));
    expect(onEndChange).toHaveBeenCalledWith(expect.any(Number));
    expect(onEndChange.mock.calls[0][0]).not.toBeNull();
  });
});
