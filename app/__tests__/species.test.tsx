import { fetchSpeciesLocations, fetchSpeciesOccurrences } from '@/data/api';
import { Size } from '@/constants/theme';
import * as LayoutChromeModule from '@/context/LayoutChromeContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as ReactNative from 'react-native';
import SpeciesScreen, {
  calculateObservationMapHeight,
  LOCATION_SEARCH_LIMIT,
  shouldRenderObservationMapFrame,
  type SpeciesScreenData,
} from '../_species';

const mockPush = jest.fn();

jest.mock('@/data/api', () => ({
  fetchSpeciesLocations: jest.fn(),
  fetchSpeciesOccurrences: jest.fn(),
  fetchEnvironmentVariables: jest.fn(),
  fetchSpeciesEnvironment: jest.fn(),
  fetchEnvironmentRangeSlice: jest.fn(),
  fetchSpeciesEnvironmentCategorySamples: jest.fn(),
  fetchDataSources: jest.fn(() => Promise.resolve({})),
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
          <Text
            testID={`select-${label}-value`}
          >{`Selected: ${value || 'none'}`}</Text>
          <Text testID={`select-${label}-status`}>
            {disabled ? 'Disabled' : 'Enabled'}
          </Text>
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
  const { Pressable, View, Text } = ReactNative;
  return {
    SpeciesOccurrenceMap: ({
      occurrences,
      loading,
      error,
      height,
      heatmapTileUrl,
      onHeatmapStatusChange,
      showMarkers,
      selectedPoint,
      onPinObservation,
    }: {
      occurrences: unknown[];
      loading?: boolean;
      error?: string | null;
      height?: number;
      heatmapTileUrl?: string | null;
      onHeatmapStatusChange?: (message: {
        type: string;
        status: 'ok' | 'unavailable';
        tileUrl?: string | null;
      }) => void;
      showMarkers?: boolean;
      selectedPoint?: { lat: number; lon: number } | null;
      onPinObservation?: (
        catalogNumber: string,
        lat: number,
        lon: number,
      ) => void;
    }) => (
      <View>
        <Text>{`Map loading: ${loading ? 'yes' : 'no'}`}</Text>
        <Text>{`Map occurrences: ${occurrences.length}`}</Text>
        <Text>{`Map error: ${error ?? 'none'}`}</Text>
        <Text>{`Map height: ${typeof height === 'number' ? height : 'none'}`}</Text>
        <Text>{`Map markers: ${showMarkers === false ? 'hidden' : 'shown'}`}</Text>
        <Text>{`Map tile heatmap: ${heatmapTileUrl ?? 'none'}`}</Text>
        <Text>{`Map selected point: ${selectedPoint ? `${selectedPoint.lat},${selectedPoint.lon}` : 'none'}`}</Text>
        <Pressable
          testID='mock-map-heatmap-unavailable'
          onPress={() =>
            onHeatmapStatusChange?.({
              type: 'heatmap_status',
              status: 'unavailable',
              tileUrl: heatmapTileUrl,
            })
          }
        >
          <Text>Heatmap unavailable</Text>
        </Pressable>
        <Pressable
          testID='mock-map-pin-observation'
          onPress={() => onPinObservation?.('obs-1', 10, 20)}
        >
          <Text>Pin observation</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock('@/components/inputs/SwitchField', () => {
  const ReactNative = jest.requireActual('react-native');
  const { Pressable, Text, View } = ReactNative;

  return {
    SwitchField: ({
      accessibilityLabel,
      description,
      disabled,
      label,
      onValueChange,
      value,
    }: {
      accessibilityLabel?: string;
      description?: string;
      disabled?: boolean;
      label?: string;
      onValueChange?: (nextValue: boolean) => void;
      value?: boolean;
    }) => (
      <View>
        <Pressable
          accessibilityRole='switch'
          accessibilityLabel={accessibilityLabel ?? label ?? 'Switch field'}
          accessibilityState={{
            checked: Boolean(value),
            disabled: Boolean(disabled),
          }}
          disabled={disabled}
          onPress={() => onValueChange?.(!value)}
        >
          <Text>{label}</Text>
        </Pressable>
        {description ? <Text>{description}</Text> : null}
      </View>
    ),
  };
});

jest.mock(
  '@/components/sections/speciesEnvironment/SpeciesEnvironmentSection',
  () => {
    const ReactNative = jest.requireActual('react-native');
    const { Text, View } = ReactNative;

    return {
      SpeciesEnvironmentSection: () => (
        <View>
          <Text>Species Environment</Text>
        </View>
      ),
    };
  },
);

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockFetchSpeciesLocations = fetchSpeciesLocations as jest.MockedFunction<
  typeof fetchSpeciesLocations
>;
const mockFetchSpeciesOccurrences =
  fetchSpeciesOccurrences as jest.MockedFunction<
    typeof fetchSpeciesOccurrences
  >;
const useLayoutChromeSpy = jest.spyOn(LayoutChromeModule, 'useLayoutChrome');
const useWindowDimensionsSpy = jest.spyOn(ReactNative, 'useWindowDimensions');
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  'OS',
);
const originalPlatformOS = Platform.OS;

const setPlatformOS = (os: string) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
};

const restorePlatformOS = () => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    return;
  }

  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatformOS,
  });
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  restorePlatformOS();
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
  useLayoutChromeSpy.mockReturnValue({
    webHeaderHeight: 0,
    setWebHeaderHeight: jest.fn(),
  });
  useWindowDimensionsSpy.mockReturnValue({
    width: 1280,
    height: 1000,
    scale: 1,
    fontScale: 1,
  });
});

