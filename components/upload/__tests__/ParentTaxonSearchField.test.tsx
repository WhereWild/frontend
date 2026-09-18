// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { fetchTaxaQuery } from '@/data/api';
import { Colors } from '@/constants/theme';
import type { TaxaQueryResponse, TaxaQueryResult } from '@/data/types';
import { ParentTaxonSearchField } from '../ParentTaxonSearchField';

jest.mock('@/data/api', () => ({
  fetchTaxaQuery: jest.fn(),
}));

const mockFetchTaxaQuery = jest.mocked(fetchTaxaQuery);

const createResult = (
  overrides: Partial<TaxaQueryResult> = {},
): TaxaQueryResult => ({
  taxon_id: '42',
  scientific_name: 'Testaceae',
  common_name: '',
  common_names: [],
  image_source: null,
  taxon_rank: 'FAMILY',
  _raw: {},
  ...overrides,
});

const createResponse = (results: TaxaQueryResult[]): TaxaQueryResponse => ({
  query: null,
  scope: {
    withinTaxonId: null,
    descendantRank: null,
    location: null,
    minSamples: null,
    includeSpeciesLike: false,
  },
  sort: { variable: null, metric: null, order: null, units: null },
  total: results.length,
  matchedTotal: results.length,
  eligibleTotal: results.length,
  emptyReason: results.length > 0 ? null : 'no_query',
  limit: results.length,
  offset: 0,
  results,
});

beforeEach(() => {
  jest.useFakeTimers();
  mockFetchTaxaQuery.mockReset();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('ParentTaxonSearchField', () => {
  it('renders a chip and no search input once a taxon is selected', () => {
    render(
      <ParentTaxonSearchField
        value={{ taxonId: '42', label: 'Testaceae' }}
        onChange={jest.fn()}
        palette={Colors.light}
      />,
    );

    expect(screen.getByText('Testaceae')).toBeTruthy();
    expect(
      screen.queryByPlaceholderText('Search for a parent taxon'),
    ).toBeNull();
  });

  it('clears the selection when Clear is pressed', () => {
    const handleChange = jest.fn();
    render(
      <ParentTaxonSearchField
        value={{ taxonId: '42', label: 'Testaceae' }}
        onChange={handleChange}
        palette={Colors.light}
      />,
    );

    fireEvent.press(screen.getByText('Clear'));
    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it('debounces the search, fetches suggestions, and selects one', async () => {
    const originalRequestAnimationFrame = global.requestAnimationFrame;
    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof requestAnimationFrame;

    mockFetchTaxaQuery.mockResolvedValueOnce(createResponse([createResult()]));
    const handleChange = jest.fn();
    render(
      <ParentTaxonSearchField
        value={null}
        onChange={handleChange}
        palette={Colors.light}
      />,
    );

    const input = screen.getByPlaceholderText('Search for a parent taxon');
    fireEvent.changeText(input, 'Testa');

    expect(mockFetchTaxaQuery).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockFetchTaxaQuery).toHaveBeenCalledWith({
      q: 'Testa',
      limit: 5,
      offset: 0,
      minSamples: 0,
    });

    expect(await screen.findByText('Testaceae')).toBeTruthy();

    act(() => {
      fireEvent.press(screen.getByTestId('search-result-42'));
    });
    expect(handleChange).toHaveBeenCalledWith({
      taxonId: '42',
      label: 'Testaceae',
    });

    global.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('prefers common_name over scientific_name for the suggestion label', async () => {
    mockFetchTaxaQuery.mockResolvedValueOnce(
      createResponse([createResult({ common_name: 'Nightshade family' })]),
    );
    render(
      <ParentTaxonSearchField
        value={null}
        onChange={jest.fn()}
        palette={Colors.light}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('Search for a parent taxon'),
      'Testa',
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(await screen.findByText('Nightshade family')).toBeTruthy();
  });

  it('shows a no-results message when the search returns nothing', async () => {
    mockFetchTaxaQuery.mockResolvedValueOnce(createResponse([]));
    render(
      <ParentTaxonSearchField
        value={null}
        onChange={jest.fn()}
        palette={Colors.light}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('Search for a parent taxon'),
      'zzz',
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(await screen.findByText('No matching taxa found')).toBeTruthy();
  });

  it('filters out results with no taxon_id', async () => {
    mockFetchTaxaQuery.mockResolvedValueOnce(
      createResponse([createResult({ taxon_id: null })]),
    );
    render(
      <ParentTaxonSearchField
        value={null}
        onChange={jest.fn()}
        palette={Colors.light}
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('Search for a parent taxon'),
      'Testa',
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(await screen.findByText('No matching taxa found')).toBeTruthy();
  });
});
