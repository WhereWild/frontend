import { Colors, Size } from '@/constants/theme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import type { ButtonSize, ButtonVariant } from '../Button';
import { Button, __BUTTON_TESTING__ } from '../Button';
import { ThemedText } from '../../text/ThemedText';

const createIconProbe = () => {
  const calls: { color?: string }[] = [];
  const IconProbe = (props: { color?: string }) => {
    calls.push(props);
    return <ThemedText testID="icon-probe" />;
  };
  return { IconProbe, calls };
};

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with text children', () => {
      render(<Button>Click Me</Button>);
      expect(screen.getByText('Click Me')).toBeDefined();
    });

    it('renders with label prop', () => {
      render(<Button label="Submit" />);
      expect(screen.getByText('Submit')).toBeDefined();
    });

    it('prioritizes label over children prop', () => {
      render(<Button label="Label">Children</Button>);
      expect(screen.getByText('Label')).toBeDefined();
      expect(screen.queryByText('Children')).toBeNull();
    });

    it('renders with iconStart', () => {
      const IconComponent = () => <>{/* icon */}</>;
      render(
        <Button iconStart={<IconComponent />}>
          Button Text
        </Button>
      );
      expect(screen.getByText('Button Text')).toBeDefined();
    });

    it('renders with iconEnd', () => {
      const IconComponent = () => <>{/* icon */}</>;
      render(
        <Button iconEnd={<IconComponent />}>
          Button Text
        </Button>
      );
      expect(screen.getByText('Button Text')).toBeDefined();
    });
  });

  describe('Variants', () => {
    const variants: ButtonVariant[] = ['primary', 'neutral', 'subtle'];

    variants.forEach((variant) => {
      it(`renders ${variant} variant`, () => {
        render(<Button variant={variant}>{variant}</Button>);
        expect(screen.getByText(variant)).toBeDefined();
      });
    });

    it('defaults to primary variant when no variant specified', () => {
      const { getByRole } = render(<Button>Default</Button>);
      const button = getByRole('button');
      expect(button).toBeDefined();
      expect(button.props.accessibilityRole).toBe('button');
    });
  });

  describe('Sizes', () => {
    const sizes: ButtonSize[] = ['small', 'medium'];

    sizes.forEach((size) => {
      it(`renders ${size} size`, () => {
        render(<Button size={size}>{size}</Button>);
        expect(screen.getByText(size)).toBeDefined();
      });
    });

    it('defaults to medium size with control minHeight', () => {
      const { getByRole } = render(<Button>Default Size</Button>);
      const button = getByRole('button');
      const styles = button.props.style;
      expect(styles).toBeDefined();
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
        <Button
          label="Save"
          iconStart={<Image source={iconSource} testID="button-icon-start" />}
        />
      );

      expect(screen.getByTestId('button-icon-start')).toBeDefined();
      expect(screen.getByText('Save')).toBeDefined();
    });

    it('renders asset iconEnd when provided', () => {
      render(
        <Button
          label="Continue"
          iconEnd={<Image source={iconSource} testID="button-icon-end" />}
        />
      );

      expect(screen.getByTestId('button-icon-end')).toBeDefined();
      expect(screen.getByText('Continue')).toBeDefined();
    });

    it('injects semantic icon color for primary variant when icon has no color', () => {
      const { IconProbe, calls } = createIconProbe();

      render(
        <Button variant="primary" iconStart={<IconProbe />}>
          Icon Color
        </Button>
      );

      expect(calls.at(-1)?.color).toBe(Colors.dark.icon.brand.onBrand);
    });

    it('does not override custom icon color', () => {
      const { IconProbe, calls } = createIconProbe();

      render(
        <Button iconEnd={<IconProbe color="#123456" />}>
          Custom Icon
        </Button>
      );

      expect(calls.at(-1)?.color).toBe('#123456');
    });
  });

  describe('Interaction', () => {
    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      render(<Button onPress={onPress}>Press Me</Button>);

      fireEvent.press(screen.getByText('Press Me'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      const onPress = jest.fn();
      render(
        <Button disabled onPress={onPress}>
          Disabled
        </Button>
      );

      fireEvent.press(screen.getByText('Disabled'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('States', () => {
    it('is disabled when disabled prop is true', () => {
      const onPress = jest.fn();
      render(
        <Button disabled onPress={onPress}>
          Disabled Button
        </Button>
      );

      fireEvent.press(screen.getByText('Disabled Button'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('uses accessibilityLabel when provided', () => {
      const { getByLabelText } = render(
        <Button accessibilityLabel="Submit Form">Submit</Button>
      );
      expect(getByLabelText('Submit Form')).toBeDefined();
    });

    it('falls back to label prop for accessibility when no accessibilityLabel', () => {
      const { getByLabelText } = render(
        <Button label="Click Here" />
      );
      expect(getByLabelText('Click Here')).toBeDefined();
    });

    it('falls back to children text for accessibility when no accessibilityLabel or label', () => {
      const { getByLabelText } = render(
        <Button>Press Me</Button>
      );
      expect(getByLabelText('Press Me')).toBeDefined();
    });

    it('sets accessibilityRole to button', () => {
      const { getByRole } = render(<Button>Button</Button>);
      expect(getByRole('button')).toBeDefined();
    });

    it('indicates disabled state in accessibility', () => {
      const { getByRole } = render(<Button disabled>Disabled</Button>);
      const button = getByRole('button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Styling', () => {
    it('applies custom style prop', () => {
      const customStyle = { marginTop: 20 };
      const { getByRole } = render(
        <Button style={customStyle}>Styled</Button>
      );
      const button = getByRole('button');
      expect(button.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });

    it('applies custom textStyle prop', () => {
      const customTextStyle = { fontSize: 20 };
      const { getByText } = render(
        <Button textStyle={customTextStyle}>Custom Text</Button>
      );
      const flattened = StyleSheet.flatten(getByText('Custom Text').props.style);
      expect(flattened).toEqual(expect.objectContaining(customTextStyle));
    });

    it('applies pressed background tokens for primary variant', () => {
      const computed = __BUTTON_TESTING__.computeVariantStyles('primary', 'dark', true, false, false);
      expect(computed.backgroundColor).toBe(Colors.dark.background.brand.pressed);
    });

    it('applies hover background tokens for primary variant', () => {
      const computed = __BUTTON_TESTING__.computeVariantStyles('primary', 'light', false, true, false);
      expect(computed.backgroundColor).toBe(Colors.light.background.brand.hover);
    });

    it('applies pressed background tokens for neutral variant', () => {
      const computed = __BUTTON_TESTING__.computeVariantStyles('neutral', 'dark', true, false, false);
      expect(computed.backgroundColor).toBe(Colors.dark.background.neutral.secondaryPressed);
    });

    it('applies hover background tokens for neutral variant', () => {
      const computed = __BUTTON_TESTING__.computeVariantStyles('neutral', 'light', false, true, false);
      expect(computed.backgroundColor).toBe(Colors.light.background.neutral.secondaryHover);
    });

    it('applies hover text and icon colors for subtle variant', () => {
      const computed = __BUTTON_TESTING__.computeVariantStyles('subtle', 'dark', false, true, false);
      expect(computed.backgroundColor).toBe(Colors.dark.background.neutral.tertiaryHover);
      expect(computed.iconColor).toBe(Colors.dark.icon.neutral.onNeutralTertiary);
    });

    it('applies pressed colors for subtle variant', () => {
      const computed = __BUTTON_TESTING__.computeVariantStyles('subtle', 'light', true, false, false);
      expect(computed.backgroundColor).toBe(Colors.light.background.neutral.tertiaryPressed);
      expect(computed.iconColor).toBe(Colors.light.icon.neutral.onNeutralTertiary);
    });

    it('applies outlined border when subtle is idle', () => {
      const computed = __BUTTON_TESTING__.computeVariantStyles('subtle', 'light', false, false, false);
      expect(computed.borderColor).toBe(Colors.light.border.neutral.tertiary);
      expect(computed.backgroundColor).toBe('transparent');
    });

    it('forces disabled palette regardless of variant or interaction state', () => {
      const lightDisabled = __BUTTON_TESTING__.computeVariantStyles('neutral', 'light', true, true, true);
      expect(lightDisabled.backgroundColor).toBe(Colors.light.background.disabled.default);
      expect(lightDisabled.color).toBe(Colors.light.text.disabled.onDisabled);
      expect(lightDisabled.iconColor).toBe(Colors.light.icon.disabled.onDisabled);
      expect(lightDisabled.borderColor).toBe('transparent');

      const darkDisabled = __BUTTON_TESTING__.computeVariantStyles('subtle', 'dark', false, false, true);
      expect(darkDisabled.backgroundColor).toBe(Colors.dark.background.disabled.default);
      expect(darkDisabled.color).toBe(Colors.dark.text.disabled.onDisabled);
      expect(darkDisabled.iconColor).toBe(Colors.dark.icon.disabled.onDisabled);
      expect(darkDisabled.borderColor).toBe('transparent');
    });
  });

  describe('__BUTTON_TESTING__ helpers', () => {
    it('falls back to default palette for unknown variants', () => {
      const computed = __BUTTON_TESTING__.computeVariantStyles(
        'unknown' as ButtonVariant,
        'dark',
        false,
        false,
        false,
      );

      expect(computed.backgroundColor).toBe(Colors.dark.background.default.default);
      expect(computed.iconColor).toBe(Colors.dark.icon.default.default);
    });

    it('renders a component icon with injected defaults', () => {
      const Icon = ({ color, size }: { color?: string; size?: string }) => (
        <ThemedText accessibilityLabel="icon" style={{ color }}>
          {String(size)}
        </ThemedText>
      );

      const rendered = __BUTTON_TESTING__.renderIcon(Icon, '#111111', '16');
      expect(React.isValidElement(rendered)).toBe(true);
      expect(rendered?.props.color).toBe('#111111');
      expect(rendered?.props.size).toBe('16');
    });

    it('preserves existing icon element props without overriding', () => {
      const Icon = ({ color, size }: { color?: string; size?: string }) => (
        <ThemedText accessibilityLabel="icon" style={{ color }}>
          {String(size)}
        </ThemedText>
      );

      const iconElement = <Icon color="#abc123" size="24" />;

      const rendered = __BUTTON_TESTING__.renderIcon(iconElement, '#111111', '16');
      expect(rendered?.props.color).toBe('#abc123');
      expect(rendered?.props.size).toBe('24');
    });
  });
});
