// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { DonutCategoryChart } from '../DonutCategoryChart';
import type { SpeciesEnvironmentCategory } from '@/data/types';

const mockReactLocal = React;
const mockRNView = View;
const mockRNPressable = Pressable;
const mockRNText = Text;

type MockPill = { key: string; label: string };
type NavigationPillListMockProps = {
  pills: MockPill[];
  selectedKey?: string;
  highlightedKey?: string;
  homeHighlightedKey?: string;
  onSelectionChange?: (key: string, options?: { additive?: boolean }) => void;
  highlightOutlineColor?: string;
};

const mockNavigationPillList = jest.fn<void, [NavigationPillListMockProps]>();

jest.mock('@/components/navigation/NavigationPillList', () => ({
  NavigationPillList: (props: NavigationPillListMockProps) => {
    mockNavigationPillList(props);
    const { pills, onSelectionChange } = props;
    return mockReactLocal.createElement(
      mockRNView,
      null,
      pills.map((pill) =>
        mockReactLocal.createElement(
          mockRNPressable,
          {
            key: pill.key,
            testID: `pill-${pill.key}`,
            onPress: () => onSelectionChange?.(pill.key),
            onLongPress: () =>
              onSelectionChange?.(pill.key, { additive: true }),
          },
          mockReactLocal.createElement(mockRNText, null, pill.label),
        ),
      ),
    );
  },
}));

jest.mock('react-native-svg', () => {
  const MockSvg = ({ children }: { children?: React.ReactNode }) =>
    mockReactLocal.createElement(mockRNView, { testID: 'svg-root' }, children);

  const MockPath = ({
    onPress,
    onLongPress,
    testID,
    stroke,
    strokeWidth,
  }: {
    onPress?: (event?: unknown) => void;
    onLongPress?: () => void;
    testID?: string;
    stroke?: string;
    strokeWidth?: number;
  }) =>
    mockReactLocal.createElement(mockRNPressable, {
      onPress,
      onLongPress,
      testID,
      accessibilityHint: stroke ? `${stroke}|${strokeWidth ?? ''}` : undefined,
    });

  const MockPassthrough = ({ children }: { children?: React.ReactNode }) =>
    mockReactLocal.createElement(mockRNView, null, children);

  return {
    __esModule: true,
    default: MockSvg,
    G: MockPassthrough,
    Path: MockPath,
    Text: MockPassthrough,
  };
});

const cats = (n: number, fraction = 1 / n): SpeciesEnvironmentCategory[] =>
  Array.from({ length: n }).map((_, i) => ({
    value: `cat-${i}`,
    className: `Category ${i}`,
    count: Math.round(fraction * 100),
    fraction,
  }));

describe('DonutCategoryChart', () => {
  beforeEach(() => mockNavigationPillList.mockClear());

  it('forwards a wedge tap as a non-additive selection', () => {
    const onSelect = jest.fn();
    render(
      <DonutCategoryChart
        categories={cats(3)}
        selectedValues={[]}
        onSelect={onSelect}
        descriptionColor='#666'
      />,
    );

    fireEvent.press(screen.getByTestId('donut-wedge-cat-1'));
    expect(onSelect).toHaveBeenCalledWith('cat-1', { additive: false });
  });

  it('forwards a wedge long-press as an additive selection', () => {
    const onSelect = jest.fn();
    render(
      <DonutCategoryChart
        categories={cats(3)}
        selectedValues={[]}
        onSelect={onSelect}
        descriptionColor='#666'
      />,
    );

    fireEvent(screen.getByTestId('donut-wedge-cat-2'), 'longPress');
    expect(onSelect).toHaveBeenCalledWith('cat-2', { additive: true });
  });

  it('outlines the location-matched wedge and forwards the highlight to the pills', () => {
    render(
      <DonutCategoryChart
        categories={[
          { value: 'forest', className: 'Forest', count: 5, fraction: 0.5 },
          { value: 'grass', className: 'Grassland', count: 5, fraction: 0.5 },
        ]}
        selectedValues={[]}
        highlightedValue='grass'
        onSelect={jest.fn()}
        descriptionColor='#666'
        highlightOutlineColor='#F59E0B'
      />,
    );

    expect(screen.getByTestId('donut-wedge-grass')).toHaveProp(
      'accessibilityHint',
      '#F59E0B|3',
    );
    expect(mockNavigationPillList.mock.calls.at(-1)?.[0]).toMatchObject({
      highlightedKey: 'grass',
      highlightOutlineColor: '#F59E0B',
    });
  });

  it('synthesizes an "other" pill and warning for a pinned category not in the distribution', () => {
    render(
      <DonutCategoryChart
        categories={[
          { value: 'forest', className: 'Forest', count: 5, fraction: 0.5 },
          { value: 'grass', className: 'Grassland', count: 5, fraction: 0.5 },
        ]}
        selectedValues={[]}
        unobservedHighlightedCategory={{
          value: 'urban',
          label: 'Urban',
          description: 'Developed land',
        }}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    expect(mockNavigationPillList.mock.calls.at(-1)?.[0]).toMatchObject({
      highlightedKey: '__other__',
    });
    expect(screen.getByText('Urban')).toBeTruthy();
    expect(
      screen.getByText('Species has never been observed in this environment'),
    ).toBeTruthy();
  });

  it('synthesizes a home pill for a home category not in the distribution', () => {
    render(
      <DonutCategoryChart
        categories={[
          { value: 'forest', className: 'Forest', count: 5, fraction: 0.5 },
          { value: 'grass', className: 'Grassland', count: 5, fraction: 0.5 },
        ]}
        selectedValues={[]}
        homeUnobservedCategory={{
          value: 'tundra',
          label: 'Tundra',
          description: null,
        }}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    expect(mockNavigationPillList.mock.calls.at(-1)?.[0]).toMatchObject({
      homeHighlightedKey: '__home_other__',
    });
    expect(screen.getByText('Tundra')).toBeTruthy();
  });

  it('rolls the long tail into an Other wedge and expands on Show more', () => {
    render(
      <DonutCategoryChart
        categories={cats(11, 1 / 11)}
        selectedValues={[]}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    expect(screen.getByTestId('donut-wedge-__other_wedge__')).toBeTruthy();
    expect(screen.getByText('Show 3 more')).toBeTruthy();

    fireEvent.press(screen.getByText('Show 3 more'));
    expect(screen.getByText('Show less')).toBeTruthy();
    expect(screen.queryByTestId('donut-wedge-__other_wedge__')).toBeNull();
  });

  it('renders the empty state', () => {
    render(
      <DonutCategoryChart
        categories={[]}
        selectedValues={[]}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );
    expect(screen.getByText('Categories unavailable.')).toBeTruthy();
  });
});
