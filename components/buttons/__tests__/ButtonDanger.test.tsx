import { Colors, Size } from '@/constants/theme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import type { ButtonDangerSize, ButtonDangerVariant } from '../ButtonDanger';
import { ButtonDanger, __BUTTON_DANGER_TESTING__ } from '../ButtonDanger';
import { ThemedText } from '../../text/ThemedText';

const createIconProbe = () => {
  const calls: { color?: string }[] = [];
  const IconProbe = (props: { color?: string }) => {
    calls.push(props);
    return <ThemedText testID="danger-icon-probe" />;
  };
  return { IconProbe, calls };
};

describe('ButtonDanger Component', () => {
  describe('Rendering', () => {
    it('renders with text children', () => {
      render(<ButtonDanger>Delete</ButtonDanger>);
      expect(screen.getByText('Delete')).toBeDefined();
    });

    it('renders with label prop', () => {
      render(<ButtonDanger label="Remove" />);
      expect(screen.getByText('Remove')).toBeDefined();
    });

    it('prioritizes label over children prop', () => {
      render(<ButtonDanger label="Label">Children</ButtonDanger>);
      expect(screen.getByText('Label')).toBeDefined();
      expect(screen.queryByText('Children')).toBeNull();
    });
  });

  describe('Variants', () => {
    const variants: ButtonDangerVariant[] = ['primary', 'subtle'];

    variants.forEach((variant) => {
      it(`renders ${variant} variant`, () => {
        render(<ButtonDanger variant={variant}>{variant}</ButtonDanger>);
        expect(screen.getByText(variant)).toBeDefined();
      });
    });

    it('defaults to primary variant (uses danger colors)', () => {
      const { getByRole } = render(<ButtonDanger>Delete</ButtonDanger>);
      const button = getByRole('button');
      expect(button).toBeDefined();
      expect(button.props.accessibilityRole).toBe('button');
    });
  });

  describe('Sizes', () => {
    const sizes: ButtonDangerSize[] = ['small', 'medium'];

    sizes.forEach((size) => {
      it(`renders ${size} size`, () => {
        render(<ButtonDanger size={size}>{size}</ButtonDanger>);
        expect(screen.getByText(size)).toBeDefined();
      });
    });

    it('defaults to medium size with control minHeight', () => {
      const { getByRole } = render(<ButtonDanger>Default Size</ButtonDanger>);
      const button = getByRole('button');
      const styles = button.props.style;
      expect(styles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: Size.control.height.medium,
          }),
        ])
      );
    });
  });

  describe('Icons', () => {
    const iconSource = require('../../../assets/images/placeholder.png');

    it('renders asset iconStart when provided', () => {
      render(
        <ButtonDanger
          label="Delete"
          iconStart={<Image source={iconSource} testID="danger-icon-start" />}
        />
      );

      expect(screen.getByTestId('danger-icon-start')).toBeDefined();
      expect(screen.getByText('Delete')).toBeDefined();
    });

    it('renders asset iconEnd when provided', () => {
      render(
        <ButtonDanger
          label="Archive"
          iconEnd={<Image source={iconSource} testID="danger-icon-end" />}
        />
      );

      expect(screen.getByTestId('danger-icon-end')).toBeDefined();
      expect(screen.getByText('Archive')).toBeDefined();
    });

    it('injects semantic icon color for primary danger variant when needed', () => {
      const { IconProbe, calls } = createIconProbe();

      render(
        <ButtonDanger variant="primary" iconStart={<IconProbe />}>
          Icon
        </ButtonDanger>
      );

      expect(calls.at(-1)?.color).toBe(Colors.dark.icon.danger.onDanger);
    });

    it('respects supplied icon color for danger buttons', () => {
      const { IconProbe, calls } = createIconProbe();

      render(
        <ButtonDanger iconEnd={<IconProbe color="#ff00ff" />}>
          Icon
        </ButtonDanger>
      );

      expect(calls.at(-1)?.color).toBe('#ff00ff');
    });
  });

  describe('Interaction', () => {
    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      render(<ButtonDanger onPress={onPress}>Delete Item</ButtonDanger>);

      fireEvent.press(screen.getByText('Delete Item'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('calls onLongPress when long pressed', () => {
      const onLongPress = jest.fn();
      render(<ButtonDanger onLongPress={onLongPress}>Hold Delete</ButtonDanger>);

      fireEvent(screen.getByText('Hold Delete'), 'longPress');
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('supports long press with a custom delayLongPress', () => {
      const onLongPress = jest.fn();
      render(
        <ButtonDanger delayLongPress={450} onLongPress={onLongPress}>
          With Delay
        </ButtonDanger>
      );

      fireEvent(screen.getByText('With Delay'), 'longPress');
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      const onPress = jest.fn();
      render(
        <ButtonDanger disabled onPress={onPress}>
          Disabled Delete
        </ButtonDanger>
      );

      fireEvent.press(screen.getByText('Disabled Delete'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('States', () => {
    it('is disabled when disabled prop is true', () => {
      const onPress = jest.fn();
      render(
        <ButtonDanger disabled onPress={onPress}>
          Cannot Delete
        </ButtonDanger>
      );

      fireEvent.press(screen.getByText('Cannot Delete'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('uses accessibilityLabel when provided', () => {
      const { getByLabelText } = render(
        <ButtonDanger accessibilityLabel="Delete Account">
          Delete
        </ButtonDanger>
      );
      expect(getByLabelText('Delete Account')).toBeDefined();
    });

    it('sets accessibilityRole to button', () => {
      const { getByRole } = render(<ButtonDanger>Delete</ButtonDanger>);
      expect(getByRole('button')).toBeDefined();
    });

    it('indicates disabled state in accessibility', () => {
      const { getByRole } = render(
        <ButtonDanger disabled>Disabled</ButtonDanger>
      );
      const button = getByRole('button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Styling', () => {
    it('applies custom style prop', () => {
      const customStyle = { marginTop: 20 };
      const { getByRole } = render(
        <ButtonDanger style={customStyle}>Styled</ButtonDanger>
      );
      const button = getByRole('button');
      expect(button.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });

    it('applies custom textStyle prop', () => {
      const customTextStyle = { fontSize: 20 };
      const { getByText } = render(
        <ButtonDanger textStyle={customTextStyle}>Custom Text</ButtonDanger>
      );
      const flattened = StyleSheet.flatten(getByText('Custom Text').props.style);
      expect(flattened).toEqual(expect.objectContaining(customTextStyle));
    });

    it('uses pressed danger background token', () => {
      const computed = __BUTTON_DANGER_TESTING__.computeDangerStyles('primary', 'dark', true, false, false);
      expect(computed.backgroundColor).toBe(Colors.dark.background.danger.pressed);
    });

    it('uses hover danger background token', () => {
      const computed = __BUTTON_DANGER_TESTING__.computeDangerStyles('primary', 'light', false, true, false);
      expect(computed.backgroundColor).toBe(Colors.light.background.danger.hover);
    });

    it('uses hover colors for subtle danger variant', () => {
      const computed = __BUTTON_DANGER_TESTING__.computeDangerStyles('subtle', 'dark', false, true, false);
      expect(computed.backgroundColor).toBe(Colors.dark.background.danger.secondaryHover);
      expect(computed.iconColor).toBe(Colors.dark.icon.danger.onDangerSecondary);
    });

    it('uses pressed colors for subtle danger variant', () => {
      const computed = __BUTTON_DANGER_TESTING__.computeDangerStyles('subtle', 'light', true, false, false);
      expect(computed.backgroundColor).toBe(Colors.light.background.danger.secondaryPressed);
      expect(computed.iconColor).toBe(Colors.light.icon.danger.onDangerSecondary);
    });

    it('shows outlined border when subtle danger is idle', () => {
      const computed = __BUTTON_DANGER_TESTING__.computeDangerStyles('subtle', 'light', false, false, false);
      expect(computed.borderColor).toBe(Colors.light.border.danger.secondary);
      expect(computed.backgroundColor).toBe('transparent');
    });

    it('locks disabled palette across variants and modes', () => {
      const lightDisabled = __BUTTON_DANGER_TESTING__.computeDangerStyles('primary', 'light', true, true, true);
      expect(lightDisabled.backgroundColor).toBe(Colors.light.background.disabled.default);
      expect(lightDisabled.color).toBe(Colors.light.text.disabled.onDisabled);
      expect(lightDisabled.iconColor).toBe(Colors.light.icon.disabled.onDisabled);
      expect(lightDisabled.borderColor).toBe('transparent');

      const darkDisabled = __BUTTON_DANGER_TESTING__.computeDangerStyles('subtle', 'dark', false, false, true);
      expect(darkDisabled.backgroundColor).toBe(Colors.dark.background.disabled.default);
      expect(darkDisabled.color).toBe(Colors.dark.text.disabled.onDisabled);
      expect(darkDisabled.iconColor).toBe(Colors.dark.icon.disabled.onDisabled);
      expect(darkDisabled.borderColor).toBe('transparent');
    });
  });

  describe('__BUTTON_DANGER_TESTING__ helpers', () => {
    it('renders a component icon with injected defaults', () => {
      const Icon = ({ color, size }: { color?: string; size?: string }) => (
        <ThemedText accessibilityLabel="danger-icon" style={{ color }}>
          {String(size)}
        </ThemedText>
      );

      const rendered = __BUTTON_DANGER_TESTING__.renderIcon(Icon, '#ff0000', '20');
      expect(React.isValidElement(rendered)).toBe(true);
      if (!React.isValidElement(rendered)) {
        throw new Error('Expected icon render helper to return a React element');
      }

      const renderedIcon = rendered as React.ReactElement<{ color?: string; size?: string }>;

      expect(renderedIcon.props.color).toBe('#ff0000');
      expect(renderedIcon.props.size).toBe('20');
    });
    
    it('preserves existing icon element props without overriding', () => {
      const Icon = ({ color, size }: { color?: string; size?: string }) => (
        <ThemedText accessibilityLabel="icon" style={{ color }}>
          {String(size)}
        </ThemedText>
      );

      const iconElement = <Icon color="#ff00ff" size="32" />;

      const rendered = __BUTTON_DANGER_TESTING__.renderIcon(iconElement, '#ff0000', '20');
      if (!React.isValidElement(rendered)) {
        throw new Error('Expected icon render helper to return a React element');
      }

      const renderedIcon = rendered as React.ReactElement<{ color?: string; size?: string }>;

      expect(renderedIcon.props.color).toBe('#ff00ff');
      expect(renderedIcon.props.size).toBe('32');
    });
  });
});
