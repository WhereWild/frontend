import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { SearchResults } from '../SearchResults';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { SpeciesSummary } from '@/data/types';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('SearchResults', () => {
  const mockSpecies: SpeciesSummary[] = [
    {
      taxonId: 1,
      commonName: 'Species One',
      scientificName: 'Genus one',
      description: 'Description one',
    },
    {
      taxonId: 2,
      commonName: 'Species Two',
      scientificName: 'Genus two',
      description: 'Description two',
    },
  ];

  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
  });

  it('renders nothing when isVisible is false', () => {
    const { queryByTestId } = render(
      <SearchResults 
        results={mockSpecies}
        isVisible={false}
      />
    );

    expect(queryByTestId('search-results-container')).toBeNull();
  });

  it('renders results when isVisible is true', () => {
    render(
      <SearchResults 
        results={mockSpecies} 
        isVisible={true} 
      />
    );

    expect(screen.getByText('Species One')).toBeTruthy();
    expect(screen.getByText('Species Two')).toBeTruthy();
  });

  it('displays loading message when isLoading is true', () => {
    render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={true}
        testID="search-results"
      />
    );

    expect(screen.getByText('Loading results...')).toBeTruthy();
    expect(screen.queryByTestId('search-results-list')).toBeNull();
  });

  it('displays empty message when no results and not loading', () => {
    render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={false}
        emptyMessage="No species found"
        testID="search-results"
      />
    );

    expect(screen.getByText('No species found')).toBeTruthy();
  });

  it('displays custom empty message', () => {
    render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={false}
        emptyMessage="Custom empty state"
      />
    );

    expect(screen.getByText('Custom empty state')).toBeTruthy();
  });

  it('renders compact SpeciesCard for each result', () => {
    render(
      <SearchResults results={mockSpecies} isVisible={true} testID="search-results" />
    );

    expect(screen.getByTestId('search-result-1')).toBeTruthy();
    expect(screen.getByTestId('search-result-2')).toBeTruthy();
  });

  it('calls onSelectResult when a result is tapped', () => {
    const handleSelect = jest.fn();
    render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        onSelectResult={handleSelect}
        testID="search-results"
      />
    );

    // Tap the first result card
    const firstResultButton = screen.getByTestId('search-result-1');
    fireEvent.press(firstResultButton);

    expect(handleSelect).toHaveBeenCalledWith(mockSpecies[0]);
  });

  it('calls onSelectResult with correct species data', () => {
    const handleSelect = jest.fn();
    const species = mockSpecies[1];
    render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        onSelectResult={handleSelect}
        testID="search-results"
      />
    );

    const secondResultButton = screen.getByTestId('search-result-2');
    fireEvent.press(secondResultButton);

    expect(handleSelect).toHaveBeenCalledWith(species);
  });

  it('renders with custom testID', () => {
    render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        testID="custom-search-results"
      />
    );

    expect(screen.getByTestId('custom-search-results')).toBeTruthy();
  });

  it('respects maxHeight prop for list height constraint', () => {
    const { getByTestId } = render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        maxHeight={200}
        testID="search-results"
      />
    );

    const container = getByTestId('search-results');
    expect(container.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ maxHeight: 200 })])
    );
  });

  it('handles empty species array gracefully', () => {
    render(
      <SearchResults
        results={[]}
        isVisible={true}
        emptyMessage="Try a different search"
      />
    );

    expect(screen.getByText('Try a different search')).toBeTruthy();
  });

  it('displays results with different color schemes', () => {
    mockUseColorScheme.mockReturnValue('light');

    render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
      />
    );

    expect(screen.getByText('Species One')).toBeTruthy();
    expect(screen.getByText('Species Two')).toBeTruthy();
  });
});

// Import after describe block to avoid issues
import { fireEvent } from '@testing-library/react-native';
