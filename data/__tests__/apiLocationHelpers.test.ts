import { fetchLocationsByHierarchy } from '../apiLocationHelpers';

describe('fetchLocationsByHierarchy', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  it('omits q when query is empty but keeps level, parent, and limit', async () => {
    await fetchLocationsByHierarchy('', 'state', 'USA', 25);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain('/locations/search_hierarchy?');
    expect(url).toContain('level=1');
    expect(url).toContain('parent=USA');
    expect(url).toContain('limit=25');
    expect(url).not.toContain('q=');
  });

  it('includes q when query is non-empty', async () => {
    await fetchLocationsByHierarchy('utah', 'state', 'USA', 25);

    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain('q=utah');
  });
});