const createData = (
  overrides: Partial<SpeciesScreenData> = {},
): SpeciesScreenData => ({
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
    imageSource: null as any,
    inferenceAvailable: true,
    inferenceTileUrl: 'https://tiles.example.test/species/{z}/{x}/{y}.png',
    classicAvailable: true,
    classicTileUrl:
      'https://tiles.example.test/species/classic/{z}/{x}/{y}.png',
    classicModelId: 'taxon_13579_gbt_20260313T000000Z',
    phenologyAvailable: true,
    fullAvailable: true,
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
    expect(screen.getByText('Map loading: no')).toBeTruthy();
  });

  await flushMicrotasks();
};

describe('Species screen', () => {
  beforeEach(() => {
    setPlatformOS('ios');
    useLayoutChromeSpy.mockReturnValue({
      webHeaderHeight: 0,
      setWebHeaderHeight: jest.fn(),
    });
    useWindowDimensionsSpy.mockReturnValue({
      width: 1280,
      height: 1000,
      scale: 1,
      fontScale: 1,
    });
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
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      fireEvent.press(screen.getByText('Download'));
      expect(alertSpy).toHaveBeenCalledWith(
        'Download started',
        expect.any(String),
      );
    } finally {
      alertSpy.mockRestore();
    }
  });

  it('renders independent observation and heatmap toggles above the map', async () => {
    render(
      <SpeciesScreen
        data={createData({
          heatmap: {
            imageSource: { uri: 'heatmap' },
            inferenceAvailable: true,
            inferenceTileUrl:
              'https://tiles.example.test/species/{z}/{x}/{y}.png',
            classicAvailable: true,
            classicTileUrl:
              'https://tiles.example.test/species/classic/{z}/{x}/{y}.png',
            classicModelId: 'taxon_13579_gbt_20260313T000000Z',
            fullAvailable: true,
            phenologyAvailable: true,
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    expect(screen.getByText('Show observations')).toBeTruthy();
    expect(screen.getByText('Show predictive heatmap')).toBeTruthy();
    expect(screen.getByText('Map markers: shown')).toBeTruthy();
    expect(screen.getByText('Map tile heatmap: none')).toBeTruthy();

    fireEvent.press(screen.getByRole('switch', { name: 'Show observations' }));

    await waitFor(() => {
      expect(screen.getByText('Map markers: hidden')).toBeTruthy();
    });

    fireEvent.press(
      screen.getByRole('switch', { name: 'Show predictive heatmap' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?forecast_hours=0',
        ),
      ).toBeTruthy();
    });

    expect(screen.getByText('Weather inputs')).toBeTruthy();
    expect(screen.getByText('Heatmap source')).toBeTruthy();
    fireEvent.press(screen.getByText('Classic'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/classic/{z}/{x}/{y}.png?forecast_hours=0&model_id=taxon_13579_gbt_20260313T000000Z&apply_phenology=true&phenology_only=false',
        ),
      ).toBeTruthy();
    });

    expect(screen.getByText('Weather inputs')).toBeTruthy();
    expect(screen.getByText('Classic overlay')).toBeTruthy();
  });

  it('updates classic predictive heatmap query options across weather and model selections', async () => {
    render(<SpeciesScreen data={createData()} />);

    await waitForSpeciesEffectsToSettle();

    fireEvent.press(
      screen.getByRole('switch', { name: 'Show predictive heatmap' }),
    );
    fireEvent.press(screen.getByText('Classic'));

    await waitFor(() => {
      expect(screen.getByText('Weather inputs')).toBeTruthy();
      expect(screen.getByText('Classic overlay')).toBeTruthy();
      expect(screen.getByLabelText('Current')).toBeTruthy();
      expect(screen.getByLabelText('Forecast +8h')).toBeTruthy();
      expect(screen.getByLabelText('Habitat + season')).toBeTruthy();
      expect(screen.getByLabelText('Season only')).toBeTruthy();
      expect(
        screen.getByText(
          'Current and forecast use weather-aware layers in the classic model.',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Forecast +8h'));
    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/classic/{z}/{x}/{y}.png?forecast_hours=8&model_id=taxon_13579_gbt_20260313T000000Z&apply_phenology=true&phenology_only=false',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Habitat'));
    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/classic/{z}/{x}/{y}.png?forecast_hours=8&model_id=taxon_13579_gbt_20260313T000000Z&apply_phenology=false&phenology_only=false',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Season only'));
    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/classic/{z}/{x}/{y}.png?forecast_hours=8&model_id=taxon_13579_gbt_20260313T000000Z&apply_phenology=true&phenology_only=true',
        ),
      ).toBeTruthy();
    });
  });

  it('updates inference predictive heatmap query options across weather selections', async () => {
    render(<SpeciesScreen data={createData()} />);

    await waitForSpeciesEffectsToSettle();

    fireEvent.press(
      screen.getByRole('switch', { name: 'Show predictive heatmap' }),
    );

    await waitFor(() => {
      expect(screen.getByText('Weather inputs')).toBeTruthy();
      expect(screen.getByLabelText('Off')).toBeTruthy();
      expect(screen.getByLabelText('Current')).toBeTruthy();
      expect(screen.getByLabelText('Forecast +8h')).toBeTruthy();
      expect(
        screen.getByText('Current uses live weather inputs.'),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?forecast_hours=0',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Off'));

    await waitFor(() => {
      expect(
        screen.getByText('Off removes weather inputs entirely.'),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?temporal_mode=missing',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Current'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?forecast_hours=0',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Forecast +8h'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?forecast_hours=8',
        ),
      ).toBeTruthy();
    });
  });

  it('normalizes experimental off to current when switching to classic', async () => {
    render(<SpeciesScreen data={createData()} />);

    await waitForSpeciesEffectsToSettle();

    fireEvent.press(
      screen.getByRole('switch', { name: 'Show predictive heatmap' }),
    );

    fireEvent.press(screen.getByLabelText('Off'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?temporal_mode=missing',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Classic'));

    await waitFor(() => {
      expect(screen.queryByLabelText('Off')).toBeNull();
      expect(
        screen.getByText(
          'Current and forecast use weather-aware layers in the classic model.',
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/classic/{z}/{x}/{y}.png?forecast_hours=0&model_id=taxon_13579_gbt_20260313T000000Z&apply_phenology=true&phenology_only=false',
        ),
      ).toBeTruthy();
    });
  });

  it('merges weather-window params into existing inference tile queries without duplicating forecast_hours', async () => {
    render(
      <SpeciesScreen
        data={createData({
          heatmap: {
            imageSource: null as any,
            inferenceAvailable: true,
            inferenceTileUrl:
              'https://tiles.example.test/species/{z}/{x}/{y}.png?foo=bar&forecast_hours=999',
            classicAvailable: false,
            classicTileUrl: null,
            classicModelId: null,
            phenologyAvailable: false,
            fullAvailable: false,
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    fireEvent.press(
      screen.getByRole('switch', { name: 'Show predictive heatmap' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?foo=bar&forecast_hours=0',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Off'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?foo=bar&temporal_mode=missing',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Current'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?foo=bar&forecast_hours=0',
        ),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Forecast +8h'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?foo=bar&forecast_hours=8',
        ),
      ).toBeTruthy();
    });
  });

  it('falls back from classic to inference when classic tiles disappear after selection', async () => {
    const { rerender } = render(<SpeciesScreen data={createData()} />);

    await waitForSpeciesEffectsToSettle();

    fireEvent.press(
      screen.getByRole('switch', { name: 'Show predictive heatmap' }),
    );
    fireEvent.press(screen.getByText('Classic'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/classic/{z}/{x}/{y}.png?forecast_hours=0&model_id=taxon_13579_gbt_20260313T000000Z&apply_phenology=true&phenology_only=false',
        ),
      ).toBeTruthy();
    });

    rerender(
      <SpeciesScreen
        data={createData({
          heatmap: {
            imageSource: { uri: 'heatmap' },
            inferenceAvailable: true,
            inferenceTileUrl:
              'https://tiles.example.test/species/{z}/{x}/{y}.png',
            classicAvailable: false,
            classicTileUrl: null,
            classicModelId: null,
            fullAvailable: true,
            phenologyAvailable: true,
          },
        })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('switch', { name: 'Show predictive heatmap' }),
      ).toBeTruthy();
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?forecast_hours=0',
        ),
      ).toBeTruthy();
    });

    expect(screen.queryByText('Heatmap source')).toBeNull();
    expect(screen.getByText('Weather inputs')).toBeTruthy();
  });

  it('falls back from inference to classic when inference tiles disappear after selection', async () => {
    const { rerender } = render(<SpeciesScreen data={createData()} />);

    await waitForSpeciesEffectsToSettle();

    fireEvent.press(
      screen.getByRole('switch', { name: 'Show predictive heatmap' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/{z}/{x}/{y}.png?forecast_hours=0',
        ),
      ).toBeTruthy();
    });

    rerender(
      <SpeciesScreen
        data={createData({
          heatmap: {
            imageSource: { uri: 'heatmap' },
            inferenceAvailable: false,
            inferenceTileUrl: null,
            classicAvailable: true,
            classicTileUrl:
              'https://tiles.example.test/species/classic/{z}/{x}/{y}.png',
            classicModelId: 'taxon_13579_gbt_20260313T000000Z',
            fullAvailable: true,
            phenologyAvailable: true,
          },
        })}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Map tile heatmap: https://tiles.example.test/species/classic/{z}/{x}/{y}.png?forecast_hours=0&model_id=taxon_13579_gbt_20260313T000000Z&apply_phenology=true&phenology_only=false',
        ),
      ).toBeTruthy();
    });

    expect(screen.queryByText('Heatmap source')).toBeNull();
    expect(screen.getByText('Weather inputs')).toBeTruthy();
    expect(screen.getByText('Classic overlay')).toBeTruthy();
  });

  it('builds a classic tile URL without model_id when none is available', async () => {
    render(
      <SpeciesScreen
        data={createData({
          heatmap: {
            imageSource: { uri: 'heatmap' },
            inferenceAvailable: false,
            inferenceTileUrl: null,
            classicAvailable: true,
            classicTileUrl:
              'https://tiles.example.test/species/classic/{z}/{x}/{y}.png',
            classicModelId: null,
            fullAvailable: true,
            phenologyAvailable: true,
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    fireEvent.press(
      screen.getByRole('switch', { name: 'Show predictive heatmap' }),
    );

    expect(
      await screen.findByText(
        'Map tile heatmap: https://tiles.example.test/species/classic/{z}/{x}/{y}.png?forecast_hours=0&apply_phenology=true&phenology_only=false',
      ),
    ).toBeTruthy();
  });

  it('shows the unavailable-live-overlay message when only a static heatmap exists', async () => {
    render(
      <SpeciesScreen
        data={createData({
          heatmap: {
            imageSource: { uri: 'heatmap' },
            inferenceAvailable: false,
            inferenceTileUrl: null,
            classicAvailable: false,
            classicTileUrl: null,
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    expect(
      screen.getByText(
        'Predictive heatmap tiles are unavailable for this species right now.',
      ),
    ).toBeTruthy();
  });

  it('shows a predictive heatmap warning when the active overlay repeatedly fails', async () => {
    render(<SpeciesScreen data={createData()} />);

    await waitForSpeciesEffectsToSettle();

    fireEvent.press(
      screen.getByRole('switch', { name: 'Show predictive heatmap' }),
    );
    fireEvent.press(screen.getByTestId('mock-map-heatmap-unavailable'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Predictive heatmap tiles are timing out or failing to load right now. You can keep browsing observations while the overlay recovers.',
        ),
      ).toBeTruthy();
    });
  });

  it('shows the no-heatmap message when neither live nor static heatmap data exists', async () => {
    render(
      <SpeciesScreen
        data={createData({
          heatmap: {
            imageSource: null as any,
            inferenceAvailable: false,
            inferenceTileUrl: null,
            classicAvailable: false,
            classicTileUrl: null,
          },
        })}
      />,
    );

    await waitForSpeciesEffectsToSettle();

    expect(
      screen.getByText('No heatmap is available for this species right now.'),
    ).toBeTruthy();
  });

  it('falls back to sample data when no data prop is provided', async () => {
    render(<SpeciesScreen />);

    await waitForSpeciesEffectsToSettle();

    expect(screen.getAllByText('Mountain Ball Cactus').length).toBeGreaterThan(
      0,
    );
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
    render(<SpeciesScreen data={createData({ commonNames: [] })} />);

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

    expect(screen.queryByText('Map height: none')).toBeNull();
  });

  it('calculates native map height from viewport minus app chrome and safe areas', () => {
    expect(
      calculateObservationMapHeight({
        breakpoint: 'phone',
        platform: 'ios',
        safeAreaBottom: 16,
        safeAreaTop: 24,
        viewportHeight: 1000,
      }),
    ).toBe(
      Math.round(
        (1000 - Size.bar.height.short - Size.bar.height.tall - 24 - 16) * 0.75,
      ),
    );
  });

  it('calculates web map height from viewport minus header only', () => {
    expect(
      calculateObservationMapHeight({
        breakpoint: 'desktop',
        measuredWebHeaderHeight: 112,
        platform: 'web',
        safeAreaBottom: 0,
        safeAreaTop: 20,
        viewportHeight: 1000,
      }),
    ).toBe(Math.round((1000 - 112) * 0.75));
  });

  it('falls back to token-based web header height before runtime measurement is available on web', () => {
    expect(
      calculateObservationMapHeight({
        breakpoint: 'desktop',
        platform: 'web',
        safeAreaBottom: 0,
        safeAreaTop: 20,
        viewportHeight: 1000,
      }),
    ).toBe(
      Math.round((1000 - (Size.space['1600'] + Size.space['200'] * 2)) * 0.75),
    );
  });

  it('holds web map render until the header height has been measured', () => {
    expect(
      shouldRenderObservationMapFrame({
        measuredWebHeaderHeight: 0,
        platform: 'web',
      }),
    ).toBe(false);

    expect(
      shouldRenderObservationMapFrame({
        measuredWebHeaderHeight: 112,
        platform: 'web',
      }),
    ).toBe(true);

    expect(
      shouldRenderObservationMapFrame({
        measuredWebHeaderHeight: 0,
        platform: 'ios',
      }),
    ).toBe(true);
  });

  it('renders dark mode palette and hides empty nearby species carousel', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    render(<SpeciesScreen data={createData({ nearbySpecies: [] })} />);

    await waitForSpeciesEffectsToSettle();

    expect(screen.queryByText('Nearby Species')).toBeNull();
  });

  it('hides observation map section when taxonId is not provided', async () => {
    render(<SpeciesScreen data={createData({ taxonId: 0 })} />);

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

  it('updates map query when users change location filters', async () => {
    mockFetchSpeciesLocations.mockImplementation(
      async (_query, level, parent) => {
        if (level === 'country') {
          return [
            {
              gid: 'country-us',
              name: 'United States',
              level: 0,
              hierarchy: ['Region'],
            },
          ];
        }
        if (level === 'state' && parent === 'United States') {
          return [
            {
              gid: 'state-ut',
              name: 'Utah',
              level: 1,
              hierarchy: ['Region', 'United States'],
            },
          ];
        }
        return [];
      },
    );

    mockFetchSpeciesOccurrences.mockImplementation(
      async (_taxonId, options) => {
        if (
          !options?.location ||
          options.location === 'country-us' ||
          options.location === 'state-ut'
        ) {
          return [{ catalogNumber: 'ok', latitude: 1, longitude: 2 }];
        }

        return [];
      },
    );

    render(<SpeciesScreen data={createData()} />);

    await waitFor(() => {
      expect(
        screen.getByTestId('select-Country-option-country-us'),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('select-Country-option-country-us'));

    await waitFor(() => {
      expect(mockFetchSpeciesOccurrences).toHaveBeenCalledWith(13579, {
        location: 'country-us',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-State-option-state-ut')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('select-State-option-state-ut'));

    await waitFor(() => {
      expect(mockFetchSpeciesOccurrences).toHaveBeenCalledWith(13579, {
        location: 'state-ut',
      });
    });
  });

  it('shows API error message when occurrence fetch rejects with Error', async () => {
    mockFetchSpeciesOccurrences.mockRejectedValueOnce(
      new Error('Network down'),
    );

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
      expect(
        screen.getByText('Map error: Failed to load observations.'),
      ).toBeTruthy();
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
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValueOnce(true);
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
    expect(openUrlSpy).toHaveBeenCalledWith(
      'https://www.inaturalist.org/observations/12345',
    );
    openUrlSpy.mockRestore();
  });

  it('uses absolute image reference URLs without rewriting them', async () => {
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValueOnce(true);
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
    expect(openUrlSpy).toHaveBeenCalledWith(
      'https://www.inaturalist.org/observations/999',
    );
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
