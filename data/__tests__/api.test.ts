// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  BACKEND_BASE,
  fetchRelativeRankingOptions,
  fetchTaxaQuery,
  fetchPointEnvironmentValue,
  fetchSpeciesByTaxonId,
  fetchSpeciesObscured,
  fetchSpeciesLocations,
  fetchSpeciesWithModels,
  fetchViewportScores,
} from '../api';

const fetchTextTaxaQueryResults = async (q: string, limit = 5) => {
  const response = await fetchTaxaQuery({ q, limit, offset: 0 });
  return response.results;
};

describe('data/api common name normalization', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('normalizes common_names arrays in taxa query responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        limit: 5,
        offset: 0,
        results: [
          {
            taxon_id: 1,
            scientific_name: 'Canis lupus',
            common_names: ['Wolf', 'Gray Wolf'],
          },
        ],
      }),
    });

    const rows = await fetchTextTaxaQueryResults('wolf');

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/query?limit=5&offset=0&q=wolf`,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        taxon_id: 1,
        scientific_name: 'Canis lupus',
        common_name: 'Wolf',
        common_names: ['Wolf', 'Gray Wolf'],
      }),
    ]);
  });

  it('normalizes numeric-string taxon_id values to numbers', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        limit: 5,
        offset: 0,
        results: [
          {
            taxon_id: '7',
            scientific_name: 'Lynx rufus',
            common_names: ['Bobcat'],
          },
        ],
      }),
    });

    const rows = await fetchTextTaxaQueryResults('lynx');

    expect(rows).toEqual([
      expect.objectContaining({
        taxon_id: 7,
      }),
    ]);
  });

  it('falls back to null taxon_id when non-numeric string is returned', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        limit: 5,
        offset: 0,
        results: [
          {
            taxon_id: 'not-a-number',
            scientific_name: 'Unknown species',
            common_names: ['Unknown'],
          },
        ],
      }),
    });

    const rows = await fetchTextTaxaQueryResults('unknown');

    expect(rows).toEqual([
      expect.objectContaining({
        taxon_id: null,
      }),
    ]);
  });

  it('uses first common_names value when species detail omits common_name', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        taxon_id: 2,
        scientific_name: 'Puma concolor',
        common_names: ['Cougar', 'Mountain Lion'],
      }),
    });

    const row = await fetchSpeciesByTaxonId(2);

    expect(global.fetch).toHaveBeenCalledWith(`${BACKEND_BASE}/api/species/2`);
    expect(row).toEqual(
      expect.objectContaining({
        taxon_id: 2,
        scientific_name: 'Puma concolor',
        common_name: 'Cougar',
        common_names: ['Cougar', 'Mountain Lion'],
      }),
    );
  });

  it('includes unit_system when fetching species detail with units option', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        taxon_id: 2,
        scientific_name: 'Puma concolor',
        common_names: ['Cougar'],
      }),
    });

    await fetchSpeciesByTaxonId(2, { units: 'imperial' });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/species/2?unit_system=imperial`,
    );
  });

  it('fetches species obscured status and preserves explicit true responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        taxon_id: 2,
        all_obscured: true,
      }),
    });

    const response = await fetchSpeciesObscured(2);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/species/2/obscured`,
    );
    expect(response).toEqual({ taxon_id: 2, all_obscured: true });
  });

  it('falls back to the requested taxon id and false obscured status when payload fields are missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const response = await fetchSpeciesObscured('27');

    expect(response).toEqual({ taxon_id: 27, all_obscured: false });
  });

  it('parses categorical point lookup responses from class_value fields', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        variable: 'landcover',
        units: null,
        lat: 40.2,
        lon: -105.1,
        class_value: 90,
        class_name: 'Urban',
        description: 'Developed land',
      }),
    });

    const result = await fetchPointEnvironmentValue(40.2, -105.1, 'landcover');

    expect(result).toEqual({
      variable: 'landcover',
      units: null,
      lat: 40.2,
      lon: -105.1,
      value: 90,
      valueLabel: 'Urban',
      valueDescription: 'Developed land',
    });
  });

  it('falls back to class_name when categorical point lookup omits class value', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        variable: 'landcover',
        units: null,
        lat: 40.2,
        lon: -105.1,
        class_name: 'Urban',
        description: 'Developed land',
      }),
    });

    const result = await fetchPointEnvironmentValue(40.2, -105.1, 'landcover');

    expect(result).toEqual({
      variable: 'landcover',
      units: null,
      lat: 40.2,
      lon: -105.1,
      value: 'Urban',
      valueLabel: 'Urban',
      valueDescription: 'Developed land',
    });
  });

  it('normalizes camelCase commonNames when snake_case common_names is absent', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        limit: 5,
        offset: 0,
        results: [
          {
            taxon_id: 4,
            scientific_name: 'Aquila chrysaetos',
            commonNames: ['Golden Eagle', 'Eagle'],
          },
        ],
      }),
    });

    const rows = await fetchTextTaxaQueryResults('eagle');

    expect(rows).toEqual([
      expect.objectContaining({
        taxon_id: 4,
        scientific_name: 'Aquila chrysaetos',
        common_name: 'Golden Eagle',
        common_names: ['Golden Eagle', 'Eagle'],
      }),
    ]);
  });

  it('trims whitespace from common_name values', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        limit: 5,
        offset: 0,
        results: [
          {
            taxon_id: 8,
            scientific_name: 'Canis lupus',
            common_name: '  Gray Wolf  ',
            common_names: ['Gray Wolf', 'Wolf'],
          },
        ],
      }),
    });

    const rows = await fetchTextTaxaQueryResults('wolf');

    expect(rows).toEqual([
      expect.objectContaining({
        taxon_id: 8,
        common_name: 'Gray Wolf',
        common_names: ['Gray Wolf', 'Wolf'],
      }),
    ]);
  });

  it('falls back to scientific_name when common_name and common_names are unavailable', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        limit: 5,
        offset: 0,
        results: [
          {
            taxon_id: 3,
            scientific_name: 'Taxus fallbackus',
            common_names: [null, '   '],
          },
        ],
      }),
    });

    const rows = await fetchTextTaxaQueryResults('taxus');

    expect(rows).toEqual([
      expect.objectContaining({
        common_name: 'Taxus fallbackus',
        common_names: [],
      }),
    ]);
  });

  it('sanitizes image_file paths down to basename and encodes URL segment', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        limit: 5,
        offset: 0,
        results: [
          {
            taxon_id: 5,
            scientific_name: 'Strix varia',
            common_name: 'Barred Owl',
            image_file: '../images/owl photo#1.png',
          },
        ],
      }),
    });

    const rows = await fetchTextTaxaQueryResults('owl');

    expect(rows).toEqual([
      expect.objectContaining({
        image_source: `${BACKEND_BASE}/static/species_images/owl%20photo%231.png`,
      }),
    ]);
  });

  it('preserves direct image_source URLs from taxa query responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        limit: 5,
        offset: 0,
        results: [
          {
            taxon_id: 8,
            scientific_name: 'Pica hudsonia',
            common_name: 'Black-billed Magpie',
            image_source: 'https://cdn.example.com/magpie.png',
          },
        ],
      }),
    });

    const rows = await fetchTextTaxaQueryResults('magpie');

    expect(rows).toEqual([
      expect.objectContaining({
        image_source: 'https://cdn.example.com/magpie.png',
      }),
    ]);
  });

  it('handles Windows-style image_file separators safely', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        taxon_id: 6,
        scientific_name: 'Vulpes vulpes',
        common_name: 'Red Fox',
        image_file_name: 'images\\nested\\fox image.png',
      }),
    });

    const row = await fetchSpeciesByTaxonId(6);

    expect(row).toEqual(
      expect.objectContaining({
        image_source: `${BACKEND_BASE}/static/species_images/fox%20image.png`,
      }),
    );
  });

  it('calls the unified taxa query endpoint with ranking params and normalizes result metadata', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'wolf',
        scope: {
          within_taxon: '5',
          descendant_rank: 'SPECIES',
          location: 'USA.45_1',
          min_samples: 12,
          include_species_like: true,
        },
        sort: {
          variable: 'bio_1',
          metric: 'mean',
          order: 'desc',
          units: 'degC',
        },
        total: 42,
        matched_total: 80,
        eligible_total: 42,
        empty_reason: null,
        limit: 10,
        offset: 0,
        results: [
          {
            taxon_id: 9,
            scientific_name: 'Canis_lupus',
            common_name: 'Gray Wolf',
            common_names: ['Gray Wolf', 'Wolf'],
            rank: 'species',
            slug: 'canis-lupus',
            description: 'Large canine',
            image_url: 'https://example.com/wolf.png',
            match_score: 0.91,
            sort_value: 12.5,
            sort_variable: 'bio_1',
            sort_metric: 'mean',
            sample_count: 19,
            position: 2,
            percentile: 98,
          },
        ],
      }),
    });

    const response = await fetchTaxaQuery({
      q: 'wolf',
      withinTaxonId: 5,
      descendantRank: 'species',
      sortVariable: 'bio_1',
      sortMetric: 'mean',
      sortOrder: 'desc',
      limit: 10,
      offset: 0,
      minSamples: 12,
      includeSpeciesLike: true,
      location: 'USA.45_1',
      units: 'metric',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/query?limit=10&offset=0&q=wolf&within_taxon=5&descendant_rank=SPECIES&sort_variable=bio_1&sort_metric=mean&sort_order=desc&min_samples=12&include_species_like=true&location=USA.45_1&unit_system=metric`,
    );
    expect(response).toEqual(
      expect.objectContaining({
        total: 42,
        matchedTotal: 80,
        eligibleTotal: 42,
        emptyReason: null,
        scope: expect.objectContaining({
          withinTaxon: '5',
          withinTaxonId: 5,
        }),
        sort: expect.objectContaining({
          variable: 'bio_1',
          metric: 'mean',
          order: 'desc',
          units: 'degC',
        }),
        results: [
          expect.objectContaining({
            taxon_id: 9,
            common_name: 'Gray Wolf',
            common_names: ['Gray Wolf', 'Wolf'],
            match_score: 0.91,
            image_url: 'https://example.com/wolf.png',
            sort_value: 12.5,
            sample_count: 19,
            position: 2,
            percentile: 98,
          }),
        ],
      }),
    );
  });

  it('omits partial sort params when the metric is missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'wolf',
        scope: {
          within_taxon: null,
          descendant_rank: null,
          location: null,
          min_samples: 0,
          include_species_like: false,
        },
        sort: {
          variable: null,
          metric: null,
          order: 'asc',
          units: null,
        },
        total: 0,
        matched_total: 0,
        eligible_total: 0,
        empty_reason: 'no_text_matches',
        limit: 10,
        offset: 0,
        results: [],
      }),
    });

    await fetchTaxaQuery({
      q: 'wolf',
      sortVariable: 'bio_1',
      sortMetric: '',
      limit: 10,
      offset: 0,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/query?limit=10&offset=0&q=wolf`,
    );
  });

  it('prefers withinTaxonId over withinTaxon when both are provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'oak',
        scope: {
          within_taxon: '2519',
          descendant_rank: 'SPECIES',
          location: null,
          min_samples: 0,
          include_species_like: false,
        },
        sort: {
          variable: null,
          metric: null,
          order: 'asc',
          units: null,
        },
        total: 0,
        matched_total: 0,
        eligible_total: 0,
        empty_reason: 'no_text_matches',
        limit: 10,
        offset: 0,
        results: [],
      }),
    });

    await fetchTaxaQuery({
      q: 'oak',
      withinTaxon: 'quercus',
      withinTaxonId: 2519,
      descendantRank: 'species',
      limit: 10,
      offset: 0,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/query?limit=10&offset=0&q=oak&within_taxon=2519&descendant_rank=SPECIES`,
    );
  });

  it('prefers explicit within_taxon_id over display within_taxon in normalized scope', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'bird',
        scope: {
          within_taxon: 'Aves',
          within_taxon_id: 212,
          descendant_rank: 'SPECIES',
          location: null,
          min_samples: 0,
          include_species_like: false,
        },
        sort: {
          variable: null,
          metric: null,
          order: 'asc',
          units: null,
        },
        total: 0,
        matched_total: 0,
        eligible_total: 0,
        empty_reason: 'no_text_matches',
        limit: 10,
        offset: 0,
        results: [],
      }),
    });

    const response = await fetchTaxaQuery({
      q: 'bird',
      limit: 10,
      offset: 0,
    });

    expect(response.scope).toEqual(
      expect.objectContaining({
        withinTaxon: 'Aves',
        withinTaxonId: 212,
      }),
    );
  });

  it('fetches scoped ranking options from the canonical taxa endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        ancestor_taxon_id: 77,
        rank: 'SPECIES',
        options: [
          {
            variable: 'bio_1',
            metric: 'median',
            label: 'Median',
            column: 'bio_1__median',
            count: 14,
          },
        ],
      }),
    });

    await expect(
      fetchRelativeRankingOptions({ taxonId: 77, rank: 'species' }),
    ).resolves.toEqual({
      ancestorTaxonId: 77,
      rank: 'SPECIES',
      options: [
        {
          variable: 'bio_1',
          metric: 'median',
          label: 'Median',
          column: 'bio_1__median',
          count: 14,
        },
      ],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/ranking-options?within_taxon=77&descendant_rank=SPECIES`,
    );
  });

  it('passes slug scopes and AbortSignal through ranking option requests', async () => {
    const controller = new AbortController();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        ancestor_taxon_id: 2519,
        rank: 'SPECIES',
        options: [
          {
            variable: 'bio_12',
            metric: 'max',
            label: 'Maximum',
            column: 'bio_12__max',
            count: 9,
          },
        ],
      }),
    });

    await expect(
      fetchRelativeRankingOptions(
        { taxonId: 'quercus', rank: 'species' },
        { signal: controller.signal },
      ),
    ).resolves.toEqual({
      ancestorTaxonId: 2519,
      rank: 'SPECIES',
      options: [
        {
          variable: 'bio_12',
          metric: 'max',
          label: 'Maximum',
          column: 'bio_12__max',
          count: 9,
        },
      ],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/ranking-options?within_taxon=quercus&descendant_rank=SPECIES`,
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('throws a descriptive error when ranking option lookup fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'backend unavailable',
    });

    await expect(
      fetchRelativeRankingOptions({ taxonId: 77, rank: 'SPECIES' }),
    ).rejects.toThrow(
      'Failed to fetch ranking options: 503 backend unavailable',
    );
  });

  it('throws when slug-scoped ranking options omit the resolved ancestor id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        rank: 'SPECIES',
        options: [],
      }),
    });

    await expect(
      fetchRelativeRankingOptions({ taxonId: 'quercus', rank: 'SPECIES' }),
    ).rejects.toThrow(
      'Failed to fetch ranking options: missing ancestor_taxon_id in response',
    );
  });

  it('calls the unified taxa query endpoint for text search with location', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'wolf',
        scope: {
          within_taxon: null,
          descendant_rank: null,
          location: 'ETH',
          min_samples: 0,
          include_species_like: false,
        },
        sort: {
          variable: null,
          metric: null,
          order: 'asc',
          units: null,
        },
        total: 1,
        matched_total: 1,
        eligible_total: 1,
        empty_reason: null,
        limit: 5,
        offset: 0,
        results: [
          {
            taxon_id: 11,
            scientific_name: 'Canis lupus',
            common_name: 'Gray Wolf',
            common_names: ['Gray Wolf', 'Wolf'],
            location: 'ETH',
          },
        ],
      }),
    });

    const response = await fetchTaxaQuery({
      q: 'wolf',
      location: 'ETH',
      limit: 5,
      offset: 0,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/query?limit=5&offset=0&q=wolf&location=ETH`,
    );
    expect(response.results).toEqual([
      expect.objectContaining({
        taxon_id: 11,
        common_name: 'Gray Wolf',
      }),
    ]);
    expect(response.scope.location).toBe('ETH');
  });

  it('does not include sort_order for plain text searches without ranking params', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'wolf',
        scope: {
          within_taxon: null,
          descendant_rank: null,
          location: null,
          min_samples: 0,
          include_species_like: false,
        },
        sort: {
          variable: null,
          metric: null,
          order: 'asc',
          units: null,
        },
        total: 1,
        matched_total: 1,
        eligible_total: 1,
        empty_reason: null,
        limit: 5,
        offset: 0,
        results: [],
      }),
    });

    await fetchTaxaQuery({
      q: 'wolf',
      sortOrder: 'asc',
      limit: 5,
      offset: 0,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/query?limit=5&offset=0&q=wolf`,
    );
  });

  it('calls the unified taxa query endpoint for text search with min_samples', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'wolf',
        scope: {
          within_taxon: null,
          descendant_rank: null,
          location: null,
          min_samples: 3,
          include_species_like: false,
        },
        sort: {
          variable: null,
          metric: null,
          order: 'asc',
          units: null,
        },
        total: 1,
        matched_total: 1,
        eligible_total: 1,
        empty_reason: null,
        limit: 5,
        offset: 0,
        results: [
          {
            taxon_id: 12,
            scientific_name: 'Canis lupus',
            common_name: 'Gray Wolf',
            common_names: ['Gray Wolf', 'Wolf'],
            sample_count: 7,
          },
        ],
      }),
    });

    const response = await fetchTaxaQuery({
      q: 'wolf',
      minSamples: 3,
      limit: 5,
      offset: 0,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/query?limit=5&offset=0&q=wolf&min_samples=3`,
    );
    expect(response.results).toEqual([
      expect.objectContaining({
        taxon_id: 12,
        sample_count: 7,
      }),
    ]);
    expect(response.scope.minSamples).toBe(3);
  });

  it('preserves include_species_like=false in unified taxa query requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'wolf',
        scope: {
          within_taxon: null,
          descendant_rank: null,
          location: null,
          min_samples: 0,
          include_species_like: false,
        },
        sort: {
          variable: null,
          metric: null,
          order: 'asc',
          units: null,
        },
        total: 0,
        matched_total: 0,
        eligible_total: 0,
        empty_reason: 'no_query',
        limit: 5,
        offset: 0,
        results: [],
      }),
    });

    await fetchTaxaQuery({
      q: 'wolf',
      includeSpeciesLike: false,
      limit: 5,
      offset: 0,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/query?limit=5&offset=0&q=wolf&include_species_like=false`,
    );
  });

  it('parses stringified include_species_like=false in unified taxa query responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'wolf',
        scope: {
          within_taxon: null,
          descendant_rank: null,
          location: null,
          min_samples: 0,
          include_species_like: 'false',
        },
        sort: {
          variable: null,
          metric: null,
          order: 'asc',
          units: null,
        },
        total: 0,
        matched_total: 0,
        eligible_total: 0,
        empty_reason: 'no_query',
        limit: 5,
        offset: 0,
        results: [],
      }),
    });

    const response = await fetchTaxaQuery({ q: 'wolf', limit: 5, offset: 0 });

    expect(response.scope.includeSpeciesLike).toBe(false);
  });

  it('returns null when include_species_like is omitted in unified taxa query responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'wolf',
        scope: {
          within_taxon: null,
          descendant_rank: null,
          location: null,
          min_samples: 0,
        },
        sort: {
          variable: null,
          metric: null,
          order: 'asc',
          units: null,
        },
        total: 0,
        matched_total: 0,
        eligible_total: 0,
        empty_reason: 'no_query',
        limit: 5,
        offset: 0,
        results: [],
      }),
    });

    const response = await fetchTaxaQuery({ q: 'wolf', limit: 5, offset: 0 });

    expect(response.scope.includeSpeciesLike).toBeNull();
  });

  it('normalizes empty-state metadata from unified taxa query responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'spinystar',
        scope: {
          within_taxon: 'quercus',
          descendant_rank: 'SPECIES',
          location: null,
          min_samples: 1,
          include_species_like: true,
        },
        sort: {
          variable: 'bio_1',
          metric: 'mean',
          order: 'asc',
          units: 'degC',
        },
        total: 0,
        matched_total: 7,
        eligible_total: 0,
        empty_reason: 'ranking_ineligible',
        limit: 10,
        offset: 0,
        results: [],
      }),
    });

    const response = await fetchTaxaQuery({
      q: 'spinystar',
      withinTaxon: 'quercus',
      descendantRank: 'species',
      sortVariable: 'bio_1',
      sortMetric: 'mean',
      limit: 10,
      offset: 0,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/query?limit=10&offset=0&q=spinystar&within_taxon=quercus&descendant_rank=SPECIES&sort_variable=bio_1&sort_metric=mean`,
    );
    expect(response).toEqual(
      expect.objectContaining({
        matchedTotal: 7,
        eligibleTotal: 0,
        emptyReason: 'ranking_ineligible',
        scope: expect.objectContaining({
          withinTaxon: 'quercus',
          withinTaxonId: null,
        }),
      }),
    );
  });

  it('passes AbortSignal through the unified taxa query fetch helper', async () => {
    const controller = new AbortController();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'cactus',
        scope: {
          within_taxon: null,
          descendant_rank: null,
          location: null,
          min_samples: 0,
          include_species_like: false,
        },
        sort: {
          variable: null,
          metric: null,
          order: 'asc',
          units: null,
        },
        total: 0,
        matched_total: 0,
        eligible_total: 0,
        empty_reason: 'no_text_matches',
        limit: 5,
        offset: 0,
        results: [],
      }),
    });

    await fetchTaxaQuery(
      {
        q: 'cactus',
        limit: 5,
        offset: 0,
      },
      { signal: controller.signal },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/taxa/query?limit=5&offset=0&q=cactus`,
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('parses structured overview sections from description_profile payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        taxon_id: 10,
        scientific_name: 'Lynx canadensis',
        common_name: 'Canada Lynx',
        description: 'Summary: Medium-sized wild cat.',
        description_profile: {
          sections: [
            {
              id: 'habitat',
              title: 'Habitat',
              lines: [
                {
                  prefix: 'Often in:',
                  body: 'boreal forests',
                },
              ],
            },
          ],
        },
      }),
    });

    const row = await fetchSpeciesByTaxonId(10);

    expect(row.description_sections).toEqual([
      {
        id: 'habitat',
        title: 'Habitat',
        lines: [
          {
            prefix: 'Often in:',
            body: 'boreal forests',
          },
        ],
      },
    ]);
  });

  it('fetches viewport scores and falls back to empty score maps when fields are missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ scores: { '10': 0.75 } }),
    });

    const result = await fetchViewportScores({
      z: 8,
      x0: 40,
      y0: 90,
      x1: 42,
      y1: 92,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/heatmap/homepage/scores?z=8&x0=40&y0=90&x1=42&y1=92`,
    );
    expect(result).toEqual({
      scores: { '10': 0.75 },
      reasons: {},
    });
  });

  it('normalizes species-with-models payloads for homepage hydration', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          taxon_id: '11',
          scientific_name: 'Pinus edulis',
          common_names: ['Colorado Pinyon'],
          taxon_group: 'plants',
          image_file: 'nested/pinyon.png',
        },
      ],
    });

    const rows = await fetchSpeciesWithModels();

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/api/species/with-models`,
    );
    expect(rows).toEqual([
      expect.objectContaining({
        taxon_id: 11,
        common_name: 'Colorado Pinyon',
        common_names: ['Colorado Pinyon'],
        taxon_group: 'plants',
        image_source: `${BACKEND_BASE}/static/species_images/pinyon.png`,
      }),
    ]);
  });

  it('normalizes species locations from array payloads and drops malformed rows', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          gid: 'country-us',
          name: 'United States',
          level: 0,
          hierarchy: ['North America'],
        },
        { gid: '', name: 'Missing gid', level: 0, hierarchy: [] },
      ],
    });

    const rows = await fetchSpeciesLocations(42, 'country', undefined, 500);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/species/42/locations?level=0&limit=500`,
    );
    expect(rows).toEqual([
      {
        gid: 'country-us',
        name: 'United States',
        level: 0,
        hierarchy: ['North America'],
      },
    ]);
  });

  it('normalizes species locations from object payloads with results arrays', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            gid: 'state-ut',
            name: 'Utah',
            level: 1,
            hierarchy: ['North America', 'United States'],
          },
        ],
      }),
    });

    const rows = await fetchSpeciesLocations(42, 'state', 'United States', 25);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND_BASE}/species/42/locations?level=1&parent=United+States&limit=25`,
    );
    expect(rows).toEqual([
      {
        gid: 'state-ut',
        name: 'Utah',
        level: 1,
        hierarchy: ['North America', 'United States'],
      },
    ]);
  });

  it('throws a descriptive error when species location request fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'backend unavailable',
    });

    await expect(fetchSpeciesLocations(42, 'country')).rejects.toThrow(
      'Failed to fetch species locations for 42: 503 backend unavailable',
    );
  });
});
