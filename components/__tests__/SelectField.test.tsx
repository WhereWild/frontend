import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SelectField, type SelectFieldOption } from '../inputs/SelectField';

const OPTIONS: SelectFieldOption[] = [
  { label: 'Fennec Fox', value: 'fennec' },
  { label: 'Snow Leopard', value: 'snow' },
  { label: 'Red Panda', value: 'panda' },
];

describe('SelectField', () => {
  it('renders label and placeholder text', () => {
    render(
      <SelectField
        label="Species"
        placeholder="Choose a species"
        options={OPTIONS}
      />,
    );

    expect(screen.getByText('Species')).toBeTruthy();
    expect(screen.getByText('Choose a species')).toBeTruthy();
  });

  it('opens the option list and fires onValueChange when a new option is selected', async () => {
    const handleChange = jest.fn();
    render(
      <SelectField
        label="Species"
        placeholder="Choose a species"
        options={OPTIONS}
        onValueChange={handleChange}
      />,
    );

    fireEvent.press(screen.getByTestId('select-field-trigger'));
    const option = await screen.findByText('Snow Leopard');
    fireEvent.press(option);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('snow');
    expect(screen.getByText('Snow Leopard')).toBeTruthy();
  });

  it('prevents interaction when disabled', () => {
    render(
      <SelectField
        label="Species"
        placeholder="Choose"
        options={OPTIONS}
        disabled
      />,
    );

    fireEvent.press(screen.getByTestId('select-field-trigger'));

    expect(screen.queryByText('Snow Leopard')).toBeNull();
    expect(screen.queryByTestId('select-field-option-0')).toBeNull();
    expect(screen.queryByTestId('select-field-dropdown')).toBeNull();
  });

  it('respects a controlled value', () => {
    const { rerender } = render(
      <SelectField
        label="Species"
        value="fennec"
        options={OPTIONS}
        onValueChange={jest.fn()}
      />,
    );

    expect(screen.getByText('Fennec Fox')).toBeTruthy();

    rerender(
      <SelectField
        label="Species"
        value="panda"
        options={OPTIONS}
        onValueChange={jest.fn()}
      />,
    );

    expect(screen.getByText('Red Panda')).toBeTruthy();
  });

  it('renders an error message', () => {
    render(
      <SelectField
        label="Species"
        options={OPTIONS}
        errorMessage="Selection required"
      />,
    );

    expect(screen.getByText('Selection required')).toBeTruthy();
  });

  it('renders the description text when provided', () => {
    render(
      <SelectField
        label="Species"
        description="Pick a mammal"
        options={OPTIONS}
      />,
    );

    expect(screen.getByText('Pick a mammal')).toBeTruthy();
  });

  it('falls back to the placeholder for accessibility label when no label is supplied', () => {
    render(
      <SelectField
        placeholder="Choose a species"
        options={OPTIONS}
      />,
    );

    expect(screen.getByLabelText('Choose a species')).toBeTruthy();
  });

  it('marks the default option as selected when the menu opens', async () => {
    render(
      <SelectField
        label="Species"
        defaultValue="fennec"
        options={OPTIONS}
      />,
    );

    fireEvent.press(screen.getByTestId('select-field-trigger'));

    const firstOption = await screen.findByTestId('select-field-option-0');
    expect(firstOption.props.accessibilityState?.selected).toBe(true);
  });

  it('does not call onValueChange when selecting the same option twice', async () => {
    const handleChange = jest.fn();
    render(
      <SelectField
        label="Species"
        defaultValue="fennec"
        options={OPTIONS}
        onValueChange={handleChange}
      />,
    );

    fireEvent.press(screen.getByTestId('select-field-trigger'));
    const firstOption = await screen.findByTestId('select-field-option-0');
    fireEvent.press(firstOption);

    expect(handleChange).not.toHaveBeenCalled();
  });
});
