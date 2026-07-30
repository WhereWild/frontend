// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from '@testing-library/react-native';
import { MapVariableLegend } from '../MapVariableLegend';

describe('MapVariableLegend range selection', () => {
  it('shows the selected range as stacked min/to/max text once a selection exists', () => {
    render(
      <MapVariableLegend
        min={0}
        max={100}
        units='°C'
        selectedRange={{ min: 42, max: 78 }}
        onRangeChange={jest.fn()}
      />,
    );
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('to')).toBeTruthy();
    expect(screen.getByText('78')).toBeTruthy();
  });

  it('shows no range text when nothing is selected', () => {
    render(<MapVariableLegend min={0} max={100} units='°C' />);
    expect(screen.queryByText('to')).toBeNull();
  });

  it('reports a sorted min/max range while dragging, regardless of drag direction', () => {
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapVariableLegend
        min={0}
        max={100}
        onRangeChange={onRangeChange}
      />,
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

    expect(onRangeChange).toHaveBeenLastCalledWith({ min: 20, max: 80 });
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
        selectedRange={{ min: 10, max: 90 }}
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

    expect(onRangeChange).toHaveBeenCalledWith(null);
  });

  it('does not attach responder handlers when onRangeChange is not provided', () => {
    const { getByTestId } = render(<MapVariableLegend min={0} max={100} />);
    const bar = getByTestId('map-variable-legend-bar');
    expect(bar.props.onResponderGrant).toBeUndefined();
  });
});
