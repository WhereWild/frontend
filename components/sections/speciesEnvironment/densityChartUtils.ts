// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SpeciesEnvironmentDensity } from '@/data/types';

/** Selected numeric range represented on the density chart. */
type DensitySelectionRange = {
  start: number;
  end: number;
};

/** Cartesian density sample in source domain units. */
export type DensitySamplePoint = {
  x: number;
  y: number;
  /** Actual first x value of the resampled chunk this point represents. */
  rangeStart?: number;
  /** Actual last x value of the resampled chunk this point represents. */
  rangeEnd?: number;
};

/** Derived x/y domain metadata used for chart normalization. */
export type DensityDomain = {
  minX: number;
  maxX: number;
  spanX: number;
  safeMaxY: number;
};

/** Builds finite x/y density samples from API curve payload. */
export const buildDensitySamples = (
  curve: SpeciesEnvironmentDensity | null | undefined,
): DensitySamplePoint[] => {
  const pointCount = Math.min(
    curve?.points?.length ?? 0,
    curve?.density?.length ?? 0,
  );
  const samples: DensitySamplePoint[] = [];

  if (!curve || pointCount <= 0) {
    return samples;
  }

  for (let index = 0; index < pointCount; index += 1) {
    const x = curve.points[index];
    const y = curve.density[index];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      samples.push({ x, y });
    }
  }

  return samples;
};

/** Computes chart domain bounds and safe extents from density samples. */
export const getDensityDomain = (
  samples: DensitySamplePoint[],
): DensityDomain => {
  const minX = samples.length
    ? Math.min(...samples.map((sample) => sample.x))
    : 0;
  const maxX = samples.length
    ? Math.max(...samples.map((sample) => sample.x))
    : 1;
  const spanX = maxX - minX || 1;
  const maxY = samples.length
    ? Math.max(...samples.map((sample) => sample.y))
    : 1;

  return {
    minX,
    maxX,
    spanX,
    safeMaxY: maxY || 1,
  };
};

/** Minimum pixel height above baseline for any non-zero density value. */
const MIN_NONZERO_RENDER_HEIGHT = 4;

/** Maps domain samples into normalized chart coordinates. */
export const normalizeDensitySamples = (
  samples: DensitySamplePoint[],
  domain: DensityDomain,
  chartHeight: number,
  chartPadding: number,
) =>
  samples.map((sample) => {
    const rawY =
      chartHeight - (sample.y / domain.safeMaxY) * (chartHeight - chartPadding);
    const y =
      sample.y > 0
        ? Math.min(rawY, chartHeight - MIN_NONZERO_RENDER_HEIGHT)
        : rawY;
    return { x: ((sample.x - domain.minX) / domain.spanX) * 100, y };
  });

/** Resolves SVG selection rectangle bounds for the active selection range. */
export const getSelectionBounds = (
  selection: DensitySelectionRange | null | undefined,
  domain: DensityDomain,
) => {
  if (!selection) {
    return null;
  }

  const leftValue = Math.max(
    domain.minX,
    Math.min(domain.maxX, selection.start),
  );
  const rightValue = Math.max(
    domain.minX,
    Math.min(domain.maxX, selection.end),
  );
  const leftRatio =
    ((Math.min(leftValue, rightValue) - domain.minX) / domain.spanX) * 100;
  const rightRatio =
    ((Math.max(leftValue, rightValue) - domain.minX) / domain.spanX) * 100;

  if (!Number.isFinite(leftRatio) || !Number.isFinite(rightRatio)) {
    return null;
  }

  const width = Math.max(0, rightRatio - leftRatio);
  if (width <= 0) {
    return null;
  }

  return {
    left: leftRatio,
    width,
  };
};

/** Converts gesture x-location to variable-domain value. */
export const getValueForLocation = (
  locationX: number,
  chartWidth: number,
  domain: DensityDomain,
) => {
  if (!chartWidth) {
    return null;
  }

  const clamped = Math.min(Math.max(locationX, 0), chartWidth);
  const fraction = clamped / chartWidth;
  return domain.minX + fraction * domain.spanX;
};

/** Returns selection range with ascending start/end ordering. */
export const toSortedSelectionRange = (left: number, right: number) => ({
  start: Math.min(left, right),
  end: Math.max(left, right),
});

/**
 * Merges histogram samples into at most maxBars bins by grouping consecutive
 * entries and summing their densities. Use when stored resolution exceeds
 * available display pixels.
 */
export const resampleHistogram = (
  samples: DensitySamplePoint[],
  maxBars: number,
): DensitySamplePoint[] => {
  if (samples.length === 0 || samples.length <= maxBars) return samples;
  const k = Math.ceil(samples.length / maxBars);
  const result: DensitySamplePoint[] = [];
  for (let i = 0; i < samples.length; i += k) {
    const chunk = samples.slice(i, i + k);
    const rangeStart = chunk[0].x;
    const rangeEnd = chunk[chunk.length - 1].x;
    const centerX = (rangeStart + rangeEnd) / 2;
    const totalY = chunk.reduce((sum, s) => sum + s.y, 0);
    result.push({ x: centerX, y: totalY, rangeStart, rangeEnd });
  }
  return result;
};

