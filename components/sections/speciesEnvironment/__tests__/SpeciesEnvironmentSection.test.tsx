import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { SpeciesEnvironmentStats } from '@/data/types';
import { SpeciesEnvironmentSection } from '../SpeciesEnvironmentSection';
import { useSpeciesEnvironmentState } from '../useSpeciesEnvironmentState';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('../useSpeciesEnvironmentState', () => ({
  useSpeciesEnvironmentState: jest.fn(),
}));

jest.mock('../VariableSelectorHeader', () => ({
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

jest.mock('../StackedCategoryBar', () => ({
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

jest.mock('../DensityChart', () => ({
  DensityChart: () => {
    const ReactNative = jest.requireActual('react-native');
    const { Text } = ReactNative;
    return <Text>density-view</Text>;
  },
}));

jest.mock('../ContinuousInsights', () => ({
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
  const treeContainsMinHeight = (node: unknown, minHeight: number): boolean => {
    if (!node || typeof node !== 'object') {
      return false;
    }

    if (Array.isArray(node)) {
      return node.some((child) => treeContainsMinHeight(child, minHeight));
    }

    const typedNode = node as {
      props?: { style?: unknown };
      children?: unknown;
    };

    const style = typedNode.props?.style;
    const styleArray = Array.isArray(style) ? style : style ? [style] : [];
    const hasMatchingStyle = styleArray.some(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        'minHeight' in entry &&
        (entry as { minHeight?: number }).minHeight === minHeight,
    );

    if (hasMatchingStyle) {
      return true;
    }

    return treeContainsMinHeight(typedNode.children, minHeight);
  };

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

    const { toJSON } = render(<SpeciesEnvironmentSection taxonId={1} />);
    const loadingText = screen.getByText('Loading environment data…');
    expect(loadingText).toBeTruthy();
    expect(treeContainsMinHeight(toJSON(), 200)).toBe(true);
  });

  it('does not render error while loading is true', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      loading: true,
      stats: null,
      error: 'Should not render while loading',
    });

    render(<SpeciesEnvironmentSection taxonId={1} />);
    expect(screen.queryByText('Should not render while loading')).toBeNull();
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

    const updater = setSelectedCategoryValue.mock.calls[0][0] as (
      previous: string | number | null,
    ) => string | number | null;
    expect(updater('a')).toBeNull();
    expect(updater('b')).toBe('a');
    expect(updater(null)).toBe('a');
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

  it('forwards selection inputs to useSpeciesEnvironmentState', () => {
    const variables = [
      { id: 'bio_1', label: 'Annual Temperature', category: 'Climate', valueType: 'continuous', units: 'C' as const },
    ];

    render(
      <SpeciesEnvironmentSection
        taxonId={2}
        variableId="bio_1"
        variables={variables}
        locationGid="USA.1_1"
        units="imperial"
      />,
    );

    expect(mockUseSpeciesEnvironmentState).toHaveBeenCalledWith(
      expect.objectContaining({
        taxonId: 2,
        variableId: 'bio_1',
        variables,
        locationGid: 'USA.1_1',
        units: 'imperial',
      }),
    );
  });
});
