import { Colors } from '@/constants/theme';
import {
  BACKEND_BASE,
  fetchSpeciesWithModels,
  fetchViewportScores,
} from '@/data/api';
import { mockHomePageData } from '@/data/homeSample';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import HomeScreen from '../index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/',
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/data/api', () => ({
  fetchSpeciesWithModels: jest.fn(() => Promise.resolve([])),
  fetchViewportScores: jest.fn(() => Promise.resolve({ scores: {}, reasons: {} })),
  BACKEND_BASE: 'https://api.test',
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');

  return {
    ActiveNearYouSection: ({
      recommendations,
      allRecommendations,
      loading,
      activeGroup,
      onGroupChange,
    }: {
      recommendations: {
        taxonId: number;
        commonName: string;
        scientificName: string;
        description: string;
      }[];
      allRecommendations: { taxonId: number }[];
      loading?: boolean;
      activeGroup?: string;
      onGroupChange?: (group: string) => void;
    }) => (
      <View>
        <Text>Active Near You</Text>
        <Text testID="active-group">{activeGroup ?? 'all'}</Text>
        <Text testID="loading-state">{loading ? 'loading' : 'idle'}</Text>
        <Text testID="all-count">{String(allRecommendations.length)}</Text>
        {recommendations.map((species) => (
          <View key={species.taxonId}>
            <Text>{species.commonName}</Text>
            <Text>{species.scientificName}</Text>
            {species.description ? <Text>{species.description}</Text> : null}
          </View>
        ))}
        <Pressable testID="group-plants" onPress={() => onGroupChange?.('plants')}>
          <Text>Plants</Text>
        </Pressable>
        <Pressable testID="group-all" onPress={() => onGroupChange?.('all')}>
          <Text>All</Text>
        </Pressable>
      </View>
    ),
    LocalMapSection: ({
      heatmapTileUrl,
      onBoundsChange,
    }: {
      heatmapTileUrl?: string | null;
      onBoundsChange?: (bounds: {
        minLon: number; minLat: number; maxLon: number; maxLat: number;
      }) => void;
    }) => (
      <View>
        <Text>Local Map</Text>
        <Text testID="heatmap-url">{heatmapTileUrl ?? 'none'}</Text>
        <Pressable
          testID="bounds-primary"
          onPress={() => onBoundsChange?.({ minLon: -122, minLat: 36, maxLon: -120, maxLat: 38 })}
        >
          <Text>Primary Bounds</Text>
        </Pressable>
        <Pressable
          testID="bounds-secondary"
          onPress={() => onBoundsChange?.({ minLon: -110, minLat: 32, maxLon: -108, maxLat: 34 })}
        >
          <Text>Secondary Bounds</Text>
        </Pressable>
      </View>
    ),
  };
});

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockFetchSpeciesWithModels = fetchSpeciesWithModels as jest.MockedFunction<
  typeof fetchSpeciesWithModels
>;
const mockFetchViewportScores = fetchViewportScores as jest.MockedFunction<
  typeof fetchViewportScores
>;
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
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
        taxonGroup: 'plants',
      },
      {
        taxonId: 202,
        commonName: 'Alpine Falcon',
        commonNames: ['Alpine Falcon'],
        scientificName: 'Falco alpinus',
        description: 'Sighted this week',
        imageSource: { uri: 'falcon' },
        taxonGroup: 'birds',
      },
    ],
  },
  ...overrides,
});

