// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Pure range-merge utilities shared between the species page's density
 * charts (DensityChart/PolarDensityChart, via useEnvironmentHighlights.ts)
 * and the maps page's numeric/circular legends — both need to collapse a
 * multi-select of possibly-overlapping ranges into their minimal combined
 * set, and both need it to work for plain continuous ranges AND circular
 * (aspect-style) wraparound ranges through 0/360 without two separate
 * implementations.
 */

export type PlainRange = { start: number; end: number };

/** Stable identity for a range — used to detect "the user
 * clicked/dragged this exact range again" (toggle it off) when multiple
 * ranges are selected at once. */
export const rangeKey = (range: PlainRange): string =>
  `${range.start}_${range.end}`;

/** Whether `value` falls within `range` — `range.start > range.end` means a
 * circular (aspect-style) wraparound arc through 0/360, e.g. {start:350,
 * end:20} covers 350→360 and 0→20. A plain continuous range never wraps
 * (start <= end always), so this degrades to a normal bounds check there. */
export const rangeContainsValue = (
  range: PlainRange,
  value: number,
): boolean =>
  range.start <= range.end
    ? value >= range.start && value <= range.end
    : value >= range.start || value <= range.end;

export const RANGE_CIRCULAR_MAX = 360;

/** Collapses overlapping/touching/subsuming ranges into their minimal
 * combined set — e.g. two disjoint drags that end up overlapping become one
 * range spanning both. Ranges with `start > end` (only ever produced by a
 * circular/aspect-style selection) represent a wraparound arc through
 * 0/360; each is split into up to two plain [start,end] segments before
 * merging (a continuous, non-circular range never has start > end, so this
 * is a no-op for those), then any segment pair straddling the 0/360 seam is
 * recombined back into a single wrapped range afterward. */
export const mergeRanges = <T extends PlainRange>(ranges: T[]): PlainRange[] => {
  if (ranges.length <= 1) {
    return ranges;
  }
  type Segment = { start: number; end: number };
  const segments: Segment[] = [];
  for (const r of ranges) {
    if (r.start <= r.end) {
      segments.push({ start: r.start, end: r.end });
    } else {
      segments.push({ start: r.start, end: RANGE_CIRCULAR_MAX });
      segments.push({ start: 0, end: r.end });
    }
  }
  segments.sort((a, b) => a.start - b.start);
  const merged: Segment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && seg.start <= last.end) {
      last.end = Math.max(last.end, seg.end);
    } else {
      merged.push({ ...seg });
    }
  }
  // Recombine a segment touching the 0/360 seam on both sides back into one
  // wrapped range — e.g. [350,360] + [0,20] merged separately above become
  // one {start:350, end:20} arc. Only when there's more than one merged
  // segment left: if everything collapsed into a single [0,360] segment,
  // that's a full circle, not a wraparound, and is left as-is (capped below
  // FULL_CIRCLE_SPAN_THRESHOLD's convention of never hitting exactly 360).
  if (
    merged.length > 1 &&
    merged[0].start === 0 &&
    merged[merged.length - 1].end === RANGE_CIRCULAR_MAX
  ) {
    const last = merged.pop()!;
    merged[0] = { start: last.start, end: merged[0].end };
  }
  return merged.map((seg) => ({
    start: seg.start,
    // A lingering end of exactly 360 only ever comes from this function's
    // own wraparound-splitting above (real per-drag ranges cap at 359.9,
    // matching useCircularDragSelection's own convention) — normalize back
    // to that same convention rather than leaking the internal 360 sentinel.
    end: seg.end === RANGE_CIRCULAR_MAX ? 359.9 : seg.end,
  }));
};
