// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render } from '@testing-library/react-native';
import { Rect } from 'react-native-svg';
import { MapVariableLegend } from '../MapVariableLegend';

describe('MapVariableLegend range selection', () => {
  it('reports a sorted min/max range while dragging, regardless of drag direction', () => {
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapVariableLegend min={0} max={100} onRangeChange={onRangeChange} />,
    );

    fireEvent(getByTestId('map-variable-legend-bar-row'), 'layout', {
      nativeEvent: { layout: { height: 100 } },
    });

    const bar = getByTestId('map-variable-legend-bar');
    // Drag from near the bottom (low value) up toward the top (high value) —
    // locationY=80 is near min (max - 0.8*(max-min) = 20), locationY=20 is
    // near max (max - 0.2*(max-min) = 80).
    fireEvent(bar, 'responderGrant', {
      nativeEvent: { locationX: 0, locationY: 80 },
    });
    fireEvent(bar, 'responderMove', {
      nativeEvent: { locationX: 0, locationY: 20 },
    });

    const lastCall = onRangeChange.mock.calls.at(-1);
    expect(lastCall?.[0]).toEqual({ min: 20, max: 80 });
  });

  it('keeps a real drag on a narrow-domain variable (e.g. snowfall, 0-1 range) instead of wiping it on release', () => {
    // Regression test: tap-vs-drag used to compare the *converted value*
    // delta against a fixed 0.5 threshold. A real drag spanning most of a
    // 0-1 domain (like snowfall water equivalent, often well under 1 inch
    // total) produces a value delta under 0.5 even though the user visibly
    // dragged most of the bar — which used to misfire the tap-to-clear
    // path on release and silently wipe the selection the user just made.
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapVariableLegend min={0} max={1} onRangeChange={onRangeChange} />,
    );

    fireEvent(getByTestId('map-variable-legend-bar-row'), 'layout', {
      nativeEvent: { layout: { height: 100 } },
    });

    const bar = getByTestId('map-variable-legend-bar');
    // Drags 60px (well past the 4px pixel threshold), but in value terms
    // that's only a 0.6 delta on a 0-1 domain — under the old 0.5 epsilon.
    fireEvent(bar, 'responderGrant', {
      nativeEvent: { locationX: 0, locationY: 80 },
    });
    fireEvent(bar, 'responderMove', {
      nativeEvent: { locationX: 0, locationY: 20 },
    });
    fireEvent(bar, 'responderRelease', {
      nativeEvent: { locationX: 0, locationY: 20 },
    });

    const lastCall = onRangeChange.mock.calls.at(-1)?.[0];
    expect(lastCall).not.toBeNull();
    expect(lastCall.min).toBeCloseTo(0.2, 5);
    expect(lastCall.max).toBeCloseTo(0.8, 5);
  });

  it('clears the selection on a tap without any drag movement', () => {
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapVariableLegend
        min={0}
        max={100}
        selectedRanges={[{ min: 10, max: 90 }]}
        onRangeChange={onRangeChange}
      />,
    );

    fireEvent(getByTestId('map-variable-legend-bar-row'), 'layout', {
      nativeEvent: { layout: { height: 100 } },
    });

    const bar = getByTestId('map-variable-legend-bar');
    fireEvent(bar, 'responderGrant', {
      nativeEvent: { locationX: 0, locationY: 50 },
    });
    fireEvent(bar, 'responderRelease', {
      nativeEvent: { locationX: 0, locationY: 50 },
    });

    expect(onRangeChange.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('does not attach responder handlers when onRangeChange is not provided', () => {
    const { getByTestId } = render(<MapVariableLegend min={0} max={100} />);
    const bar = getByTestId('map-variable-legend-bar');
    expect(bar.props.onResponderGrant).toBeUndefined();
  });

  it('forwards additive/sessionId/final options through to onRangeChange (long-press-arm)', () => {
    jest.useFakeTimers();
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapVariableLegend min={0} max={100} onRangeChange={onRangeChange} />,
    );
    fireEvent(getByTestId('map-variable-legend-bar-row'), 'layout', {
      nativeEvent: { layout: { height: 100 } },
    });
    const bar = getByTestId('map-variable-legend-bar');

    fireEvent(bar, 'responderGrant', {
      nativeEvent: { locationX: 0, locationY: 50 },
    });
    jest.advanceTimersByTime(500);
    fireEvent(bar, 'responderMove', {
      nativeEvent: { locationX: 0, locationY: 20 },
    });
    fireEvent(bar, 'responderRelease', {
      nativeEvent: { locationX: 0, locationY: 20 },
    });

    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: true, final: true });
    jest.useRealTimers();
  });

  it('renders a dim gap between two disjoint selected ranges (not one blended band)', () => {
    const { getByTestId, UNSAFE_getAllByType } = render(
      <MapVariableLegend
        min={0}
        max={100}
        selectedRanges={[
          { min: 10, max: 20 },
          { min: 70, max: 90 },
        ]}
      />,
    );
    fireEvent(getByTestId('map-variable-legend-bar-row'), 'layout', {
      nativeEvent: { layout: { height: 100 } },
    });
    // Two disjoint bands leave 3 dim rects (above, between, below) instead
    // of one — a regression check that the gap between them isn't dimmed
    // away as if it were a single [10,90] selection.
    const rects = UNSAFE_getAllByType(Rect);
    // 1 gradient rect + N dim rects.
    expect(rects.length).toBeGreaterThanOrEqual(4);
  });
});
