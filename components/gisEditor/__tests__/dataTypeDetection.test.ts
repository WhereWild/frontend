// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import { detectValueType } from '../dataTypeDetection';

describe('detectValueType', () => {
  it('flags an embedded color palette as high-confidence nominal', () => {
    const result = detectValueType([1, 2, 3], null, { hasColorMap: true });
    expect(result.guess).toBe('nominal');
    expect(result.confidence).toBe('high');
  });

  it('detects a binary mask as nominal', () => {
    const values = Array(100)
      .fill(0)
      .map((_, i) => (i % 3 === 0 ? 1 : 0));
    const result = detectValueType(values);
    expect(result.guess).toBe('nominal');
    expect(result.confidence).toBe('high');
    expect(result.distinctCount).toBe(2);
  });

  it('detects contiguous integer classes starting at 1 as ordinal', () => {
    const values = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 3, 3, 2];
    const result = detectValueType(values);
    expect(result.guess).toBe('ordinal');
    expect(result.distinctCount).toBe(5);
  });

  it('detects contiguous integer classes starting at 0 as ordinal', () => {
    const values = [0, 1, 2, 3, 0, 1, 2, 3, 2, 2];
    expect(detectValueType(values).guess).toBe('ordinal');
  });

  it('detects non-contiguous integer codes as nominal', () => {
    // Land-cover-style codes with gaps between them.
    const values = [11, 21, 22, 41, 71, 11, 21, 21, 41, 71, 11];
    const result = detectValueType(values);
    expect(result.guess).toBe('nominal');
    expect(result.confidence).toBe('medium');
  });

  it('detects bounded 0-360 floats as circular (degrees)', () => {
    const values = [0.5, 45.2, 90.1, 180.0, 270.3, 359.8, 12.4];
    const result = detectValueType(values);
    expect(result.guess).toBe('circular');
    expect(result.reason).toMatch(/degrees/);
  });

  it('detects bounded 0-2pi floats as circular (radians)', () => {
    const values = [0.1, 1.2, 2.5, 3.9, 5.1, 6.2];
    const result = detectValueType(values);
    expect(result.guess).toBe('circular');
    expect(result.reason).toMatch(/radians/);
  });

  it('detects non-negative floats with a low cardinality but not integer as ratio', () => {
    const values = [0, 1.5, 2.75, 3.2, 0.1, 4000.6, 0, 12.9];
    const result = detectValueType(values);
    expect(result.guess).toBe('ratio');
    expect(result.confidence).toBe('low');
  });

  it('detects floats spanning negative and positive as interval', () => {
    const values = [-12.4, -3.1, 0.5, 8.9, -20.2, 15.6];
    const result = detectValueType(values);
    expect(result.guess).toBe('interval');
    expect(result.confidence).toBe('low');
  });

  it('does not call it ratio just because the sample never dips negative', () => {
    // Non-negative, but the minimum (2197) is nowhere near zero relative to
    // the observed range — no evidence of a true zero, so this shouldn't be
    // asserted as ratio.
    const values = [2197.3, 2500.1, 3000.8, 4100.2, 2900.6];
    const result = detectValueType(values);
    expect(result.guess).toBe('interval');
    expect(result.confidence).toBe('low');
    expect(result.reason).toMatch(/never approach zero/);
  });

  it('does not mistake many-valued integers (e.g. population counts) for categorical', () => {
    const values = Array.from({ length: 200 }, (_, i) => i * 37);
    const result = detectValueType(values);
    expect(result.guess).not.toBe('nominal');
    expect(result.guess).not.toBe('ordinal');
  });

  it('returns a low-confidence ratio guess for an empty sample', () => {
    const result = detectValueType([]);
    expect(result.confidence).toBe('low');
  });

  it('excludes noData and non-finite values from the analysis', () => {
    const values = [1, 1, 2, -9999, -9999, NaN, 1];
    const result = detectValueType(values, -9999);
    expect(result.distinctCount).toBe(2);
  });

  it('treats an all-noData sample the same as an empty one', () => {
    const result = detectValueType([-9999, -9999, NaN], -9999);
    expect(result.confidence).toBe('low');
    expect(result.distinctCount).toBeNull();
  });
});
