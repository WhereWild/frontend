// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchTaxaQuery } from '@/data/api';
import {
  deriveLocationGid,
  resolveAncestorTaxonId,
  toRankingFilterHint,
} from '../useSearchFilters.helpers';

jest.mock('@/data/api', () => ({
  fetchTaxaQuery: jest.fn(),
}));

const mockFetchTaxaQuery = jest.mocked(fetchTaxaQuery);

describe('useSearchFilters.helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a metric hint when taxon and variable are set but metric is missing', () => {
    expect(toRankingFilterHint('42', 'species', 'bio_1', '')).toBe(
      'Choose a Sorting metric to apply ranking-based filters.',
    );
  });

  it('returns a rank hint when taxon is selected without a rank', () => {
    expect(toRankingFilterHint('42', '', '', '')).toBe(
      'Selecting a Scope taxon already limits search results to its descendant taxa. Choose a Rank to start ranking within that scope.',
    );
  });

  it('returns a variable hint when taxon and rank are selected without a sort variable', () => {
    expect(toRankingFilterHint('42', 'species', '', '')).toBe(
      'Choose a Sort variable to apply ranking-based filters.',
    );
  });

  it('returns a scoped search hint when no base taxon is selected', () => {
    expect(toRankingFilterHint(null, '', 'bio_1', 'median')).toBe(
      'Add a Scope taxon to limit search results to descendant taxa. Then choose Rank, Variable, and Metric to rank within that scope.',
    );
  });

  it('returns null when the ranking filter set is complete', () => {
    expect(toRankingFilterHint('42', 'species', 'bio_1', 'median')).toBeNull();
  });

  it('derives the most specific location gid', () => {
    expect(deriveLocationGid('USA', 'USA.45_1', 'USA.45.1_1')).toBe(
      'USA.45.1_1',
    );
    expect(deriveLocationGid('USA', 'USA.45_1', '')).toBe('USA.45_1');
    expect(deriveLocationGid('USA', '', '')).toBe('USA');
    expect(deriveLocationGid('', '', '')).toBeNull();
  });

  it('returns a numeric query directly when resolving an ancestor taxon id', async () => {
    await expect(resolveAncestorTaxonId('77')).resolves.toBe(77);
    expect(mockFetchTaxaQuery).not.toHaveBeenCalled();
  });

  it('resolves an ancestor taxon id from search results', async () => {
    mockFetchTaxaQuery.mockResolvedValueOnce({
      results: [{ taxon_id: '88' }],
    } as any);

    await expect(resolveAncestorTaxonId('canis')).resolves.toBe(88);
    expect(mockFetchTaxaQuery).toHaveBeenCalledWith({
      q: 'canis',
      limit: 1,
      offset: 0,
      minSamples: 0,
    });
  });

  it('returns null when ancestor taxon search has no numeric top result', async () => {
    mockFetchTaxaQuery.mockResolvedValueOnce({
      results: [{ taxon_id: 'not-a-number' }],
    } as any);

    await expect(resolveAncestorTaxonId('canis')).resolves.toBeNull();
  });
});
