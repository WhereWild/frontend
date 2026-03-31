import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { SelectField } from '../SelectField';

const OPTIONS = [
  { label: 'Hello World', value: 'hello' },
  { label: 'Option 2', value: 'option-2' },
  { label: 'Option 3', value: 'option-3' },
  { label: 'Option 4', value: 'option-4' },
  { label: 'Option 5', value: 'option-5' },
];

const findHostNodeByTestId = (
  root: ReturnType<typeof render>['UNSAFE_root'],
  testID: string,
) => {
  const matches = root.findAll((node) => node.props?.testID === testID && typeof node.type === 'string');
  if (matches.length === 0) {
    throw new Error(`Expected host node with testID ${testID}.`);
  }

  return matches[0] as ReactTestInstance;
};

const findByAccessibilityLabel = (
  root: ReturnType<typeof render>['UNSAFE_root'],
  label: string,
) => {
  const matches = root.findAll((node) => node.props?.accessibilityLabel === label);
  if (matches.length === 0) {
    throw new Error(`Expected node with accessibilityLabel ${label}.`);
  }

  return matches[0] as ReactTestInstance;
};

const findPressableByAccessibilityLabel = (
  root: ReturnType<typeof render>['UNSAFE_root'],
  label: string,
) => {
  const matches = root.findAll(
    (node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function',
  );
  if (matches.length === 0) {
    throw new Error(`Expected pressable node with accessibilityLabel ${label}.`);
  }

  return matches[0] as ReactTestInstance;
};

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
    const rendered = render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));

    const input = findHostNodeByTestId(rendered.UNSAFE_root, 'select-field-portal-input');
    fireEvent.changeText(input, 'Option 4');

    expect(findByAccessibilityLabel(rendered.UNSAFE_root, 'Select Option 4')).toBeTruthy();
    expect(() => findByAccessibilityLabel(rendered.UNSAFE_root, 'Select Option 2')).toThrow();
  });

  it('renders option press targets when opened', () => {
    const rendered = render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    expect(findPressableByAccessibilityLabel(rendered.UNSAFE_root, 'Select Option 3')).toBeTruthy();
  });

  it('supports keyboard selection when searchable', () => {
    const handleValueChange = jest.fn();
    const rendered = render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    const input = findHostNodeByTestId(rendered.UNSAFE_root, 'select-field-portal-input');
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Enter' } });

    expect(handleValueChange).toHaveBeenCalledWith('hello');
  });

  it('selects the last option when pressing ArrowUp first', () => {
    const handleValueChange = jest.fn();
    const rendered = render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    const input = findHostNodeByTestId(rendered.UNSAFE_root, 'select-field-portal-input');
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowUp' } });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Enter' } });

    expect(handleValueChange).toHaveBeenCalledWith('option-5');
  });

  it('does not select when Enter is pressed without a highlight', () => {
    const handleValueChange = jest.fn();
    const rendered = render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    const input = findHostNodeByTestId(rendered.UNSAFE_root, 'select-field-portal-input');
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Enter' } });

    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('closes on Escape and triggers onOpenChange', () => {
    const handleOpenChange = jest.fn();
    const rendered = render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={OPTIONS}
        value=""
        onOpenChange={handleOpenChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    const input = findHostNodeByTestId(rendered.UNSAFE_root, 'select-field-portal-input');
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Escape' } });

    expect(handleOpenChange).toHaveBeenCalledWith(true);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('does nothing when options are empty', () => {
    const handleValueChange = jest.fn();
    const rendered = render(
      <SelectField
        label="Label"
        placeholder="Value"
        options={[]}
        value=""
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Label'));
    const input = findHostNodeByTestId(rendered.UNSAFE_root, 'select-field-portal-input');
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'ArrowDown' } });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Enter' } });

    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('supports keyboard selection when not searchable', () => {
    const handleValueChange = jest.fn();
    const rendered = render(
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
    const input = findHostNodeByTestId(rendered.UNSAFE_root, 'select-field-portal-input');
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
    const rendered = render(
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
    expect(findByAccessibilityLabel(rendered.UNSAFE_root, 'Select Option 2')).toBeTruthy();
    expect(findByAccessibilityLabel(rendered.UNSAFE_root, 'Select Hello World')).toBeTruthy();
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
