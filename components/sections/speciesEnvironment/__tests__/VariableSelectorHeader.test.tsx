import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { VariableSelectorHeader } from '../VariableSelectorHeader';

const mockReact = React;
const mockView = View;
const mockPressable = Pressable;
const mockText = Text;

type MockTab = { key: string; label: string };
type TabsMockProps = {
  tabs: MockTab[];
  onSelectionChange?: (key: string) => void;
};

type MockOption = { value: string; label: string };
type SelectFieldMockProps = {
  options: MockOption[];
  onValueChange?: (value: string) => void;
  value: string;
};

jest.mock('@/components/tabs/Tabs', () => ({
  Tabs: ({ tabs, onSelectionChange }: TabsMockProps) =>
    mockReact.createElement(
      mockView,
      null,
      tabs.map((tab) =>
        mockReact.createElement(
          mockPressable,
          {
            key: tab.key,
            testID: `category-${tab.key}`,
            onPress: () => onSelectionChange?.(tab.key),
          },
          mockReact.createElement(mockText, null, tab.label),
        ),
      ),
    ),
}));

jest.mock('@/components/inputs/SelectField', () => ({
  SelectField: ({ options, onValueChange, value }: SelectFieldMockProps) =>
    mockReact.createElement(
      mockView,
      null,
      mockReact.createElement(mockText, { testID: 'selected-variable' }, value),
      options.map((option) =>
        mockReact.createElement(
          mockPressable,
          {
            key: option.value,
            testID: `option-${option.value}`,
            onPress: () => onValueChange?.(option.value),
          },
          mockReact.createElement(mockText, null, option.label),
        ),
      ),
    ),
}));

describe('VariableSelectorHeader', () => {
  it('renders category tabs and variable options with unit suffix for continuous values', () => {
    const onCategoryChange = jest.fn();
    const onVariableChange = jest.fn();

    render(
      <VariableSelectorHeader
        categories={['Climate', 'Land cover']}
        selectedVariableCategory={'Climate'}
        onCategoryChange={onCategoryChange}
        filteredVariables={[
          { id: 'bio_1', label: 'Annual Temp', units: 'C', valueType: 'continuous', category: 'Climate' },
          { id: 'landcover', label: 'Land Cover', units: '%', valueType: 'categorical', category: 'Land cover' },
        ]}
        selectedVariable={'bio_1'}
        onVariableChange={onVariableChange}
        headingText={null}
        metaText={null}
      />,
    );

    expect(screen.getByText('Annual Temp (C)')).toBeTruthy();
    expect(screen.getByText('Land Cover')).toBeTruthy();

    fireEvent.press(screen.getByTestId('category-Land cover'));
    expect(onCategoryChange).toHaveBeenCalledWith('Land cover');

    fireEvent.press(screen.getByTestId('option-landcover'));
    expect(onVariableChange).toHaveBeenCalledWith('landcover');
  });

  it('renders heading/meta fallback when no variable options exist', () => {
    render(
      <VariableSelectorHeader
        categories={[]}
        selectedVariableCategory={null}
        onCategoryChange={jest.fn()}
        filteredVariables={[]}
        selectedVariable={'bio_1'}
        onVariableChange={jest.fn()}
        headingText={'Environment'}
        metaText={'(Based on 10 observations)'}
      />,
    );

    expect(screen.getByText('Environment')).toBeTruthy();
    expect(screen.getByText('(Based on 10 observations)')).toBeTruthy();
  });

  it('defaults to first category when selected category is null and omits heading/meta when absent', () => {
    render(
      <VariableSelectorHeader
        categories={['Climate', 'Land cover']}
        selectedVariableCategory={null}
        onCategoryChange={jest.fn()}
        filteredVariables={[]}
        selectedVariable={'bio_1'}
        onVariableChange={jest.fn()}
        headingText={null}
        metaText={null}
      />,
    );

    expect(screen.getByTestId('category-Climate')).toBeTruthy();
    expect(screen.queryByTestId('selected-variable')).toBeNull();
    expect(screen.queryByText('Environment')).toBeNull();
  });
});
