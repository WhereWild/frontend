import { fetchSpeciesLocations, fetchSpeciesOccurrences } from '@/data/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, Linking } from 'react-native';
import SpeciesScreen, { LOCATION_SEARCH_LIMIT, type SpeciesScreenData } from '../_species';

const mockPush = jest.fn();

jest.mock('@/data/api', () => ({
  fetchSpeciesLocations: jest.fn(),
  fetchSpeciesOccurrences: jest.fn(),
  fetchEnvironmentVariables: jest.fn(),
  fetchSpeciesEnvironment: jest.fn(),
  fetchEnvironmentRangeSlice: jest.fn(),
  fetchSpeciesEnvironmentCategorySamples: jest.fn(),
}));

const mockedApiModule = jest.requireMock('@/data/api') as {
  fetchEnvironmentVariables: jest.Mock;
  fetchSpeciesEnvironment: jest.Mock;
  fetchEnvironmentRangeSlice: jest.Mock;
  fetchSpeciesEnvironmentCategorySamples: jest.Mock;
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

jest.mock('@/components/inputs/SelectField', () => {
  const ReactNative = jest.requireActual('react-native');
  const { View, Text, Pressable } = ReactNative;
  return {
    SelectField: ({
      label,
      options = [],
      value,
      disabled,
      onValueChange,
    }: {
      label?: string;
      options?: { label: string; value: string }[];
      value: string;
      disabled?: boolean;
      onValueChange?: (value: string) => void;
    }) => {
      const nextValue = options[1]?.value ?? '';
      return (
        <View>
          <Text>{label}</Text>
          <Text testID={`select-${label}-value`}>{`Selected: ${value || 'none'}`}</Text>
          <Text testID={`select-${label}-status`}>{disabled ? 'Disabled' : 'Enabled'}</Text>
          <Pressable
            testID={`select-${label}-next`}
            onPress={() => onValueChange?.(nextValue)}
            disabled={disabled}
          >
            <Text>{`Pick ${label}`}</Text>
          </Pressable>
          {options.map((option) => {
            const optionKey = option.value || 'empty';
            return (
              <Pressable
                key={`${label}-${optionKey}`}
                testID={`select-${label}-option-${optionKey}`}
                onPress={() => onValueChange?.(option.value)}
                disabled={disabled}
              >
                <Text>{`Choose ${label}: ${option.label}`}</Text>
              </Pressable>
            );
          })}
          <Pressable
            testID={`select-${label}-clear`}
            onPress={() => onValueChange?.('')}
            disabled={disabled}
          >
            <Text>{`Clear ${label}`}</Text>
          </Pressable>
        </View>
      );
    },
  };
});

jest.mock('@/components/sections/SpeciesOccurrenceMap', () => {
  const ReactNative = jest.requireActual('react-native');
  const { View, Text } = ReactNative;
  return {
    SpeciesOccurrenceMap: ({
      occurrences,
      loading,
      error,
      heatmapTileUrl,
      showMarkers,
    }: {
      occurrences: unknown[];
      loading?: boolean;
      error?: string | null;
      heatmapTileUrl?: string | null;
      showMarkers?: boolean;
    }) => (
      <View>
        <Text>{`Map loading: ${loading ? 'yes' : 'no'}`}</Text>
        <Text>{`Map occurrences: ${occurrences.length}`}</Text>
        <Text>{`Map error: ${error ?? 'none'}`}</Text>
        <Text>{`Map markers: ${showMarkers === false ? 'hidden' : 'shown'}`}</Text>
        <Text>{`Map heatmap: ${heatmapTileUrl ?? 'none'}`}</Text>
      </View>
    ),
  };
});

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockFetchSpeciesLocations = fetchSpeciesLocations as jest.MockedFunction<
  typeof fetchSpeciesLocations
>;
const mockFetchSpeciesOccurrences = fetchSpeciesOccurrences as jest.MockedFunction<
  typeof fetchSpeciesOccurrences
>;

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockPush.mockClear();
  mockUseColorScheme.mockReturnValue('dark');
  mockFetchSpeciesLocations.mockResolvedValue([]);
  mockFetchSpeciesOccurrences.mockResolvedValue([]);
  mockedApiModule.fetchEnvironmentVariables.mockResolvedValue([]);
  mockedApiModule.fetchSpeciesEnvironment.mockResolvedValue(null);
  mockedApiModule.fetchEnvironmentRangeSlice.mockResolvedValue({
    speciesId: 0,
    variable: 'bio_1',
    range: { min: 0, max: 0 },
    limit: null,
    count: 0,
    observations: [],
  });
  mockedApiModule.fetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
    speciesId: 0,
    variable: 'landcover',
    classValue: 'unknown',
    observations: [],
    count: 0,
  });
});

