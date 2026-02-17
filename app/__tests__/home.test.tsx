import { Colors } from '@/constants/theme';
import { mockHomePageData } from '@/data/homeSample';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen } from '@testing-library/react-native';
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

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

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
});