describe('Home screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setPlatformOS('ios');
    mockUseColorScheme.mockReturnValue('dark');
    mockFetchSpeciesWithModels.mockResolvedValue([] as any);
    mockFetchViewportScores.mockResolvedValue({ scores: {}, reasons: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
    restorePlatformOS();
    jest.clearAllMocks();
  });

  it('renders provided recommendation data and default homepage heatmap tiles', () => {
    render(<HomeScreen data={createData()} />);

    expect(screen.getByText('Local Map')).toBeTruthy();
    expect(screen.getByText('Active Near You')).toBeTruthy();
    expect(screen.getByText('Desert Bloom')).toBeTruthy();
    expect(screen.getByText('Bloomus deserti')).toBeTruthy();
    expect(screen.getByText('Alpine Falcon')).toBeTruthy();
    expect(screen.getByText('Falco alpinus')).toBeTruthy();
    expect(screen.getByTestId('heatmap-url').props.children).toContain(
      `${BACKEND_BASE}/api/heatmap/homepage/tiles/{z}/{x}/{y}.png?v=`,
    );
    expect(screen.getByTestId('heatmap-url').props.children).not.toContain('&group=');
  });

  it('falls back to mock data immediately while remote models are still unresolved', () => {
    mockFetchSpeciesWithModels.mockReturnValue(new Promise(() => undefined) as never);

    render(<HomeScreen />);

    expect(screen.getByText(mockHomePageData.recommendations.items[0].commonName)).toBeTruthy();
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

  it('hydrates recommendations from the with-models API when no data prop is supplied', async () => {
    mockFetchSpeciesWithModels.mockResolvedValueOnce([
      {
        taxon_id: 101,
        scientific_name: 'Hydratus firstus',
        common_name: 'Hydrated First',
        common_names: ['Hydrated First'],
        image_source: null,
        taxon_group: 'plants',
      },
    ] as any);

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('Hydrated First')).toBeTruthy();
      expect(screen.getByText('Hydratus firstus')).toBeTruthy();
    });
  });

  it('debounces viewport scoring, pins group representatives, and formats reasons', async () => {
    mockFetchSpeciesWithModels.mockResolvedValueOnce([
      {
        taxon_id: 1,
        scientific_name: 'Planta one',
        common_name: 'Plant One',
        common_names: ['Plant One'],
        image_source: null,
        taxon_group: 'plants',
      },
      {
        taxon_id: 2,
        scientific_name: 'Avis two',
        common_name: 'Bird Two',
        common_names: ['Bird Two'],
        image_source: null,
        taxon_group: 'birds',
      },
      {
        taxon_id: 3,
        scientific_name: 'Animal three',
        common_name: 'Animal Three',
        common_names: ['Animal Three'],
        image_source: null,
        taxon_group: 'animals',
      },
      {
        taxon_id: 4,
        scientific_name: 'Fungus four',
        common_name: 'Fungus Four',
        common_names: ['Fungus Four'],
        image_source: null,
        taxon_group: 'fungi',
      },
      {
        taxon_id: 5,
        scientific_name: 'Bug five',
        common_name: 'Bug Five',
        common_names: ['Bug Five'],
        image_source: null,
        taxon_group: 'arthropods',
      },
      {
        taxon_id: 6,
        scientific_name: 'Extra six',
        common_name: 'Extra Six',
        common_names: ['Extra Six'],
        image_source: null,
        taxon_group: null,
      },
    ] as any);
    mockFetchViewportScores.mockResolvedValueOnce({
      scores: {
        '1': 0.91,
        '2': 0.82,
        '3': 0.78,
        '4': 0.64,
        '5': 0.55,
        '6': 0.44,
      },
      reasons: {
        '1': ['warm slopes', 'dry soils'],
        '6': ['recently suitable'],
      },
    });

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('Plant One')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('bounds-primary'));

    expect(screen.getByTestId('loading-state').props.children).toBe('loading');

    await act(async () => {
      jest.advanceTimersByTime(1199);
    });

    expect(mockFetchViewportScores).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchViewportScores).toHaveBeenCalledWith({
        minLon: -122,
        minLat: 36,
        maxLon: -120,
        maxLat: 38,
      });
    });

    expect(screen.getByText('Warm slopes · Dry soils')).toBeTruthy();
    expect(screen.getByText('Recently suitable')).toBeTruthy();
    expect(screen.getByTestId('all-count').props.children).toBe('6');

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('idle');
    });
  });

  it('cancels the previous debounce request when bounds change again before the timeout', async () => {
    render(<HomeScreen data={createData()} />);

    fireEvent.press(screen.getByTestId('bounds-primary'));
    fireEvent.press(screen.getByTestId('bounds-secondary'));

    await act(async () => {
      jest.advanceTimersByTime(1200);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchViewportScores).toHaveBeenCalledTimes(1);
    });
    expect(mockFetchViewportScores).toHaveBeenCalledWith({
      minLon: -110,
      minLat: 32,
      maxLon: -108,
      maxLat: 34,
    });
  });

  it('keeps scored recommendations when rerendered with equivalent data content', async () => {
    mockFetchViewportScores.mockResolvedValueOnce({
      scores: {
        '101': 0.9,
        '202': 0.4,
      },
      reasons: {
        '101': ['sunny ridges'],
      },
    });

    const initialData = createData();
    const { rerender } = render(<HomeScreen data={initialData} />);

    fireEvent.press(screen.getByTestId('bounds-primary'));

    await act(async () => {
      jest.advanceTimersByTime(1200);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Sunny ridges')).toBeTruthy();
    });

    rerender(<HomeScreen data={createData()} />);

    expect(screen.getByText('Sunny ridges')).toBeTruthy();
  });

  it('updates the heatmap tile url when the active group changes', () => {
    render(<HomeScreen data={createData()} />);

    fireEvent.press(screen.getByTestId('group-plants'));
    expect(screen.getByTestId('active-group').props.children).toBe('plants');
    expect(screen.getByTestId('heatmap-url').props.children).toContain('&group=plants');

    fireEvent.press(screen.getByTestId('group-all'));
    expect(screen.getByTestId('active-group').props.children).toBe('all');
    expect(screen.getByTestId('heatmap-url').props.children).not.toContain('&group=plants');
  });

  it('logs a warning and keeps fallback recommendations when model hydration fails', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetchSpeciesWithModels.mockRejectedValueOnce(new Error('fetch failed'));

    render(<HomeScreen />);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        '[HomeScreen] failed to fetch species with models',
        expect.any(Error),
      );
    });
    expect(screen.getByText(mockHomePageData.recommendations.items[0].commonName)).toBeTruthy();

    warnSpy.mockRestore();
  });

  it('silently ignores viewport score failures and clears the loading state', async () => {
    mockFetchViewportScores.mockRejectedValueOnce(new Error('score failed'));
    render(<HomeScreen data={createData()} />);

    fireEvent.press(screen.getByTestId('bounds-primary'));

    await act(async () => {
      jest.advanceTimersByTime(1200);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('idle');
    });
    expect(screen.getByText('Desert Bloom')).toBeTruthy();
  });
});
