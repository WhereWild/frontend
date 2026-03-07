import { fetchReinforcementFeedback } from '../apiReinforcementHelpers';

describe('apiReinforcementHelpers.fetchReinforcementFeedback', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  it('parses object-wrapped feedback arrays', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        species_key: 11498251,
        feedback_count: 2,
        feedback: [
          { lat: 42.1, lon: -114.1, present: false },
          { lat: 43.2, lon: -112.2, present: true },
        ],
      }),
    });

    const result = await fetchReinforcementFeedback(11498251);

    expect(result).toEqual([
      { lat: 42.1, lon: -114.1, present: false },
      { lat: 43.2, lon: -112.2, present: true },
    ]);
  });

  it('still parses legacy top-level array payloads', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ([
        { lat: 42.1, lon: -114.1, present: false },
      ]),
    });

    const result = await fetchReinforcementFeedback(11498251);

    expect(result).toEqual([
      { lat: 42.1, lon: -114.1, present: false },
    ]);
  });
});
