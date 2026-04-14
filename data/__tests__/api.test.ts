import {
  BACKEND_BASE,
  fetchPointEnvironmentValue,
  fetchSpeciesByTaxonId,
  fetchSpeciesList,
  fetchSpeciesLocations,
  fetchSpeciesWithModels,
  fetchViewportScores,
} from '../api';

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

  it('normalizes common_names arrays in species list responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          taxon_id: 1,
          scientific_name: 'Canis lupus',
          common_names: ['Wolf', 'Gray Wolf'],
        },
      ]),
    });

    const rows = await fetchSpeciesList(5, 'wolf');

    expect(global.fetch).toHaveBeenCalledWith(`${BACKEND_BASE}/api/species?limit=5&q=wolf`);
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
      json: async () => ([
        {
          taxon_id: '7',
          scientific_name: 'Lynx rufus',
          common_names: ['Bobcat'],
        },
      ]),
    });

    const rows = await fetchSpeciesList(5, 'lynx');

    expect(rows).toEqual([
      expect.objectContaining({
        taxon_id: 7,
      }),
    ]);
  });

  it('falls back to null taxon_id when non-numeric string is returned', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          taxon_id: 'not-a-number',
          scientific_name: 'Unknown species',
          common_names: ['Unknown'],
        },
      ]),
    });

    const rows = await fetchSpeciesList(5, 'unknown');

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

    expect(global.fetch).toHaveBeenCalledWith(`${BACKEND_BASE}/api/species/2?unit_system=imperial`);
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
      json: async () => ([
        {
          taxon_id: 4,
          scientific_name: 'Aquila chrysaetos',
          commonNames: ['Golden Eagle', 'Eagle'],
        },
      ]),
    });

    const rows = await fetchSpeciesList(5, 'eagle');

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
      json: async () => ([
        {
          taxon_id: 8,
          scientific_name: 'Canis lupus',
          common_name: '  Gray Wolf  ',
          common_names: ['Gray Wolf', 'Wolf'],
        },
      ]),
    });

    const rows = await fetchSpeciesList(5, 'wolf');

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
      json: async () => ([
        {
          taxon_id: 3,
          scientific_name: 'Taxus fallbackus',
          common_names: [null, '   '],
        },
      ]),
    });

    const rows = await fetchSpeciesList(5, 'taxus');

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
      json: async () => ([
        {
          taxon_id: 5,
          scientific_name: 'Strix varia',
          common_name: 'Barred Owl',
          image_file: '../images/owl photo#1.png',
        },
      ]),
    });

    const rows = await fetchSpeciesList(5, 'owl');

    expect(rows).toEqual([
      expect.objectContaining({
        image_source: `${BACKEND_BASE}/static/species_images/owl%20photo%231.png`,
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
      json: async () => ([
        {
          taxon_id: '11',
          scientific_name: 'Pinus edulis',
          common_names: ['Colorado Pinyon'],
          taxon_group: 'plants',
          image_file: 'nested/pinyon.png',
        },
      ]),
    });

    const rows = await fetchSpeciesWithModels();

    expect(global.fetch).toHaveBeenCalledWith(`${BACKEND_BASE}/api/species/with-models`);
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
      json: async () => ([
        { gid: 'country-us', name: 'United States', level: 0, hierarchy: ['North America'] },
        { gid: '', name: 'Missing gid', level: 0, hierarchy: [] },
      ]),
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
        results: [{ gid: 'state-ut', name: 'Utah', level: 1, hierarchy: ['North America', 'United States'] }],
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
