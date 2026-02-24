import { render, screen, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
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
      commonNames: ['Species One'],
      scientificName: 'Genus one',
      description: 'Description one',
    },
    {
      taxonId: 2,
      commonName: 'Species Two',
      commonNames: ['Species Two'],
      scientificName: 'Genus two',
      description: 'Description two',
    },
  ];

  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
  });

  it('uses the light palette path when color scheme is light', () => {
    mockUseColorScheme.mockReturnValue('light');

    render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
      />,
    );

    expect(screen.getByText('Species One')).toBeTruthy();
  });

  it('renders nothing when isVisible is false', () => {
    const { queryByTestId } = render(
      <SearchResults
        results={mockSpecies}
        isVisible={false}
        testID="search-results"
      />
    );

    expect(queryByTestId('search-results')).toBeNull();
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

  it('omits loading testID when testID prop is not provided', () => {
    const { queryByTestId } = render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={true}
      />,
    );

    expect(queryByTestId(/-loading$/)).toBeNull();
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

  it('omits empty testID when testID prop is not provided', () => {
    const { queryByTestId } = render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={false}
      />,
    );

    expect(queryByTestId(/-empty$/)).toBeNull();
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
    const flattenedStyle = StyleSheet.flatten(container.props.style);

    expect(flattenedStyle?.maxHeight).toBe(200);
  });

  it('forwards pointer and touch handlers on the loading panel', () => {
    const onPointerEnter = jest.fn();
    const onPointerLeave = jest.fn();
    const onTouchStart = jest.fn();
    const onTouchEnd = jest.fn();

    const { getByTestId } = render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={true}
        testID="search-results"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />,
    );

    const panel = getByTestId('search-results-loading');
    panel.props.onPointerEnter?.();
    panel.props.onPointerLeave?.();
    panel.props.onTouchStart?.();
    panel.props.onTouchEnd?.();

    expect(onPointerEnter).toHaveBeenCalledTimes(1);
    expect(onPointerLeave).toHaveBeenCalledTimes(1);
    expect(onTouchStart).toHaveBeenCalledTimes(1);
    expect(onTouchEnd).toHaveBeenCalledTimes(1);
  });

  it('forwards focus and blur handlers on the loading panel', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();

    const { getByTestId } = render(
      <SearchResults
        results={[]}
        isVisible={true}
        isLoading={true}
        testID="search-results"
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const panel = getByTestId('search-results-loading');
    panel.props.onFocus?.();
    panel.props.onBlur?.();

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('merges custom style overrides on the results panel', () => {
    const { getByTestId } = render(
      <SearchResults
        results={mockSpecies}
        isVisible={true}
        testID="search-results"
        style={{ left: 12, right: 16, top: 24 }}
      />,
    );

    const panel = getByTestId('search-results');
    const flattenedStyle = StyleSheet.flatten(panel.props.style);

    expect(flattenedStyle?.left).toBe(12);
    expect(flattenedStyle?.right).toBe(16);
    expect(flattenedStyle?.top).toBe(24);
  });


});
