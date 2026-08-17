// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fetchEnvironmentVariables } from '@/data/api';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import Maps from '../maps';

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ breakpoint: 'desktop' }),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/data/api', () => ({
  BACKEND_BASE: 'https://api.example.test',
  fetchEnvironmentVariables: jest.fn(async () => []),
  fetchDataSources: jest.fn(async () => ({})),
}));

jest.mock('@/components', () => {
  const actual = jest.requireActual('@/components');
  const mockReact = jest.requireActual('react');
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = jest.requireActual('react-native');

  return {
    ...actual,
    SelectField: ({
      label,
      options = [],
      placeholder,
      value,
      onValueChange,
    }: {
      label?: string;
      options?: { label: string; value: string }[];
      placeholder?: string;
      value?: string;
      onValueChange?: (nextValue: string) => void;
    }) => {
      const controlLabel = label ?? placeholder ?? 'Select';
      const nextValue = options[1]?.value ?? options[0]?.value ?? '';
      return mockReact.createElement(
        MockView,
        null,
        mockReact.createElement(MockText, null, controlLabel),
        mockReact.createElement(
          MockText,
          { testID: `select-value-${controlLabel}` },
          value ?? 'none',
        ),
        mockReact.createElement(
          MockPressable,
          {
            accessibilityLabel: controlLabel,
            onPress: () => onValueChange?.(nextValue),
          },
          mockReact.createElement(MockText, null, `Change ${controlLabel}`),
        ),
      );
    },
    SpeciesOccurrenceMap: ({
      heatmapTileUrl,
      onTileClasses,
      onBoundsChange,
      renderMin,
      renderMax,
      autoAdaptApplicable,
      autoAdaptEnabled,
      onToggleAutoAdapt,
    }: {
      heatmapTileUrl?: string | null;
      onTileClasses?: (classes: { id: number; count: number }[]) => void;
      onBoundsChange?: (bounds: {
        z: number;
        x0: number;
        y0: number;
        x1: number;
        y1: number;
      }) => void;
      renderMin?: number | null;
      renderMax?: number | null;
      autoAdaptApplicable?: boolean;
      autoAdaptEnabled?: boolean;
      onToggleAutoAdapt?: () => void;
    }) => {
      mockReact.useEffect(() => {
        onTileClasses?.([
          { id: 1, count: 5 },
          { id: 2, count: 3 },
        ]);
      }, [onTileClasses]);
      return mockReact.createElement(
        MockView,
        { testID: 'species-occurrence-map-mock' },
        mockReact.createElement(
          MockText,
          { testID: 'species-occurrence-map-url' },
          heatmapTileUrl ?? 'none',
        ),
        mockReact.createElement(
          MockText,
          { testID: 'species-occurrence-map-render-range' },
          `${renderMin ?? 'null'},${renderMax ?? 'null'}`,
        ),
        mockReact.createElement(MockPressable, {
          testID: 'trigger-bounds-change',
          onPress: () => onBoundsChange?.({ z: 4, x0: 2, y0: 3, x1: 3, y1: 4 }),
        }),
        mockReact.createElement(
          MockText,
          { testID: 'species-occurrence-map-auto-adapt-state' },
          `${autoAdaptApplicable ? 'applicable' : 'not-applicable'},${autoAdaptEnabled ? 'enabled' : 'disabled'}`,
        ),
        mockReact.createElement(MockPressable, {
          testID: 'trigger-toggle-auto-adapt',
          onPress: () => onToggleAutoAdapt?.(),
        }),
      );
    },
  };
});

