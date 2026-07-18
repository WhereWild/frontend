// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  getSearchHistoryState,
  mergeSearchHistoryState,
  shouldPushSearchHistoryEntry,
  toInitialSearchFilterState,
  toSearchRouteParams,
  type SearchRouteParams,
} from '../searchRouteState';

describe('searchRouteState', () => {
  it('hydrates routed county gids into county and parent state selectors', () => {
    const params: SearchRouteParams = {
      location: 'USA.45.1_1',
    };

    expect(toInitialSearchFilterState(params).location).toEqual({
      countryValue: 'USA',
      stateValue: 'USA.45_1',
      countyValue: 'USA.45.1_1',
    });
  });

  it('hydrates routed state gids into the state selector', () => {
    const params: SearchRouteParams = {
      location: 'USA.45_1',
    };

    expect(toInitialSearchFilterState(params).location).toEqual({
      countryValue: 'USA',
      stateValue: 'USA.45_1',
    });
  });

  it('treats local upload county gids as opaque location selections until canonical hydration runs', () => {
    const params: SearchRouteParams = {
      location: 'county-us-ca-sf',
    };

    expect(toInitialSearchFilterState(params).location).toEqual({
      countyValue: 'county-us-ca-sf',
    });
  });

  it('hydrates local upload state gids into the state selector', () => {
    const params: SearchRouteParams = {
      location: 'state-us-ca',
    };

    expect(toInitialSearchFilterState(params).location).toEqual({
      stateValue: 'state-us-ca',
    });
  });

  it('hydrates routed country gids into the country selector', () => {
    const params: SearchRouteParams = {
      location: 'USA',
    };

    expect(toInitialSearchFilterState(params).location).toEqual({
      countryValue: 'USA',
    });
  });

  it('normalizes routed includeSpeciesLike=false on non-species ranks back to species-only semantics', () => {
    const params: SearchRouteParams = {
      withinTaxonId: '77',
      descendantRank: 'genus',
      includeSpeciesLike: 'false',
    };

    expect(toInitialSearchFilterState(params).ranking).toEqual({
      rankValue: 'genus',
      includeSubspecies: true,
      sortVariableValue: '',
      sortMetricValue: '',
      sortOrder: 'ascending',
      predicates: [],
    });
  });

  it('preserves species includeSpeciesLike=false routes by serializing species explicitly', () => {
    expect(
      toSearchRouteParams('wolf', {
        withinTaxonId: 77,
        descendantRank: 'species',
        includeSpeciesLike: false,
        sortVariable: null,
        sortMetric: null,
        sortOrder: null,
        limit: 10,
        minSamples: null,
        location: null,
      }),
    ).toEqual({
      query: 'wolf',
      withinTaxonId: '77',
      descendantRank: 'species',
      includeSpeciesLike: 'false',
    });
  });

  it('serializes species rank routes even when includeSpeciesLike remains enabled', () => {
    expect(
      toSearchRouteParams('wolf', {
        withinTaxonId: 77,
        descendantRank: 'species',
        includeSpeciesLike: true,
        sortVariable: null,
        sortMetric: null,
        sortOrder: null,
        limit: 10,
        minSamples: null,
        location: null,
      }),
    ).toEqual({
      query: 'wolf',
      withinTaxonId: '77',
      descendantRank: 'species',
    });
  });

  it('keeps species rank in the route when ranking sort params are present', () => {
    expect(
      toSearchRouteParams('mistletoe', {
        withinTaxonId: 2519,
        descendantRank: 'species',
        includeSpeciesLike: true,
        sortVariable: 'bio_1',
        sortMetric: 'median',
        sortOrder: 'asc',
        limit: 10,
        minSamples: null,
        location: 'ETH',
      }),
    ).toEqual({
      query: 'mistletoe',
      location: 'ETH',
      withinTaxonId: '2519',
      descendantRank: 'species',
      sortVariable: 'bio_1',
      sortMetric: 'median',
    });
  });

  it('drops unscoped ranking params when serializing the route', () => {
    expect(
      toSearchRouteParams('cat', {
        withinTaxonId: null,
        descendantRank: 'species',
        includeSpeciesLike: true,
        sortVariable: 'bio_1',
        sortMetric: 'median',
        sortOrder: 'desc',
        limit: 10,
        minSamples: null,
        location: null,
      }),
    ).toEqual({
      query: 'cat',
    });
  });

  it('infers a species rank when legacy routes only specify includeSpeciesLike=false', () => {
    const params: SearchRouteParams = {
      withinTaxonId: '77',
      includeSpeciesLike: 'false',
    };

    expect(toInitialSearchFilterState(params).ranking).toEqual({
      rankValue: 'species',
      includeSubspecies: false,
      sortVariableValue: '',
      sortMetricValue: '',
      sortOrder: 'ascending',
      predicates: [],
    });
  });

  it('pushes browser history when query presence toggles', () => {
    expect(shouldPushSearchHistoryEntry({}, { query: 'oak' })).toBe(true);
    expect(
      shouldPushSearchHistoryEntry(
        { query: 'oak', withinTaxonId: '77' },
        { withinTaxonId: '77' },
      ),
    ).toBe(true);
  });

  it('pushes browser history when non-query filter params change', () => {
    expect(
      shouldPushSearchHistoryEntry(
        { query: 'oak' },
        {
          query: 'oak',
          withinTaxonId: '77',
          sortVariable: 'bio_1',
          sortMetric: 'median',
        },
      ),
    ).toBe(true);
  });

  it('replaces the current history entry when refining an existing non-empty query', () => {
    expect(
      shouldPushSearchHistoryEntry(
        { query: 'ow', withinTaxonId: '77' },
        { query: 'owl', withinTaxonId: '77' },
      ),
    ).toBe(false);
  });

  it('stores the managed search route url in browser history state', () => {
    expect(
      getSearchHistoryState(
        mergeSearchHistoryState(null, {
          filterVisible: true,
        }),
      ),
    ).toEqual({
      filterVisible: true,
    });
  });
});