const createData = (overrides: Partial<SpeciesScreenData> = {}): SpeciesScreenData => ({
  taxonId: 13579,
  commonName: 'Test Cactus',
  commonNames: ['Test Cactus', 'Prickly Test Cactus'],
  scientificName: 'Testus cactus',
  overview: {
    description: 'A sample species used for testing.',
    imageSource: { uri: 'test-image' },
  },
  nearbySpecies: [
    {
      taxonId: 24680,
      commonName: 'Neighbor',
      commonNames: ['Neighbor'],
      scientificName: 'Neighborius plantus',
      description: 'Nearby species description.',
    },
  ],
  heatmap: {
    imageSource: { uri: 'heatmap' },
    liveAvailable: false,
    liveTileUrl: null,
    liveModelId: null,
  },
  ...overrides,
});

const waitForSpeciesEffectsToSettle = async (hasTaxonId = true) => {
  const flushMicrotasks = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  if (!hasTaxonId) {
    await flushMicrotasks();
    await flushMicrotasks();
    return;
  }

  await waitFor(() => {
    expect(mockFetchSpeciesLocations).toHaveBeenCalled();
  });

  await waitFor(() => {
    expect(mockFetchSpeciesOccurrences).toHaveBeenCalled();
  });

  await waitFor(() => {
    expect(screen.getByText('Map loading: no')).toBeTruthy();
  });

  await flushMicrotasks();
};

