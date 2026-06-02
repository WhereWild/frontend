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
  disableNativeHoverVisuals?: boolean;
};

type MockOption = { value: string; label: string };
type SelectFieldMockProps = {
  options: MockOption[];
  onValueChange?: (value: string) => void;
  value: string;
  placeholder?: string;
  disabled?: boolean;
};

jest.mock('@/components/tabs/Tabs', () => ({
  Tabs: ({
    tabs,
    onSelectionChange,
    disableNativeHoverVisuals,
  }: TabsMockProps) =>
    mockReact.createElement(
      mockView,
      {
        testID: disableNativeHoverVisuals
          ? 'tabs-native-hover-disabled'
          : undefined,
      },
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
  SelectField: ({
    options,
    onValueChange,
    value,
    placeholder,
    disabled,
  }: SelectFieldMockProps) =>
    mockReact.createElement(
      mockView,
      null,
      mockReact.createElement(
        mockText,
        { testID: `selected-variable-${placeholder ?? 'default'}` },
        value,
      ),
      mockReact.createElement(
        mockText,
        { testID: `select-disabled-${placeholder ?? 'default'}` },
        disabled ? 'true' : 'false',
      ),
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
          {
            id: 'bio_1',
            label: 'Annual Temp',
            units: 'C',
            valueType: 'continuous',
            category: 'Climate',
          },
          {
            id: 'landcover',
            label: 'Land Cover',
            units: '%',
            valueType: 'categorical',
            category: 'Land cover',
          },
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
    expect(screen.getByTestId('tabs-native-hover-disabled')).toBeTruthy();

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
    expect(
      screen.queryByTestId('selected-variable-Select environment variable'),
    ).toBeNull();
    expect(screen.queryByText('Environment')).toBeNull();
  });

  it('renders split selectors for temporal variables and deduplicates base options', () => {
    render(
      <VariableSelectorHeader
        categories={['Recent Weather']}
        selectedVariableCategory={'Recent Weather'}
        onCategoryChange={jest.fn()}
        filteredVariables={[
          {
            id: 'temperature_2m_avg_24h',
            label: 'Air Temperature (2m) (Avg, 24h)',
            units: 'C',
            valueType: 'continuous',
            category: 'Recent Weather',
          },
          {
            id: 'temperature_2m_avg_168h',
            label: 'Air Temperature (2m) (Avg, 168h)',
            units: 'C',
            valueType: 'continuous',
            category: 'Recent Weather',
          },
          {
            id: 'precipitation_sum_24h',
            label: 'Precipitation (Sum, 24h)',
            units: 'mm',
            valueType: 'continuous',
            category: 'Recent Weather',
          },
        ]}
        selectedVariable={'temperature_2m_avg_24h'}
        onVariableChange={jest.fn()}
        headingText={null}
        metaText={null}
      />,
    );

    expect(screen.getByText('Air Temperature (2m)')).toBeTruthy();
    expect(screen.getByText('Precipitation')).toBeTruthy();
    expect(screen.getByText('1 day')).toBeTruthy();
    expect(screen.getByText('1 week')).toBeTruthy();
    expect(
      screen.getByTestId('selected-variable-Select variable'),
    ).toHaveTextContent('temperature_2m');
    expect(screen.getByTestId('selected-variable-No window')).toHaveTextContent(
      'temperature_2m_avg_24h',
    );
    expect(screen.getByTestId('select-disabled-No window')).toHaveTextContent(
      'false',
    );
  });

  it('switches bases by selecting the first available temporal window', () => {
    const onVariableChange = jest.fn();

    render(
      <VariableSelectorHeader
        categories={['Recent Weather']}
        selectedVariableCategory={'Recent Weather'}
        onCategoryChange={jest.fn()}
        filteredVariables={[
          {
            id: 'temperature_2m_avg_24h',
            label: 'Air Temperature (2m) (Avg, 24h)',
            units: 'C',
            valueType: 'continuous',
            category: 'Recent Weather',
          },
          {
            id: 'temperature_2m_avg_168h',
            label: 'Air Temperature (2m) (Avg, 168h)',
            units: 'C',
            valueType: 'continuous',
            category: 'Recent Weather',
          },
          {
            id: 'precipitation_sum_24h',
            label: 'Precipitation (Sum, 24h)',
            units: 'mm',
            valueType: 'continuous',
            category: 'Recent Weather',
          },
          {
            id: 'precipitation_sum_168h',
            label: 'Precipitation (Sum, 168h)',
            units: 'mm',
            valueType: 'continuous',
            category: 'Recent Weather',
          },
        ]}
        selectedVariable={'temperature_2m_avg_168h'}
        onVariableChange={onVariableChange}
        headingText={null}
        metaText={null}
      />,
    );

    fireEvent.press(screen.getByTestId('option-precipitation'));
    expect(onVariableChange).toHaveBeenCalledWith('precipitation_sum_24h');
  });

  it('switches temporal windows directly from the window selector', () => {
    const onVariableChange = jest.fn();

    render(
      <VariableSelectorHeader
        categories={['Recent Weather']}
        selectedVariableCategory={'Recent Weather'}
        onCategoryChange={jest.fn()}
        filteredVariables={[
          {
            id: 'temperature_2m_avg_24h',
            label: 'Air Temperature (2m) (Avg, 24h)',
            units: 'C',
            valueType: 'continuous',
            category: 'Recent Weather',
          },
          {
            id: 'temperature_2m_avg_168h',
            label: 'Air Temperature (2m) (Avg, 168h)',
            units: 'C',
            valueType: 'continuous',
            category: 'Recent Weather',
          },
        ]}
        selectedVariable={'temperature_2m_avg_24h'}
        onVariableChange={onVariableChange}
        headingText={null}
        metaText={null}
      />,
    );

    fireEvent.press(screen.getByTestId('option-temperature_2m_avg_168h'));
    expect(onVariableChange).toHaveBeenCalledWith('temperature_2m_avg_168h');
  });

  it('renders split group/variant selectors for grouped variables', () => {
    const onVariableChange = jest.fn();

    render(
      <VariableSelectorHeader
        categories={['Climate']}
        selectedVariableCategory={'Climate'}
        onCategoryChange={jest.fn()}
        filteredVariables={[
          {
            id: 'bio_1_mean',
            label: 'Annual Mean Temperature Mean',
            units: 'C',
            valueType: 'continuous',
            category: 'Climate',
            group: 'bio_1',
            groupLabel: 'Annual Mean Temperature',
          },
          {
            id: 'bio_1_min',
            label: 'Annual Mean Temperature Min',
            units: 'C',
            valueType: 'continuous',
            category: 'Climate',
            group: 'bio_1',
            groupLabel: 'Annual Mean Temperature',
          },
          {
            id: 'bio_1_max',
            label: 'Annual Mean Temperature Max',
            units: 'C',
            valueType: 'continuous',
            category: 'Climate',
            group: 'bio_1',
            groupLabel: 'Annual Mean Temperature',
          },
          {
            id: 'bio_12',
            label: 'Annual Precipitation',
            units: 'mm',
            valueType: 'continuous',
            category: 'Climate',
            group: 'bio_12',
            groupLabel: 'Annual Precipitation',
          },
        ]}
        selectedVariable={'bio_1_mean'}
        onVariableChange={onVariableChange}
        headingText={null}
        metaText={null}
      />,
    );

    expect(screen.getByTestId('selected-variable-Select variable')).toHaveTextContent('bio_1');
    expect(screen.getByTestId('option-bio_1')).toBeTruthy();
    expect(screen.getByTestId('option-bio_12')).toBeTruthy();
    expect(screen.getByTestId('option-bio_1_mean')).toBeTruthy();
    expect(screen.getByTestId('option-bio_1_min')).toBeTruthy();
    expect(screen.getByTestId('option-bio_1_max')).toBeTruthy();
  });

  it('switches to the mean variant when the group base changes', () => {
    const onVariableChange = jest.fn();

    render(
      <VariableSelectorHeader
        categories={['Climate']}
        selectedVariableCategory={'Climate'}
        onCategoryChange={jest.fn()}
        filteredVariables={[
          {
            id: 'bio_1_mean',
            label: 'Annual Mean Temperature Mean',
            units: 'C',
            valueType: 'continuous',
            category: 'Climate',
            group: 'bio_1',
            groupLabel: 'Annual Mean Temperature',
          },
          {
            id: 'bio_1_min',
            label: 'Annual Mean Temperature Min',
            units: 'C',
            valueType: 'continuous',
            category: 'Climate',
            group: 'bio_1',
            groupLabel: 'Annual Mean Temperature',
          },
          {
            id: 'bio_12_mean',
            label: 'Annual Precipitation Mean',
            units: 'mm',
            valueType: 'continuous',
            category: 'Climate',
            group: 'bio_12',
            groupLabel: 'Annual Precipitation',
          },
          {
            id: 'bio_12_min',
            label: 'Annual Precipitation Min',
            units: 'mm',
            valueType: 'continuous',
            category: 'Climate',
            group: 'bio_12',
            groupLabel: 'Annual Precipitation',
          },
        ]}
        selectedVariable={'bio_1_mean'}
        onVariableChange={onVariableChange}
        headingText={null}
        metaText={null}
      />,
    );

    fireEvent.press(screen.getByTestId('option-bio_12'));
    expect(onVariableChange).toHaveBeenCalledWith('bio_12_mean');
  });

  it('renders non-temporal variables in a temporal category as ungrouped base options', () => {
    render(
      <VariableSelectorHeader
        categories={['Recent Weather']}
        selectedVariableCategory={'Recent Weather'}
        onCategoryChange={jest.fn()}
        filteredVariables={[
          {
            id: 'temperature_2m_avg_24h',
            label: 'Air Temperature (2m) (Avg, 24h)',
            units: 'C',
            valueType: 'continuous',
            category: 'Recent Weather',
          },
          {
            id: 'weather_code_simple',
            label: 'Weather Code',
            valueType: 'categorical',
            category: 'Recent Weather',
          },
        ]}
        selectedVariable={'temperature_2m_avg_24h'}
        onVariableChange={jest.fn()}
        headingText={null}
        metaText={null}
      />,
    );

    expect(screen.getByTestId('option-temperature_2m')).toBeTruthy();
    expect(screen.getByTestId('option-weather_code_simple')).toBeTruthy();
  });
});
