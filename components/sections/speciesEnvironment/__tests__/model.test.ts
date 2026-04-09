import {
  buildCategoricalSummary,
  estimatePercentileFromHistogram,
  formatComparisonLabel,
  formatValue,
  isValidHistogramContract,
  normalizeLabel,
} from '../model';

describe('speciesEnvironment model helpers', () => {
  it('normalizes labels from snake_case', () => {
    expect(normalizeLabel('mean_temp_coldest_quarter')).toBe(
      'Mean Temp Coldest Quarter',
    );
  });

  it('formats values and invalid values', () => {
    expect(formatValue(12.345, 1)).toBe('12.3');
    expect(formatValue(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
    expect(formatValue(Number.NaN)).toBe('—');
  });

  it('formats comparison labels with deltas', () => {
    expect(formatComparisonLabel(12, 10, 0)).toBe('vs. 10 (+20%) globally');
    expect(formatComparisonLabel(8, 10, 0)).toBe('vs. 10 (-20%) globally');
    expect(formatComparisonLabel(10, 10, 0)).toBe('vs. 10 (0%) globally');
  });

  it('returns null comparison when values are invalid', () => {
    expect(formatComparisonLabel(null, 10)).toBeNull();
    expect(formatComparisonLabel(10, null)).toBeNull();
  });

  it('builds categorical summary with fallback totals', () => {
    const summary = buildCategoricalSummary(
      [
        { value: 'a', className: 'A', count: 3, fraction: 0.3 },
        { value: 'b', className: 'B', count: 7, fraction: 0.7 },
      ],
      { count: 10, min: null, mean: null, max: null },
      null,
    );

    expect(summary.totalSamples).toBe(10);
    expect(summary.uniqueClasses).toBe(2);
    expect(summary.significantClasses).toBe(2);
    expect(summary.dominant?.className).toBe('B');
  });

  it('prefers explicit totals over derived values', () => {
    const summary = buildCategoricalSummary(
      [{ value: 'a', className: 'A', count: 1, fraction: 0.01 }],
      { count: 1, min: null, mean: null, max: null },
      { totalSamples: 100, uniqueClasses: 8, significantUniqueClasses: 3 },
    );

    expect(summary.totalSamples).toBe(100);
    expect(summary.uniqueClasses).toBe(8);
    expect(summary.significantClasses).toBe(3);
  });

  it('estimates percentile from histogram', () => {
    const histogram = {
      bins: [0, 10, 20],
      counts: [5, 5],
    };
    expect(estimatePercentileFromHistogram(histogram, 0)).toBe(0);
    expect(estimatePercentileFromHistogram(histogram, 10)).toBe(0.5);
    expect(estimatePercentileFromHistogram(histogram, 20)).toBe(1);
  });

  it('estimates percentile from a well-formed histogram with non-uniform counts', () => {
    const histogram = {
      bins: [0, 10, 20],
      counts: [2, 3],
    };

    expect(estimatePercentileFromHistogram(histogram, 0)).toBe(0);
    expect(estimatePercentileFromHistogram(histogram, 5)).toBeCloseTo(0.2);
    expect(estimatePercentileFromHistogram(histogram, 10)).toBeCloseTo(0.4);
    expect(estimatePercentileFromHistogram(histogram, 15)).toBeCloseTo(0.7);
    expect(estimatePercentileFromHistogram(histogram, 20)).toBe(1);
  });

  it('handles invalid histogram inputs', () => {
    expect(estimatePercentileFromHistogram(null, 5)).toBeNull();
    expect(
      estimatePercentileFromHistogram({ bins: [0], counts: [1] }, 5),
    ).toBeNull();
    expect(
      estimatePercentileFromHistogram({ bins: [0, 1], counts: [1, 2] }, 0.5),
    ).toBeNull();
    expect(
      estimatePercentileFromHistogram({ bins: [0, 1], counts: [0] }, 0.5),
    ).toBeNull();
    expect(
      estimatePercentileFromHistogram({ bins: [0, 1], counts: [1] }, null),
    ).toBeNull();
    expect(
      estimatePercentileFromHistogram(
        { bins: [0, 1], counts: [1] },
        Number.POSITIVE_INFINITY,
      ),
    ).toBeNull();
    expect(
      estimatePercentileFromHistogram(
        { bins: [0, 1], counts: [1] },
        Number.NEGATIVE_INFINITY,
      ),
    ).toBeNull();
    expect(
      estimatePercentileFromHistogram({ bins: [0, 0, 1], counts: [1, 1] }, 0.5),
    ).toBeNull();
    expect(
      estimatePercentileFromHistogram(
        { bins: [0, 1, 2], counts: [1, -1] },
        0.5,
      ),
    ).toBeNull();
  });

  it('formats comparison label without percent when baseline is zero', () => {
    expect(formatComparisonLabel(10, 0, 0)).toBe('vs. 0 globally');
  });

  it('builds categorical summary from reduced distribution when summary count is unavailable', () => {
    const summary = buildCategoricalSummary(
      [
        { value: 'x', className: 'X', count: 2, fraction: 0.8 },
        { value: 'y', className: 'Y', count: 1, fraction: 0.01 },
      ],
      { count: 0, min: null, mean: null, max: null },
      null,
    );

    expect(summary.totalSamples).toBe(3);
    expect(summary.significantClasses).toBe(1);
  });

  it('rejects histograms when bins/counts lengths do not match the canonical shape', () => {
    const histogram = {
      bins: [0, 10],
      counts: [2, 3],
    };

    // Canonical shape is bins.length === counts.length + 1.
    // This malformed input should be rejected regardless of target value.
    expect(estimatePercentileFromHistogram(histogram, 0)).toBeNull();
    expect(estimatePercentileFromHistogram(histogram, 5)).toBeNull();
    expect(estimatePercentileFromHistogram(histogram, 10)).toBeNull();
  });

  it('validates canonical histogram contract', () => {
    expect(isValidHistogramContract({ bins: [0, 1, 2], counts: [1, 2] })).toBe(
      true,
    );
    expect(
      isValidHistogramContract({ bins: [0, Number.NaN], counts: [1] }),
    ).toBe(false);
    expect(
      isValidHistogramContract({
        bins: [0, 1],
        counts: [Number.POSITIVE_INFINITY],
      }),
    ).toBe(false);
  });
});
