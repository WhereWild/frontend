// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook } from '@testing-library/react-native';
import { useRangeSelectionAccumulator } from '../useRangeSelectionAccumulator';

describe('useRangeSelectionAccumulator', () => {
  it('replaces the selection on a plain (non-additive) range', () => {
    const { result } = renderHook(() => useRangeSelectionAccumulator());
    act(() => {
      result.current.applyRangeChange({ start: 10, end: 20 });
    });
    expect(result.current.ranges).toEqual([{ start: 10, end: 20 }]);

    act(() => {
      result.current.applyRangeChange({ start: 50, end: 60 });
    });
    expect(result.current.ranges).toEqual([{ start: 50, end: 60 }]);
  });

  it('clears the whole selection on a plain (non-additive) null', () => {
    const { result } = renderHook(() => useRangeSelectionAccumulator());
    act(() => {
      result.current.applyRangeChange({ start: 10, end: 20 });
    });
    act(() => {
      result.current.applyRangeChange(null);
    });
    expect(result.current.ranges).toEqual([]);
  });

  it('adds an additive range as a new disjoint entry instead of replacing', () => {
    const { result } = renderHook(() => useRangeSelectionAccumulator());
    act(() => {
      result.current.applyRangeChange({ start: 10, end: 20 });
    });
    act(() => {
      result.current.applyRangeChange(
        { start: 50, end: 60 },
        { additive: true, sessionId: 2, final: true },
      );
    });
    expect(result.current.ranges).toEqual([
      { start: 10, end: 20 },
      { start: 50, end: 60 },
    ]);
  });

  it('updates the same in-progress session slot across move events instead of appending each frame', () => {
    const { result } = renderHook(() => useRangeSelectionAccumulator());
    act(() => {
      result.current.applyRangeChange({ start: 10, end: 20 });
    });
    act(() => {
      result.current.applyRangeChange(
        { start: 50, end: 55 },
        { additive: true, sessionId: 2 },
      );
    });
    act(() => {
      result.current.applyRangeChange(
        { start: 50, end: 65 },
        { additive: true, sessionId: 2 },
      );
    });
    // Still just 2 entries — the second session's live updates replaced its
    // own slot rather than appending a new one each move.
    expect(result.current.ranges).toEqual([
      { start: 10, end: 20 },
      { start: 50, end: 65 },
    ]);
  });

  it('merges an additive range into an existing overlapping one on final', () => {
    const { result } = renderHook(() => useRangeSelectionAccumulator());
    act(() => {
      result.current.applyRangeChange({ start: 10, end: 30 });
    });
    act(() => {
      result.current.applyRangeChange(
        { start: 20, end: 40 },
        { additive: true, sessionId: 2, final: true },
      );
    });
    expect(result.current.ranges).toEqual([{ start: 10, end: 40 }]);
  });

  it('removes only the in-progress session slot on an additive null (not the whole selection)', () => {
    const { result } = renderHook(() => useRangeSelectionAccumulator());
    act(() => {
      result.current.applyRangeChange({ start: 10, end: 20 });
    });
    act(() => {
      result.current.applyRangeChange(
        { start: 50, end: 55 },
        { additive: true, sessionId: 2 },
      );
    });
    act(() => {
      result.current.applyRangeChange(null, {
        additive: true,
        sessionId: 2,
      });
    });
    expect(result.current.ranges).toEqual([{ start: 10, end: 20 }]);
  });

  it('setAll replaces everything and resets in-progress session tracking', () => {
    const { result } = renderHook(() => useRangeSelectionAccumulator());
    act(() => {
      result.current.setAll([{ start: 1, end: 2 }]);
    });
    expect(result.current.ranges).toEqual([{ start: 1, end: 2 }]);
  });

  it('clear empties the selection', () => {
    const { result } = renderHook(() => useRangeSelectionAccumulator());
    act(() => {
      result.current.applyRangeChange({ start: 1, end: 2 });
    });
    act(() => {
      result.current.clear();
    });
    expect(result.current.ranges).toEqual([]);
  });
});
