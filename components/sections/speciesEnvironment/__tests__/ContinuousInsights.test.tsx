import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { ContinuousInsights } from '../ContinuousInsights';

const mockView = View;
const mockPressable = Pressable;
const mockText = Text;
const mockReact = React;

type MockPill = { key: string; label: string };
type NavigationPillListMockProps = {
  pills: MockPill[];
  onSelectionChange?: (value: string) => void;
};

jest.mock('@/components/navigation/NavigationPillList', () => ({
  NavigationPillList: ({ pills, onSelectionChange }: NavigationPillListMockProps) =>
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

describe('ContinuousInsights', () => {
  const summary = { min: 1, mean: 5, max: 10 };

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
        borderColor="#ddd"
        secondaryTextColor="#666"
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
        borderColor="#ddd"
        secondaryTextColor="#666"
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
          min: { metric: 'min', label: 'Mammalia', rank: 1, count: 10, percentile: 0.9 },
          mean: { metric: 'mean', label: 'Mammalia', rank: 2, count: 10, percentile: 0.8 },
          max: { metric: 'max', label: 'Mammalia', rank: 3, count: 10, percentile: 0.7 },
        }}
        summaryComparisons={{ min: 'vs. 0 (+10%)', mean: 'vs. 4 (+25%)', max: 'vs. 9 (+11%)' }}
        locationFilterActive={true}
        borderColor="#ddd"
        secondaryTextColor="#666"
      />,
    );

    expect(screen.getByText('vs. 0 (+10%)')).toBeTruthy();
    expect(screen.getByText('vs. 4 (+25%)')).toBeTruthy();
    expect(screen.getByText('vs. 9 (+11%)')).toBeTruthy();
  });
});
