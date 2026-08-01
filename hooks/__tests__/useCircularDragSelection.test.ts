// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook } from '@testing-library/react-native';
import type { GestureResponderEvent } from 'react-native';
import { Platform } from 'react-native';
import { useCircularDragSelection } from '../useCircularDragSelection';

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  'OS',
);

const setPlatformOS = (os: string) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
};

const restorePlatformOS = () => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
  }
};

const touchEvent = (locationX: number, locationY: number) =>
  ({ nativeEvent: { locationX, locationY } }) as GestureResponderEvent;

const CENTER = { cx: 100, cy: 100 };
// Directly "north" of center, i.e. angle 0 in touchToDeg's convention.
const NORTH = { x: 100, y: 50 };

describe('useCircularDragSelection long-press-to-arm', () => {
  beforeEach(() => {
    setPlatformOS('ios');
    jest.useFakeTimers();
  });

  afterEach(() => {
    restorePlatformOS();
    jest.useRealTimers();
  });

  it('keeps the final release additive after a held (armed) drag — does not reset before reading isAdditive', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useCircularDragSelection({ center: CENTER, onRangeChange }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(NORTH.x, NORTH.y));
      jest.advanceTimersByTime(500); // arms additive
    });

    act(() => {
      // A real selection needs to move past minDragDeg (default 3°) — well
      // past the small-jitter tolerance too, so this is a deliberate drag,
      // not accidental wander.
      result.current.onResponderMove(touchEvent(160, 100));
    });

    act(() => {
      result.current.onResponderRelease();
    });

    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: true, final: true });
    unmount();
  });

  it('tolerates small jitter without cancelling the pending arm', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useCircularDragSelection({ center: CENTER, onRangeChange }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(NORTH.x, NORTH.y));
      // A couple of 1px-scale jitter moves before the arm timer fires.
      result.current.onResponderMove(touchEvent(NORTH.x + 1, NORTH.y));
      result.current.onResponderMove(touchEvent(NORTH.x, NORTH.y));
      jest.advanceTimersByTime(500);
    });

    act(() => {
      result.current.onResponderMove(touchEvent(160, 100));
    });
    act(() => {
      result.current.onResponderRelease();
    });

    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: true, final: true });
    unmount();
  });

  it('cancels the pending arm once movement exceeds the jitter tolerance', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useCircularDragSelection({ center: CENTER, onRangeChange }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(NORTH.x, NORTH.y));
      // A real drag away from center, well past the tolerance, before the
      // arm timer would fire.
      result.current.onResponderMove(touchEvent(160, 100));
      jest.advanceTimersByTime(500);
    });

    act(() => {
      result.current.onResponderRelease();
    });

    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: false, final: true });
    unmount();
  });

  it('tolerates small jitter near the donut inner radius, where the same jitter produces a large angular delta', () => {
    // Close to center (radius 14px, matching PolarDensityChart's
    // INNER_RADIUS) — a 3px wobble here swings the angle by ~12°, which
    // would have blown past a degree-based tolerance even though the
    // finger barely moved. Pixel-based tolerance isn't fooled by this.
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useCircularDragSelection({ center: CENTER, onRangeChange }),
    );
    const nearCenter = { x: CENTER.cx + 14, y: CENTER.cy };

    act(() => {
      result.current.onResponderGrant(touchEvent(nearCenter.x, nearCenter.y));
      result.current.onResponderMove(
        touchEvent(nearCenter.x, nearCenter.y + 3),
      );
      jest.advanceTimersByTime(500);
    });

    act(() => {
      result.current.onResponderMove(touchEvent(160, 100));
    });
    act(() => {
      result.current.onResponderRelease();
    });

    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: true, final: true });
    unmount();
  });

  it('does not emit anything during the pre-arm dwell, even with jitter — a non-additive call there would wipe an existing selection', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useCircularDragSelection({ center: CENTER, onRangeChange }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(NORTH.x, NORTH.y));
      // Jitter well within tolerance, still before the arm timer fires —
      // additive isn't known yet, so nothing should be emitted at all.
      result.current.onResponderMove(touchEvent(NORTH.x + 1, NORTH.y));
      result.current.onResponderMove(touchEvent(NORTH.x, NORTH.y + 1));
      result.current.onResponderMove(touchEvent(NORTH.x - 1, NORTH.y));
    });

    expect(onRangeChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    act(() => {
      result.current.onResponderMove(touchEvent(160, 100));
    });
    act(() => {
      result.current.onResponderRelease();
    });

    // Every call across the whole gesture — once armed, and at release —
    // must be additive; none of the earlier dwell jitter should have
    // sneaked out a non-additive (selection-wiping) call.
    for (const call of onRangeChange.mock.calls) {
      expect(call[1]).toMatchObject({ additive: true });
    }
    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: true, final: true });
    unmount();
  });
});

describe('useCircularDragSelection forceAdditive', () => {
  beforeEach(() => {
    setPlatformOS('ios');
  });

  afterEach(() => {
    restorePlatformOS();
  });

  it('treats an immediate drag as additive with no hold required', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useCircularDragSelection({
        center: CENTER,
        onRangeChange,
        forceAdditive: true,
      }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(NORTH.x, NORTH.y));
      // Drag immediately — no dwell/hold at all.
      result.current.onResponderMove(touchEvent(160, 100));
    });
    act(() => {
      result.current.onResponderRelease();
    });

    expect(onRangeChange).toHaveBeenCalled();
    for (const call of onRangeChange.mock.calls) {
      expect(call[1]).toMatchObject({ additive: true });
    }
    const finalCall = onRangeChange.mock.calls.at(-1);
    expect(finalCall?.[1]).toMatchObject({ additive: true, final: true });
    unmount();
  });

  it('still clears on a plain tap (no drag)', () => {
    const onRangeChange = jest.fn();
    const { result, unmount } = renderHook(() =>
      useCircularDragSelection({
        center: CENTER,
        onRangeChange,
        forceAdditive: true,
      }),
    );

    act(() => {
      result.current.onResponderGrant(touchEvent(NORTH.x, NORTH.y));
    });
    act(() => {
      result.current.onResponderRelease();
    });

    expect(onRangeChange).toHaveBeenCalledWith(null);
    unmount();
  });
});
