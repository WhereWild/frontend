import { toRankingFilterHint } from '../useSearchFilters.helpers';

describe('useSearchFilters.helpers', () => {
  it('returns a metric hint when taxon and variable are set but metric is missing', () => {
    expect(toRankingFilterHint(42, 'bio_1', '')).toBe(
      'Choose a Sorting metric to apply ranking-based filters.',
    );
  });
});
