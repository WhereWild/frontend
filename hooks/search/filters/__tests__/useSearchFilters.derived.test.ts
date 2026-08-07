// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  createEmptyFilterPredicate,
  createInitialSearchFiltersState,
  type SearchFiltersState,
} from '../useSearchFilters.state';
import {
  getHasActiveSearchFilters,
  parseFilterPredicateString,
  serializeFilterPredicate,
  toFilterPredicatesFromRouteValue,
  toSearchFilterParams,
  toSearchFilterStrings,
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
        ancestorTaxonId: '2519',
        rankValue: '',
      }),
    );

    expect(filterParams.withinTaxonId).toBe('2519');
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
        ancestorTaxonId: '2519',
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
        ancestorTaxonId: '2519',
        rankValue: 'species',
        sortVariableValue: 'bio_1',
        sortMetricValue: 'median',
        sortOrder: 'descending',
      }),
    );

    expect(hasActiveFilters).toBe(true);
  });
});

describe('filter predicate serialization', () => {
  it('serializes a stat-mode predicate', () => {
    const predicate = {
      ...createEmptyFilterPredicate(),
      variable: 'bio1',
      mode: 'stat' as const,
      metric: 'mean',
      op: 'lt' as const,
      value: 20,
    };

    expect(serializeFilterPredicate(predicate)).toBe('bio1:mean:lt:20');
  });

  it('serializes a category-mode percentage predicate as a 0-1 fraction', () => {
    const predicate = {
      ...createEmptyFilterPredicate(),
      variable: 'ecoregions',
      mode: 'category' as const,
      categoryId: '356',
      asCount: false,
      op: 'gte' as const,
      value: 50,
    };

    expect(serializeFilterPredicate(predicate)).toBe(
      'ecoregions:class_356:gte:0.5',
    );
  });

  it('serializes a category-mode observation-count predicate with the :count suffix', () => {
    const predicate = {
      ...createEmptyFilterPredicate(),
      variable: 'ecoregions',
      mode: 'category' as const,
      categoryId: '356',
      asCount: true,
      op: 'gte' as const,
      value: 10,
    };

    expect(serializeFilterPredicate(predicate)).toBe(
      'ecoregions:class_356:gte:10:count',
    );
  });

  it('drops incomplete predicates (no value, no metric, no category) instead of serializing them', () => {
    expect(
      serializeFilterPredicate({ ...createEmptyFilterPredicate(), variable: 'bio1' }),
    ).toBeNull();
    expect(
      serializeFilterPredicate({
        ...createEmptyFilterPredicate(),
        variable: 'bio1',
        value: 5,
      }),
    ).toBeNull();
    expect(
      serializeFilterPredicate({
        ...createEmptyFilterPredicate(),
        variable: 'ecoregions',
        mode: 'category',
        value: 5,
      }),
    ).toBeNull();
  });

  it('round-trips a stat-mode filter string through parse and back to the same string', () => {
    const raw = 'bio12:mean:gte:2';
    const predicate = parseFilterPredicateString(raw);
    expect(predicate).not.toBeNull();
    expect(serializeFilterPredicate(predicate!)).toBe(raw);
  });

  it('round-trips a category-mode observation-count filter string', () => {
    const raw = 'ecoregions:class_356:gte:10:count';
    const predicate = parseFilterPredicateString(raw);
    expect(predicate).toMatchObject({
      variable: 'ecoregions',
      mode: 'category',
      categoryId: '356',
      asCount: true,
      op: 'gte',
      value: 10,
    });
    expect(serializeFilterPredicate(predicate!)).toBe(raw);
  });

  it('round-trips a category-mode percentage filter string', () => {
    const raw = 'ecoregions:class_356:lt:0.5';
    const predicate = parseFilterPredicateString(raw);
    expect(predicate).toMatchObject({
      variable: 'ecoregions',
      mode: 'category',
      categoryId: '356',
      asCount: false,
      op: 'lt',
      value: 50,
    });
    expect(serializeFilterPredicate(predicate!)).toBe(raw);
  });

  it('rejects a malformed filter string (bad operator)', () => {
    expect(parseFilterPredicateString('bio1:mean:xyz:10')).toBeNull();
  });

  it('rejects a malformed filter string (non-numeric value)', () => {
    expect(parseFilterPredicateString('bio1:mean:lt:abc')).toBeNull();
  });

  it('parses a comma-joined route value into multiple predicates', () => {
    const predicates = toFilterPredicatesFromRouteValue(
      'bio1:mean:lt:20,ecoregions:class_356:gte:10:count',
    );

    expect(predicates).toHaveLength(2);
    expect(predicates[0]).toMatchObject({ variable: 'bio1', metric: 'mean' });
    expect(predicates[1]).toMatchObject({
      variable: 'ecoregions',
      categoryId: '356',
    });
  });

  it('returns an empty array for an undefined route value', () => {
    expect(toFilterPredicatesFromRouteValue(undefined)).toEqual([]);
  });

  it('serializes predicates into filterParams.filters, in order', () => {
    const predicateA = {
      ...createEmptyFilterPredicate(),
      variable: 'bio1',
      mode: 'stat' as const,
      metric: 'mean',
      op: 'lt' as const,
      value: 20,
    };
    const predicateB = {
      ...createEmptyFilterPredicate(),
      variable: 'bio1',
      mode: 'stat' as const,
      metric: 'std',
      op: 'gte' as const,
      value: 2,
    };

    expect(toSearchFilterStrings([predicateA, predicateB])).toEqual([
      'bio1:mean:lt:20',
      'bio1:std:gte:2',
    ]);

    const filterParams = toSearchFilterParams(
      createState({ predicates: [predicateA, predicateB] }),
    );
    expect(filterParams.filters).toEqual(['bio1:mean:lt:20', 'bio1:std:gte:2']);
  });
});
