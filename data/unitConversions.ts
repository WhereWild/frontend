/**
 * Client-side unit conversion for display purposes.
 * Mirrors wherewild/util/units.py — keep in sync when adding variables.
 */

export type LinearConversion = {
  /** Multiply factor. */
  scale: number;
  /**
   * Additive offset, applied ONLY to position metrics (min, mean, max, quantiles…).
   * Spread metrics (stddev, range, bandwidth) are converted with scale only.
   */
  offset: number;
  /** Target unit label (imperial). */
  unit: string;
};

/** Metric unit → imperial conversion. Mirrors _CONVERSION in units.py. */
const METRIC_TO_IMPERIAL: Record<string, LinearConversion> = {
  '°C':       { scale: 9 / 5, offset: 32,  unit: '°F' },
  '°C·days':  { scale: 9 / 5, offset: 0,   unit: '°F·days' },
  'mm':       { scale: 1 / 25.4, offset: 0, unit: 'in' },
  'm':        { scale: 1 / 0.3048, offset: 0, unit: 'ft' },
  'm s⁻¹':   { scale: 2.2369362921, offset: 0, unit: 'mph' },
};

/**
 * Summary field names that represent spread rather than position.
 * These never receive the additive offset even on interval-scale variables.
 * Mirrors _SPREAD_METRICS in units.py.
 */
const SPREAD_FIELDS = new Set(['stddev', 'std', 'range', 'iqr', 'bandwidth']);

export function getMetricToImperial(
  unit: string | null | undefined,
): LinearConversion | null {
  if (!unit) return null;
  return METRIC_TO_IMPERIAL[unit] ?? null;
}

/**
 * Apply a linear conversion to a scalar value.
 * Pass `isSpread=true` for stddev-like metrics so the offset is suppressed.
 */
export function applyConv(
  value: number | null | undefined,
  conv: LinearConversion,
  isSpread = false,
): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return value;
  return value * conv.scale + (isSpread ? 0 : conv.offset);
}

/**
 * Reverse a linear conversion (imperial → metric).
 * Use this to map user-facing selection bounds back to raw metric for index filtering.
 */
export function reverseConv(
  value: number | null | undefined,
  conv: LinearConversion,
  isSpread = false,
): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return value;
  return (value - (isSpread ? 0 : conv.offset)) / conv.scale;
}

export { SPREAD_FIELDS };
