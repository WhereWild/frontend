import {
  buildDensitySamples,
  getDensityDomain,
  getSelectionBounds,
  getValueForLocation,
  normalizeDensitySamples,
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

  it('maps location x to domain value and sorts ranges', () => {
    const domain = { minX: 0, maxX: 10, spanX: 10, safeMaxY: 1 };

    expect(getValueForLocation(25, 100, domain)).toBe(2.5);
    expect(getValueForLocation(10, 0, domain)).toBeNull();
    expect(toSortedSelectionRange(9, 2)).toEqual({ start: 2, end: 9 });
  });
});