describe('Species screen', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
    mockFetchSpeciesLocations.mockResolvedValue([]);
    mockFetchSpeciesOccurrences.mockResolvedValue([]);
    mockedApiModule.fetchEnvironmentVariables.mockResolvedValue([]);
    mockedApiModule.fetchSpeciesEnvironment.mockResolvedValue(null);
    mockedApiModule.fetchEnvironmentRangeSlice.mockResolvedValue({
      speciesId: 0,
      variable: 'bio_1',
      range: { min: 0, max: 0 },
      limit: null,
      count: 0,
      observations: [],
    });
    mockedApiModule.fetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
      speciesId: 0,
      variable: 'landcover',
      classValue: 'unknown',
      observations: [],
      count: 0,
    });
  });

  it('renders species data-driven content and supports download press', async () => {
    const data = createData();
    render(<SpeciesScreen data={data} />);

    await waitForSpeciesEffectsToSettle();

    expect(screen.getAllByText('Test Cactus').length).toBeGreaterThan(0);
    expect(screen.getByText('Testus cactus')).toBeTruthy();
    expect(screen.getByText('A sample species used for testing.')).toBeTruthy();
    expect(screen.getByText('Common Names')).toBeTruthy();
    expect(screen.getAllByText('Test Cactus').length).toBeGreaterThan(0);
    expect(screen.getByText('Prickly Test Cactus')).toBeTruthy();
    expect(screen.getByText('Nearby Species')).toBeTruthy();
    expect(screen.getByText('Neighbor')).toBeTruthy();
    expect(screen.getByText('Show observations')).toBeTruthy();
    expect(screen.getByText('Show predictive heatmap')).toBeTruthy();

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => { });
    try {
      fireEvent.press(screen.getByText('Download'));
      expect(alertSpy).toHaveBeenCalledWith('Download started', expect.any(String));
    } finally {
      alertSpy.mockRestore();
    }
  });

  it('falls back to sample data when no data prop is provided', async () => {
    render(<SpeciesScreen />);

    await waitForSpeciesEffectsToSettle();

    expect(screen.getAllByText('Mountain Ball Cactus').length).toBeGreaterThan(0);
    expect(screen.getByText('Common Names')).toBeTruthy();
    expect(screen.getByText('Mountain Cactus')).toBeTruthy();
    expect(screen.getByText('Snowball Cactus')).toBeTruthy();
  });

  it('renders overview sub-sections when structured description sections are provided', async () => {
    render(
      <SpeciesScreen
        data={createData({
          overview: {
            description: 'Summary: A sample species used for testing.',
            sections: [
              {
                id: 'summary',
                title: 'Summary',
                lines: [{ body: 'A sample species used for testing.' }],
              },
              {
                id: 'habitat',
                title: 'Habitat',
                lines: [{ prefix: 'Often in:', body: 'dry uplands' }],
              },
            ],
            imageSource: { uri: 'test-image' },
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.getByText('Habitat')).toBeTruthy();
    expect(screen.getByText(/Often in:\s+dry uplands/)).toBeTruthy();
  });

  it('falls back to single commonName when commonNames list is empty', async () => {
    render(
      <SpeciesScreen
        data={createData({ commonNames: [] })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    expect(screen.getByText('Common Names')).toBeTruthy();
    expect(screen.getAllByText('Test Cactus').length).toBeGreaterThan(1);
  });

  it('loads occurrence and country options on mount', async () => {
    render(<SpeciesScreen data={createData()} />);

    await waitFor(() => {
      expect(mockFetchSpeciesOccurrences).toHaveBeenCalledWith(13579, {
        location: undefined,
      });
    });

    expect(mockFetchSpeciesLocations).toHaveBeenCalledWith(
      13579,
      'country',
      undefined,
      LOCATION_SEARCH_LIMIT,
    );

    await waitFor(() => {
      expect(screen.getByText('Map loading: no')).toBeTruthy();
    });
  });

  it('renders dark mode palette and hides empty nearby species carousel', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    render(
      <SpeciesScreen
        data={createData({ nearbySpecies: [] })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    expect(screen.queryByText('Nearby Species')).toBeNull();
  });

  it('hides observation map section when taxonId is not provided', async () => {
    render(
      <SpeciesScreen
        data={createData({ taxonId: 0 })}
      />,
    );

    expect(screen.queryByText('Observation Map')).toBeNull();

    await waitForSpeciesEffectsToSettle(false);

    expect(mockFetchSpeciesOccurrences).not.toHaveBeenCalled();
  });

  it('renders map and filters when color scheme is light', async () => {
    mockUseColorScheme.mockReturnValue('light');
    render(<SpeciesScreen data={createData()} />);

    await waitForSpeciesEffectsToSettle();

    expect(screen.getByText('Observation Map')).toBeTruthy();
    expect(screen.getByText('Filter Observations by Location')).toBeTruthy();
  });

  it('renders independent observation and heatmap toggles above the map', async () => {
    render(
      <SpeciesScreen
        data={createData({
          heatmap: {
            imageSource: { uri: 'heatmap' },
            liveAvailable: true,
            liveTileUrl: 'https://tiles.example.test/species/{z}/{x}/{y}.png',
            liveModelId: 'taxon_13579_gbt_20260313T000000Z',
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    expect(screen.getByText('Show observations')).toBeTruthy();
    expect(screen.getByText('Show predictive heatmap')).toBeTruthy();
    expect(screen.getByText('Map markers: shown')).toBeTruthy();
    expect(
      screen.getByText('Map heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png'),
    ).toBeTruthy();
    expect(screen.queryByText('Heat Map')).toBeNull();

    fireEvent.press(screen.getByRole('switch', { name: 'Show observations' }));

    await waitFor(() => {
      expect(screen.getByText('Map markers: hidden')).toBeTruthy();
    });

    fireEvent.press(screen.getByRole('switch', { name: 'Show predictive heatmap' }));

    await waitFor(() => {
      expect(screen.getByText('Map heatmap: none')).toBeTruthy();
    });
  });

  it('shows a disabled heatmap toggle instead of a separate fallback section when no live overlay exists', async () => {
    render(<SpeciesScreen data={createData()} />);

    await waitForSpeciesEffectsToSettle();

    expect(screen.getByText('Show observations')).toBeTruthy();
    expect(screen.getByText('Show predictive heatmap')).toBeTruthy();
    expect(
      screen.getByText('Live heatmap overlay is unavailable for this model right now.'),
    ).toBeTruthy();
    expect(screen.queryByText('Heat Map')).toBeNull();
  });

  it('updates map query when users change location filters', async () => {
    mockFetchSpeciesLocations.mockImplementation(async (_query, level, parent) => {
      if (level === 'country') {
        return [{ gid: 'country-us', name: 'United States', level: 0, hierarchy: ['Region'] }];
      }
      if (level === 'state' && parent === 'United States') {
        return [{ gid: 'state-ut', name: 'Utah', level: 1, hierarchy: ['Region', 'United States'] }];
      }
      return [];
    });

    mockFetchSpeciesOccurrences.mockImplementation(async (_taxonId, options) => {
      if (!options?.location || options.location === 'country-us' || options.location === 'state-ut') {
        return [{ catalogNumber: 'ok', latitude: 1, longitude: 2 }];
      }

      return [];
    });

    render(<SpeciesScreen data={createData()} />);

    await waitFor(() => {
      expect(screen.getByTestId('select-Country-option-country-us')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('select-Country-option-country-us'));

    await waitFor(() => {
      expect(mockFetchSpeciesOccurrences).toHaveBeenCalledWith(13579, { location: 'country-us' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-State-option-state-ut')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('select-State-option-state-ut'));

    await waitFor(() => {
      expect(mockFetchSpeciesOccurrences).toHaveBeenCalledWith(13579, { location: 'state-ut' });
    });
  });

  it('shows API error message when occurrence fetch rejects with Error', async () => {
    mockFetchSpeciesOccurrences.mockRejectedValueOnce(new Error('Network down'));

    render(<SpeciesScreen data={createData()} />);

    await waitFor(() => {
      expect(mockFetchSpeciesLocations).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Map error: Network down')).toBeTruthy();
    });
  });

  it('shows fallback error message when occurrence fetch rejects with non-Error value', async () => {
    mockFetchSpeciesOccurrences.mockRejectedValueOnce('bad payload');

    render(<SpeciesScreen data={createData()} />);

    await waitFor(() => {
      expect(mockFetchSpeciesLocations).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Map error: Failed to load observations.')).toBeTruthy();
    });
  });

  it('renders plain overview description when no parsed sections are available', async () => {
    render(
      <SpeciesScreen
        data={createData({
          overview: {
            description: '   ',
            imageSource: { uri: 'test-image' },
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.queryByText('Summary')).toBeNull();
  });

  it('renders attribution and opens iNaturalist link when references are provided', async () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true);
    render(
      <SpeciesScreen
        data={createData({
          overview: {
            description: 'A sample species used for testing.',
            imageSource: { uri: 'test-image' },
            imageCreator: 'A Photographer',
            imageLicense: 'CC-BY',
            imageReferences: '/observations/12345',
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    expect(screen.getByText('Photo by A Photographer')).toBeTruthy();
    expect(screen.getByText('CC-BY')).toBeTruthy();
    fireEvent.press(screen.getByText('View on iNaturalist'));
    expect(openUrlSpy).toHaveBeenCalledWith('https://www.inaturalist.org/observations/12345');
    openUrlSpy.mockRestore();
  });

  it('uses absolute image reference URLs without rewriting them', async () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true);
    render(
      <SpeciesScreen
        data={createData({
          overview: {
            description: 'A sample species used for testing.',
            imageSource: { uri: 'test-image' },
            imageReferences: 'https://www.inaturalist.org/observations/999',
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    fireEvent.press(screen.getByText('View on iNaturalist'));
    expect(openUrlSpy).toHaveBeenCalledWith('https://www.inaturalist.org/observations/999');
    openUrlSpy.mockRestore();
  });

  it('ignores overview lines with empty bodies', async () => {
    render(
      <SpeciesScreen
        data={createData({
          overview: {
            description: 'Summary: A sample species used for testing.',
            sections: [
              {
                id: 'summary',
                title: 'Summary',
                lines: [
                  { body: 'Visible line' },
                  { body: '   ' },
                  { prefix: 'Test:', body: '   ' },
                ],
              },
            ],
            imageSource: { uri: 'test-image' },
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    expect(screen.getByText('Visible line')).toBeTruthy();
  });

});
