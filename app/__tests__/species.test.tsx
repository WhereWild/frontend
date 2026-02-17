import { Colors } from '@/constants/theme';
import { fetchLocationsByHierarchy, fetchSpeciesOccurrences } from '@/data/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as speciesLocationFiltersModule from '@/hooks/species/useSpeciesLocationFilters';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import SpeciesScreen, { LOCATION_SEARCH_LIMIT, type SpeciesScreenData } from '../_species';

const mockPush = jest.fn();

jest.mock('@/data/api', () => ({
  fetchLocationsByHierarchy: jest.fn(),
  fetchSpeciesOccurrences: jest.fn(),
}));

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
    }: {
      occurrences: unknown[];
      loading?: boolean;
      error?: string | null;
    }) => (
      <View>
        <Text>{`Map loading: ${loading ? 'yes' : 'no'}`}</Text>
        <Text>{`Map occurrences: ${occurrences.length}`}</Text>
        <Text>{`Map error: ${error ?? 'none'}`}</Text>
      </View>
    ),
  };
});

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockFetchLocationsByHierarchy = fetchLocationsByHierarchy as jest.MockedFunction<
  typeof fetchLocationsByHierarchy
>;
const mockFetchSpeciesOccurrences = fetchSpeciesOccurrences as jest.MockedFunction<
  typeof fetchSpeciesOccurrences
>;

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockPush.mockClear();
  mockUseColorScheme.mockReturnValue('dark');
  mockFetchLocationsByHierarchy.mockResolvedValue([]);
  mockFetchSpeciesOccurrences.mockResolvedValue([]);
});

const createData = (overrides: Partial<SpeciesScreenData> = {}): SpeciesScreenData => ({
  taxonId: 13579,
  commonName: 'Test Cactus',
  scientificName: 'Testus cactus',
  overview: {
    description: 'A sample species used for testing.',
    imageSource: { uri: 'test-image' },
  },
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
    expect(mockFetchLocationsByHierarchy).toHaveBeenCalled();
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
    mockFetchLocationsByHierarchy.mockResolvedValue([]);
    mockFetchSpeciesOccurrences.mockResolvedValue([]);
  });

  it('renders species data-driven content and supports download press', async () => {
    const data = createData();
    render(<SpeciesScreen data={data} />);

    await waitForSpeciesEffectsToSettle();

    expect(screen.getByText('Test Cactus')).toBeTruthy();
    expect(screen.getByText('Testus cactus')).toBeTruthy();
    expect(screen.getByText('A sample species used for testing.')).toBeTruthy();
    expect(screen.getByText('Nearby Species')).toBeTruthy();
    expect(screen.getByText('Neighbor')).toBeTruthy();
    expect(screen.getByText('Heat Map')).toBeTruthy();

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

    expect(screen.getByText('Mountain Ball Cactus')).toBeTruthy();
  });

  it('loads occurrence and country options on mount', async () => {
    render(<SpeciesScreen data={createData()} />);

    await waitFor(() => {
      expect(mockFetchSpeciesOccurrences).toHaveBeenCalledWith(13579, {
        location: undefined,
      });
    });

    expect(mockFetchLocationsByHierarchy).toHaveBeenCalledWith(
      '',
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

  it('applies light mode background color when overridden to be light', async () => {
    mockUseColorScheme.mockReturnValue('light');
    const rendered = render(<SpeciesScreen data={createData()} />);

    await waitForSpeciesEffectsToSettle();

    const tree = rendered.toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected SpeciesScreen to render a single root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(Colors.light.background.default.default);
  });

  it('wires location filter values and handlers into SelectField controls', async () => {
    const onCountryChange = jest.fn();
    const onStateChange = jest.fn();
    const onCountyChange = jest.fn();

    const filtersSpy = jest
      .spyOn(speciesLocationFiltersModule, 'useSpeciesLocationFilters')
      .mockReturnValue({
        countryOptions: [{ label: 'United States', value: 'country-us' }],
        stateOptions: [{ label: 'Utah', value: 'state-ut' }],
        countyOptions: [{ label: 'Salt Lake', value: 'county-salt-lake' }],
        countryLoading: false,
        stateLoading: false,
        countyLoading: false,
        selectedCountryGid: 'country-us',
        selectedStateGid: 'state-ut',
        selectedCountyGid: 'county-salt-lake',
        finalLocationGid: 'county-salt-lake',
        onCountryChange,
        onStateChange,
        onCountyChange,
      });

    try {
      render(<SpeciesScreen data={createData()} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-Country-status').props.children).toBe('Enabled');
      });

      expect(screen.getByTestId('select-Country-value').props.children).toContain('country-us');
      expect(screen.getByTestId('select-State-value').props.children).toContain('state-ut');
      expect(screen.getByTestId('select-County-value').props.children).toContain('county-salt-lake');

      fireEvent.press(screen.getByTestId('select-Country-next'));
      fireEvent.press(screen.getByTestId('select-State-next'));
      fireEvent.press(screen.getByTestId('select-County-next'));

      expect(onCountryChange).toHaveBeenCalledWith('country-us');
      expect(onStateChange).toHaveBeenCalledWith('state-ut');
      expect(onCountyChange).toHaveBeenCalledWith('county-salt-lake');
    } finally {
      filtersSpy.mockRestore();
    }
  });

  it('shows API error message when occurrence fetch rejects with Error', async () => {
    mockFetchSpeciesOccurrences.mockRejectedValueOnce(new Error('Network down'));

    render(<SpeciesScreen data={createData()} />);

    await waitFor(() => {
      expect(mockFetchLocationsByHierarchy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Map error: Network down')).toBeTruthy();
    });
  });

  it('shows fallback error message when occurrence fetch rejects with non-Error value', async () => {
    mockFetchSpeciesOccurrences.mockRejectedValueOnce('bad payload');

    render(<SpeciesScreen data={createData()} />);

    await waitFor(() => {
      expect(mockFetchLocationsByHierarchy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Map error: Failed to load observations.')).toBeTruthy();
    });
  });

});
