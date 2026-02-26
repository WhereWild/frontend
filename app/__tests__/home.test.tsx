import { Colors } from '@/constants/theme';
import { fetchSpeciesByTaxonId } from '@/data/api';
import { mockHomePageData } from '@/data/homeSample';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import HomeScreen from '../index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/data/api', () => ({
  fetchSpeciesByTaxonId: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockFetchSpeciesByTaxonId = fetchSpeciesByTaxonId as jest.MockedFunction<
  typeof fetchSpeciesByTaxonId
>;

const createData = (overrides: Partial<HomePageData> = {}): HomePageData => ({
  map: {
    heatmapImage: { uri: 'heatmap' },
    controlsImage: { uri: 'controls' },
  },
  recommendations: {
    items: [
      {
        taxonId: 101,
        commonName: 'Desert Bloom',
        commonNames: ['Desert Bloom'],
        scientificName: 'Bloomus deserti',
        description: 'Currently flowering',
        imageSource: { uri: 'desert' },
      },
      {
        taxonId: 202,
        commonName: 'Alpine Falcon',
        commonNames: ['Alpine Falcon'],
        scientificName: 'Falco alpinus',
        description: 'Sighted this week',
        imageSource: { uri: 'falcon' },
      },
    ],
  },
  ...overrides,
});

describe('Home screen', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
    mockPush.mockClear();
    mockFetchSpeciesByTaxonId.mockImplementation(
      () => new Promise(() => undefined),
    );
  });

  it('renders map and recommendation cards from provided data', () => {
    render(<HomeScreen data={createData()} />);

    expect(screen.getByText('Local Map')).toBeTruthy();
    expect(screen.getByText('Active Near You')).toBeTruthy();
    expect(screen.getByText('Desert Bloom')).toBeTruthy();
    expect(screen.getByText('Bloomus deserti')).toBeTruthy();
    expect(screen.getByText('Alpine Falcon')).toBeTruthy();
    expect(screen.getByText('Falco alpinus')).toBeTruthy();
  });

  it('falls back to mock data when no data prop is supplied', () => {
    render(<HomeScreen />);

    expect(screen.getByText(mockHomePageData.recommendations.items[0].commonName)).toBeTruthy();
  });

  it('updates the page header search input state', () => {
    render(<HomeScreen data={createData()} />);

    const searchInput = screen.getByPlaceholderText('Search');
    fireEvent.changeText(searchInput, 'lynx');
    expect(searchInput.props.value).toBe('lynx');
  });

  it('applies light mode background color when overridden to be light', () => {
    mockUseColorScheme.mockReturnValue('light');
    const tree = render(<HomeScreen data={createData()} />).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected HomeScreen to render a single root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(Colors.light.background.default.default);
  });

  it('hydrates recommendation cards from fetched species values', async () => {
    mockFetchSpeciesByTaxonId.mockImplementation(async (taxonId) => {
      if (Number(taxonId) === 101) {
        return {
          taxon_id: 101,
          scientific_name: 'Hydratus firstus',
          common_name: 'Hydrated First',
          common_names: ['Hydrated First'],
          image_source: null,
          _raw: {},
          description: 'Hydrated description',
          image_license: null,
          image_creator: null,
          image_rights_holder: null,
          image_references: null,
          taxonomyPath: null,
        };
      }

      return {
        taxon_id: Number(taxonId),
        scientific_name: '',
        common_name: '',
        common_names: [],
        image_source: null,
        _raw: {},
        description: 'description pending',
        image_license: null,
        image_creator: null,
        image_rights_holder: null,
        image_references: null,
        taxonomyPath: null,
      };
    });

    render(<HomeScreen data={createData()} />);

    await waitFor(() => {
      expect(screen.getByText('Hydrated First')).toBeTruthy();
      expect(screen.getByText('Hydratus firstus')).toBeTruthy();
    });
  });
});
