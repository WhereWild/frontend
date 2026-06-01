import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SpeciesObservationFilters } from '../SpeciesObservationFilters';

jest.mock('@/components/inputs/SelectField', () => ({
  SelectField: ({ label, placeholder, options, value, onValueChange, disabled }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        <Text>{label}</Text>
        <Text testID='placeholder'>{placeholder}</Text>
        <Text testID='value'>{value}</Text>
        <Text testID='disabled'>{String(disabled)}</Text>
        {options.map((opt: any) => (
          <Pressable key={opt.value} testID={`option-${opt.value}`} onPress={() => onValueChange(opt.value)}>
            <Text>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));

describe('SpeciesObservationFilters', () => {
  it('shows loading state when phenologyCounts is null', () => {
    const { getByTestId } = render(
      <SpeciesObservationFilters
        selectedPhenology={null}
        onPhenologyChange={jest.fn()}
        phenologyCounts={null}
      />,
    );
    expect(getByTestId('placeholder').props.children).toBe('Loading…');
    expect(getByTestId('disabled').props.children).toBe('true');
  });

  it('shows all option only when phenologyCounts is null', () => {
    const { getByTestId, queryByTestId } = render(
      <SpeciesObservationFilters
        selectedPhenology={null}
        onPhenologyChange={jest.fn()}
        phenologyCounts={null}
      />,
    );
    expect(getByTestId('option-')).toBeTruthy();
    expect(queryByTestId('option-flowers')).toBeNull();
  });

  it('builds sorted options from phenologyCounts', () => {
    const { getByTestId } = render(
      <SpeciesObservationFilters
        selectedPhenology={null}
        onPhenologyChange={jest.fn()}
        phenologyCounts={{ flowers: 100, 'fruits or seeds': 50 }}
      />,
    );
    expect(getByTestId('option-')).toBeTruthy();
    expect(getByTestId('option-flowers')).toBeTruthy();
    expect(getByTestId('option-fruits or seeds')).toBeTruthy();
    expect(getByTestId('disabled').props.children).toBe('false');
    expect(getByTestId('placeholder').props.children).toBe('Select');
  });

  it('calls onPhenologyChange with null when empty string selected', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <SpeciesObservationFilters
        selectedPhenology='flowers'
        onPhenologyChange={onChange}
        phenologyCounts={{ flowers: 100 }}
      />,
    );
    fireEvent.press(getByTestId('option-'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onPhenologyChange with value when option selected', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <SpeciesObservationFilters
        selectedPhenology={null}
        onPhenologyChange={onChange}
        phenologyCounts={{ flowers: 100 }}
      />,
    );
    fireEvent.press(getByTestId('option-flowers'));
    expect(onChange).toHaveBeenCalledWith('flowers');
  });

  it('reflects selectedPhenology as current value', () => {
    const { getByTestId } = render(
      <SpeciesObservationFilters
        selectedPhenology='flowers'
        onPhenologyChange={jest.fn()}
        phenologyCounts={{ flowers: 100 }}
      />,
    );
    expect(getByTestId('value').props.children).toBe('flowers');
  });
});
