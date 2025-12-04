import { Colors } from '@/constants/theme';
import type { SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SpeciesScreen from '../_speciesPage';

jest.mock('@/components/sections/SpeciesEnvironmentSection', () => {
  const MockSpeciesEnvironmentSection = jest.fn(() => null);
  return {
    __esModule: true,
    SpeciesEnvironmentSection: MockSpeciesEnvironmentSection,
  };
});

const speciesEnvironmentSectionMock = jest.requireMock('@/components/sections/SpeciesEnvironmentSection')
  .SpeciesEnvironmentSection as jest.Mock;

const mockPush = jest.fn();
const mockCanGoBack = jest.fn(() => false);

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    canGoBack: mockCanGoBack,
  }),
  usePathname: () => '/',
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockUseSafeAreaInsets = useSafeAreaInsets as jest.MockedFunction<typeof useSafeAreaInsets>;

beforeEach(() => {
  mockUseSafeAreaInsets.mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
});

afterEach(() => {
  jest.restoreAllMocks();
  mockPush.mockClear();
  mockUseColorScheme.mockReturnValue('dark');
  speciesEnvironmentSectionMock.mockClear();

});

const createData = (overrides: Partial<SpeciesPageData> = {}): SpeciesPageData => ({
  taxonId: 13579,
  commonName: 'Test Cactus',
  scientificName: 'Testus cactus',
  description: 'Fixture description used in cards and summaries.',
  imageSource: { uri: 'card-image' },
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
          environmentGraph: {
            variableId: 'soil_moisture',
          },
        },
      ],
    },
  ],
  nearbySpecies: [
    {
      taxonId: 24680,
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

  it('renders the overview fallback copy when description and image data are missing', () => {
    const data = createData({
      overview: undefined,
    });

    render(<SpeciesScreen data={data} />);

    expect(
      screen.getByText('Overview data is unavailable for this species.'),
    ).toBeTruthy();
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

  it('expands inline rows to reveal details and environment graph', () => {
    const data = createData();
    render(<SpeciesScreen data={data} />);

    expect(speciesEnvironmentSectionMock).not.toHaveBeenCalled();

    const soilRow = screen.getByLabelText('Soil: Sandy');
    fireEvent.press(soilRow);

    expect(screen.getByText('Drainage: Fast')).toBeTruthy();
    expect(speciesEnvironmentSectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taxonId: data.taxonId,
        variableId: 'soil_moisture',
        title: 'Soil',
      }),
      undefined,
    );
  });

  it('renders dark mode palette and shows placeholder nearby species when data is empty', () => {
    mockUseColorScheme.mockReturnValue('dark');
    render(
      <SpeciesScreen
        data={createData({ nearbySpecies: [] })}
      />,
    );

    expect(screen.getByText('Nearby Species')).toBeTruthy();
    expect(screen.getByText('Utah Juniper')).toBeTruthy();
  });

  it('shows environmental and heat map placeholders when sections and imagery are missing', () => {
    const data = createData({
      dataSections: [],
      heatmap: undefined,
    });

    render(<SpeciesScreen data={data} />);

    expect(
      screen.getByText('Environmental breakdowns are not yet available.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Heat map data is still processing for this species.'),
    ).toBeTruthy();
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
