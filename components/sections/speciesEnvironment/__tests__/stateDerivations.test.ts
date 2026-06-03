// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  SpeciesEnvironmentRelativeRank,
  SpeciesEnvironmentStats,
  SpeciesEnvironmentSummary,
} from '@/data/types';
import {
  buildHeadingText,
  buildMetaText,
  buildSummaryComparisons,
  getRankContextOptions,
  resolveMetricRank,
  resolveRangeValue,
} from '../stateDerivations';

describe('stateDerivations', () => {
  const baseSummary: SpeciesEnvironmentSummary = {
    count: 10,
    min: 1,
    mean: 5,
    max: 10,
    stddev: 2,
    q01: 1,
    q99: 10,
  };

  const makeStats = (
    overrides?: Partial<SpeciesEnvironmentStats>,
  ): SpeciesEnvironmentStats => ({
    speciesId: 1,
    variable: 'bio_1',
    variableName: 'Annual Temperature',
    summary: baseSummary,
    histogram: null,
    ...overrides,
  });

  it('skips missing labels and duplicate labels when deriving rank context options', () => {
    const relativeRanks: SpeciesEnvironmentRelativeRank[] = [
      {
        metric: 'mean',
        label: null,
        context: null,
        rank: 1,
        count: 10,
        percentile: 0.9,
      },
      {
        metric: 'mean',
        label: 'Mammalia',
        context: null,
        rank: 2,
        count: 10,
        percentile: 0.8,
      },
      {
        metric: 'max',
        label: 'Mammalia',
        context: null,
        rank: 3,
        count: 20,
        percentile: 0.7,
      },
      {
        metric: 'min',
        label: null,
        context: 'Chordata',
        rank: 4,
        count: 30,
        percentile: 0.6,
      },
    ];

    const options = getRankContextOptions(false, relativeRanks);

    expect(options).toEqual([
      { key: 'Chordata', label: 'Chordata' },
      { key: 'Mammalia', label: 'Mammalia' },
    ]);
  });

  it('returns empty options when location filter is active or ranks are missing', () => {
    expect(
      getRankContextOptions(true, [
        { metric: 'mean' } as SpeciesEnvironmentRelativeRank,
      ]),
    ).toEqual([]);
    expect(getRankContextOptions(false, null)).toEqual([]);
    expect(getRankContextOptions(false, [])).toEqual([]);
  });

  it('resolves preferred metric rank by selected context, then falls back to raw candidates', () => {
    const stats = makeStats({
      relativeRanks: [
        {
          metric: 'mean',
          label: 'Mammalia',
          rank: 5,
          count: 50,
          percentile: 0.8,
        },
        {
          metric: 'mean',
          label: 'Chordata',
          rank: 4,
          count: 200,
          percentile: 0.9,
        },
      ],
      histogram: null,
    });

    const selected = resolveMetricRank({
      metric: 'mean',
      value: 10,
      stats,
      selectedRankContext: 'Mammalia',
    });
    expect(selected?.label).toBe('Mammalia');

    const fallback = resolveMetricRank({
      metric: 'mean',
      value: 10,
      stats,
      selectedRankContext: 'NonExisting',
    });
    expect(fallback?.label).toBe('Chordata');
  });

  it('uses histogram fallback percentile when rank entries are unavailable and fallback enabled', () => {
    const stats = makeStats({
      relativeRanks: [],
      histogram: { bins: [0, 10, 20], counts: [1, 1] },
    });

    const result = resolveMetricRank({
      metric: 'mean',
      value: 15,
      stats,
      selectedRankContext: null,
    });

    expect(result?.label).toBe('Distribution');
    expect(typeof result?.percentile).toBe('number');
  });

  it('returns null when fallback is disabled or histogram percentile cannot be computed', () => {
    const statsNoHistogram = makeStats({
      relativeRanks: [],
      histogram: null,
    });

    expect(
      resolveMetricRank({
        metric: 'std',
        value: 4,
        stats: statsNoHistogram,
        selectedRankContext: null,
        allowHistogramFallback: false,
      }),
    ).toBeNull();

    expect(
      resolveMetricRank({
        metric: 'mean',
        value: null,
        stats: makeStats({
          relativeRanks: [],
          histogram: { bins: [0, 10], counts: [1] },
        }),
        selectedRankContext: null,
      }),
    ).toBeNull();
  });

  it('builds heading and meta text across categorical, continuous, selected-range, and empty-stats states', () => {
    expect(buildHeadingText(false, 'Temp', 'Fallback', false, 'C')).toBeNull();
    expect(buildHeadingText(true, null, 'Fallback', false, 'C')).toBe(
      'Fallback (C)',
    );
    expect(buildHeadingText(true, 'Land Cover', 'Fallback', true, '%')).toBe(
      'Land Cover',
    );

    expect(
      buildMetaText({
        hasStats: false,
        isCategorical: false,
        isCircular: false,
        selectedDensityRange: null,
        rangeObservationCount: 0,
        observationCount: 0,
        summaryCount: 0,
        categoricalTotalSamples: 0,
      }),
    ).toBeNull();

    expect(
      buildMetaText({
        hasStats: true,
        isCategorical: false,
        isCircular: false,
        selectedDensityRange: { start: 1.2, end: 2.8 },
        rangeObservationCount: 3,
        observationCount: 10,
        summaryCount: 10,
        categoricalTotalSamples: null,
      }),
    ).toContain('Selected range: 1.2 to 2.8 (3 of 10 observations)');

    expect(
      buildMetaText({
        hasStats: true,
        isCategorical: false,
        isCircular: false,
        selectedDensityRange: {
          start: -0.5,
          end: 9.5,
          displayStart: 0,
          displayEnd: 9,
        },
        rangeObservationCount: 50,
        observationCount: 100,
        summaryCount: 100,
        categoricalTotalSamples: null,
      }),
    ).toContain('Selected range: 0.0 to 9.0 (50 of 100 observations)');

    expect(
      buildMetaText({
        hasStats: true,
        isCategorical: true,
        isCircular: false,
        selectedDensityRange: null,
        rangeObservationCount: 0,
        observationCount: 7,
        summaryCount: 7,
        categoricalTotalSamples: 9,
      }),
    ).toContain('(Based on 9 observations)');

    expect(
      buildMetaText({
        hasStats: true,
        isCategorical: false,
        isCircular: false,
        selectedDensityRange: null,
        rangeObservationCount: 0,
        observationCount: 12,
        summaryCount: 0,
        categoricalTotalSamples: null,
      }),
    ).toContain('(Based on 12 observations)');
  });

  it('builds summary comparisons and resolves q01-q99 range values', () => {
    const disabled = buildSummaryComparisons(false, null, null, null, null);
    expect(disabled).toEqual({
      min: null,
      mean: null,
      max: null,
      std: null,
      range99: null,
    });

    const enabled = buildSummaryComparisons(
      true,
      { count: 10, min: 1, mean: 2, max: 3, stddev: 4, q01: 1, q99: 10 },
      { count: 8, min: 0.5, mean: 1.5, max: 2.5, stddev: 2, q01: 0, q99: 8 },
      9,
      8,
    );
    expect(enabled.min).toContain('vs.');
    expect(enabled.mean).toContain('vs.');
    expect(enabled.max).toContain('vs.');
    expect(enabled.std).toContain('vs.');
    expect(enabled.range99).toContain('vs.');

    expect(
      resolveRangeValue({ count: 1, min: 0, mean: 0, max: 0, q01: 1, q99: 11 }),
    ).toBe(10);
    expect(
      resolveRangeValue({
        count: 1,
        min: 0,
        mean: 0,
        max: 0,
        q01: null,
        q99: 11,
      }),
    ).toBeNull();
  });
});
