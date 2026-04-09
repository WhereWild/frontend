import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { create, act } from 'react-test-renderer';
import { ContinuousInsights } from '../ContinuousInsights';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';

const mockView = View;
const mockPressable = Pressable;
const mockText = Text;
const mockReact = React;
const mockUseColorScheme = jest.mocked(useColorScheme);

type MockPill = { key: string; label: string };
type NavigationPillListMockProps = {
  pills: MockPill[];
  onSelectionChange?: (value: string) => void;
};

jest.mock('@/components/navigation/NavigationPillList', () => ({
  NavigationPillList: ({
    pills,
    onSelectionChange,
  }: NavigationPillListMockProps) =>
    mockReact.createElement(
      mockView,
      null,
      pills.map((pill) =>
        mockReact.createElement(
          mockPressable,
          {
            key: pill.key,
            testID: `rank-pill-${pill.key}`,
            onPress: () => onSelectionChange?.(pill.key),
          },
          mockReact.createElement(mockText, null, pill.label),
        ),
      ),
    ),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseResponsive = useResponsive as jest.MockedFunction<
  typeof useResponsive
>;

const findHostNodesByTestId = (
  root: ReturnType<typeof create>['root'],
  testID: string,
) =>
  root.findAll(
    (node) => typeof node.type === 'string' && node.props?.testID === testID,
  );

describe('ContinuousInsights', () => {
  const summary = { min: 1, mean: 5, max: 10 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('light');
    mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' } as ReturnType<
      typeof useResponsive
    >);
  });

  it('renders multi-context rank selector and handles selection', () => {
    const onRankContextChange = jest.fn();
    render(
      <ContinuousInsights
        showRankContext={true}
        rankContextOptions={[
          { key: 'Mammalia', label: 'Mammalia' },
          { key: 'Aves', label: 'Aves' },
        ]}
        selectedRankContext={'Mammalia'}
        onRankContextChange={onRankContextChange}
        summary={summary}
        summaryRanks={{ min: null, mean: null, max: null }}
        summaryComparisons={{ min: null, mean: null, max: null }}
        locationFilterActive={false}
      />,
    );

    expect(screen.getByText(/Select a taxon/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('rank-pill-Aves'));
    expect(onRankContextChange).toHaveBeenCalledWith('Aves');
  });

  it('renders single-context informational copy', () => {
    render(
      <ContinuousInsights
        showRankContext={true}
        rankContextOptions={[{ key: 'Mammalia', label: 'Mammalia' }]}
        selectedRankContext={'Mammalia'}
        onRankContextChange={jest.fn()}
        summary={summary}
        summaryRanks={{ min: null, mean: null, max: null }}
        summaryComparisons={{ min: null, mean: null, max: null }}
        locationFilterActive={false}
      />,
    );

    expect(screen.getByText('Rankings within Mammalia')).toBeTruthy();
    expect(screen.getByText(/Min\s*:\s*1\.0/)).toBeTruthy();
    expect(screen.getByText(/Mean\s*:\s*5\.0/)).toBeTruthy();
    expect(screen.getByText(/Max\s*:\s*10\.0/)).toBeTruthy();
  });

  it('renders comparison values in location filter mode', () => {
    render(
      <ContinuousInsights
        showRankContext={false}
        rankContextOptions={[]}
        selectedRankContext={null}
        onRankContextChange={jest.fn()}
        summary={summary}
        summaryRanks={{
          min: {
            metric: 'min',
            label: 'Mammalia',
            rank: 1,
            count: 10,
            percentile: 0.9,
          },
          mean: {
            metric: 'mean',
            label: 'Mammalia',
            rank: 2,
            count: 10,
            percentile: 0.8,
          },
          max: {
            metric: 'max',
            label: 'Mammalia',
            rank: 3,
            count: 10,
            percentile: 0.7,
          },
        }}
        summaryComparisons={{
          min: 'vs. 0 (+10%)',
          mean: 'vs. 4 (+25%)',
          max: 'vs. 9 (+11%)',
        }}
        locationFilterActive={true}
      />,
    );

    expect(screen.getByText('vs. 0 (+10%)')).toBeTruthy();
    expect(screen.getByText('vs. 4 (+25%)')).toBeTruthy();
    expect(screen.getByText('vs. 9 (+11%)')).toBeTruthy();
  });

  it('does not render rank context copy when showRankContext is true but no options exist', () => {
    render(
      <ContinuousInsights
        showRankContext={true}
        rankContextOptions={[]}
        selectedRankContext={null}
        onRankContextChange={jest.fn()}
        summary={summary}
        summaryRanks={{ min: null, mean: null, max: null }}
        summaryComparisons={{ min: null, mean: null, max: null }}
        locationFilterActive={false}
      />,
    );

    expect(screen.queryByText(/Select a taxon/)).toBeNull();
    expect(screen.queryByText(/Rankings within/)).toBeNull();
    expect(screen.getByText(/Min\s*:\s*1\.0/)).toBeTruthy();
  });

  it('keeps rank-context host slots mounted across selector visibility changes', () => {
    let rendered: ReturnType<typeof create>;

    act(() => {
      rendered = create(
        <ContinuousInsights
          showRankContext={true}
          rankContextOptions={[
            { key: 'Mammalia', label: 'Mammalia' },
            { key: 'Aves', label: 'Aves' },
          ]}
          selectedRankContext={'Mammalia'}
          onRankContextChange={jest.fn()}
          summary={summary}
          summaryRanks={{ min: null, mean: null, max: null }}
          summaryComparisons={{ min: null, mean: null, max: null }}
          locationFilterActive={false}
        />,
      );
    });

    const initialRoot = rendered!.root;
    expect(
      findHostNodesByTestId(
        initialRoot,
        'continuous-insights-rank-context-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        initialRoot,
        'continuous-insights-rank-context-content-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        initialRoot,
        'continuous-insights-rank-context-selector-slot',
      ),
    ).toHaveLength(1);
    expect(findHostNodesByTestId(initialRoot, 'summary-row')).toHaveLength(1);

    act(() => {
      rendered!.update(
        <ContinuousInsights
          showRankContext={true}
          rankContextOptions={[{ key: 'Mammalia', label: 'Mammalia' }]}
          selectedRankContext={'Mammalia'}
          onRankContextChange={jest.fn()}
          summary={summary}
          summaryRanks={{ min: null, mean: null, max: null }}
          summaryComparisons={{ min: null, mean: null, max: null }}
          locationFilterActive={false}
        />,
      );
    });

    const singleContextRoot = rendered!.root;
    expect(
      findHostNodesByTestId(
        singleContextRoot,
        'continuous-insights-rank-context-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        singleContextRoot,
        'continuous-insights-rank-context-content-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        singleContextRoot,
        'continuous-insights-rank-context-selector-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(singleContextRoot, 'summary-row'),
    ).toHaveLength(1);

    act(() => {
      rendered!.update(
        <ContinuousInsights
          showRankContext={true}
          rankContextOptions={[]}
          selectedRankContext={null}
          onRankContextChange={jest.fn()}
          summary={summary}
          summaryRanks={{ min: null, mean: null, max: null }}
          summaryComparisons={{ min: null, mean: null, max: null }}
          locationFilterActive={false}
        />,
      );
    });

    const emptyContextRoot = rendered!.root;
    expect(
      findHostNodesByTestId(
        emptyContextRoot,
        'continuous-insights-rank-context-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        emptyContextRoot,
        'continuous-insights-rank-context-content-slot',
      ),
    ).toHaveLength(1);
    expect(
      findHostNodesByTestId(
        emptyContextRoot,
        'continuous-insights-rank-context-selector-slot',
      ),
    ).toHaveLength(1);
    expect(findHostNodesByTestId(emptyContextRoot, 'summary-row')).toHaveLength(
      1,
    );
  });

  it('renders location-filter summary without comparison text when comparisons are null', () => {
    render(
      <ContinuousInsights
        showRankContext={true}
        rankContextOptions={[
          { key: 'Mammalia', label: 'Mammalia' },
          { key: 'Aves', label: 'Aves' },
        ]}
        selectedRankContext={null}
        onRankContextChange={jest.fn()}
        summary={summary}
        summaryRanks={{
          min: {
            metric: 'min',
            label: 'Mammalia',
            rank: 1,
            count: 10,
            percentile: 0.9,
          },
          mean: {
            metric: 'mean',
            label: 'Mammalia',
            rank: 2,
            count: 10,
            percentile: 0.8,
          },
          max: {
            metric: 'max',
            label: 'Mammalia',
            rank: 3,
            count: 10,
            percentile: 0.7,
          },
        }}
        summaryComparisons={{ min: null, mean: null, max: null }}
        locationFilterActive={true}
      />,
    );

    expect(screen.getByText(/Select a taxon/)).toBeTruthy();
    expect(screen.queryByText(/vs\./)).toBeNull();
    expect(screen.getByText(/Min\s*:\s*1\.0/)).toBeTruthy();
    expect(screen.getByText(/Mean\s*:\s*5\.0/)).toBeTruthy();
    expect(screen.getByText(/Max\s*:\s*10\.0/)).toBeTruthy();
  });

  it('renders correctly in dark mode', () => {
    mockUseColorScheme.mockReturnValue('dark');

    render(
      <ContinuousInsights
        showRankContext={true}
        rankContextOptions={[{ key: 'Mammalia', label: 'Mammalia' }]}
        selectedRankContext={null}
        onRankContextChange={jest.fn()}
        summary={summary}
        summaryRanks={{ min: null, mean: null, max: null }}
        summaryComparisons={{ min: null, mean: null, max: null }}
        locationFilterActive={false}
      />,
    );

    expect(screen.getByText('Rankings within Mammalia')).toBeTruthy();
  });

  describe('stacking layout', () => {
    const baseProps = {
      showRankContext: false,
      rankContextOptions: [],
      selectedRankContext: null,
      onRankContextChange: jest.fn(),
      summary: { min: 1, mean: 5, max: 10 },
      summaryRanks: { min: null, mean: null, max: null },
      summaryComparisons: { min: null, mean: null, max: null },
      locationFilterActive: false,
    };

    it('stacks summary items vertically on phone breakpoint', () => {
      mockUseResponsive.mockReturnValue({ breakpoint: 'phone' } as ReturnType<
        typeof useResponsive
      >);
      render(<ContinuousInsights {...baseProps} />);

      const row = screen.getByTestId('summary-row');
      const style = StyleSheet.flatten(row.props.style);
      expect(style.flexDirection).toBe('column');
    });

    it('stacks summary items vertically on tablet breakpoint', () => {
      mockUseResponsive.mockReturnValue({ breakpoint: 'tablet' } as ReturnType<
        typeof useResponsive
      >);
      render(<ContinuousInsights {...baseProps} />);

      const row = screen.getByTestId('summary-row');
      const style = StyleSheet.flatten(row.props.style);
      expect(style.flexDirection).toBe('column');
    });

    it('keeps summary items in a row on desktop breakpoint', () => {
      mockUseResponsive.mockReturnValue({ breakpoint: 'desktop' } as ReturnType<
        typeof useResponsive
      >);
      render(<ContinuousInsights {...baseProps} />);

      const row = screen.getByTestId('summary-row');
      const style = StyleSheet.flatten(row.props.style);
      expect(style.flexDirection).toBe('row');
    });
  });
});
