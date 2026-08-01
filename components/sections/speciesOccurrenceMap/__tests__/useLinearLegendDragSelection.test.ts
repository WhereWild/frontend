// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import { useLinearLegendDragSelection } from '../useLinearLegendDragSelection';

const touchEvent = (locationX: number, locationY: number) =>
  ({ nativeEvent: { locationX, locationY } }) as GestureResponderEvent;

// Simple 1:1 mapping from locationY to a domain value for these tests.
const locationToValue = (_x: number, y: number) => y;

describe('useLinearLegendDragSelection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports a sorted range immediately on a real (non-additive) drag', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useLinearLegendDragSelection({ locationToValue, onRangeChange }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(0, 80));
      result.current.onResponderMove(touchEvent(0, 20));
    });
    act(() => {
      result.current.onResponderRelease(touchEvent(0, 20));
    });

    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[0]).toEqual({ start: 20, end: 80 });
    expect(finalCall?.[1]).toMatchObject({ additive: false, final: true });
    unmount();
  });

  it('clears the selection on a plain tap without any drag', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useLinearLegendDragSelection({ locationToValue, onRangeChange }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(0, 50));
    });
    act(() => {
      result.current.onResponderRelease(touchEvent(0, 50));
    });

    expect(onRangeChange).toHaveBeenCalledWith(null);
    unmount();
  });

  it('arms additive after a long press with no movement', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useLinearLegendDragSelection({ locationToValue, onRangeChange }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(0, 50));
      jest.advanceTimersByTime(500);
    });
    act(() => {
      result.current.onResponderMove(touchEvent(0, 20));
    });
    act(() => {
      result.current.onResponderRelease(touchEvent(0, 20));
    });

    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: true, final: true });
    unmount();
  });

  it('does not emit anything during the pre-arm dwell, even with small jitter', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useLinearLegendDragSelection({ locationToValue, onRangeChange }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(0, 50));
      result.current.onResponderMove(touchEvent(1, 50));
      result.current.onResponderMove(touchEvent(0, 51));
    });
    expect(onRangeChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });
    act(() => {
      result.current.onResponderMove(touchEvent(0, 20));
    });
    act(() => {
      result.current.onResponderRelease(touchEvent(0, 20));
    });

    for (const call of onRangeChange.mock.calls) {
      expect(call[1]).toMatchObject({ additive: true });
    }
    unmount();
  });

  it('cancels the pending arm once movement exceeds the jitter tolerance', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useLinearLegendDragSelection({ locationToValue, onRangeChange }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(0, 50));
      result.current.onResponderMove(touchEvent(0, 20));
      jest.advanceTimersByTime(500);
    });
    act(() => {
      result.current.onResponderRelease(touchEvent(0, 20));
    });

    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: false, final: true });
    unmount();
  });

  it('returns null values from locationToValue without throwing', () => {
    const onRangeChange = jest.fn();
    const alwaysNull = () => null;
    const { result, unmount } = renderHook(() =>
      useLinearLegendDragSelection({
        locationToValue: alwaysNull,
        onRangeChange,
      }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(0, 50));
      result.current.onResponderMove(touchEvent(0, 20));
    });
    act(() => {
      result.current.onResponderRelease(touchEvent(0, 20));
    });

    expect(onRangeChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ start: expect.anything() }),
    );
    unmount();
  });

  it('with forceAdditive, treats an immediate drag as additive with no hold required', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useLinearLegendDragSelection({
        locationToValue,
        onRangeChange,
        forceAdditive: true,
      }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(0, 80));
      result.current.onResponderMove(touchEvent(0, 20));
    });
    act(() => {
      result.current.onResponderRelease(touchEvent(0, 20));
    });

    expect(onRangeChange).toHaveBeenCalled();
    for (const call of onRangeChange.mock.calls) {
      expect(call[1]).toMatchObject({ additive: true });
    }
    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: true, final: true });
    unmount();
  });

  it('with forceAdditive, still clears on a plain tap (no drag)', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useLinearLegendDragSelection({
        locationToValue,
        onRangeChange,
        forceAdditive: true,
      }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(0, 50));
    });
    act(() => {
      result.current.onResponderRelease(touchEvent(0, 50));
    });

    expect(onRangeChange).toHaveBeenCalledWith(null);
    unmount();
  });
});
