import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import renderer, { act as rendererAct } from 'react-test-renderer';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { RadioGroup, type RadioGroupOption } from '../RadioGroup';
import { RadioField } from '../RadioField';

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const OPTIONS: RadioGroupOption[] = [
  { label: 'One', value: 'one', description: 'One description' },
  { label: 'Two', value: 'two', description: 'Two description' },
  { label: 'Three', value: 'three' },
];

describe('RadioGroup', () => {
  beforeEach(() => {
    mockedUseColorScheme.mockReturnValue('dark');
  });

  it('renders group label, description, and options', () => {
    render(
      <RadioGroup
        label="Group label"
        description="Group description"
        options={OPTIONS}
        value="one"
      />,
    );

    expect(screen.getByText('Group label')).toBeTruthy();
    expect(screen.getByText('Group description')).toBeTruthy();
    expect(screen.getByText('One')).toBeTruthy();
    expect(screen.getByText('Two')).toBeTruthy();
  });

  it('calls onValueChange when selecting a different option', () => {
    const handleValueChange = jest.fn();
    render(
      <RadioGroup
        label="Group"
        options={OPTIONS}
        value="one"
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Two'));

    expect(handleValueChange).toHaveBeenCalledWith('two');
  });

  it('does not call onValueChange when selecting the active option', () => {
    const handleValueChange = jest.fn();
    render(
      <RadioGroup
        label="Group"
        options={OPTIONS}
        value="one"
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('One'));

    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('manages selected value internally when uncontrolled', () => {
    render(
      <RadioGroup
        options={OPTIONS}
        defaultValue="one"
      />,
    );

    expect(screen.getByLabelText('One').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Two').props.accessibilityState.selected).toBe(false);

    fireEvent.press(screen.getByLabelText('Two'));

    expect(screen.getByLabelText('One').props.accessibilityState.selected).toBe(false);
    expect(screen.getByLabelText('Two').props.accessibilityState.selected).toBe(true);
  });

  it('respects per-option disabled state', () => {
    const handleValueChange = jest.fn();

    render(
      <RadioGroup
        options={[
          { label: 'Enabled', value: 'enabled' },
          { label: 'Option disabled', value: 'option-disabled', disabled: true },
        ]}
        value="enabled"
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Option disabled'));
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('respects disabled state from the group', () => {
    const handleValueChange = jest.fn();

    render(
      <RadioGroup
        options={OPTIONS}
        value="one"
        disabled
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Two'));
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('exposes radiogroup accessibility role', () => {
    render(
      <RadioGroup
        label="Accessibility group"
        options={OPTIONS}
        value="one"
      />,
    );

    const group = screen.getByLabelText('Accessibility group');
    expect(group.props.accessibilityRole).toBe('radiogroup');
  });

  it('returns early in onSelectValue for matching value and disabled states', () => {
    const onValueChange = jest.fn();
    let testRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      testRenderer = renderer.create(
        <RadioGroup
          options={OPTIONS}
          value="one"
          onValueChange={onValueChange}
        />,
      );
    });

    const radioFields = testRenderer!.root.findAllByType(RadioField);
    const firstOnValueChange = radioFields[0]?.props.onValueChange as (() => void) | undefined;
    firstOnValueChange?.();
    expect(onValueChange).not.toHaveBeenCalled();

    rendererAct(() => {
      testRenderer!.update(
        <RadioGroup
          options={OPTIONS}
          value="one"
          disabled
          onValueChange={onValueChange}
        />,
      );
    });

    const disabledFields = testRenderer!.root.findAllByType(RadioField);
    const secondOnValueChange = disabledFields[1]?.props.onValueChange as (() => void) | undefined;
    secondOnValueChange?.();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('uses light palette tokens for group label in light mode', () => {
    mockedUseColorScheme.mockReturnValue('light');
    const palette = Colors.light;

    render(
      <RadioGroup
        label="Light group"
        options={OPTIONS}
        value="one"
      />,
    );

    const label = screen.getByText('Light group');
    const labelStyle = Array.isArray(label.props.style) ? label.props.style : [label.props.style];
    const colorLayer = labelStyle.find(
      (entry: unknown) => typeof entry === 'object' && entry !== null && 'color' in (entry as Record<string, unknown>),
    ) as { color?: string } | undefined;

    expect(colorLayer?.color).toBe(palette.text.default.default);
  });
});
