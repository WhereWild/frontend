// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Guesses a raster's measurement level ("nominal" | "ordinal" | "interval" |
// "ratio" | "circular" — the same precise taxonomy as
// EnvironmentVariableDefinition.rawValueType) from a sample of its pixel
// values, for the /gis-editor "suggested data type" hint. This is always a
// heuristic over a downsampled preview, not ground truth — "ratio" vs
// "interval" in particular depends on what zero *means*, which pixel values
// alone can never prove. The panel that shows this should let the guess be
// overridden.

export type ValueTypeGuess =
  | 'nominal'
  | 'ordinal'
  | 'interval'
  | 'ratio'
  | 'circular';
export type Confidence = 'high' | 'medium' | 'low';

export type DetectedValueType = {
  guess: ValueTypeGuess;
  confidence: Confidence;
  reason: string;
  /** Count of distinct values found, when that's what drove the guess (the
   * categorical branches). Null when the sample wasn't treated as
   * categorical (continuous/circular data isn't deduplicated). */
  distinctCount: number | null;
};

// Once this many distinct values show up we stop treating the raster as a
// plausible category set — real class rasters (land cover, soil type, ...)
// almost never have more classes than this, and bailing out early keeps the
// Set from growing unboundedly for genuinely continuous data.
const CATEGORICAL_MAX_DISTINCT = 64;
const INTEGER_EPSILON = 1e-6;
const DOWNSAMPLED_NOTE =
  ' (based on a downsampled preview sample — rare classes may not appear)';

const isInteger = (v: number) => Math.abs(v - Math.round(v)) < INTEGER_EPSILON;

export const detectValueType = (
  values: ArrayLike<number>,
  opts: { hasColorMap?: boolean } = {},
): DetectedValueType => {
  if (opts.hasColorMap) {
    return {
      guess: 'nominal',
      confidence: 'high',
      reason:
        'File has an embedded color palette (a paletted/indexed raster) — that only makes sense for categorical classes.',
      distinctCount: null,
    };
  }

  if (values.length === 0) {
    return {
      guess: 'ratio',
      confidence: 'low',
      reason: 'No sample pixels to analyze.',
      distinctCount: null,
    };
  }

  let min = Infinity;
  let max = -Infinity;
  let allInteger = true;
  const distinct = new Set<number>();
  let tooManyDistinct = false;

  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
    if (allInteger && !isInteger(v)) allInteger = false;
    if (!tooManyDistinct) {
      distinct.add(allInteger ? Math.round(v) : v);
      if (distinct.size > CATEGORICAL_MAX_DISTINCT) tooManyDistinct = true;
    }
  }

  const looksCategorical = allInteger && !tooManyDistinct;

  if (looksCategorical) {
    const sorted = [...distinct].sort((a, b) => a - b);
    const startsLow = sorted[0] === 0 || sorted[0] === 1;
    const contiguous = startsLow && sorted.every((v, i) => v === sorted[0] + i);

    if (sorted.length === 2) {
      return {
        guess: 'nominal',
        confidence: 'high',
        reason:
          `Only two distinct integer values (${sorted[0]}, ${sorted[1]}) — looks like a binary mask or flag.` +
          DOWNSAMPLED_NOTE,
        distinctCount: sorted.length,
      };
    }
    if (contiguous) {
      return {
        guess: 'ordinal',
        confidence: 'medium',
        reason:
          `Values are a contiguous run of integers (${sorted[0]}–${sorted[sorted.length - 1]}) with no gaps — looks like ranked classes.` +
          DOWNSAMPLED_NOTE,
        distinctCount: sorted.length,
      };
    }
    return {
      guess: 'nominal',
      confidence: 'medium',
      reason:
        `Few distinct integer values (${sorted.length}) that aren't a contiguous run — looks like unordered class codes.` +
        DOWNSAMPLED_NOTE,
      distinctCount: sorted.length,
    };
  }

  const range = max - min;
  const looksLikeDegrees = min >= -1 && max <= 361 && range >= 45;
  const looksLikeRadians =
    min >= -0.1 && max <= 2 * Math.PI + 0.05 && range >= 0.8;
  if (looksLikeDegrees || looksLikeRadians) {
    return {
      guess: 'circular',
      confidence: 'medium',
      reason: looksLikeDegrees
        ? `Values are bounded within roughly 0–360 (${min.toFixed(1)}–${max.toFixed(1)}) — looks like a bearing/aspect in degrees.`
        : `Values are bounded within roughly 0–2π (${min.toFixed(2)}–${max.toFixed(2)}) — looks like an angle in radians.`,
      distinctCount: null,
    };
  }

  if (min >= -INTEGER_EPSILON) {
    return {
      guess: 'ratio',
      confidence: 'low',
      reason: `All sampled values are non-negative (min ${min.toFixed(2)}) — consistent with a scale that has a true zero, but this can't be confirmed from pixel values alone.`,
      distinctCount: null,
    };
  }
  return {
    guess: 'interval',
    confidence: 'low',
    reason: `Values span both sides of zero (min ${min.toFixed(2)}, max ${max.toFixed(2)}) — consistent with a scale with no true zero (e.g. temperature), but this can't be confirmed from pixel values alone.`,
    distinctCount: null,
  };
};
