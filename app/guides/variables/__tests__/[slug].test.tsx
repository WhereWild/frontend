// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import VariableGuideScreen from '../[slug]';

let mockSlug: string | undefined = 'bio1';
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/guides/variables/bio1',
  useLocalSearchParams: () => ({ slug: mockSlug }),
}));

jest.mock('expo-router/head', () => {
  const React = jest.requireActual('react');
  function Head({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  return Head;
});

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ breakpoint: 'desktop', textWidth: 720 }),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

let mockSettings = {
  units: 'metric',
  colormap: 'viridis',
  cbMode: null as string | null,
};
jest.mock('@/context/SettingsContext', () => ({
  useSettings: () => mockSettings,
}));

const mockGetCbColor = jest.fn(
  (
    _variableId: string,
    _classId: number,
    cbMode: string | null,
    fallback: string,
  ) => (cbMode ? `CB:${cbMode}` : fallback),
);
const mockGetCbShape = jest.fn(
  (_variableId: string, classId: number) => `shape-${classId}`,
);
jest.mock('@/components/sections/speciesOccurrenceMap/cbColors', () => ({
  getCbColor: (...args: [string, number, string | null, string]) =>
    mockGetCbColor(...args),
  getCbShape: (...args: [string, number]) => mockGetCbShape(...args),
}));

jest.mock('@/components/sections/speciesOccurrenceMap/ShapeMarker', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    ShapeMarker: ({ shape, color }: { shape: string; color: string }) =>
      React.createElement(Text, null, `${shape}:${color}`),
  };
});

const mockFetchEnvironmentVariables = jest.fn();
jest.mock('@/data/api', () => ({
  fetchEnvironmentVariables: (...args: unknown[]) =>
    mockFetchEnvironmentVariables(...args),
}));

jest.mock('@/hooks/useDataSources', () => ({
  useDataSources: () => ({
    chelsa_v2_1: {
      name: 'CHELSA v2.1',
      url: 'https://chelsa-climate.org/',
      license: 'CC0 1.0',
      references: [],
    },
  }),
}));

jest.mock('@/content/guides/variables/index', () => ({
  VARIABLE_GUIDES: {
    bio1: 'Annual mean temperature explained in depth.',
    landcover:
      '# Landcover\n\nLandcover overview.\n\n## Rainfed cropland\n\nCropland that relies on rainfall rather than irrigation.\n\n## Forest\n',
  },
}));

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  const { Markdown } = jest.requireActual('@/components/markdown/Markdown');

  return {
    PageScrollContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    PageTitle: ({ title }: { title: string }) =>
      React.createElement(Text, null, title),
    ThemedText: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) => React.createElement(Text, { onPress }, children),
    Markdown,
  };
});

