// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  getMeasuredWidthOrFallback,
  hasAllTabMeasurements,
  updateMeasuredTabWidths,
} from '../navigationBarMeasurement';

describe('navigationBarMeasurement', () => {
  it('detects whether all tab widths have been measured', () => {
    expect(hasAllTabMeasurements(['a', 'b'], { a: 100 })).toBe(false);
    expect(hasAllTabMeasurements(['a', 'b'], { a: 100, b: 120 })).toBe(true);
  });

  it('updates tab widths only when needed', () => {
    const previous = { a: 100 };

    const updated = updateMeasuredTabWidths(previous, 'b', 120);
    expect(updated).toEqual({ a: 100, b: 120 });

    const unchangedSameValue = updateMeasuredTabWidths(updated, 'b', 120);
    expect(unchangedSameValue).toBe(updated);

    // Re-measure passes after resize should still accept changed tab widths.
    const updatedAllMeasured = updateMeasuredTabWidths(updated, 'a', 110);
    expect(updatedAllMeasured).toEqual({ a: 110, b: 120 });
  });

  it('falls back to horizontal minimum width when tab is not measured', () => {
    expect(getMeasuredWidthOrFallback({ a: 140 }, 'a')).toBe(140);
    expect(getMeasuredWidthOrFallback({ a: 140 }, 'b')).toBe(96);
  });
});