/**
 * Builds an SVG area path clipped to [selLeft, selRight] in viewBox x-units (0–100).
 * Avoids SVG clipPath which is unreliable on Android in react-native-svg.
 * Interpolates y at the selection boundaries so the shape follows the curve precisely.
 */
export function buildSelectionAreaPath(
  normalized: { x: number; y: number }[],
  selLeft: number,
  selRight: number,
  chartHeight: number,
): string {
  if (normalized.length === 0 || selLeft >= selRight) return '';

  const interpY = (targetX: number): number => {
    for (let i = 0; i < normalized.length - 1; i++) {
      const a = normalized[i];
      const b = normalized[i + 1];
      if (targetX >= a.x && targetX <= b.x) {
        const t = (targetX - a.x) / (b.x - a.x);
        return a.y + t * (b.y - a.y);
      }
    }
    return targetX <= normalized[0].x
      ? normalized[0].y
      : normalized[normalized.length - 1].y;
  };

  const yLeft = interpY(selLeft);
  const yRight = interpY(selRight);
  const inner = normalized.filter((p) => p.x > selLeft && p.x < selRight);
  const pts = [{ x: selLeft, y: yLeft }, ...inner, { x: selRight, y: yRight }];

  const toSvg = (p: { x: number; y: number }) => `${p.x},${p.y}`;

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toSvg(p)}`)
    .join(' ');
  return `${linePath} L${selRight},${chartHeight} L${selLeft},${chartHeight} Z`;
}

export type LabelPlacementInput = {
  /** Desired center (px) — usually directly under the line it labels. */
  center: number;
  /** Half the label's fixed width (px). */
  half: number;
  /** Lower number = more important; the highest numbers are dropped first
   * when the labels cannot all fit side by side. */
  priority: number;
};

/**
 * Lays out horizontally-centered labels along `[lo, hi]` (px) so that none
 * overlap each other or leave the range. Each label stays as close to its
 * desired center as possible: overlapping labels are merged into clusters
 * spread symmetrically around their desired centers (kept inside range). If the labels cannot all fit,
 * the least important are dropped (returned as `null`) until the rest do.
 */
export function placeLabels(
  inputs: (LabelPlacementInput | null)[],
  lo: number,
  hi: number,
  gap = 4,
): (number | null)[] {
  const kept = inputs
    .map((input, index) => ({ input, index }))
    .filter(
      (e): e is { input: LabelPlacementInput; index: number } =>
        e.input != null && Number.isFinite(e.input.center),
    );
  const widthOf = (list: typeof kept) =>
    list.reduce((sum, e) => sum + e.input.half * 2, 0) +
    gap * Math.max(list.length - 1, 0);

  const available = hi - lo;
  while (kept.length > 0 && widthOf(kept) > available) {
    let worst = 0;
    kept.forEach((e, i) => {
      if (e.input.priority >= kept[worst].input.priority) worst = i;
    });
    kept.splice(worst, 1);
  }

  const result: (number | null)[] = inputs.map(() => null);
  const sorted = [...kept].sort((a, b) => a.input.center - b.input.center);

  // Merge overlapping labels into clusters that sit centered on their
  // members' desired positions (so neighbours shift symmetrically), clamped
  // into range; merging repeats until no two clusters touch.
  type Cluster = { start: number; width: number; first: number; last: number };
  const clusters: Cluster[] = [];
  const clampStart = (start: number, width: number) =>
    Math.min(Math.max(start, lo), hi - width);
  const centeredStart = (first: number, last: number, width: number) => {
    // Average of each member's ideal cluster start.
    let offset = 0;
    let sum = 0;
    for (let i = first; i <= last; i++) {
      const half = sorted[i].input.half;
      sum += sorted[i].input.center - half - offset;
      offset += half * 2 + gap;
    }
    return clampStart(sum / (last - first + 1), width);
  };
  sorted.forEach((e, i) => {
    const width = e.input.half * 2;
    clusters.push({
      start: clampStart(e.input.center - e.input.half, width),
      width,
      first: i,
      last: i,
    });
    while (clusters.length > 1) {
      const cur = clusters[clusters.length - 1];
      const prev = clusters[clusters.length - 2];
      if (prev.start + prev.width + gap <= cur.start) break;
      clusters.splice(clusters.length - 2, 2, {
        first: prev.first,
        last: cur.last,
        width: prev.width + gap + cur.width,
        start: centeredStart(
          prev.first,
          cur.last,
          prev.width + gap + cur.width,
        ),
      });
    }
  });
  clusters.forEach((cluster) => {
    let cursor = cluster.start;
    for (let i = cluster.first; i <= cluster.last; i++) {
      const half = sorted[i].input.half;
      result[sorted[i].index] = cursor + half;
      cursor += half * 2 + gap;
    }
  });
  return result;
}