describe('VariableGuideScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSlug = 'bio1';
    mockSettings = { units: 'metric', colormap: 'viridis', cbMode: null };
    mockGetCbColor.mockImplementation(
      (
        _variableId: string,
        _classId: number,
        cbMode: string | null,
        fallback: string,
      ) => (cbMode ? `CB:${cbMode}` : fallback),
    );
  });

  it('renders the hand-written guide when one exists for the slug', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'bio1',
        name: 'Annual Mean Temperature',
        units: '°C',
        category: 'bioclimate',
        sourceIds: ['chelsa_v2_1'],
        renderMin: -53.55,
        renderMax: 34.75,
        legendClasses: null,
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(
        screen.getByText('Annual mean temperature explained in depth.'),
      ).toBeTruthy(),
    );

    expect(screen.getByText('°C')).toBeTruthy();
    expect(screen.getByText('CHELSA v2.1')).toBeTruthy();
  });

  it('shows the API ID and links the variable type to its types guide', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'bio1',
        name: 'Annual Mean Temperature',
        valueType: 'ratio',
        units: '°C',
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() => expect(screen.getByText('bio1')).toBeTruthy());
    expect(screen.getByText('Ratio')).toBeTruthy();

    fireEvent.press(screen.getByText('Ratio'));
    expect(mockPush).toHaveBeenCalledWith('/guides/variables/types/ratio');
  });

  it('prefers the precise rawValueType over the bucketed valueType for display and linking', async () => {
    mockSlug = 'landcover';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'landcover',
        name: 'Landcover',
        valueType: 'categorical',
        rawValueType: 'nominal',
        category: 'terrain',
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() => expect(screen.getByText('Nominal')).toBeTruthy());
    expect(screen.queryByText('Categorical')).toBeNull();

    fireEvent.press(screen.getByText('Nominal'));
    expect(mockPush).toHaveBeenCalledWith('/guides/variables/types/nominal');
  });

  it('shows the domain when the backend reports one', async () => {
    mockSlug = 'landcover';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'landcover',
        name: 'Landcover',
        domain: 'categorical',
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() => expect(screen.getByText('Domain')).toBeTruthy());
    expect(screen.getByText('Categorical')).toBeTruthy();
  });

  it('shows an id template with the actual windows for a temporal family, not just one variant', async () => {
    mockSlug = 'weather_code_simple';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'weather_code_simple_mode_1h',
        name: 'Weather Code (Mode, 1h)',
        valueType: 'nominal',
      },
      {
        id: 'weather_code_simple_mode_24h',
        name: 'Weather Code (Mode, 24h)',
        valueType: 'nominal',
      },
      {
        id: 'weather_code_simple_mode_168h',
        name: 'Weather Code (Mode, 168h)',
        valueType: 'nominal',
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(
        screen.getByText(
          'weather_code_simple_mode_{window}h (windows: 1, 24, 168)',
        ),
      ).toBeTruthy(),
    );
  });

  it('lists the real ids for a grouped family with no shared id template', async () => {
    mockSlug = 'vpd';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'vpdmin',
        name: 'VPD (Min)',
        group: 'vpd',
        agg: 'min',
        groupLabel: 'Vapor Pressure Deficit',
      },
      {
        id: 'vpdmean',
        name: 'VPD (Mean)',
        group: 'vpd',
        agg: 'mean',
        groupLabel: 'Vapor Pressure Deficit',
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(screen.getByText('vpdmin, vpdmean')).toBeTruthy(),
    );
  });

  it('shows the variable type as plain text when it is not a known type key', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio1', name: 'Annual Mean Temperature', valueType: 'weird' },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() => expect(screen.getByText('Weird')).toBeTruthy());
    fireEvent.press(screen.getByText('Weird'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("fetches variables in the user's selected unit system", async () => {
    mockSettings = { units: 'imperial', colormap: 'viridis', cbMode: null };
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio1', name: 'Annual Mean Temperature', units: '°F' },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(mockFetchEnvironmentVariables).toHaveBeenCalledWith({
        units: 'imperial',
      }),
    );
    await waitFor(() => expect(screen.getByText('°F')).toBeTruthy());
  });

  it('falls back to "More coming soon." when no guide exists for the slug', async () => {
    mockSlug = 'elevation';
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'elevation', name: 'Elevation', units: 'm', category: 'terrain' },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(screen.getByText('More coming soon.')).toBeTruthy(),
    );
  });

  it('shows a not-found message when the slug matches no variable', async () => {
    mockSlug = 'nonexistent';
    mockFetchEnvironmentVariables.mockResolvedValue([]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(screen.getByText("We couldn't find that variable.")).toBeTruthy(),
    );
  });

  it('renders legend classes for categorical variables', async () => {
    mockSlug = 'landcover';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'landcover',
        name: 'Landcover',
        category: 'terrain',
        legendClasses: [{ id: 10, name: 'Rainfed cropland', color: '#FFFF64' }],
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(screen.getByText('Rainfed cropland')).toBeTruthy(),
    );
  });

  it("merges a class heading's written prose into that class's swatch row instead of listing it separately", async () => {
    mockSlug = 'landcover';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'landcover',
        name: 'Landcover',
        category: 'terrain',
        legendClasses: [
          { id: 10, name: 'Rainfed cropland', color: '#FFFF64' },
          { id: 20, name: 'Forest', color: '#00FF00' },
        ],
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(screen.getByText('Landcover overview.')).toBeTruthy(),
    );
    expect(
      screen.getByText(
        'Cropland that relies on rainfall rather than irrigation.',
      ),
    ).toBeTruthy();
    // "Rainfed cropland" should appear exactly once — as the swatch row's
    // label — not a second time as a bare heading up in the intro.
    expect(screen.getAllByText('Rainfed cropland')).toHaveLength(1);
  });

  it('links an axis member to its sibling axes and the classifier', async () => {
    mockSlug = 'clay';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'clay',
        name: 'Clay Content (0–5cm)',
        valueType: 'ratio',
        compositionGroup: 'soil_texture',
        compositionAxis: 'top',
        compositionLabel: 'Clay',
      },
      {
        id: 'sand',
        name: 'Sand Content (0–5cm)',
        valueType: 'ratio',
        compositionGroup: 'soil_texture',
        compositionAxis: 'bottom_left',
        compositionLabel: 'Sand',
      },
      {
        id: 'silt',
        name: 'Silt Content (0–5cm)',
        valueType: 'ratio',
        compositionGroup: 'soil_texture',
        compositionAxis: 'bottom_right',
        compositionLabel: 'Silt',
      },
      {
        id: 'soil_texture',
        name: 'Soil Texture',
        valueType: 'nominal',
        compositionGroup: 'soil_texture',
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(
        screen.getByText('Part of the Soil Texture composition, alongside:'),
      ).toBeTruthy(),
    );
    expect(screen.getByText('Sand')).toBeTruthy();
    expect(screen.getByText('Silt')).toBeTruthy();
    expect(screen.getByText('Soil Texture')).toBeTruthy();

    fireEvent.press(screen.getByText('Sand'));
    expect(mockPush).toHaveBeenCalledWith('/guides/variables/sand');
  });

  it('shows a "Secondary type" row linking to the compositional guide for any variable with a compositionGroup', async () => {
    mockSlug = 'clay';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'clay',
        name: 'Clay Content (0–5cm)',
        valueType: 'ratio',
        compositionGroup: 'soil_texture',
        compositionAxis: 'top',
        compositionLabel: 'Clay',
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(screen.getByText('Secondary type')).toBeTruthy(),
    );
    expect(screen.getByText('Compositional')).toBeTruthy();

    fireEvent.press(screen.getByText('Compositional'));
    expect(mockPush).toHaveBeenCalledWith('/guides/compositional');
  });

  it('omits the "Secondary type" row for a variable with no compositionGroup', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      { id: 'bio1', name: 'Annual Mean Temperature', valueType: 'ratio' },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() => expect(screen.getByText('bio1')).toBeTruthy());
    expect(screen.queryByText('Secondary type')).toBeNull();
  });

  it('links the classifier to its composition members', async () => {
    mockSlug = 'soil_texture';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'clay',
        name: 'Clay Content (0–5cm)',
        valueType: 'ratio',
        compositionGroup: 'soil_texture',
        compositionAxis: 'top',
        compositionLabel: 'Clay',
      },
      {
        id: 'soil_texture',
        name: 'Soil Texture',
        valueType: 'nominal',
        compositionGroup: 'soil_texture',
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(screen.getByText('Classifies the composition of:')).toBeTruthy(),
    );
    expect(screen.getByText('Clay')).toBeTruthy();
  });

  it('uses the catalog color for a nominal variable when no cb mode is active', async () => {
    mockSlug = 'kg2';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'kg2',
        name: 'Köppen-Geiger',
        valueType: 'nominal',
        legendClasses: [{ id: 1, name: 'Tropical', color: '#0000FF' }],
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(mockGetCbColor).toHaveBeenCalledWith('kg2', 1, null, '#0000FF'),
    );
    expect(screen.getByTestId('legend-swatch-1').props.style).toContainEqual(
      expect.objectContaining({ backgroundColor: '#0000FF' }),
    );
  });

  it('routes a nominal variable through the colorblind palette when cb mode is active', async () => {
    mockSlug = 'kg2';
    mockSettings = {
      units: 'metric',
      colormap: 'viridis',
      cbMode: 'colorblind',
    };
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'kg2',
        name: 'Köppen-Geiger',
        valueType: 'nominal',
        legendClasses: [{ id: 1, name: 'Tropical', color: '#0000FF' }],
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(mockGetCbColor).toHaveBeenCalledWith(
        'kg2',
        1,
        'colorblind',
        '#0000FF',
      ),
    );
  });

  it('colorizes ordinal variables with the colormap instead of gray, even without a catalog color', async () => {
    mockSlug = 'sreg';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'sreg',
        name: 'Snow Regime',
        valueType: 'ordinal',
        legendClasses: [{ id: 2, name: 'Maritime', color: null }],
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(mockGetCbColor).toHaveBeenCalledWith(
        'sreg',
        2,
        'viridis',
        '#888888',
      ),
    );
  });

  it('renders shape markers instead of color swatches in achromatopsia mode', async () => {
    mockSlug = 'kg2';
    mockSettings = {
      units: 'metric',
      colormap: 'viridis',
      cbMode: 'achromatopsia',
    };
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'kg2',
        name: 'Köppen-Geiger',
        valueType: 'nominal',
        legendClasses: [{ id: 1, name: 'Tropical', color: '#0000FF' }],
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() => expect(mockGetCbShape).toHaveBeenCalledWith('kg2', 1));
    expect(screen.getByText('shape-1:CB:achromatopsia')).toBeTruthy();
  });

  it('renders plain color swatches when not in achromatopsia mode', async () => {
    mockSlug = 'kg2';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'kg2',
        name: 'Köppen-Geiger',
        valueType: 'nominal',
        legendClasses: [{ id: 1, name: 'Tropical', color: '#0000FF' }],
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() =>
      expect(screen.getByTestId('legend-swatch-1')).toBeTruthy(),
    );
    expect(mockGetCbShape).not.toHaveBeenCalled();
  });

  it('omits "Global range" for categorical and circular variables', async () => {
    mockSlug = 'aspect';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'aspect',
        name: 'Aspect',
        valueType: 'circular',
        units: '°',
        renderMin: 0,
        renderMax: 360,
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() => expect(screen.getByText('°')).toBeTruthy());
    expect(screen.queryByText('Global range')).toBeNull();
  });

  it('shows "Global range" for continuous variables, using "to" instead of a dash', async () => {
    mockSlug = 'bio1';
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'bio1',
        name: 'Annual Mean Temperature',
        valueType: 'continuous',
        units: '°F',
        renderMin: -64.4,
        renderMax: 94.6,
      },
    ]);

    render(<VariableGuideScreen />);

    await waitFor(() => expect(screen.getByText('Global range')).toBeTruthy());
    expect(screen.getByText('-64.4 to 94.6 °F')).toBeTruthy();
  });
});
