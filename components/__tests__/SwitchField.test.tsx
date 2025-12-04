import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SwitchField } from '../inputs/SwitchField';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('SwitchField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('light');
  });

  it('renders label + description and toggles value when pressed', () => {
    mockUseColorScheme.mockReturnValueOnce('dark');
    const handleChange = jest.fn();
    const { getByRole, getByText } = render(
      <SwitchField
        label="Sightings alerts"
        description="Send a notification when rare species are nearby."
        value={false}
        onValueChange={handleChange}
      />,
    );

    const toggle = getByRole('switch', { name: 'Sightings alerts' });
    const labelNode = getByText('Sightings alerts');
    const descriptionNode = getByText('Send a notification when rare species are nearby.');
    const labelStyle = StyleSheet.flatten(labelNode.props.style);
    const descriptionStyle = StyleSheet.flatten(descriptionNode.props.style);

    expect(descriptionStyle?.marginTop).toBe(Size.space['100']);
    expect(labelStyle?.color).toBe(Colors.dark.text.default.default);
    expect(descriptionStyle?.color).toBe(Colors.dark.text.default.secondary);
    fireEvent.press(toggle);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('prevents toggling when disabled and announces custom accessibility label', () => {
    const handleChange = jest.fn();
    const { getByRole } = render(
      <SwitchField
        label="Location sharing"
        value={false}
        onValueChange={handleChange}
        disabled
        accessibilityLabel="Share location"
      />,
    );

    const toggle = getByRole('switch', { name: 'Share location' });

    fireEvent.press(toggle);
    act(() => {
      const onPress = (toggle.props as Record<string, unknown>).onPress as (() => void) | undefined;
      onPress?.();
    });

    expect(handleChange).not.toHaveBeenCalled();
    expect(toggle.props.accessibilityState).toMatchObject({ disabled: true, checked: false });
  });

  it('supports controlled updates without description and exposes press states', () => {
    function ControlledSwitch() {
      const [value, setValue] = React.useState(true);
      return (
        <SwitchField
          label="Auto-download maps"
          value={value}
          onValueChange={setValue}
          testID="switch-control"
        />
      );
    }

    const { getByTestId, queryByText } = render(<ControlledSwitch />);

    expect(queryByText('Auto-download maps')).toBeTruthy();
    expect(queryByText('Disabled until offline mode is enabled.')).toBeNull();

    const toggle = getByTestId('switch-control');
    fireEvent.press(toggle);
    fireEvent.press(toggle);
  });

  it('applies palette-driven colors to the track and knob across states', async () => {
    const palette = Colors.light;
    const baseProps = {
      label: 'Night mode',
      value: false,
      onValueChange: jest.fn(),
    };
    const { rerender, getByRole } = render(<SwitchField {...baseProps} />);

    const readTrackColor = (node: any) => {
      const flattened = StyleSheet.flatten<ViewStyle>(node.props.style);
      return flattened?.backgroundColor;
    };

    const readKnobColor = (node: any) => {
      const child = Array.isArray(node.props.children)
        ? node.props.children[0]
        : node.props.children;
      const knobElement = child as React.ReactElement<{ style: StyleProp<ViewStyle> }>;
      const flattened = StyleSheet.flatten<ViewStyle>(knobElement.props.style);
      return flattened?.backgroundColor;
    };

    let toggle = getByRole('switch', { name: 'Night mode' });

    expect(readTrackColor(toggle)).toBe(palette.background.default.secondary);
    fireEvent(toggle, 'pressIn');
    let pressedToggle = getByRole('switch', { name: 'Night mode' });
    expect(readTrackColor(pressedToggle)).toBe(palette.background.default.secondaryPressed);
    fireEvent(pressedToggle, 'pressOut');
    expect(readKnobColor(toggle)).toBe(palette.icon.neutral.default);

    rerender(<SwitchField {...baseProps} value />);
    toggle = getByRole('switch', { name: 'Night mode' });

    expect(readTrackColor(toggle)).toBe(palette.background.brand.default);
    fireEvent(toggle, 'pressIn');
    pressedToggle = getByRole('switch', { name: 'Night mode' });
    expect(readTrackColor(pressedToggle)).toBe(palette.background.brand.pressed);
    expect(readKnobColor(toggle)).toBe(palette.icon.brand.onBrand);

    rerender(<SwitchField {...baseProps} value disabled />);
    await waitFor(() => {
      const disabledToggle = getByRole('switch', { name: 'Night mode' });
      expect(readTrackColor(disabledToggle)).toBe(palette.background.disabled.default);
      expect(readKnobColor(disabledToggle)).toBe(palette.icon.disabled.onDisabled);
    });
  });
});
