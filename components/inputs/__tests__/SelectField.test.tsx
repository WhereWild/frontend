import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';
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

  it('selects the last option when pressing ArrowUp first', () => {
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
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowUp' } });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Enter' } });

    expect(handleValueChange).toHaveBeenCalledWith('option-5');
  });

  it('does not select when Enter is pressed without a highlight', () => {
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
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Enter' } });

    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('closes on Escape and triggers onOpenChange', () => {
    const handleOpenChange = jest.fn();
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        onOpenChange={handleOpenChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    const input = screen.getByPlaceholderText('Value');
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Escape' } });

    expect(handleOpenChange).toHaveBeenCalledWith(true);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('does nothing when options are empty', () => {
    const handleValueChange = jest.fn();
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={[]}
        value=""
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    const input = screen.getByPlaceholderText('Value');
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Enter' } });

    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('supports keyboard selection when not searchable', () => {
    const handleValueChange = jest.fn();
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        allowSearch={false}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    const inputCandidates = screen.getAllByLabelText('Label');
    const input = inputCandidates.find((node) => typeof node.props?.onKeyPress === 'function');
    expect(input).toBeTruthy();
    if (!input) {
      throw new Error('Expected keyboard input to be rendered.');
    }
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

  it('renders selected value when provided', () => {
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value="option-2"
      />,
    );

    expect(screen.getByText('Option 2')).toBeTruthy();
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

  it('calls onOpenChange and closes on backdrop press', () => {
    const handleOpenChange = jest.fn();
    render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        onOpenChange={handleOpenChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    expect(handleOpenChange).toHaveBeenCalledWith(true);

    fireEvent.press(screen.getByLabelText('Close dropdown'));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText('Option 2')).toBeNull();
  });
});
