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
  VariableSelectorHeader: ({
    headingText,
    metaText,
  }: {
    headingText?: string | null;
    metaText?: string | null;
  }) => {
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
    highlightedValue,
    pinnedValue,
    pinnedClassName,
  }: {
    onSelect?: (value: string | number) => void;
    highlightedValue?: string | number | null;
    pinnedValue?: string | number | null;
    pinnedClassName?: string | null;
  }) => {
    const ReactNative = jest.requireActual('react-native');
    const { Pressable, Text, View } = ReactNative;
    return (
      <View>
        <Text>categorical-view</Text>
        <Text>
          {highlightedValue == null
            ? 'no-highlighted-category'
            : `highlighted-${String(highlightedValue)}`}
        </Text>
        <Text>
          {pinnedValue == null
            ? 'no-pinned-value'
            : `pinned-${String(pinnedValue)}`}
        </Text>
        <Text>
          {pinnedClassName == null
            ? 'no-pinned-class-name'
            : `pinned-class-${pinnedClassName}`}
        </Text>
        <Pressable testID='pick-categorical' onPress={() => onSelect?.('a')}>
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
        <Pressable
          testID='pick-rank-context'
          onPress={() => onRankContextChange?.('Mammalia')}
        >
          <Text>pick-rank</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('../AspectCompassChart', () => ({
  AspectCompassChart: ({
    onSelect,
    highlightedValue,
  }: {
    onSelect?: (value: string | number) => void;
    highlightedValue?: string | number | null;
  }) => {
    const ReactNative = jest.requireActual('react-native');
    const { Pressable, Text, View } = ReactNative;
    return (
      <View>
        <Text>aspect-compass-view</Text>
        <Text>
          {highlightedValue == null
            ? 'no-highlighted-aspect'
            : `highlighted-aspect-${String(highlightedValue)}`}
        </Text>
        <Pressable testID='pick-aspect' onPress={() => onSelect?.('N')}>
          <Text>pick</Text>
        </Pressable>
      </View>
    );
  },
}));

const mockPolarDensityChart = jest.fn<
  React.ReactElement,
  [
    {
      onSelectionChange?: (
        range: { start: number; end: number } | null,
      ) => void;
      pinValue?: number | null;
      pinLoading?: boolean;
    },
  ]
>();

jest.mock('../PolarDensityChart', () => ({
  PolarDensityChart: (props: {
    onSelectionChange?: (range: { start: number; end: number } | null) => void;
    pinValue?: number | null;
    pinLoading?: boolean;
  }) => {
    mockPolarDensityChart(props);
    const ReactNative = jest.requireActual('react-native');
    const { Pressable, Text, View } = ReactNative;
    return (
      <View>
        <Text>polar-density-view</Text>
        <Pressable
          testID='pick-polar-range'
          onPress={() => props.onSelectionChange?.({ start: 0, end: 90 })}
        >
          <Text>pick</Text>
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
  summary: {
    count: 10,
    min: null,
    mean: null,
    max: null,
    q01: null,
    q99: null,
  },
  histogram: null,
  densityCurve: null,
  categoricalDistribution: [
    { value: 'a', className: 'A', count: 10, fraction: 1 },
  ],
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
  summaryComparisons: {
    min: null,
    mean: null,
    max: null,
    std: null,
    range99: null,
  },
  locationFilterActive: false,
  pinnedCategoryValue: null,
  pinnedUnobservedCategory: null,
  pinnedClassName: null,
  pinnedValue: null,
  pinnedLoading: false,
  pinnedNoData: false,
  selectedVariableMeta: null,
  isCircularVariable: false,
};

describe('SpeciesEnvironmentSection', () => {
  const findHostNodesByTestId = (
    root: ReturnType<typeof render>['UNSAFE_root'],
    testID: string,
  ) =>
    root.findAll(
      (node) => node.props?.testID === testID && typeof node.type === 'string',
    );

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
    mockPolarDensityChart.mockReturnValue(<></>);
    mockUseSpeciesEnvironmentState.mockReturnValue(baseState);
  });

  it('returns null when no taxonId is provided', () => {
    const { queryByText } = render(
      <SpeciesEnvironmentSection taxonId={undefined} />,
    );
    expect(queryByText('Loading environment data…')).toBeNull();
  });

  it('renders the section subheading above the variable selector', () => {
    render(<SpeciesEnvironmentSection taxonId={1} />);
    expect(screen.getByText('Species Environment')).toBeTruthy();
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

  it('renders the obscured warning when all observations are obscured', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      loading: false,
      stats: {
        ...baseContinuousStats,
        allObscured: true,
      },
      isCategorical: false,
      densityCurve: baseContinuousStats.densityCurve ?? null,
      summary: baseContinuousStats.summary,
      headingText: 'Annual Temperature (C)',
      metaText: '(Based on 10 observations)',
    });

    render(<SpeciesEnvironmentSection taxonId={1} />);

    expect(
      screen.getByText(
        'All observations for this species have obscured locations and cannot be used for environmental analysis.',
      ),
    ).toBeTruthy();
  });

  it('renders the location-specific obscured warning copy when a location filter is active', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      loading: false,
      stats: {
        ...baseContinuousStats,
        allObscured: true,
      },
      locationFilterActive: true,
      isCategorical: false,
      densityCurve: baseContinuousStats.densityCurve ?? null,
      summary: baseContinuousStats.summary,
    });

    render(<SpeciesEnvironmentSection taxonId={1} locationGid='USA.5_1' />);

    expect(
      screen.getByText(
        'All observations for this species in the selected location have obscured locations and cannot be used for environmental analysis.',
      ),
    ).toBeTruthy();
  });

  it('renders categorical branch and forwards category selection intent', () => {
    const setSelectedCategoryValue = jest.fn();
    mockUseSpeciesEnvironmentState.mockImplementation(() => ({
      ...baseState,
      stats: baseCategoricalStats,
      isCategorical: true,
      categoricalDistribution:
        baseCategoricalStats.categoricalDistribution ?? [],
      summary: baseCategoricalStats.summary,
      selectedCategoryValue: null,
      setSelectedCategoryValue,
    }));

    render(<SpeciesEnvironmentSection taxonId={1} />);
    expect(screen.getByText('categorical-view')).toBeTruthy();
    expect(screen.queryByText('density-view')).toBeNull();
    expect(screen.queryByText('continuous-view')).toBeNull();

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
    expect(screen.queryByText('categorical-view')).toBeNull();
    expect(screen.getByText('density-view')).toBeTruthy();
    expect(screen.getByText('continuous-view')).toBeTruthy();

    fireEvent.press(screen.getByTestId('pick-rank-context'));
    expect(setSelectedRankContext).toHaveBeenCalledWith('Mammalia');
  });

  it('keeps the last rendered content mounted while a new variable is loading', () => {
    let phase: 'ready' | 'loading' = 'ready';
    mockUseSpeciesEnvironmentState.mockImplementation(() => {
      if (phase === 'ready') {
        return {
          ...baseState,
          stats: baseContinuousStats,
          isCategorical: false,
          densityCurve: baseContinuousStats.densityCurve ?? null,
          summary: baseContinuousStats.summary,
          headingText: 'Annual Temperature (C)',
          metaText: '(Based on 10 observations)',
        };
      }

      return {
        ...baseState,
        loading: true,
        stats: null,
      };
    });

    const { rerender } = render(
      <SpeciesEnvironmentSection taxonId={1} variableId='bio_1' />,
    );
    expect(screen.getByText('density-view')).toBeTruthy();
    expect(screen.getByText('continuous-view')).toBeTruthy();

    phase = 'loading';
    rerender(<SpeciesEnvironmentSection taxonId={1} variableId='bio_2' />);

    expect(screen.getByText('density-view')).toBeTruthy();
    expect(screen.getByText('continuous-view')).toBeTruthy();
    expect(screen.getByText('Annual Temperature (C)')).toBeTruthy();
    expect(screen.getByText('(Based on 10 observations)')).toBeTruthy();
    expect(screen.getByText('Updating environment data…')).toBeTruthy();
    expect(screen.queryByText('Loading environment data…')).toBeNull();
  });

  it('keeps display and branch host slots mounted across rerenders', () => {
    let phase: 'continuous' | 'loading' | 'categorical' = 'continuous';
    mockUseSpeciesEnvironmentState.mockImplementation(() => {
      if (phase === 'continuous') {
        return {
          ...baseState,
          stats: baseContinuousStats,
          isCategorical: false,
          densityCurve: baseContinuousStats.densityCurve ?? null,
          summary: baseContinuousStats.summary,
        };
      }

      if (phase === 'loading') {
        return {
          ...baseState,
          loading: true,
          stats: null,
        };
      }

      return {
        ...baseState,
        stats: baseCategoricalStats,
        isCategorical: true,
        categoricalDistribution:
          baseCategoricalStats.categoricalDistribution ?? [],
        summary: baseCategoricalStats.summary,
      };
    });

    const rendered = render(<SpeciesEnvironmentSection taxonId={1} />);

    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-display-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-categorical-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-continuous-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-loading-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-updating-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-error-slot',
      ),
    ).toHaveLength(1);

    phase = 'loading';
    rendered.rerender(
      <SpeciesEnvironmentSection taxonId={1} variableId='bio_2' />,
    );

    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-display-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-categorical-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-continuous-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-loading-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-updating-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-error-slot',
      ),
    ).toHaveLength(1);

    phase = 'categorical';
    rendered.rerender(
      <SpeciesEnvironmentSection taxonId={1} variableId='landcover' />,
    );

    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-display-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-categorical-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-continuous-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-loading-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-updating-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        rendered.UNSAFE_root,
        'species-environment-error-slot',
      ),
    ).toHaveLength(1);
  });

  it('clears preserved content and header when a new variable load fails', () => {
    let phase: 'ready' | 'error' = 'ready';
    mockUseSpeciesEnvironmentState.mockImplementation(() => {
      if (phase === 'ready') {
        return {
          ...baseState,
          stats: baseContinuousStats,
          isCategorical: false,
          densityCurve: baseContinuousStats.densityCurve ?? null,
          summary: baseContinuousStats.summary,
          headingText: 'Annual Temperature (C)',
          metaText: '(Based on 10 observations)',
        };
      }

      return {
        ...baseState,
        loading: false,
        stats: null,
        error: 'Failed to load environment stats',
        headingText: null,
        metaText: null,
      };
    });

    const { rerender } = render(
      <SpeciesEnvironmentSection taxonId={1} variableId='bio_1' />,
    );
    expect(screen.getByText('density-view')).toBeTruthy();
    expect(screen.getByText('(Based on 10 observations)')).toBeTruthy();

    phase = 'error';
    rerender(<SpeciesEnvironmentSection taxonId={1} variableId='bio_2' />);

    expect(screen.getByText('Failed to load environment stats')).toBeTruthy();
    expect(screen.queryByText('density-view')).toBeNull();
    expect(screen.queryByText('continuous-view')).toBeNull();
    expect(screen.queryByText('Annual Temperature (C)')).toBeNull();
    expect(screen.queryByText('(Based on 10 observations)')).toBeNull();
  });

  it('forwards selection inputs to useSpeciesEnvironmentState', () => {
    const variables = [
      {
        id: 'bio_1',
        label: 'Annual Temperature',
        category: 'Climate',
        valueType: 'continuous',
        units: 'C' as const,
      },
    ];

    render(
      <SpeciesEnvironmentSection
        taxonId={2}
        variableId='bio_1'
        variables={variables}
        locationGid='USA.1_1'
        units='imperial'
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

  it('renders AspectCompassChart instead of StackedCategoryBar when variable is "aspect"', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      selectedVariable: 'aspect',
      stats: baseCategoricalStats,
      isCategorical: true,
      categoricalDistribution:
        baseCategoricalStats.categoricalDistribution ?? [],
      summary: baseCategoricalStats.summary,
    });

    render(<SpeciesEnvironmentSection taxonId={1} variableId='aspect' />);

    expect(screen.getByText('aspect-compass-view')).toBeTruthy();
    expect(screen.queryByText('categorical-view')).toBeNull();
  });

  it('forwards pinnedCategoryValue to AspectCompassChart for categorical highlights', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      selectedVariable: 'aspect',
      stats: baseCategoricalStats,
      isCategorical: true,
      categoricalDistribution:
        baseCategoricalStats.categoricalDistribution ?? [],
      summary: baseCategoricalStats.summary,
      pinnedCategoryValue: 'N',
    });

    render(<SpeciesEnvironmentSection taxonId={1} variableId='aspect' />);

    expect(screen.getByText('highlighted-aspect-N')).toBeTruthy();
  });

  it('still renders StackedCategoryBar for non-aspect categorical variables', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      selectedVariable: 'landcover',
      stats: baseCategoricalStats,
      isCategorical: true,
      categoricalDistribution:
        baseCategoricalStats.categoricalDistribution ?? [],
      summary: baseCategoricalStats.summary,
    });

    render(<SpeciesEnvironmentSection taxonId={1} variableId='landcover' />);

    expect(screen.getByText('categorical-view')).toBeTruthy();
    expect(screen.queryByText('aspect-compass-view')).toBeNull();
  });

  it('forwards pinnedCategoryValue to StackedCategoryBar for categorical highlights', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      selectedVariable: 'landcover',
      stats: baseCategoricalStats,
      isCategorical: true,
      categoricalDistribution:
        baseCategoricalStats.categoricalDistribution ?? [],
      summary: baseCategoricalStats.summary,
      pinnedCategoryValue: 'a',
    });

    render(<SpeciesEnvironmentSection taxonId={1} variableId='landcover' />);

    expect(screen.getByText('highlighted-a')).toBeTruthy();
  });

  it('forwards raw pinned category data to StackedCategoryBar', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      selectedVariable: 'landcover',
      stats: baseCategoricalStats,
      isCategorical: true,
      categoricalDistribution:
        baseCategoricalStats.categoricalDistribution ?? [],
      summary: baseCategoricalStats.summary,
      pinnedValue: 62,
      pinnedClassName: 'Closed deciduous broadleaved forest',
    });

    render(<SpeciesEnvironmentSection taxonId={1} variableId='landcover' />);

    expect(screen.getByText('pinned-62')).toBeTruthy();
    expect(
      screen.getByText('pinned-class-Closed deciduous broadleaved forest'),
    ).toBeTruthy();
  });

  it('renders PolarDensityChart instead of DensityChart when variable is "aspect_deg"', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      selectedVariable: 'aspect_deg',
      isCircularVariable: true,
      stats: baseContinuousStats,
      isCategorical: false,
      densityCurve: baseContinuousStats.densityCurve ?? null,
      summary: baseContinuousStats.summary,
    });

    render(<SpeciesEnvironmentSection taxonId={1} variableId='aspect_deg' />);

    expect(screen.getByText('polar-density-view')).toBeTruthy();
    expect(screen.queryByText('density-view')).toBeNull();
    expect(screen.queryByText('continuous-view')).toBeNull();
  });

  it('still renders DensityChart + ContinuousInsights for non-aspect_deg continuous variables', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      selectedVariable: 'bio_1',
      stats: baseContinuousStats,
      isCategorical: false,
      densityCurve: baseContinuousStats.densityCurve ?? null,
      summary: baseContinuousStats.summary,
    });

    render(<SpeciesEnvironmentSection taxonId={1} variableId='bio_1' />);

    expect(screen.getByText('density-view')).toBeTruthy();
    expect(screen.getByText('continuous-view')).toBeTruthy();
    expect(screen.queryByText('polar-density-view')).toBeNull();
  });

  it('forwards aspect category selection through handleCategorySelect', () => {
    const setSelectedCategoryValue = jest.fn();
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      selectedVariable: 'aspect',
      stats: baseCategoricalStats,
      isCategorical: true,
      categoricalDistribution:
        baseCategoricalStats.categoricalDistribution ?? [],
      summary: baseCategoricalStats.summary,
      setSelectedCategoryValue,
    });

    render(<SpeciesEnvironmentSection taxonId={1} variableId='aspect' />);

    fireEvent.press(screen.getByTestId('pick-aspect'));
    expect(setSelectedCategoryValue).toHaveBeenCalledWith(expect.any(Function));
  });

  it('forwards pinnedValue and pinnedLoading to PolarDensityChart', () => {
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      selectedVariable: 'aspect_deg',
      isCircularVariable: true,
      stats: baseContinuousStats,
      isCategorical: false,
      densityCurve: baseContinuousStats.densityCurve ?? null,
      summary: baseContinuousStats.summary,
      pinnedValue: 135,
      pinnedLoading: false,
    });

    render(<SpeciesEnvironmentSection taxonId={1} variableId='aspect_deg' />);

    expect(mockPolarDensityChart).toHaveBeenCalledWith(
      expect.objectContaining({ pinValue: 135, pinLoading: false }),
    );
  });

  it('forwards polar density selection through handleDensitySelectionChange', () => {
    const handleDensitySelectionChange = jest.fn();
    mockUseSpeciesEnvironmentState.mockReturnValue({
      ...baseState,
      selectedVariable: 'aspect_deg',
      isCircularVariable: true,
      stats: baseContinuousStats,
      isCategorical: false,
      densityCurve: baseContinuousStats.densityCurve ?? null,
      summary: baseContinuousStats.summary,
      handleDensitySelectionChange,
    });

    render(<SpeciesEnvironmentSection taxonId={1} variableId='aspect_deg' />);

    fireEvent.press(screen.getByTestId('pick-polar-range'));
    expect(handleDensitySelectionChange).toHaveBeenCalledWith({
      start: 0,
      end: 90,
    });
  });
});
