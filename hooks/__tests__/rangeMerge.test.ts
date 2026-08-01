// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mergeRanges, rangeContainsValue, rangeKey } from '../rangeMerge';

describe('rangeKey', () => {
  it('builds a stable identity string from start/end', () => {
    expect(rangeKey({ start: 10, end: 20 })).toBe('10_20');
  });
});

describe('rangeContainsValue', () => {
  it('checks a plain continuous range', () => {
    expect(rangeContainsValue({ start: 10, end: 20 }, 15)).toBe(true);
    expect(rangeContainsValue({ start: 10, end: 20 }, 25)).toBe(false);
  });

  it('checks a wraparound (circular) range where start > end', () => {
    const wrap = { start: 350, end: 20 };
    expect(rangeContainsValue(wrap, 0)).toBe(true);
    expect(rangeContainsValue(wrap, 10)).toBe(true);
    expect(rangeContainsValue(wrap, 355)).toBe(true);
    expect(rangeContainsValue(wrap, 180)).toBe(false);
  });
});

describe('mergeRanges', () => {
  it('returns the input unchanged for 0 or 1 ranges', () => {
    expect(mergeRanges([])).toEqual([]);
    expect(mergeRanges([{ start: 1, end: 2 }])).toEqual([{ start: 1, end: 2 }]);
  });

  it('merges two overlapping continuous ranges', () => {
    const merged = mergeRanges([
      { start: 10, end: 20 },
      { start: 15, end: 30 },
    ]);
    expect(merged).toEqual([{ start: 10, end: 30 }]);
  });

  it('merges two touching continuous ranges', () => {
    const merged = mergeRanges([
      { start: 10, end: 20 },
      { start: 20, end: 30 },
    ]);
    expect(merged).toEqual([{ start: 10, end: 30 }]);
  });

  it('keeps disjoint continuous ranges separate', () => {
    const merged = mergeRanges([
      { start: 10, end: 20 },
      { start: 50, end: 60 },
    ]);
    expect(merged).toEqual([
      { start: 10, end: 20 },
      { start: 50, end: 60 },
    ]);
  });

  it('merges a subsuming range into just the larger one', () => {
    const merged = mergeRanges([
      { start: 10, end: 100 },
      { start: 20, end: 30 },
    ]);
    expect(merged).toEqual([{ start: 10, end: 100 }]);
  });

  it('recombines a wraparound range split across the 0/360 seam', () => {
    // A wraparound arc {350,20} plus a disjoint {100,110} — the wraparound
    // one should come back out as a single {350,20}-shaped range, not two
    // separate [350,360]/[0,20] pieces.
    const merged = mergeRanges([
      { start: 350, end: 20 },
      { start: 100, end: 110 },
    ]);
    expect(merged).toHaveLength(2);
    const wrap = merged.find((r) => r.start > r.end);
    expect(wrap).toEqual({ start: 350, end: 20 });
    expect(merged).toContainEqual({ start: 100, end: 110 });
  });

  it('normalizes a full-circle merge result (everything collapses into [0,360]) to the 359.9 convention', () => {
    // A lingering end of exactly 360 only comes from this function's own
    // wraparound-splitting — normalized back to 359.9 to match real
    // per-drag ranges (see useCircularDragSelection's own convention),
    // rather than leaking the internal 360 sentinel either way.
    const merged = mergeRanges([
      { start: 0, end: 200 },
      { start: 180, end: 360 },
    ]);
    expect(merged).toEqual([{ start: 0, end: 359.9 }]);
  });

  it('merges an overlapping pair of wraparound ranges', () => {
    const merged = mergeRanges([
      { start: 340, end: 10 },
      { start: 350, end: 30 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({ start: 340, end: 30 });
  });
});
