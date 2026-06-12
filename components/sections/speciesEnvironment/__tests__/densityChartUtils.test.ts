// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  buildDensitySamples,
  buildSelectionAreaPath,
  getDensityDomain,
  getSelectionBounds,
  getValueForLocation,
  normalizeDensitySamples,
  resampleHistogram,
  toSortedSelectionRange,
} from '../densityChartUtils';

describe('densityChartUtils', () => {
  it('builds finite samples only', () => {
    const samples = buildDensitySamples({
      points: [0, 10, Number.NaN],
      density: [0.2, 0.8, 0.4],
    });

    expect(samples).toEqual([
      { x: 0, y: 0.2 },
      { x: 10, y: 0.8 },
    ]);
  });

  it('computes domain and normalized points', () => {
    const domain = getDensityDomain([
      { x: 0, y: 0.2 },
      { x: 10, y: 1 },
    ]);
    const normalized = normalizeDensitySamples(
      [
        { x: 0, y: 0.2 },
        { x: 10, y: 1 },
      ],
      domain,
      160,
      10,
    );

    expect(domain.minX).toBe(0);
    expect(domain.maxX).toBe(10);
    expect(normalized[0].x).toBe(0);
    expect(normalized[1].x).toBe(100);
  });

  it('returns selection bounds only when width is positive', () => {
    const domain = { minX: 0, maxX: 10, spanX: 10, safeMaxY: 1 };

    expect(getSelectionBounds({ start: 2, end: 8 }, domain)).toEqual({
      left: 20,
      width: 60,
    });
    expect(getSelectionBounds({ start: 5, end: 5 }, domain)).toBeNull();
  });

  it('returns null from getSelectionBounds when domain span is zero', () => {
    const domain = { minX: 5, maxX: 5, spanX: 0, safeMaxY: 1 };
    expect(getSelectionBounds({ start: 4, end: 6 }, domain)).toBeNull();
  });

  it('maps location x to domain value and sorts ranges', () => {
    const domain = { minX: 0, maxX: 10, spanX: 10, safeMaxY: 1 };

    expect(getValueForLocation(25, 100, domain)).toBe(2.5);
    expect(getValueForLocation(10, 0, domain)).toBeNull();
    expect(toSortedSelectionRange(9, 2)).toEqual({ start: 2, end: 9 });
  });

  describe('resampleHistogram', () => {
    it('returns original samples when count is within maxBars', () => {
      const samples = [
        { x: 0, y: 0.2 },
        { x: 5, y: 0.8 },
        { x: 10, y: 0.3 },
      ];
      expect(resampleHistogram(samples, 5)).toBe(samples);
    });

    it('returns empty array for empty input', () => {
      expect(resampleHistogram([], 10)).toEqual([]);
    });

    it('resamples into fewer bins with rangeStart and rangeEnd', () => {
      const samples = Array.from({ length: 10 }, (_, i) => ({
        x: i,
        y: 0.1 * (i + 1),
      }));
      const result = resampleHistogram(samples, 3);

      expect(result.length).toBeLessThanOrEqual(3);
      expect(result[0].rangeStart).toBe(0);
      expect(result[0].rangeEnd).toBeGreaterThan(0);
      expect(result[result.length - 1].rangeEnd).toBe(9);
    });

    it('centers each bin between its first and last sample', () => {
      const samples = [
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        { x: 4, y: 1 },
        { x: 6, y: 1 },
      ];
      const result = resampleHistogram(samples, 2);

      expect(result).toHaveLength(2);
      expect(result[0].x).toBe(1);
      expect(result[0].rangeStart).toBe(0);
      expect(result[0].rangeEnd).toBe(2);
      expect(result[1].x).toBe(5);
      expect(result[1].rangeStart).toBe(4);
      expect(result[1].rangeEnd).toBe(6);
    });

    it('sums density within each bin', () => {
      const samples = [
        { x: 0, y: 0.2 },
        { x: 1, y: 0.3 },
        { x: 2, y: 0.4 },
        { x: 3, y: 0.1 },
      ];
      const result = resampleHistogram(samples, 2);

      expect(result[0].y).toBeCloseTo(0.5);
      expect(result[1].y).toBeCloseTo(0.5);
    });
  });

  describe('buildSelectionAreaPath', () => {
    it('returns empty string for empty normalized array', () => {
      expect(buildSelectionAreaPath([], 0, 100, 200)).toBe('');
    });

    it('returns empty string when selLeft >= selRight', () => {
      const pts = [
        { x: 0, y: 100 },
        { x: 100, y: 50 },
      ];
      expect(buildSelectionAreaPath(pts, 50, 50, 200)).toBe('');
      expect(buildSelectionAreaPath(pts, 80, 20, 200)).toBe('');
    });

    it('builds a closed area path for an interior selection', () => {
      const pts = [
        { x: 0, y: 100 },
        { x: 50, y: 60 },
        { x: 100, y: 80 },
      ];
      const path = buildSelectionAreaPath(pts, 20, 80, 200);
      expect(path).toContain('Z');
      expect(path).toContain('L80,200');
      expect(path).toContain('L20,200');
    });

    it('extrapolates y when selRight exceeds the last normalized point', () => {
      const pts = [
        { x: 0, y: 100 },
        { x: 50, y: 60 },
        { x: 100, y: 80 },
      ];
      // selRight=120 is beyond the last point (x=100) → uses last point's y
      const path = buildSelectionAreaPath(pts, 10, 120, 200);
      expect(path).toBeTruthy();
      expect(path).toContain('120,200');
    });
  });
});
