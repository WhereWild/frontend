// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render } from '@testing-library/react-native';
import { Path } from 'react-native-svg';
import { MapCircularLegend } from '../MapCircularLegend';

// Ring is 56x56 (RING const), center at (28, 28).
const CENTER = 28;

// Inverse of the component's touchToDeg — builds a touch point for a given
// compass bearing (0 = north, clockwise-positive) at radius r from center.
function pointAtDeg(deg: number, r = 20) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return {
    locationX: CENTER + r * Math.cos(rad),
    locationY: CENTER + r * Math.sin(rad),
  };
}

describe('MapCircularLegend range selection', () => {
  it('reports a start/end angle pair in drag order (not sorted), so a slice can wrap through 0°', () => {
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapCircularLegend onRangeChange={onRangeChange} />,
    );

    const responder = getByTestId('map-circular-legend-responder');
    // Straight up from center = 0° (north).
    fireEvent(responder, 'responderGrant', {
      nativeEvent: { locationX: CENTER, locationY: CENTER - 20 },
    });
    // Straight right from center = 90° (east).
    fireEvent(responder, 'responderMove', {
      nativeEvent: { locationX: CENTER + 20, locationY: CENTER },
    });

    const lastCall = onRangeChange.mock.calls.at(-1);
    expect(lastCall?.[0]).toEqual({ min: 0, max: 90 });
  });

  it('preserves a wrapping start > end angle pair (drag from east back through north)', () => {
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapCircularLegend onRangeChange={onRangeChange} />,
    );

    const responder = getByTestId('map-circular-legend-responder');
    // Start near 270° (west-ish, dx negative), drag to 45° (northeast).
    fireEvent(responder, 'responderGrant', {
      nativeEvent: { locationX: CENTER - 20, locationY: CENTER },
    });
    fireEvent(responder, 'responderMove', {
      nativeEvent: { locationX: CENTER + 14, locationY: CENTER - 14 },
    });

    const lastCall = onRangeChange.mock.calls.at(-1)?.[0];
    expect(lastCall.min).toBeCloseTo(270, 0);
    expect(lastCall.max).toBeCloseTo(45, 0);
  });

  it('accumulates a multi-step drag exceeding 180° in one direction (would be wrong as a single-jump shortest-path guess)', () => {
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapCircularLegend onRangeChange={onRangeChange} />,
    );
    const responder = getByTestId('map-circular-legend-responder');

    // Drag clockwise in 40° steps: 0 -> 40 -> 80 -> 120 -> 160 -> 200.
    // A single raw jump from 0 to 200 would resolve to the *shorter* 160°
    // counterclockwise path instead — only accumulating each small step
    // (each unambiguously the short way) correctly recovers the actual
    // 200° clockwise drag.
    fireEvent(responder, 'responderGrant', { nativeEvent: pointAtDeg(0) });
    for (const deg of [40, 80, 120, 160, 200]) {
      fireEvent(responder, 'responderMove', { nativeEvent: pointAtDeg(deg) });
    }

    expect(onRangeChange.mock.calls.at(-1)?.[0]).toEqual({ min: 0, max: 200 });
  });

  it('distinguishes a short backward drag from a long forward drag that would end at the same angle', () => {
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapCircularLegend onRangeChange={onRangeChange} />,
    );
    const responder = getByTestId('map-circular-legend-responder');

    // Drag counterclockwise (backward) from 300° to 210° in small steps.
    // The raw endpoints (300 -> 210) are also consistent with a 270° drag
    // forward the other way — only the actual path taken (each step
    // unambiguously backward) tells them apart.
    fireEvent(responder, 'responderGrant', { nativeEvent: pointAtDeg(300) });
    for (const deg of [270, 240, 210]) {
      fireEvent(responder, 'responderMove', { nativeEvent: pointAtDeg(deg) });
    }

    // Short 90° CCW arc, represented as 210 -> 300 clockwise — NOT
    // {min: 300, max: 210}, which would mean the long 270° forward arc.
    expect(onRangeChange.mock.calls.at(-1)?.[0]).toEqual({
      min: 210,
      max: 300,
    });
  });

  it('clears the selection on a tap without any drag movement', () => {
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapCircularLegend
        selectedRanges={[{ min: 0, max: 90 }]}
        onRangeChange={onRangeChange}
      />,
    );

    const responder = getByTestId('map-circular-legend-responder');
    fireEvent(responder, 'responderGrant', {
      nativeEvent: { locationX: CENTER, locationY: CENTER - 20 },
    });
    fireEvent(responder, 'responderRelease', {
      nativeEvent: { locationX: CENTER, locationY: CENTER - 20 },
    });

    expect(onRangeChange.mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('does not render a responder overlay when onRangeChange is not provided', () => {
    const { queryByTestId } = render(<MapCircularLegend />);
    expect(queryByTestId('map-circular-legend-responder')).toBeNull();
  });

  it('forwards additive/final options through to onRangeChange when forceAdditive is set', () => {
    const onRangeChange = jest.fn();
    const { getByTestId } = render(
      <MapCircularLegend onRangeChange={onRangeChange} forceAdditive />,
    );
    const responder = getByTestId('map-circular-legend-responder');

    fireEvent(responder, 'responderGrant', {
      nativeEvent: { locationX: CENTER, locationY: CENTER - 20 },
    });
    fireEvent(responder, 'responderMove', {
      nativeEvent: { locationX: CENTER + 20, locationY: CENTER },
    });
    fireEvent(responder, 'responderRelease', {
      nativeEvent: { locationX: CENTER + 20, locationY: CENTER },
    });

    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: true, final: true });
  });

  it('renders one dim gap per disjoint selected slice, not one merged blob', () => {
    const { UNSAFE_getAllByType } = render(
      <MapCircularLegend
        selectedRanges={[
          { min: 0, max: 30 },
          { min: 90, max: 120 },
        ]}
      />,
    );
    const paths = UNSAFE_getAllByType(Path);
    // Two disjoint 30° slices out of 360° leave 2 gaps (between them, and
    // wrapping from the end of the second back to the start of the first) —
    // a regression check against collapsing into a single [30,90] dim arc.
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });
});
