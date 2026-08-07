// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BACKEND_BASE } from '@/data/api';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDataSources } from '@/hooks/useDataSources';
import { useResponsive } from '@/hooks/useResponsive';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking, Platform, StyleSheet, ViewStyle } from 'react-native';
import MapScreen from '../map';

const mockUseNativeHomeTabs = jest.fn();
const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/map',
}));

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/hooks/useDataSources', () => ({
  useDataSources: jest.fn(() => ({})),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({})),
}));

jest.mock('@/constants/responsiveStyles', () => ({
  getResponsiveContentContainerStyle: jest.fn(() => undefined),
  getResponsiveGapStyle: jest.fn(() => undefined),
}));

jest.mock('@/data/api', () => ({
  fetchSpeciesWithModels: jest.fn(() => Promise.resolve([])),
  fetchViewportScores: jest.fn(() =>
    Promise.resolve({ scores: {}, reasons: {} }),
  ),
  fetchDataSources: jest.fn(() => Promise.resolve({})),
  BACKEND_BASE: 'https://api.test',
}));

jest.mock('@/context/NativeHomeTabsContext', () => ({
  useNativeHomeTabs: () => mockUseNativeHomeTabs(),
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  const { WeatherAttribution } = jest.requireActual(
    '@/components/sections/WeatherAttribution',
  );

  return {
    ActiveNearYouSection: ({
      recommendations,
      allRecommendations,
      loading,
      style,
    }: {
      recommendations: {
        taxonId: number;
        commonName: string;
        scientificName: string;
        description: string;
      }[];
      allRecommendations: { taxonId: number }[];
      loading?: boolean;
      style?: unknown;
    }) => (
      <View testID='active-near-you-section' style={style}>
        <Text>Active Near You</Text>
        <Text testID='loading-state'>{loading ? 'loading' : 'idle'}</Text>
        <Text testID='all-count'>{String(allRecommendations.length)}</Text>
        {recommendations.map((species) => (
          <View key={species.taxonId}>
            <Text>{species.commonName}</Text>
            <Text>{species.scientificName}</Text>
            {species.description ? <Text>{species.description}</Text> : null}
          </View>
        ))}
      </View>
    ),
    HomeRecommendationFilter: ({
      activeGroup,
      loading,
      onGroupChange,
    }: {
      activeGroup: string;
      loading?: boolean;
      onGroupChange?: (group: string) => void;
    }) => (
      <View>
        <Text testID='shared-filter-group'>{activeGroup}</Text>
        <Text testID='shared-filter-loading'>
          {loading ? 'loading' : 'idle'}
        </Text>
        <Pressable
          testID='shared-filter-plants'
          onPress={() => onGroupChange?.('plants')}
        >
          <Text>Shared Plants</Text>
        </Pressable>
        <Pressable
          testID='shared-filter-all'
          onPress={() => onGroupChange?.('all')}
        >
          <Text>Shared All</Text>
        </Pressable>
      </View>
    ),
    WeatherAttribution,
    PageTitle: ({
      title,
      button,
      iconButton,
    }: {
      title: string;
      button?: { label?: string; onPress?: () => void };
      iconButton?: { accessibilityLabel?: string; onPress?: () => void };
    }) => (
      <View>
        <Text testID='page-title'>{title}</Text>
        {iconButton ? (
          <Pressable
            testID='page-title-icon-button'
            onPress={iconButton.onPress}
          >
            <Text>{iconButton.accessibilityLabel ?? 'icon-button'}</Text>
          </Pressable>
        ) : null}
        {button ? (
          <Pressable testID='page-title-button' onPress={button.onPress}>
            <Text>{button.label ?? 'button'}</Text>
          </Pressable>
        ) : null}
      </View>
    ),
    PageScrollContainer: ({ children }: { children?: React.ReactNode }) => (
      <View>{children}</View>
    ),
    ThemedText: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) => <Text onPress={onPress}>{children}</Text>,
    LocalMapSection: ({
      heatmapTileUrl,
      onBoundsChange,
      style,
    }: {
      heatmapTileUrl?: string | null;
      onBoundsChange?: (bounds: {
        minLon: number;
        minLat: number;
        maxLon: number;
        maxLat: number;
      }) => void;
      style?: unknown;
    }) => (
      <View testID='local-map-section' style={style}>
        <Text>Local Map</Text>
        <Text testID='heatmap-url'>{heatmapTileUrl ?? 'none'}</Text>
        <Pressable
          testID='bounds-primary'
          onPress={() =>
            onBoundsChange?.({
              minLon: -122,
              minLat: 36,
              maxLon: -120,
              maxLat: 38,
            })
          }
        >
          <Text>Primary Bounds</Text>
        </Pressable>
        <Pressable
          testID='bounds-secondary'
          onPress={() =>
            onBoundsChange?.({
              minLon: -110,
              minLat: 32,
              maxLon: -108,
              maxLat: 34,
            })
          }
        >
          <Text>Secondary Bounds</Text>
        </Pressable>
      </View>
    ),
  };
});

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockUseDataSources = useDataSources as jest.MockedFunction<
  typeof useDataSources
