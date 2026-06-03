// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchLocationsByHierarchy } from '@/data/api';
import {
  fetchCountryHierarchyOptions,
  fetchHierarchyOptionsWithParentFallback,
  getCachedHierarchyOptionsForValue,
  getOptionLabelForValue,
  resetSearchFilterLocationOptionsCache,
} from '../searchFilterLocationHelpers';

jest.mock('@/data/api', () => ({
  fetchLocationsByHierarchy: jest.fn(),
}));

const mockFetchLocationsByHierarchy = jest.mocked(fetchLocationsByHierarchy);

describe('searchFilterLocationHelpers', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetSearchFilterLocationOptionsCache();
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
    expect(
      getOptionLabelForValue([{ label: 'Canada', value: 'CAN' }], 'USA'),
    ).toBe('');
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

    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith(
      '',
      'country',
      undefined,
      300,
    );
  });

  it('tries parent candidates in order and returns first non-empty result set', async () => {
    mockFetchLocationsByHierarchy.mockImplementation(
      async (_query, level, parent) => {
        if (level !== 'state') {
          return [];
        }

        if (parent === 'USA') {
          throw new Error('temporary error');
        }

        if (parent === 'United States') {
          return [
            {
              gid: 'US-CA',
              name: 'California',
              level: 1,
              hierarchy: ['United States'],
            },
          ];
        }

        return [];
      },
    );

    const options = await fetchHierarchyOptionsWithParentFallback('state', [
      'USA',
      '  United States  ',
      'USA',
      undefined,
      '',
    ]);

    expect(options).toEqual([{ label: 'California', value: 'US-CA' }]);
    expect(mockFetchLocationsByHierarchy).toHaveBeenNthCalledWith(
      1,
      '',
      'state',
      'USA',
      300,
    );
    expect(mockFetchLocationsByHierarchy).toHaveBeenNthCalledWith(
      2,
      '',
      'state',
      'United States',
      300,
    );
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('returns empty options when all parent candidates fail or are empty', async () => {
    mockFetchLocationsByHierarchy.mockRejectedValue(new Error('backend down'));

    await expect(
      fetchHierarchyOptionsWithParentFallback('county', [
        undefined,
        '',
        '   ',
        'USA.45_1',
      ]),
    ).resolves.toEqual([]);
  });

  it('logs warnings when all parent candidates fail', async () => {
    mockFetchLocationsByHierarchy.mockRejectedValue(new Error('backend down'));

    await expect(
      fetchHierarchyOptionsWithParentFallback('state', ['USA']),
    ).resolves.toEqual([]);

    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('reuses cached hierarchy options for repeated level and parent lookups', async () => {
    mockFetchLocationsByHierarchy.mockResolvedValue([
      { gid: 'CHN.1_1', name: 'Anhui', level: 1, hierarchy: ['China'] },
    ]);

    await expect(
      fetchHierarchyOptionsWithParentFallback('state', ['CHN']),
    ).resolves.toEqual([{ label: 'Anhui', value: 'CHN.1_1' }]);

    await expect(
      fetchHierarchyOptionsWithParentFallback('state', ['CHN']),
    ).resolves.toEqual([{ label: 'Anhui', value: 'CHN.1_1' }]);

    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledTimes(1);
    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith(
      '',
      'state',
      'CHN',
      300,
    );
  });

  it('deduplicates in-flight hierarchy lookups and reuses cached labels by value', async () => {
    type MockHierarchyRow = {
      gid: string;
      name: string;
      level: number;
      hierarchy: string[];
    };

    const resolveRequestRef: {
      current: ((rows: MockHierarchyRow[]) => void) | null;
    } = {
      current: null,
    };

    mockFetchLocationsByHierarchy.mockImplementationOnce(
      () =>
        new Promise<MockHierarchyRow[]>((resolve) => {
          resolveRequestRef.current = resolve;
        }),
    );

    const firstRequest = fetchHierarchyOptionsWithParentFallback('state', [
      'CHN',
    ]);
    const secondRequest = fetchHierarchyOptionsWithParentFallback('state', [
      'CHN',
    ]);

    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledTimes(1);

    if (resolveRequestRef.current == null) {
      throw new Error('Expected in-flight hierarchy request resolver');
    }

    resolveRequestRef.current([
      { gid: 'CHN.16_1', name: 'Jiangsu', level: 1, hierarchy: ['China'] },
    ]);

    await expect(firstRequest).resolves.toEqual([
      { label: 'Jiangsu', value: 'CHN.16_1' },
    ]);
    await expect(secondRequest).resolves.toEqual([
      { label: 'Jiangsu', value: 'CHN.16_1' },
    ]);

    expect(
      getCachedHierarchyOptionsForValue('state', 'CHN.16_1', 'CHN'),
    ).toEqual([{ label: 'Jiangsu', value: 'CHN.16_1' }]);
    expect(
      getCachedHierarchyOptionsForValue('state', 'CHN.99_1', 'CHN'),
    ).toEqual([]);
    expect(getCachedHierarchyOptionsForValue('state', '', 'CHN')).toEqual([]);
  });

  it('returns an empty list for a non-empty value when no cached hierarchy options exist yet', () => {
    expect(
      getCachedHierarchyOptionsForValue('county', 'USA.45.1_1', 'USA.45_1'),
    ).toEqual([]);
  });
});
