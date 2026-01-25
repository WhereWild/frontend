import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SelectField } from '../SelectField';

const OPTIONS = [
  { label: 'Hello World', value: 'hello' },
  { label: 'Option 2', value: 'option-2' },
  { label: 'Option 3', value: 'option-3' },
  { label: 'Option 4', value: 'option-4' },
  { label: 'Option 5', value: 'option-5' },
];

describe('SelectField', () => {
  it('renders label and placeholder when empty', () => {
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
      />,
    );

    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Value')).toBeTruthy();
  });

  it('opens and filters options while typing', () => {
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));

    const input = screen.getByPlaceholderText('Value');
    fireEvent.changeText(input, 'Option 4');

    expect(screen.getByText('Option 4')).toBeTruthy();
    expect(screen.queryByText('Option 2')).toBeNull();
  });

  it('selects an option and closes the list', () => {
    const handleValueChange = jest.fn();
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    fireEvent.press(screen.getByText('Option 3'));

    expect(handleValueChange).toHaveBeenCalledWith('option-3');
  });

  it('supports keyboard selection when searchable', () => {
    const handleValueChange = jest.fn();
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    const input = screen.getByPlaceholderText('Value');
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Enter' } });

    expect(handleValueChange).toHaveBeenCalledWith('hello');
  });

  it('does not open when disabled', () => {
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        disabled
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    expect(screen.queryByPlaceholderText('Value')).toBeNull();
    expect(screen.queryByText('Option 2')).toBeNull();
  });

  it('renders error text when provided', () => {
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        errorMessage="Error"
      />,
    );

    expect(screen.getByText('Error')).toBeTruthy();
  });

  it('renders a list-only variant without a text input', () => {
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        allowSearch={false}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    expect(screen.queryByPlaceholderText('Value')).toBeNull();
    expect(screen.getByText('Option 2')).toBeTruthy();
    expect(screen.getByText('Hello World')).toBeTruthy();
  });
});
