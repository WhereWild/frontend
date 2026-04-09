import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { StackedCategoryBar } from '../StackedCategoryBar';
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
  onSelectionChange?: (key: string) => void;
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
          },
          mockReactLocal.createElement(mockRNText, null, pill.label),
        ),
      ),
      mockReactLocal.createElement(
        mockRNPressable,
        {
          key: 'missing',
          testID: 'pill-missing',
          onPress: () => onSelectionChange?.('missing'),
        },
        mockReactLocal.createElement(mockRNText, null, 'Missing'),
      ),
    );
  },
}));

describe('StackedCategoryBar', () => {
  beforeEach(() => {
    mockNavigationPillList.mockClear();
  });

  it('applies the fixed fallback category color palette to stacked segments', () => {
    render(
      <StackedCategoryBar
        categories={[
          { value: 'cat-0', className: 'Category 0', count: 1, fraction: 0.2 },
          { value: 'cat-1', className: 'Category 1', count: 1, fraction: 0.2 },
          { value: 'cat-2', className: 'Category 2', count: 1, fraction: 0.2 },
          { value: 'cat-3', className: 'Category 3', count: 1, fraction: 0.2 },
        ]}
        selectedValue={null}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    expect(screen.getByTestId('stacked-segment-0')).toHaveStyle({
      backgroundColor: '#466237',
    });
    expect(screen.getByTestId('stacked-segment-1')).toHaveStyle({
      backgroundColor: '#E07A5F',
    });
    expect(screen.getByTestId('stacked-segment-2')).toHaveStyle({
      backgroundColor: '#3D5A80',
    });
    expect(screen.getByTestId('stacked-segment-3')).toHaveStyle({
      backgroundColor: '#F2CC8F',
    });
  });

  it('outlines the location-matched category with the highlight color', () => {
    render(
      <StackedCategoryBar
        categories={[
          { value: 'forest', className: 'Forest', count: 1, fraction: 0.5 },
          { value: 'grass', className: 'Grassland', count: 1, fraction: 0.5 },
        ]}
        selectedValue={null}
        highlightedValue='grass'
        onSelect={jest.fn()}
        descriptionColor='#666'
        highlightOutlineColor='#F59E0B'
      />,
    );

    expect(screen.getByTestId('stacked-segment-0')).toHaveStyle({
      borderWidth: 3,
      borderColor: 'transparent',
      borderStyle: 'solid',
    });
    expect(screen.getByTestId('stacked-segment-1')).toHaveStyle({
      borderWidth: 3,
      borderColor: '#F59E0B',
      borderStyle: 'dashed',
    });

    expect(mockNavigationPillList.mock.calls.at(-1)?.[0]).toMatchObject({
      highlightedKey: 'grass',
      highlightOutlineColor: '#F59E0B',
    });
  });

  it('shows an unobserved highlighted pill and warning copy for pinned map categories', () => {
    render(
      <StackedCategoryBar
        categories={[
          { value: 'forest', className: 'Forest', count: 1, fraction: 0.5 },
          { value: 'grass', className: 'Grassland', count: 1, fraction: 0.5 },
        ]}
        selectedValue={null}
        unobservedHighlightedCategory={{
          value: 'urban',
          label: 'Urban',
          description: 'Developed land',
        }}
        onSelect={jest.fn()}
        descriptionColor='#666'
        highlightOutlineColor='#F59E0B'
      />,
    );

    expect(mockNavigationPillList.mock.calls.at(-1)?.[0]).toMatchObject({
      highlightedKey: '__other__',
      highlightOutlineColor: '#F59E0B',
    });
    expect(screen.getByText('Other (Urban)')).toBeTruthy();
    expect(
      screen.getByText('Species has never been observed in this environment'),
    ).toBeTruthy();
  });

  it('highlights the existing Other category and appends the unobserved label', () => {
    const categories = Array.from({ length: 9 }).map((_, index) => ({
      value: `cat-${index}`,
      className: `Category ${index}`,
      count: 2,
      fraction: 0.1,
    }));

    render(
      <StackedCategoryBar
        categories={categories}
        selectedValue={null}
        unobservedHighlightedCategory={{
          value: 'urban',
          label: 'Urban',
          description: null,
        }}
        onSelect={jest.fn()}
        descriptionColor='#666'
        highlightOutlineColor='#F59E0B'
      />,
    );

    expect(mockNavigationPillList.mock.calls.at(-1)?.[0]).toMatchObject({
      highlightedKey: '__other__',
      highlightOutlineColor: '#F59E0B',
    });
    expect(screen.getByText('Other (Urban)')).toBeTruthy();
    expect(screen.getByTestId('stacked-segment-8')).toHaveStyle({
      borderWidth: 3,
      borderColor: '#F59E0B',
      borderStyle: 'dashed',
    });
  });

  it('matches the POC behavior by highlighting Other from the raw pinned value and class name', () => {
    const categories = Array.from({ length: 9 }).map((_, index) => ({
      value: index === 8 ? 70 : index + 1,
      className: index === 8 ? 'Observed Other Class' : `Category ${index}`,
      count: 2,
      fraction: 0.1,
    }));

    render(
      <StackedCategoryBar
        categories={categories}
        selectedValue={null}
        pinnedValue={62}
        pinnedClassName='Closed deciduous broadleaved forest'
        onSelect={jest.fn()}
        descriptionColor='#666'
        highlightOutlineColor='#F59E0B'
      />,
    );

    expect(mockNavigationPillList.mock.calls.at(-1)?.[0]).toMatchObject({
      highlightedKey: '__other__',
      highlightOutlineColor: '#F59E0B',
    });
    expect(
      screen.getByText('Other (Closed deciduous broadleaved forest)'),
    ).toBeTruthy();
    expect(screen.getByTestId('stacked-segment-8')).toHaveStyle({
      borderWidth: 3,
      borderColor: '#F59E0B',
      borderStyle: 'dashed',
    });
  });

  it('renders empty-state branch', () => {
    render(
      <StackedCategoryBar
        categories={[]}
        selectedValue={null}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    expect(screen.getByText('Categories unavailable.')).toBeTruthy();
  });

  it('renders selected description with explicit category description', () => {
    render(
      <StackedCategoryBar
        categories={[
          {
            value: 'forest',
            className: 'Forest',
            count: 6,
            fraction: 0.6,
            description: 'Forested areas.',
          },
          {
            value: 'grass',
            className: 'Grassland',
            count: 4,
            fraction: 0.4,
          },
        ]}
        selectedValue={'forest'}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    expect(screen.getByText(/Forested areas/)).toBeTruthy();
    expect(
      screen.getByText(/This accounts for 60% of all observations/),
    ).toBeTruthy();
  });

  it('aggregates into Other category when over display limit and supports pill selection', () => {
    const onSelect = jest.fn();
    const categories = Array.from({ length: 10 }).map((_, index) => ({
      value: `cat-${index}`,
      className: `Category ${index}`,
      count: 1,
      fraction: 0.1,
    }));

    render(
      <StackedCategoryBar
        categories={categories}
        selectedValue={null}
        onSelect={onSelect}
        descriptionColor='#666'
      />,
    );

    expect(screen.getByText('Other')).toBeTruthy();

    fireEvent.press(screen.getByTestId('pill-cat-0'));
    expect(onSelect).toHaveBeenCalledWith('cat-0');
  });

  it('renders Other selection copy when selected value is __other__', () => {
    const categories = Array.from({ length: 9 }).map((_, index) => ({
      value: `cat-${index}`,
      className: `Category ${index}`,
      count: 2,
      fraction: 0.1,
      description: `Description ${index}`,
    }));

    render(
      <StackedCategoryBar
        categories={categories}
        selectedValue={'__other__'}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    expect(screen.getByText(/Together these account/)).toBeTruthy();
  });

  it('formats tiny percentages and supports no-description branch', () => {
    render(
      <StackedCategoryBar
        categories={[
          { value: 'rare', className: 'Rare', count: 1, fraction: 0.009 },
          {
            value: 'unknown',
            className: 'Unknown',
            count: Number.NaN,
            fraction: Number.NaN,
          },
        ]}
        selectedValue={'rare'}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    expect(screen.getByText(/<1%/)).toBeTruthy();
  });

  it('filters invalid-fraction categories and ignores unknown pill selection keys', () => {
    const onSelect = jest.fn();
    render(
      <StackedCategoryBar
        categories={[
          {
            value: 'unknown',
            className: 'Unknown',
            count: Number.NaN,
            fraction: Number.NaN,
          },
          { value: 'normal', className: 'Normal', count: 2, fraction: 0.2 },
        ]}
        selectedValue={'normal'}
        onSelect={onSelect}
        descriptionColor='#666'
      />,
    );

    expect(screen.queryByText('Unknown')).toBeNull();
    expect(screen.getByText(/20% of all observations/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('pill-missing'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders empty state when all categories have invalid fractions', () => {
    render(
      <StackedCategoryBar
        categories={[
          { value: 'x', className: 'X', count: 1, fraction: Number.NaN },
          {
            value: 'y',
            className: 'Y',
            count: 2,
            fraction: Number.POSITIVE_INFINITY,
          },
        ]}
        selectedValue={null}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    expect(screen.getByText('Categories unavailable.')).toBeTruthy();
  });

  it('uses fallback aggregation when extra categories have missing counts', () => {
    const categories: SpeciesEnvironmentCategory[] = Array.from({
      length: 10,
    }).map((_, index) => ({
      value: `cat-${index}`,
      className: `Category ${index}`,
      count: index < 8 ? 1 : Number.NaN,
      fraction: 0.1,
    }));

    render(
      <StackedCategoryBar
        categories={categories}
        selectedValue={'__other__'}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    expect(screen.getByText('Other')).toBeTruthy();
    expect(screen.getByText(/Together these account/)).toBeTruthy();
  });

  it('keeps the pill model stable when only selectedValue changes', () => {
    const categories: SpeciesEnvironmentCategory[] = [
      { value: 'forest', className: 'Forest', count: 6, fraction: 0.6 },
      { value: 'grass', className: 'Grassland', count: 4, fraction: 0.4 },
    ];

    const rendered = render(
      <StackedCategoryBar
        categories={categories}
        selectedValue={'forest'}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    const initialProps = mockNavigationPillList.mock.calls.at(-1)?.[0];
    expect(initialProps?.pills).toBeTruthy();

    rendered.rerender(
      <StackedCategoryBar
        categories={categories}
        selectedValue={'grass'}
        onSelect={jest.fn()}
        descriptionColor='#666'
      />,
    );

    const updatedProps = mockNavigationPillList.mock.calls.at(-1)?.[0];
    expect(updatedProps?.pills).toBe(initialProps?.pills);
    expect(updatedProps?.selectedKey).toBe('grass');
  });
});
