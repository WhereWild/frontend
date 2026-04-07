import { fetchEnvironmentVariables } from '@/data/api';
import { Colors, Shadows, Time, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import About from '../about';

const mockPush = jest.fn();
let mockPathname: '/' | '/about' = '/';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
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
}));

jest.mock('@/components', () => {
  const actual = jest.requireActual('@/components');
  const mockReact = jest.requireActual('react');
  const { Pressable: MockPressable, Text: MockText, View: MockView } = jest.requireActual('react-native');

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
        mockReact.createElement(MockText, { testID: `select-value-${controlLabel}` }, value ?? 'none'),
        mockReact.createElement(
          MockPressable,
          { accessibilityLabel: controlLabel, onPress: () => onValueChange?.(nextValue) },
          mockReact.createElement(MockText, null, `Change ${controlLabel}`),
        ),
      );
    },
    SpeciesOccurrenceMap: ({ heatmapTileUrl }: { heatmapTileUrl?: string | null }) =>
      mockReact.createElement(
        MockView,
        { testID: 'species-occurrence-map-mock' },
        mockReact.createElement(MockText, { testID: 'species-occurrence-map-url' }, heatmapTileUrl ?? 'none'),
      ),
  };
});

jest.mock('@/components/sections/speciesEnvironment/VariableSelectorHeader', () => {
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
    }: {
      headingText?: string;
      metaText?: string;
      onCategoryChange?: (value: string) => void;
      onVariableChange?: (value: string) => void;
      selectedVariable?: string;
      selectedVariableCategory?: string | null;
    }) => (
      <View>
        <Text>{headingText}</Text>
        <Text>{metaText}</Text>
        <Text testID="selected-variable">{selectedVariable ?? 'none'}</Text>
        <Text testID="selected-variable-category">{selectedVariableCategory ?? 'none'}</Text>
        <Pressable
          testID="select-live-weather"
          onPress={() => {
            onCategoryChange?.('Live Weather');
            onVariableChange?.('wind_speed');
          }}
        >
          <Text>Select Live Weather</Text>
        </Pressable>
        <Pressable
          testID="select-landcover"
          onPress={() => {
            onCategoryChange?.('Categorical');
            onVariableChange?.('landcover');
          }}
        >
          <Text>Select Land Cover</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock('@/components/sections/speciesEnvironment/useEnvironmentVariableSelection', () => {
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
      const resolvedVariables = variables?.length ? variables : [{
        id: variableId,
        label: variableId,
        category: 'Categorical',
        valueType: null,
      }];
      const categories = Array.from(
        new Set(resolvedVariables.map((variable) => variable.category ?? 'Other')),
      );
      const initialSelectedCategory = categories.includes('Categorical') ? 'Categorical' : categories[0] ?? null;
      const [selectedVariableCategory, setSelectedVariableCategory] = React.useState(initialSelectedCategory);
      const [selectedVariable, setSelectedVariable] = React.useState(variableId);
      const filteredVariables = resolvedVariables.filter(
        (variable) => !selectedVariableCategory || (variable.category ?? 'Other') === selectedVariableCategory,
      );
      const selectedVariableMeta = resolvedVariables.find((variable) => variable.id === selectedVariable)
        ?? filteredVariables[0]
        ?? null;

      return {
        categories,
        selectedVariableCategory,
        setSelectedVariableCategory,
        filteredVariables,
        selectedVariable,
        setSelectedVariable,
        selectedVariableMeta,
      };
    },
  };
});

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockFetchEnvironmentVariables = fetchEnvironmentVariables as jest.MockedFunction<
  typeof fetchEnvironmentVariables
>;

const TYPOGRAPHY_SAMPLE_TEXT = 'Sphinx of black quartz, judge my vow.';
const EXPECTED_TYPOGRAPHY_LABELS = [
  'Title Hero',
  'Title Page',
  'Subtitle',
  'Heading',
  'Subheading',
  'Body',
  'Body Emphasis',
  'Body Strong',
  'Body Small',
  'Body Small Emphasis',
  'Body Small Strong',
  'Body Small Link',
  'Body Tiny',
  'Body Tiny Strong',
  'Link',
  'Code',
  'Single Line Body',
  'Single Line Body Small',
  'Single Line Body Small Strong',
  'Single Line Body Tiny',
  'Single Line Body Tiny Strong',
] as const;

