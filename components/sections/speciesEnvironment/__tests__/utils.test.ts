import { buildHistogramBars, formatBinLabel, formatFractionPercent, formatValue } from '../utils';

describe('buildHistogramBars', () => {
  it('returns an empty array when histogram input is null or invalid', () => {
    expect(buildHistogramBars(null)).toEqual([]);
    expect(
      buildHistogramBars({
        bins: [],
        counts: [],
      }),
    ).toEqual([]);
  });

  it('returns all bars when the histogram is already within the display budget', () => {
    const bars = buildHistogramBars({ bins: [0, 10, 20], counts: [5, 10] });
    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ index: 0, start: 0, end: 10, count: 5 });
  });

  it('defaults missing bin edges to zero when counts outnumber bins', () => {
    const bars = buildHistogramBars({ bins: [5], counts: [3, 7] });
    expect(bars[1]).toMatchObject({ index: 1, start: 0, end: 0, count: 7 });
  });

  it('downsamples large histograms and preserves sorted unique bin indices', () => {
    const counts = Array.from({ length: 20 }, (_, index) => index + 1);
    const bins = Array.from({ length: counts.length + 1 }, (_, index) => index * 5);

    const bars = buildHistogramBars({ bins, counts });

    expect(bars).toHaveLength(12);
    expect(bars[0].index).toBeLessThan(bars[bars.length - 1].index);
    expect(new Set(bars.map((bar) => bar.index)).size).toBe(bars.length);
  });

  it('still creates downsampled bars when bin boundaries are missing', () => {
    const counts = Array.from({ length: 20 }, (_, index) => index + 1);
    const bars = buildHistogramBars({ bins: [0, 10], counts });
    expect(bars[bars.length - 1]).toMatchObject({
      index: expect.any(Number),
      start: 0,
      end: 0,
      count: expect.any(Number),
    });
    // Downsampled bars should still map back to an existing count.
    expect(counts).toContain(bars[bars.length - 1].count);
  });

  it('falls back to current bin bounds when the next bin edge is missing', () => {
    const bars = buildHistogramBars({ bins: [5], counts: [3] });
    expect(bars[0]).toMatchObject({ start: 5, end: 5, count: 3 });
  });
});

describe('format helpers', () => {
  it('formats numeric values with a configurable precision', () => {
    expect(formatValue(1234.5678, 2)).toBe('1,234.57');
    expect(formatValue(NaN)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
  });

  it('renders bin labels and guards against invalid inputs', () => {
    expect(formatBinLabel(-0.4, 10.2)).toBe('0 to 10');
    expect(formatBinLabel(Number.NaN, 10)).toBe('—');
  });

  it('normalizes negative zero tick labels to 0', () => {
    const negativeZero = -0;
    expect(Object.is(negativeZero, -0)).toBe(true);
    expect(formatBinLabel(negativeZero, 5)).toBe('0 to 5');
  });

  it('formats fractions as percentages and clamps invalid values to 0%', () => {
    expect(formatFractionPercent(0.1234)).toBe('12.3%');
    expect(formatFractionPercent(Number.POSITIVE_INFINITY)).toBe('0%');
  });
});
