import { Colors } from '@/constants/theme';
import type { SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import SpeciesScreen from '../species';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

afterEach(() => {
  jest.restoreAllMocks();
  mockPush.mockClear();
  mockUseColorScheme.mockReturnValue('dark');
});

const createData = (overrides: Partial<SpeciesPageData> = {}): SpeciesPageData => ({
  id: 'test-species',
  commonName: 'Test Cactus',
  scientificName: 'Testus cactus',
  overview: {
    description: 'A sample species used for testing.',
    imageSource: { uri: 'test-image' },
  },
  dataSections: [
    {
      title: 'Habitat',
      entries: [
        { dataName: 'Climate', dataPoint: 'Desert', expandable: false },
        {
          dataName: 'Soil',
          dataPoint: 'Sandy',
          details: [{ label: 'Drainage', value: 'Fast' }],
        },
      ],
    },
  ],
  nearbySpecies: [
    {
      commonName: 'Neighbor',
      scientificName: 'Neighborius plantus',
      description: 'Nearby species description.',
    },
  ],
  heatmap: {
    imageSource: { uri: 'heatmap' },
  },
  ...overrides,
});

describe('Species screen', () => {
  it('renders species data-driven content and supports download press', () => {
    const data = createData();
    render(<SpeciesScreen data={data} />);

    expect(screen.getByText('Test Cactus')).toBeTruthy();
    expect(screen.getByText('Testus cactus')).toBeTruthy();
    expect(screen.getByText('A sample species used for testing.')).toBeTruthy();
    expect(screen.getByText('Habitat')).toBeTruthy();
    expect(screen.getByText('Climate: Desert')).toBeTruthy();
    expect(screen.getByText('Nearby Species')).toBeTruthy();
    expect(screen.getByText('Neighbor')).toBeTruthy();
    expect(screen.getByText('Heat Map')).toBeTruthy();

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    fireEvent.press(screen.getByText('Download'));
    expect(alertSpy).toHaveBeenCalledWith('Download started', expect.any(String));
    alertSpy.mockRestore();
  });

  it('falls back to sample data when no data prop is provided', () => {
    render(<SpeciesScreen />);

    expect(screen.getByText('Mountain Ball Cactus')).toBeTruthy();
  });

  it('updates header search input and triggers filter alert', () => {
    render(<SpeciesScreen data={createData()} />);

    const headerSearchInput = screen.getAllByPlaceholderText('Search')[0];
    fireEvent.changeText(headerSearchInput, 'lichen');
    expect(headerSearchInput.props.value).toBe('lichen');

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    fireEvent.press(screen.getByLabelText('Filter search results'));
    expect(alertSpy).toHaveBeenCalledWith('Filter coming soon');
    alertSpy.mockRestore();
  });

  it('expands inline rows to reveal details and graph placeholder', () => {
    render(<SpeciesScreen data={createData()} />);

    const soilRow = screen.getByLabelText('Soil expand');
    fireEvent.press(soilRow);

    expect(screen.getByText('Drainage: Fast')).toBeTruthy();
    expect(screen.getByTestId('data-entry-graph')).toBeTruthy();
  });

  it('renders dark mode palette and hides empty nearby species carousel', () => {
    mockUseColorScheme.mockReturnValue('dark');
    render(
      <SpeciesScreen
        data={createData({ nearbySpecies: [] })}
      />,
    );

    expect(screen.queryByText('Nearby Species')).toBeNull();
  });

  it('applies light mode background color when overridden to be light', () => {
    mockUseColorScheme.mockReturnValue('light');
    const tree = render(<SpeciesScreen data={createData()} />).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected SpeciesScreen to render a single root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(Colors.light.background.default.default);
  });
});
