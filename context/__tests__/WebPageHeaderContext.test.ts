// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { resolveHeaderConfigForRoute } from '../WebPageHeaderContext';

describe('resolveHeaderConfigForRoute', () => {
  it('preserves search-specific config on /search', () => {
    const onFilterPress = jest.fn();
    const onResetFilterPress = jest.fn();

    const resolved = resolveHeaderConfigForRoute('/search', {
      showFilterButton: true,
      onFilterPress,
      filterLabel: 'Hide Filter',
      showResetFilterButton: true,
      onResetFilterPress,
      showSearchResultsDropdown: false,
      searchQuery: 'canis',
      filterParams: {
        withinTaxonId: '5219142',
        descendantRank: 'species',
      },
    });

    expect(resolved.showFilterButton).toBe(true);
    expect(resolved.onFilterPress).toBe(onFilterPress);
    expect(resolved.filterLabel).toBe('Hide Filter');
    expect(resolved.showResetFilterButton).toBe(true);
    expect(resolved.onResetFilterPress).toBe(onResetFilterPress);
    expect(resolved.showSearchResultsDropdown).toBe(false);
    expect(resolved.searchQuery).toBe('canis');
    expect(resolved.filterParams?.withinTaxonId).toBe('5219142');
  });

  it('strips search-only controls on non-search routes', () => {
    const resolved = resolveHeaderConfigForRoute('/settings', {
      showFilterButton: true,
      onFilterPress: jest.fn(),
      filterLabel: 'Filter',
      showResetFilterButton: true,
      onResetFilterPress: jest.fn(),
      showSearchResultsDropdown: false,
      searchQuery: 'fox',
      filterParams: { withinTaxonId: '212' },
    });

    expect(resolved.showFilterButton).toBe(false);
    expect(resolved.onFilterPress).toBeUndefined();
    expect(resolved.filterLabel).toBeUndefined();
    expect(resolved.showResetFilterButton).toBe(false);
    expect(resolved.onResetFilterPress).toBeUndefined();
    expect(resolved.showSearchResultsDropdown).toBe(true);
    expect(resolved.searchQuery).toBeUndefined();
    expect(resolved.filterParams).toBeUndefined();
  });
});
