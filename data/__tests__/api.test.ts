import { BACKEND_BASE, fetchSpeciesByTaxonId, fetchSpeciesList } from '../api';

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

  it('handles null species detail payloads without throwing', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => null,
    });

    const row = await fetchSpeciesByTaxonId(999);

    expect(row).toEqual(
      expect.objectContaining({
        taxon_id: null,
        scientific_name: '',
        common_name: '',
        common_names: [],
        image_source: null,
        description: 'description pending',
      }),
    );
  });
});