jest.mock(
  '@/components/sections/speciesEnvironment/VariableSelectorHeader',
  () => {
    const React = jest.requireActual('react');
    const { Pressable, Text, View } = jest.requireActual('react-native');

    return {
      VariableSelectorHeader: ({
        headingText,
        metaText,
        onCategoryChange,
        onVariableChange,
        selectedVariable,
        selectedVariableCategory,
        forecastOptions,
        selectedForecast,
        onForecastChange,
      }: {
        headingText?: string;
        metaText?: string;
        onCategoryChange?: (value: string) => void;
        onVariableChange?: (value: string) => void;
        selectedVariable?: string;
        selectedVariableCategory?: string | null;
        forecastOptions?: { value: string; label: string }[];
        selectedForecast?: string;
        onForecastChange?: (value: string) => void;
      }) => (
        <View>
          <Text>{headingText}</Text>
          <Text>{metaText}</Text>
          <Text testID='selected-variable'>{selectedVariable ?? 'none'}</Text>
          <Text testID='selected-variable-category'>
            {selectedVariableCategory ?? 'none'}
          </Text>
          {forecastOptions &&
            forecastOptions.length > 0 &&
            onForecastChange && (
              <Pressable
                accessibilityLabel='Forecast offset'
                onPress={() =>
                  onForecastChange(
                    forecastOptions[1]?.value ??
                      forecastOptions[0]?.value ??
                      '',
                  )
                }
              >
                <Text>Forecast offset</Text>
              </Pressable>
            )}
          <Pressable
            testID='select-recent-weather'
            onPress={() => {
              onCategoryChange?.('Recent Weather');
              onVariableChange?.('wind_speed');
            }}
          >
            <Text>Select Recent Weather</Text>
          </Pressable>
          <Pressable
            testID='select-landcover'
            onPress={() => {
              onCategoryChange?.('Categorical');
              onVariableChange?.('landcover');
            }}
          >
            <Text>Select Land Cover</Text>
          </Pressable>
          <Pressable
            testID='select-aspect'
            onPress={() => {
              onCategoryChange?.('Terrain');
              onVariableChange?.('aspect');
            }}
          >
            <Text>Select Aspect</Text>
          </Pressable>
          <Pressable
            testID='select-bio1'
            onPress={() => {
              onCategoryChange?.('Bioclim');
              onVariableChange?.('bio_1');
            }}
          >
            <Text>Select Bio 1</Text>
          </Pressable>
        </View>
      ),
    };
  },
);

jest.mock(
  '@/components/sections/speciesEnvironment/useEnvironmentVariableSelection',
  () => {
    const React = jest.requireActual('react');

    return {
      useEnvironmentVariableSelection: ({
        variableId,
        variables,
      }: {
        variableId: string;
        variables: {
          id: string;
          label: string;
          category?: string | null;
          units?: string | null;
          valueType?: string | null;
        }[];
      }) => {
        const resolvedVariables = variables?.length
          ? variables
          : [
              {
                id: variableId,
                label: variableId,
                category: 'Categorical',
                valueType: null,
              },
            ];
        const categories = Array.from(
          new Set(
            resolvedVariables.map((variable) => variable.category ?? 'Other'),
          ),
        );
        const initialSelectedCategory = categories.includes('Categorical')
          ? 'Categorical'
          : (categories[0] ?? null);
        const [selectedVariableCategory, setSelectedVariableCategory] =
          React.useState(initialSelectedCategory);
        const [selectedVariable, setSelectedVariable] =
          React.useState(variableId);
        const filteredVariables = resolvedVariables.filter(
          (variable) =>
            !selectedVariableCategory ||
            (variable.category ?? 'Other') === selectedVariableCategory,
        );
        const selectedVariableMeta =
          resolvedVariables.find(
            (variable) => variable.id === selectedVariable,
          ) ??
          filteredVariables[0] ??
          null;

        return {
          categories,
          selectedVariableCategory,
          setSelectedVariableCategory,
          filteredVariables,
          allVariables: resolvedVariables,
          selectedVariable,
          setSelectedVariable,
          selectedVariableMeta,
        };
      },
    };
  },
);

const mockFetchEnvironmentVariables =
  fetchEnvironmentVariables as jest.MockedFunction<
    typeof fetchEnvironmentVariables
  >;

