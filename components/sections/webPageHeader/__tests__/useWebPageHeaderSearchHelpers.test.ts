// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  buildEmptyStateContext,
  hasExplicitMinimumSamplesFilter,
  hasValidQueryParams,
  mapTaxaQueryResultToSummary,
} from '@/hooks/search/taxaQuerySearchHelpers';

const createPayload = (overrides: Partial<any> = {}) => ({
  query: null,
  scope: {
    withinTaxon: null,
    withinTaxonId: null,
    descendantRank: null,
    location: null,
    minSamples: 0,
    includeSpeciesLike: true,
  },
  sort: {
    variable: null,
    metric: null,
    order: null,
    units: null,
  },
  total: 10,
  matchedTotal: 10,
  eligibleTotal: 10,
  emptyReason: null,
  limit: 10,
  offset: 0,
  results: [],
  ...overrides,
});

describe('taxaQuerySearchHelpers', () => {
  it('validates ranked query params only when sort fields exist and a scope or query is available', () => {
    expect(hasValidQueryParams()).toBe(false);
    expect(
      hasValidQueryParams(
        { sortVariable: 'bio_1', sortMetric: 'median' },
        true,
      ),
    ).toBe(true);
    expect(
      hasValidQueryParams({
        withinTaxonId: '77',
        descendantRank: 'genus',
        sortVariable: 'bio_1',
        sortMetric: 'median',
      }),
    ).toBe(true);
    expect(
      hasValidQueryParams({
        withinTaxonId: '77',
        sortVariable: 'bio_1',
        sortMetric: 'median',
      }),
    ).toBe(false);
    expect(
      hasValidQueryParams({ withinTaxonId: '77', sortVariable: 'bio_1' }),
    ).toBe(false);
  });

  it('detects whether an explicit minimum sample filter is active', () => {
    expect(hasExplicitMinimumSamplesFilter()).toBe(false);
    expect(hasExplicitMinimumSamplesFilter({ minSamples: 0 })).toBe(false);
    expect(hasExplicitMinimumSamplesFilter({ minSamples: 1 })).toBe(true);
  });

  it.each([
    [
      'ranking_ineligible',
      'wolf',
      'Taxa matched "wolf", but none were eligible for ranking with the selected filters.',
    ],
    ['ranking_ineligible', '', 'No ranked taxa matched the selected filters.'],
    [
      'filtered_out',
      'wolf',
      'No taxa matched "wolf" after applying the selected filters.',
    ],
    ['filtered_out', '', 'No taxa matched the selected filters.'],
    ['no_text_matches', 'wolf', 'No taxa matched "wolf".'],
    ['no_text_matches', '', null],
    ['no_query', 'wolf', null],
    [null, 'wolf', 'No taxa matched "wolf".'],
  ])(
    'builds empty state context for emptyReason=%s and query=%s',
    (emptyReason, query, expected) => {
      expect(
        buildEmptyStateContext(createPayload({ emptyReason }), query),
      ).toBe(expected);
    },
  );

  it('maps ranked taxa query results into summaries with normalized units, image fallback, and percentages', () => {
    const summary = mapTaxaQueryResultToSummary(
      {
        taxon_id: '42',
        scientific_name: 'Canis_lupus',
        common_name: 'Gray_wolf',
        common_names: ['Gray wolf'],
        image_source: null,
        image_url: null,
        image_file: 'images/wolf.png',
        sort_value: 12.5,
        count: 3,
        sample_count: 7,
        position: 2,
        percentile: 0.985,
        _raw: {},
      } as any,
      createPayload({
        total: 48,
        eligibleTotal: 48,
        sort: {
          variable: 'bio_1',
          metric: 'mean',
          order: 'asc',
          units: 'celsius',
        },
      }),
    );

    expect(summary).toEqual({
      taxonId: '42',
      commonName: 'Gray wolf',
      commonNames: ['Gray wolf'],
      scientificName: 'Canis lupus',
      description: '12.5 degC | Rank 2 of 48 | Percentile 2.08% | 7 samples',
      imageSource: {
        uri: 'http://localhost:8000/static/species_images/wolf.png',
      },
    });
  });

  it('maps text results with appended sample counts when an explicit minimum sample filter is active', () => {
    const summary = mapTaxaQueryResultToSummary(
      {
        taxon_id: '7',
        scientific_name: 'Felis_catus',
        common_name: '',
        common_names: [],
        image_source: 'https://example.test/cat.png',
        sample_count: 12,
        _raw: {},
      } as any,
      createPayload(),
      true,
    );

    expect(summary).toEqual({
      taxonId: '7',
      commonName: 'Felis catus',
      commonNames: ['Felis catus'],
      scientificName: 'Felis catus',
      description: '12 samples',
      imageSource: { uri: 'https://example.test/cat.png' },
    });
  });

  it('returns a fallback ranked description and null image when the result lacks optional data', () => {
    const summary = mapTaxaQueryResultToSummary(
      {
        taxon_id: '55',
        scientific_name: '',
        common_name: '',
        common_names: [],
        image_source: null,
        image_url: null,
        image_file: '',
        _raw: {},
      } as any,
      createPayload({
        total: 0,
        sort: {
          variable: 'bio_1',
          metric: 'mean',
          order: 'asc',
          units: 'degf',
        },
      }),
    );

    expect(summary).toEqual({
      taxonId: '55',
      commonName: 'Taxon #55',
      commonNames: ['Taxon #55'],
      scientificName: 'Taxon #55',
      description: 'Tap to view species details',
      imageSource: undefined,
    });
  });

  it('passes through alphanumeric (non-numeric) taxon ids as opaque strings', () => {
    expect(
      mapTaxaQueryResultToSummary(
        {
          taxon_id: 'not-a-number',
          scientific_name: 'Canis lupus',
          common_name: 'Gray wolf',
          common_names: ['Gray wolf'],
          _raw: {},
        } as any,
        createPayload(),
      ),
    ).toEqual(
      expect.objectContaining({
        taxonId: 'not-a-number',
      }),
    );
  });

  it('returns null for results with a missing taxon id', () => {
    expect(
      mapTaxaQueryResultToSummary(
        {
          taxon_id: null,
          scientific_name: 'Canis lupus',
          common_name: 'Gray wolf',
          common_names: ['Gray wolf'],
          _raw: {},
        } as any,
        createPayload(),
      ),
    ).toBeNull();
  });
});
