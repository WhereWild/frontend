import {
  createInitialSearchFiltersState,
  type SearchFiltersState,
} from '../useSearchFilters.state';
import {
  getHasActiveSearchFilters,
  toSearchFilterParams,
} from '../useSearchFilters.derived';

const createState = (
  overrides: Partial<SearchFiltersState> = {},
): SearchFiltersState => ({
  ...createInitialSearchFiltersState(),
  ...overrides,
});

describe('useSearchFilters.derived', () => {
  it('emits ancestor taxon scope through withinTaxonId', () => {
    const filterParams = toSearchFilterParams(
      createState({
        ancestorTaxonId: 2519,
        rankValue: '',
      }),
    );

    expect(filterParams.withinTaxonId).toBe(2519);
    expect('withinTaxon' in filterParams).toBe(false);
  });

  it('drops incomplete sort selections from filter params', () => {
    const filterParams = toSearchFilterParams(
      createState({
        sortVariableValue: 'bio_1',
        sortMetricValue: '',
      }),
    );

    expect(filterParams.sortVariable).toBeNull();
    expect(filterParams.sortMetric).toBeNull();
    expect(filterParams.sortOrder).toBeNull();
  });

  it('drops complete sort selections when no scope taxon is selected', () => {
    const filterParams = toSearchFilterParams(
      createState({
        sortVariableValue: 'bio_1',
        sortMetricValue: 'median',
      }),
    );

    expect(filterParams.descendantRank).toBeNull();
    expect(filterParams.sortVariable).toBeNull();
    expect(filterParams.sortMetric).toBeNull();
    expect(filterParams.sortOrder).toBeNull();
  });

  it('preserves complete sort selections in filter params when scoped ranking is complete', () => {
    const filterParams = toSearchFilterParams(
      createState({
        ancestorTaxonId: 2519,
        rankValue: 'species',
        sortVariableValue: 'bio_1',
        sortMetricValue: 'median',
      }),
    );

    expect(filterParams.sortVariable).toBe('bio_1');
    expect(filterParams.sortMetric).toBe('median');
    expect(filterParams.sortOrder).toBe('asc');
  });

  it('does not treat unscoped sort-order changes as active filters', () => {
    const hasActiveFilters = getHasActiveSearchFilters(
      createState({
        sortOrder: 'descending',
      }),
    );

    expect(hasActiveFilters).toBe(false);
  });

  it('treats scoped descending sort order as an active filter', () => {
    const hasActiveFilters = getHasActiveSearchFilters(
      createState({
        ancestorTaxonId: 2519,
        rankValue: 'species',
        sortVariableValue: 'bio_1',
        sortMetricValue: 'median',
        sortOrder: 'descending',
      }),
    );

    expect(hasActiveFilters).toBe(true);
  });
});
