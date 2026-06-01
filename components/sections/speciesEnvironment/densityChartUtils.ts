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