describe('Maps screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchEnvironmentVariables.mockReturnValue(
      new Promise(() => undefined) as any,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows recent weather controls and updates the tile url for forecasts', async () => {
    mockFetchEnvironmentVariables.mockResolvedValueOnce([
      {
        id: 'wind_speed_avg_24h',
        name: 'Wind Speed',
        category: 'Recent Weather',
        valueType: 'continuous',
      },
      {
        id: 'landcover',
        name: 'Land Cover',
        category: 'Categorical',
        valueType: 'categorical',
      },
    ] as any);

    render(<Maps />);

    expect(
      screen.getByTestId('species-occurrence-map-url').props.children,
    ).toContain('/api/variables/');
    expect(screen.queryByText('Forecast offset')).toBeNull();

    fireEvent.press(screen.getByTestId('select-recent-weather'));

    await waitFor(() => {
      expect(
        screen.getByTestId('selected-variable-category').props.children,
      ).toBe('Recent Weather');
    });
    expect(screen.getByText('Forecast offset')).toBeTruthy();

    expect(
      screen.getByTestId('species-occurrence-map-url').props.children,
    ).toContain('/api/variables/wind_speed/tiles/');
    expect(
      screen.getByTestId('species-occurrence-map-url').props.children,
    ).not.toContain('&forecast_h=');

    // pressing Forecast offset picks options[1] → '+1 hour' → forecast_h=1
    fireEvent.press(screen.getByLabelText('Forecast offset'));
    expect(
      screen.getByTestId('species-occurrence-map-url').props.children,
    ).toContain('&forecast_h=1');

    fireEvent.press(screen.getByTestId('select-landcover'));
    await waitFor(() => {
      expect(screen.getByTestId('selected-variable').props.children).toBe(
        'landcover',
      );
    });
    expect(screen.queryByText('Forecast offset')).toBeNull();
    expect(
      screen.getByTestId('species-occurrence-map-url').props.children,
    ).toContain('/api/variables/landcover/tiles/{z}/{x}/{y}.png');
    expect(
      screen.getByTestId('species-occurrence-map-url').props.children,
    ).not.toContain('&forecast_h=');
  });

  it('switches to circular colormap when a circular variable is selected', async () => {
    mockFetchEnvironmentVariables.mockResolvedValueOnce([
      {
        id: 'aspect',
        name: 'Aspect',
        category: 'Terrain',
        valueType: 'circular',
      },
      {
        id: 'landcover',
        name: 'Land Cover',
        category: 'Categorical',
        valueType: 'categorical',
      },
    ] as any);

    render(<Maps />);

    await waitFor(() => {
      expect(
        screen.getByTestId('selected-variable').props.children,
      ).toBeDefined();
    });

    fireEvent.press(screen.getByTestId('select-aspect'));

    await waitFor(() => {
      expect(
        screen.getByTestId('species-occurrence-map-url').props.children,
      ).toContain('twilight_90');
    });
  });

  it('renders gradient legend for continuous variable with renderMin/renderMax', async () => {
    mockFetchEnvironmentVariables.mockResolvedValueOnce([
      {
        id: 'bio_1',
        name: 'Annual Mean Temperature',
        category: 'Bioclim',
        valueType: 'continuous',
        renderMin: -5,
        renderMax: 30,
        units: '°C',
      },
      {
        id: 'landcover',
        name: 'Land Cover',
        category: 'Categorical',
        valueType: 'categorical',
      },
    ] as any);

    render(<Maps />);

    await waitFor(() => {
      expect(
        screen.getByTestId('selected-variable').props.children,
      ).toBeDefined();
    });

    fireEvent.press(screen.getByTestId('select-bio1'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-variable').props.children).toBe(
        'bio_1',
      );
    });

    expect(
      screen.getByTestId('species-occurrence-map-url').props.children,
    ).toContain('/api/variables/bio_1/');
  });

  it('auto-adapt: off by default; discovers a range via tile-range/stats only once toggled on, and never applies before the fetch resolves', async () => {
    mockFetchEnvironmentVariables.mockResolvedValueOnce([
      {
        id: 'bio_1',
        name: 'Annual Mean Temperature',
        category: 'Bioclim',
        valueType: 'continuous',
        renderMin: -5,
        renderMax: 30,
        units: '°C',
      },
      {
        id: 'landcover',
        name: 'Land Cover',
        category: 'Categorical',
        valueType: 'categorical',
      },
    ] as any);

    const originalFetch = global.fetch;
    const fetchMock = jest.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/tile-range/stats')) {
        return { ok: true, json: async () => ({ min: 10, max: 20 }) } as any;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as any;

    render(<Maps />);
    fireEvent.press(screen.getByTestId('select-bio1'));
    await waitFor(() => {
      expect(screen.getByTestId('selected-variable').props.children).toBe(
        'bio_1',
      );
    });

    // Off by default: knowing the viewport bounds alone doesn't trigger a
    // stats fetch or change the legend range.
    fireEvent.press(screen.getByTestId('trigger-bounds-change'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('species-occurrence-map-render-range').props.children,
    ).toBe('-5,30');
    expect(
      screen.getByTestId('species-occurrence-map-url').props.children,
    ).not.toContain('render_range=');

    expect(
      screen.getByTestId('species-occurrence-map-auto-adapt-state').props
        .children,
    ).toBe('applicable,disabled');

    fireEvent.press(screen.getByTestId('trigger-toggle-auto-adapt'));
    // Bounds are already known, so the toggle alone schedules the debounced
    // stats fetch — the legend must stay on the catalog range right up
    // until it actually resolves (no intermediate/default-range flash).
    expect(
      screen.getByTestId('species-occurrence-map-render-range').props.children,
    ).toBe('-5,30');

    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      '/api/layers/bio_1/tile-range/stats',
    );
    await waitFor(() => {
      expect(
        screen.getByTestId('species-occurrence-map-render-range').props
          .children,
      ).toBe('10,20');
    });
    expect(
      screen.getByTestId('species-occurrence-map-url').props.children,
    ).toContain(`render_range=${encodeURIComponent('[10,20]')}`);

    global.fetch = originalFetch;
  });

  it('auto-adapt: button is absent for categorical/circular variables', async () => {
    mockFetchEnvironmentVariables.mockResolvedValueOnce([
      {
        id: 'aspect',
        name: 'Aspect',
        category: 'Terrain',
        valueType: 'circular',
      },
      {
        id: 'landcover',
        name: 'Land Cover',
        category: 'Categorical',
        valueType: 'categorical',
      },
    ] as any);

    render(<Maps />);
    expect(
      screen.getByTestId('species-occurrence-map-auto-adapt-state').props
        .children,
    ).toBe('not-applicable,disabled');

    fireEvent.press(screen.getByTestId('select-aspect'));
    await waitFor(() => {
      expect(
        screen.getByTestId('species-occurrence-map-url').props.children,
      ).toContain('twilight_90');
    });
    expect(
      screen.getByTestId('species-occurrence-map-auto-adapt-state').props
        .children,
    ).toBe('not-applicable,disabled');
  });

  it('renders categorical legend after tile classes are reported', async () => {
    mockFetchEnvironmentVariables.mockResolvedValueOnce([
      {
        id: 'landcover',
        name: 'Land Cover',
        category: 'Categorical',
        valueType: 'categorical',
        legendClasses: [
          { id: 1, name: 'Forest', color: '#228B22' },
          { id: 2, name: 'Water', color: '#4169E1' },
        ],
      },
    ] as any);

    render(<Maps />);

    await waitFor(() => {
      expect(
        screen.getByTestId('species-occurrence-map-url').props.children,
      ).toContain('landcover');
    });
  });
});
