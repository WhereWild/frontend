import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import renderer, { act as rendererAct } from 'react-test-renderer';
import { SwitchField } from '../SwitchField';
import { Colors } from '@/constants/theme';

type PressableStyleState = { pressed: boolean; hovered: boolean };

const getStyleProperty = (styles: unknown[], propertyName: string): string | undefined => {
  for (let index = styles.length - 1; index >= 0; index -= 1) {
    const style = styles[index];
    if (typeof style === 'object' && style !== null && propertyName in style) {
      const value = (style as Record<string, unknown>)[propertyName];
      if (typeof value === 'string') {
        return value;
      }
    }
  }
  return undefined;
};

describe('SwitchField', () => {
  it('renders label and description when provided', () => {
    render(
      <SwitchField
        label="Label"
        description="Description"
        value
      />,
    );

    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('calls onValueChange with the toggled value', () => {
    const handleValueChange = jest.fn();
    render(
      <SwitchField
        label="Notifications"
        value={false}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Notifications'));

    expect(handleValueChange).toHaveBeenCalledWith(true);
  });

  it('manages value internally when uncontrolled', () => {
    render(
      <SwitchField
        label="Auto Sync"
        defaultValue={false}
      />,
    );

    const control = screen.getByLabelText('Auto Sync');
    expect(control.props.accessibilityState.checked).toBe(false);

    fireEvent.press(control);

    const toggledOnControl = screen.getByLabelText('Auto Sync');
    expect(toggledOnControl.props.accessibilityState.checked).toBe(true);

    fireEvent.press(toggledOnControl);

    expect(screen.getByLabelText('Auto Sync').props.accessibilityState.checked).toBe(false);
  });

  it('does not toggle when disabled', () => {
    const handleValueChange = jest.fn();
    render(
      <SwitchField
        label="Disabled toggle"
        value={false}
        disabled
        onValueChange={handleValueChange}
      />,
    );

    const control = screen.getByLabelText('Disabled toggle');
    fireEvent.press(control);

    expect(control.props.accessibilityState.disabled).toBe(true);
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('renders without label and description', () => {
    render(<SwitchField value={false} />);

    expect(screen.getByLabelText('Switch field')).toBeTruthy();
    expect(screen.queryByText('Label')).toBeNull();
    expect(screen.queryByText('Description')).toBeNull();
  });

  it('applies hover and pressed track backgrounds', () => {
    const palette = Colors.dark;
    let testRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      testRenderer = renderer.create(<SwitchField label="State styles" value={false} />);
    });

    const switchNode = testRenderer!.root.findByProps({ accessibilityLabel: 'State styles' });
    const styleFn = switchNode.props.style as (state: PressableStyleState) => unknown[];

    const defaultStyle = styleFn({ pressed: false, hovered: false });
    const hoveredStyle = styleFn({ pressed: false, hovered: true });
    const pressedStyle = styleFn({ pressed: true, hovered: false });

    expect(getStyleProperty(defaultStyle, 'backgroundColor')).toBe(palette.background.default.secondary);
    expect(getStyleProperty(hoveredStyle, 'backgroundColor')).toBe(palette.background.default.secondaryHover);
    expect(getStyleProperty(pressedStyle, 'backgroundColor')).toBe(palette.background.default.secondaryPressed);
  });
});
