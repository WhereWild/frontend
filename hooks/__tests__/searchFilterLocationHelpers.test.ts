import { fetchLocationsByHierarchy } from '@/data/api';
import {
  fetchCountryHierarchyOptions,
  fetchHierarchyOptionsWithParentFallback,
  getOptionLabelForValue,
} from '../searchFilterLocationHelpers';

jest.mock('@/data/api', () => ({
  fetchLocationsByHierarchy: jest.fn(),
}));

const mockFetchLocationsByHierarchy = jest.mocked(fetchLocationsByHierarchy);

describe('searchFilterLocationHelpers', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('returns trimmed label for a selected option value', () => {
    const label = getOptionLabelForValue(
      [
        { label: ' United States ', value: 'USA' },
        { label: 'Canada', value: 'CAN' },
      ],
      'USA',
    );

    expect(label).toBe('United States');
    expect(getOptionLabelForValue([{ label: 'Canada', value: 'CAN' }], 'USA')).toBe('');
  });

  it('loads and maps country hierarchy options', async () => {
    mockFetchLocationsByHierarchy.mockResolvedValueOnce([
      { gid: 'USA', name: 'United States', level: 0, hierarchy: [] },
      { gid: 'CAN', name: 'Canada', level: 0, hierarchy: [] },
    ]);

    await expect(fetchCountryHierarchyOptions()).resolves.toEqual([
      { label: 'United States', value: 'USA' },
      { label: 'Canada', value: 'CAN' },
    ]);

    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith('', 'country', undefined, 300);
  });

  it('tries parent candidates in order and returns first non-empty result set', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(async (_query, level, parent) => {
      if (level !== 'state') {
        return [];
      }

      if (parent === 'USA') {
        throw new Error('temporary error');
      }

      if (parent === 'United States') {
        return [{ gid: 'US-CA', name: 'California', level: 1, hierarchy: ['United States'] }];
      }

      return [];
    });

    const options = await fetchHierarchyOptionsWithParentFallback('state', [
      'USA',
      '  United States  ',
      'USA',
      undefined,
      '',
    ]);

    expect(options).toEqual([{ label: 'California', value: 'US-CA' }]);
    expect(mockFetchLocationsByHierarchy).toHaveBeenNthCalledWith(1, '', 'state', 'USA', 300);
    expect(mockFetchLocationsByHierarchy).toHaveBeenNthCalledWith(2, '', 'state', 'United States', 300);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('returns empty options when all parent candidates fail or are empty', async () => {
    mockFetchLocationsByHierarchy.mockRejectedValue(new Error('backend down'));

    await expect(
      fetchHierarchyOptionsWithParentFallback('county', [undefined, '', '   ', 'US-UT']),
    ).resolves.toEqual([]);
  });

  it('logs warnings when all parent candidates fail', async () => {
    mockFetchLocationsByHierarchy.mockRejectedValue(new Error('backend down'));

    await expect(
      fetchHierarchyOptionsWithParentFallback('state', ['USA']),
    ).resolves.toEqual([]);

    expect(consoleWarnSpy).toHaveBeenCalled();
  });
});