>;
const mockUseResponsive = useResponsive as jest.MockedFunction<
  typeof useResponsive
>;
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

const createData = (overrides: Partial<HomePageData> = {}): HomePageData => ({
  map: {
    heatmapImage: { uri: 'heatmap' },
    controlsImage: { uri: 'controls' },
  },
  recommendations: {
    items: [
      {
        taxonId: '101',
        commonName: 'Desert Bloom',
        commonNames: ['Desert Bloom'],
        scientificName: 'Bloomus deserti',
        description: 'Currently flowering',
        imageSource: { uri: 'desert' },
        taxonGroup: 'plants',
      },
      {
        taxonId: '202',
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

const flattenStyle = (style: unknown): ViewStyle =>
  StyleSheet.flatten(style) as ViewStyle;

describe('Map screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setPlatformOS('ios');
    mockUseColorScheme.mockReturnValue('dark');
    mockUseDataSources.mockReturnValue({});
    mockUseResponsive.mockReturnValue({} as ReturnType<typeof useResponsive>);
    mockRedirect.mockReset();
    mockUseNativeHomeTabs.mockReturnValue({
      activeGroup: 'all',
      allScored: createData().recommendations.items,
      handleBoundsChange: jest.fn(),
      heatmapTileUrl: `${BACKEND_BASE}/api/heatmap/homepage/tiles/{z}/{x}/{y}.png?v=1`,
      isFilterVisible: false,
      recommendations: createData().recommendations.items,
      scoresLoading: false,
      setActiveGroup: jest.fn(),
      toggleFilterVisibility: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    restorePlatformOS();
    jest.clearAllMocks();
  });

  it('hides native shared filter controls in the default state', () => {
    setPlatformOS('ios');
    mockUseResponsive.mockReturnValue({
      gap: 24,
      marginHorizontal: 32,
    } as ReturnType<typeof useResponsive>);

    const { UNSAFE_getByProps } = render(<MapScreen data={createData()} />);

    expect(screen.queryByText('Active Near You')).toBeNull();
    expect(
      UNSAFE_getByProps({ testID: 'map-filter-slot' }).props
        .accessibilityElementsHidden,
    ).toBe(true);
    expect(
      flattenStyle(
        UNSAFE_getByProps({ testID: 'native-map-screen-content' }).props.style,
      ).paddingTop,
    ).toBeUndefined();
    expect(
      flattenStyle(UNSAFE_getByProps({ testID: 'map-filter-slot' }).props.style)
        .height,
    ).toBe(0);
    expect(
      UNSAFE_getByProps({ testID: 'weather-attribution-slot' }).props
        .accessibilityElementsHidden,
    ).toBe(true);
    expect(screen.getByTestId('heatmap-url').props.children).toContain(
      `${BACKEND_BASE}/api/heatmap/homepage/tiles/{z}/{x}/{y}.png?v=1`,
    );
  });

  it('shows the native shared filter when visibility is enabled', () => {
    setPlatformOS('ios');
    mockUseResponsive.mockReturnValue({
      gap: 24,
      marginHorizontal: 32,
    } as ReturnType<typeof useResponsive>);
    mockUseNativeHomeTabs.mockReturnValue({
      activeGroup: 'plants',
      allScored: createData().recommendations.items,
      handleBoundsChange: jest.fn(),
      heatmapTileUrl: `${BACKEND_BASE}/api/heatmap/homepage/tiles/{z}/{x}/{y}.png?v=1&group=plants`,
      isFilterVisible: true,
      recommendations: createData().recommendations.items,
      scoresLoading: false,
      setActiveGroup: jest.fn(),
      toggleFilterVisibility: jest.fn(),
    });

    const { UNSAFE_getByProps } = render(<MapScreen data={createData()} />);

    expect(
      UNSAFE_getByProps({ testID: 'map-filter-slot' }).props
        .accessibilityElementsHidden,
    ).toBe(false);
    expect(
      flattenStyle(
        UNSAFE_getByProps({ testID: 'native-map-screen-content' }).props.style,
      ).paddingTop,
    ).toBeUndefined();
    expect(
      flattenStyle(UNSAFE_getByProps({ testID: 'map-filter-slot' }).props.style)
        .paddingTop,
    ).toBe(24);
    expect(
      flattenStyle(
        UNSAFE_getByProps({ testID: 'native-map-content' }).props.style,
      ).marginTop,
    ).toBe(24);
    expect(screen.getByTestId('shared-filter-group').props.children).toBe(
      'plants',
    );
  });

  it('redirects web /map to home', () => {
    setPlatformOS('web');

    render(<MapScreen data={createData()} />);

    expect(mockRedirect).toHaveBeenCalledWith('/');
  });

  it('renders and opens weather citation links when DOI and license URLs are available', async () => {
    const openUrlSpy = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(true as never);
    mockUseDataSources.mockReturnValueOnce({
      open_meteo: {
        name: 'Open-Meteo',
        url: 'https://open-meteo.example/data',
        license: 'CC BY 4.0',
        license_url: 'https://open-meteo.example/license',
        references: [
          {
            authors: 'Open-Meteo Team',
            title: 'Open-Meteo Dataset',
            year: 2024,
            doi: 'https://doi.org/open-meteo',
          },
        ],
      },
      ncep_gfs_open_meteo: {
        name: 'NCEP GFS',
        url: 'https://ncep.example/data',
        license: 'Public Domain',
        license_url: 'https://ncep.example/license',
        references: [
          {
            authors: 'NOAA',
            title: 'GFS Dataset',
            year: 2024,
            doi: 'https://doi.org/ncep-gfs',
          },
        ],
      },
    });

    render(<MapScreen data={createData()} />);

    expect(screen.getByText('Open-Meteo')).toBeTruthy();
    expect(screen.getByText('NCEP GFS')).toBeTruthy();

    fireEvent.press(screen.getByText('Open-Meteo'));
    fireEvent.press(screen.getAllByText('DOI')[0]);
    fireEvent.press(screen.getAllByText('License')[0]);
    fireEvent.press(screen.getByText('NCEP GFS'));
    fireEvent.press(screen.getAllByText('DOI')[1]);
    fireEvent.press(screen.getAllByText('License')[1]);

    expect(openUrlSpy).toHaveBeenNthCalledWith(
      1,
      'https://open-meteo.example/data',
    );
    expect(openUrlSpy).toHaveBeenNthCalledWith(2, 'https://doi.org/open-meteo');
    expect(openUrlSpy).toHaveBeenNthCalledWith(
      3,
      'https://open-meteo.example/license',
    );
    expect(openUrlSpy).toHaveBeenNthCalledWith(4, 'https://ncep.example/data');
    expect(openUrlSpy).toHaveBeenNthCalledWith(5, 'https://doi.org/ncep-gfs');
    expect(openUrlSpy).toHaveBeenNthCalledWith(
      6,
      'https://ncep.example/license',
    );
  });

  it('omits weather DOI and license links when optional citation fields are missing', async () => {
    mockUseDataSources.mockReturnValueOnce({
      open_meteo: {
        name: 'Open-Meteo',
        url: 'https://open-meteo.example/data',
        license: 'CC BY 4.0',
        references: [],
      },
    });

    render(<MapScreen data={createData()} />);

    expect(screen.getByText('Open-Meteo')).toBeTruthy();

    expect(screen.queryByText('NCEP GFS')).toBeNull();
    expect(screen.queryByText('DOI')).toBeNull();
    expect(screen.queryByText('License')).toBeNull();
  });

  it('renders only the available Open-Meteo license link when DOI is missing', () => {
    mockUseDataSources.mockReturnValueOnce({
      open_meteo: {
        name: 'Open-Meteo',
        url: 'https://open-meteo.example/data',
        license: 'CC BY 4.0',
        license_url: 'https://open-meteo.example/license',
        references: [],
      },
    });

    render(<MapScreen data={createData()} />);

    expect(screen.getByText('Open-Meteo')).toBeTruthy();
    expect(screen.queryByText('DOI')).toBeNull();
    expect(screen.getByText('License')).toBeTruthy();
  });

  it('renders only the available NCEP DOI link when license URL is missing', () => {
    mockUseDataSources.mockReturnValueOnce({
      ncep_gfs_open_meteo: {
        name: 'NCEP GFS',
        url: 'https://ncep.example/data',
        license: 'Public Domain',
        references: [
          {
            authors: 'NOAA',
            title: 'GFS Dataset',
            year: 2024,
            doi: 'https://doi.org/ncep-gfs',
          },
        ],
      },
    });

    render(<MapScreen data={createData()} />);

    expect(screen.queryByText('Open-Meteo')).toBeNull();
    expect(screen.getByText('NCEP GFS')).toBeTruthy();
    expect(screen.getByText('DOI')).toBeTruthy();
    expect(screen.queryByText('License')).toBeNull();
  });

  it('renders NCEP without citation links when neither DOI nor license URL is available', () => {
    mockUseDataSources.mockReturnValueOnce({
      ncep_gfs_open_meteo: {
        name: 'NCEP GFS',
        url: 'https://ncep.example/data',
        license: 'Public Domain',
        references: [],
      },
    });

    render(<MapScreen data={createData()} />);

    expect(screen.getByText('NCEP GFS')).toBeTruthy();
    expect(screen.queryByText('DOI')).toBeNull();
    expect(screen.queryByText('License')).toBeNull();
  });
});
