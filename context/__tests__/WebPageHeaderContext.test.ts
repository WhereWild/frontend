import { resolveHeaderConfigForRoute } from '../WebPageHeaderContext';

describe('resolveHeaderConfigForRoute', () => {
  it('preserves search-specific config on /search', () => {
    const onFilterPress = jest.fn();
    const onResetFilterPress = jest.fn();
    const onSearchingChanged = jest.fn();
    const onSearchResultsChanged = jest.fn();
    const onSearchContextChanged = jest.fn();

    const resolved = resolveHeaderConfigForRoute('/search', {
      showFilterButton: true,
      onFilterPress,
      filterLabel: 'Hide Filter',
      showResetFilterButton: true,
      onResetFilterPress,
      showSearchResultsDropdown: false,
      initialQuery: 'canis',
      filterParams: {
        ancestorTaxonId: 5219142,
        rank: 'species',
      },
      onSearchingChanged,
      onSearchResultsChanged,
      onSearchContextChanged,
    });

    expect(resolved.showFilterButton).toBe(true);
    expect(resolved.onFilterPress).toBe(onFilterPress);
    expect(resolved.filterLabel).toBe('Hide Filter');
    expect(resolved.showResetFilterButton).toBe(true);
    expect(resolved.onResetFilterPress).toBe(onResetFilterPress);
    expect(resolved.showSearchResultsDropdown).toBe(false);
    expect(resolved.initialQuery).toBe('canis');
    expect(resolved.filterParams?.ancestorTaxonId).toBe(5219142);
    expect(resolved.onSearchingChanged).toBe(onSearchingChanged);
    expect(resolved.onSearchResultsChanged).toBe(onSearchResultsChanged);
    expect(resolved.onSearchContextChanged).toBe(onSearchContextChanged);
  });

  it('strips search-only controls on non-search routes', () => {
    const resolved = resolveHeaderConfigForRoute('/settings', {
      showFilterButton: true,
      onFilterPress: jest.fn(),
      filterLabel: 'Filter',
      showResetFilterButton: true,
      onResetFilterPress: jest.fn(),
      showSearchResultsDropdown: false,
      initialQuery: 'fox',
      filterParams: { ancestorTaxonId: 212 },
      onSearchingChanged: jest.fn(),
      onSearchResultsChanged: jest.fn(),
      onSearchContextChanged: jest.fn(),
    });

    expect(resolved.showFilterButton).toBe(false);
    expect(resolved.onFilterPress).toBeUndefined();
    expect(resolved.filterLabel).toBeUndefined();
    expect(resolved.showResetFilterButton).toBe(false);
    expect(resolved.onResetFilterPress).toBeUndefined();
    expect(resolved.showSearchResultsDropdown).toBe(true);
    expect(resolved.initialQuery).toBeUndefined();
    expect(resolved.filterParams).toBeUndefined();
    expect(resolved.onSearchingChanged).toBeUndefined();
    expect(resolved.onSearchResultsChanged).toBeUndefined();
    expect(resolved.onSearchContextChanged).toBeUndefined();
  });
});
