import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { SpeciesEnvironmentStats } from '@/data/types';
import { SpeciesEnvironmentSection } from '../SpeciesEnvironmentSection';
import { useSpeciesEnvironmentState } from '../speciesEnvironment/useSpeciesEnvironmentState';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('../speciesEnvironment/useSpeciesEnvironmentState', () => ({
  useSpeciesEnvironmentState: jest.fn(),
}));

jest.mock('../speciesEnvironment/VariableSelectorHeader', () => ({
  VariableSelectorHeader: ({ headingText, metaText }: { headingText?: string | null; metaText?: string | null }) => {
    const ReactNative = jest.requireActual('react-native');
    const { View, Text } = ReactNative;
    return (
      <View>
        {headingText ? <Text>{headingText}</Text> : null}
        {metaText ? <Text>{metaText}</Text> : null}
      </View>
    );
  },
}));

jest.mock('../speciesEnvironment/StackedCategoryBar', () => ({
  StackedCategoryBar: ({
    onSelect,
  }: {
    onSelect?: (value: string | number) => void;
  }) => {
    const ReactNative = jest.requireActual('react-native');
    const { Pressable, Text, View } = ReactNative;
    return (
      <View>
        <Text>categorical-view</Text>
        <Pressable testID="pick-categorical" onPress={() => onSelect?.('a')}>
          <Text>pick</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('../speciesEnvironment/DensityChart', () => ({
  DensityChart: () => {
    const ReactNative = jest.requireActual('react-native');
    const { Text } = ReactNative;
    return <Text>density-view</Text>;
  },
}));

jest.mock('../speciesEnvironment/ContinuousInsights', () => ({
  ContinuousInsights: ({
    onRankContextChange,
  }: {
    onRankContextChange?: (value: string) => void;
  }) => {
    const ReactNative = jest.requireActual('react-native');
    const { Pressable, Text, View } = ReactNative;
    return (
      <View>
        <Text>continuous-view</Text>
        <Pressable testID="pick-rank-context" onPress={() => onRankContextChange?.('Mammalia')}>
          <Text>pick-rank</Text>
        </Pressable>
      </View>
    );
  },
}));

const mockUseSpeciesEnvironmentState = jest.mocked(useSpeciesEnvironmentState);
type SpeciesEnvironmentState = ReturnType<typeof useSpeciesEnvironmentState>;

const baseContinuousStats: SpeciesEnvironmentStats = {
  speciesId: 1,
  variable: 'bio_1',
  variableName: 'Annual Temperature',
  units: 'C',
  variableType: 'continuous',
  summary: { count: 10, min: 1, mean: 5, max: 10, q01: 1, q99: 10 },
  histogram: null,
  densityCurve: { points: [1, 5, 10], density: [0.2, 0.8, 0.2] },
  relativeRanks: [],
};

const baseCategoricalStats: SpeciesEnvironmentStats = {
  speciesId: 1,
  variable: 'landcover',
  variableName: 'Land Cover',
  units: null,
  variableType: 'categorical',
  summary: { count: 10, min: null, mean: null, max: null, q01: null, q99: null },
  histogram: null,
  densityCurve: null,
  categoricalDistribution: [{ value: 'a', className: 'A', count: 10, fraction: 1 }],
  relativeRanks: [],
};

const baseState: SpeciesEnvironmentState = {
  categories: [],
  selectedVariableCategory: null,
  setSelectedVariableCategory: jest.fn(),
  filteredVariables: [],
  selectedVariable: 'bio_1',
  setSelectedVariable: jest.fn(),
  headingText: null,
  metaText: null,
  loading: false,
  stats: null,
  isVariableCategorical: false,
  error: null,
  isCategorical: false,
  categoricalDistribution: [],
  selectedCategoryValue: null,
  setSelectedCategoryValue: jest.fn(),
  densityCurve: null,
  summary: undefined,
  selectedDensityRange: null,
  handleDensitySelectionChange: jest.fn(),
  showRankContext: false,
  rankContextOptions: [],
  selectedRankContext: null,
  setSelectedRankContext: jest.fn(),
  summaryRanks: { min: null, mean: null, max: null, std: null, range99: null },
  summaryComparisons: { min: null, mean: null, max: null, std: null, range99: null },
  locationFilterActive: false,
};

describe('SpeciesEnvironmentSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSpeciesEnvironmentState.mockReturnValue(baseState);
  });

  it('returns null when no taxonId is provided', () => {
    const { queryByText } = render(<SpeciesEnvironmentSection taxonId={undefined} />);
    expect(queryByText('Loading environment data…')).toBeNull();
  });

  it('renders loading state', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      loading: true,
      stats: null,
      isVariableCategorical: true,
    });

    render(<SpeciesEnvironmentSection taxonId={1} />);
    expect(screen.getByText('Loading environment data…')).toBeTruthy();
  });

  it('renders error state', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      loading: false,
      error: 'Something failed',
    });

    render(<SpeciesEnvironmentSection taxonId={1} />);
    expect(screen.getByText('Something failed')).toBeTruthy();
  });

  it('renders categorical branch and forwards category selection intent', () => {
    const setSelectedCategoryValue = jest.fn();
    mockUseSpeciesEnvironmentState.mockImplementation(() => ({
      ...baseState,
      stats: baseCategoricalStats,
      isCategorical: true,
      categoricalDistribution: baseCategoricalStats.categoricalDistribution ?? [],
      summary: baseCategoricalStats.summary,
      selectedCategoryValue: null,
      setSelectedCategoryValue,
    }));

    render(<SpeciesEnvironmentSection taxonId={1} />);
    expect(screen.getByText('categorical-view')).toBeTruthy();

    fireEvent.press(screen.getByTestId('pick-categorical'));
    expect(setSelectedCategoryValue).toHaveBeenCalledWith(expect.any(Function));
  });

  it('renders continuous branch and forwards rank-context selection', () => {
    const setSelectedRankContext = jest.fn();
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      stats: baseContinuousStats,
      isCategorical: false,
      densityCurve: baseContinuousStats.densityCurve ?? null,
      summary: baseContinuousStats.summary,
      setSelectedRankContext,
    });

    render(<SpeciesEnvironmentSection taxonId={1} />);
    expect(screen.getByText('density-view')).toBeTruthy();
    expect(screen.getByText('continuous-view')).toBeTruthy();

    fireEvent.press(screen.getByTestId('pick-rank-context'));
    expect(setSelectedRankContext).toHaveBeenCalledWith('Mammalia');
  });
});