describe('About screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPush.mockClear();
    mockPathname = '/';
    mockFetchEnvironmentVariables.mockResolvedValue([] as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the species component preview with sample data', () => {
    render(<About />);

    expect(screen.queryByText('Developer Tools')).toBeNull();

    expect(screen.getByText('Species Page Components')).toBeTruthy();
    expect(screen.getByText('Variable Tile Map')).toBeTruthy();
    expect(
      screen.getByText('Preview of the composable building blocks used on the species detail page.'),
    ).toBeTruthy();
    expect(screen.getByText('Mountain Ball Cactus')).toBeTruthy();
    expect(screen.getByText('Pediocactus simpsonii')).toBeTruthy();
    expect(screen.getByText('Nearby Species')).toBeTruthy();
  });

  it('updates the playground search status text when typing and clearing', () => {
    render(<About />);

    const speciesSearchInput = screen.getAllByLabelText('Search species')[0];
    fireEvent.changeText(speciesSearchInput, 'pinyon');
    expect(screen.getByText('Query changed: pinyon')).toBeTruthy();

    const clearSpeciesSearch = screen.getByLabelText('Clear search');
    fireEvent.press(clearSpeciesSearch);
    expect(screen.getByText('Search cleared')).toBeTruthy();
  });

  it('records submission events for the playground search input', () => {
    render(<About />);

    const speciesSearchInput = screen.getAllByLabelText('Search species')[0];
    fireEvent.changeText(speciesSearchInput, 'sage');
    fireEvent(speciesSearchInput, 'submitEditing', { nativeEvent: { text: 'sage' } });

    expect(screen.getByText('Search submitted with "sage"')).toBeTruthy();
  });

  it('renders previews for typography, shadow, and time token examples', () => {
    render(<About />);

    const typographyVariantCount = Object.keys(Typography.light).length;
    expect(EXPECTED_TYPOGRAPHY_LABELS).toHaveLength(typographyVariantCount);
    const typographySamples = screen.getAllByTestId('typography-sample');
    expect(typographySamples).toHaveLength(typographyVariantCount);
    typographySamples.forEach((sample, index) => {
      const scoped = within(sample);
      expect(scoped.getByText(EXPECTED_TYPOGRAPHY_LABELS[index])).toBeTruthy();
      expect(scoped.getByText(TYPOGRAPHY_SAMPLE_TEXT)).toBeTruthy();
    });
    expect(screen.getAllByTestId('shadow-sample')).toHaveLength(Object.keys(Shadows).length);

    expect(screen.getByText('Time + Easing Tokens')).toBeTruthy();
    expect(screen.getByText('Duration \\ Easing')).toBeTruthy();
    expect(screen.getAllByTestId('time-duration-header')).toHaveLength(Object.keys(Time.duration).length);
    expect(screen.getAllByTestId('time-easing-header')).toHaveLength(Object.keys(Time.easing).length);
    expect(screen.getAllByTestId('time-motion-preview-cell')).toHaveLength(
      Object.keys(Time.duration).length * Object.keys(Time.easing).length,
    );
  });

  it('does not trigger navigation from local About screen content', () => {
    mockPathname = '/about';
    render(<About />);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('applies light mode background color when overridden to be light', () => {
    mockUseColorScheme.mockReturnValue('light');
    const tree = render(<About />).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected About to render a single root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(Colors.light.background.default.default);
  });

  it('switches through each tab showcase and renders the matching pill section', () => {
    render(<About />);

    fireEvent.press(screen.getByText('Habitat & Range'));
    expect(screen.getByText('Vertical list')).toBeTruthy();

    fireEvent.press(screen.getByText('Tracking and Sightings'));
    expect(screen.getByText('Mixed label lengths')).toBeTruthy();

    fireEvent.press(screen.getByText('Images'));
    expect(screen.getByText('Image categories')).toBeTruthy();

    fireEvent.press(screen.getByText('Field Notes'));
    expect(screen.getByText('Notes sections')).toBeTruthy();

    fireEvent.press(screen.getByText('Overview'));
    expect(screen.getByText('Horizontal wrap')).toBeTruthy();
  });

  it('shows live weather controls and updates the tile url for weather windows and forecasts', async () => {
    mockFetchEnvironmentVariables.mockResolvedValueOnce([
      {
        id: 'temporal-only',
        name: 'Temporal Only',
        category: 'Temporal',
        valueType: 'continuous',
      },
      {
        id: 'recent-weather-only',
        name: 'Recent Weather Only',
        category: 'Recent Weather',
        valueType: 'continuous',
      },
      {
        id: 'wind_speed',
        name: 'Wind Speed',
        category: 'Live Weather',
        valueType: 'continuous',
      },
      {
        id: 'landcover',
        name: 'Land Cover',
        category: 'Categorical',
        valueType: 'categorical',
      },
    ] as any);

    render(<About />);

    expect(screen.getByTestId('species-occurrence-map-url').props.children).toContain(
      '/api/variables/',
    );
    expect(screen.queryByText('Aggregation window')).toBeNull();
    expect(screen.queryByText('Forecast offset')).toBeNull();

    fireEvent.press(screen.getByTestId('select-live-weather'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-variable-category').props.children).toBe('Live Weather');
    });
    expect(screen.getByText('Aggregation window')).toBeTruthy();
    expect(screen.getByText('Forecast offset')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Aggregation window'));
    expect(screen.getByTestId('species-occurrence-map-url').props.children).toContain('&window=1h');
    expect(screen.getByTestId('species-occurrence-map-url').props.children).not.toContain('&forecast=');

    fireEvent.press(screen.getByLabelText('Forecast offset'));
    expect(screen.getByTestId('species-occurrence-map-url').props.children).toContain('&forecast=1h');

    fireEvent.press(screen.getByTestId('select-landcover'));
    await waitFor(() => {
      expect(screen.getByTestId('selected-variable').props.children).toBe('landcover');
    });
    expect(screen.queryByText('Aggregation window')).toBeNull();
    expect(screen.queryByText('Forecast offset')).toBeNull();
    expect(screen.getByTestId('species-occurrence-map-url').props.children).toContain(
      '/api/variables/landcover/tiles/{z}/{x}/{y}.png',
    );
    expect(screen.getByTestId('species-occurrence-map-url').props.children).not.toContain('&window=');
    expect(screen.getByTestId('species-occurrence-map-url').props.children).not.toContain('&forecast=');
  });
});
