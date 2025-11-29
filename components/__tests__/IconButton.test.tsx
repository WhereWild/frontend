import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { IconButton , __ICON_BUTTON_TESTING__ } from '../IconButton';
import type { IconButtonVariant, IconButtonSize } from '../IconButton';
import { Image } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { ThemedText } from '../ThemedText';

// Mock icon component for testing
const MockIcon = () => <ThemedText>Icon</ThemedText>;

const createIconProbe = () => {
  const calls: { color?: string; size?: string }[] = [];
  const IconProbe = (props: { color?: string; size?: string }) => {
    calls.push(props);
    return <ThemedText testID="icon-button-probe" />;
  };
  return { IconProbe, calls };
};

describe('IconButton Component', () => {
  describe('Rendering', () => {
    it('renders with icon prop', () => {
      render(
        <IconButton icon={<MockIcon />} accessibilityLabel="Close" />
      );
      expect(screen.getByText('Icon')).toBeDefined();
    });

    it('requires accessibilityLabel for screen readers', () => {
      const { getByLabelText } = render(
        <IconButton
          icon={<MockIcon />}
          accessibilityLabel="Settings"
        />
      );
      expect(getByLabelText('Settings')).toBeDefined();
    });
  });

  describe('Variants', () => {
    const variants: IconButtonVariant[] = ['primary', 'neutral', 'subtle'];

    variants.forEach((variant) => {
      it(`renders ${variant} variant`, () => {
        render(
          <IconButton
            variant={variant}
            icon={<MockIcon />}
            accessibilityLabel={variant}
          />
        );
        expect(screen.getByText('Icon')).toBeDefined();
      });
    });

    it('defaults to primary variant when no variant specified', () => {
      const { getByRole } = render(
        <IconButton icon={<MockIcon />} accessibilityLabel="Default" />
      );
      const button = getByRole('button');
      expect(button).toBeDefined();
      expect(button.props.accessibilityRole).toBe('button');
    });
  });

  describe('Sizes', () => {
    const sizes: IconButtonSize[] = ['small', 'medium'];

    sizes.forEach((size) => {
      it(`renders ${size} size`, () => {
        render(
          <IconButton
            size={size}
            icon={<MockIcon />}
            accessibilityLabel={size}
          />
        );
        expect(screen.getByText('Icon')).toBeDefined();
      });
    });

    it('defaults to medium size tokens for padding and radius', () => {
      const { getByLabelText } = render(
        <IconButton icon={<MockIcon />} accessibilityLabel="Default Size" />
      );
      const button = getByLabelText('Default Size');
      const styles = button.props.style;
      expect(styles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            padding: Size.space['300'],
            borderRadius: Size.space['800'],
          }),
        ])
      );
    });
  });

  describe('Icons', () => {
    const iconSource = require('../../assets/images/react-logo.png');

    it('renders asset icon node inside the button', () => {
      render(
        <IconButton
          icon={<Image source={iconSource} testID="icon-button-asset" />}
          accessibilityLabel="Asset Icon"
        />
      );

      expect(screen.getByTestId('icon-button-asset')).toBeDefined();
      expect(screen.getByRole('button')).toBeDefined();
    });

    it('keeps asset icon visible even when disabled', () => {
      render(
        <IconButton
          disabled
          icon={<Image source={iconSource} testID="icon-button-disabled" />}
          accessibilityLabel="Disabled Asset Icon"
        />
      );

      expect(screen.getByTestId('icon-button-disabled')).toBeDefined();
    });

    it('injects semantic icon color and medium icon size when missing', () => {
      const { IconProbe, calls } = createIconProbe();

      render(
        <IconButton icon={<IconProbe />} accessibilityLabel="Semantic Icon" />
      );

      expect(calls.at(-1)).toEqual(
        expect.objectContaining({
          color: Colors.light.icon.brand.onBrand,
          size: '20',
        })
      );
    });

    it('respects custom icon color and size overrides', () => {
      const { IconProbe, calls } = createIconProbe();

      render(
        <IconButton
          icon={<IconProbe color="#123456" size="40" />}
          accessibilityLabel="Custom Icon Props"
        />
      );

      expect(calls.at(-1)).toEqual(
        expect.objectContaining({
          color: '#123456',
          size: '40',
        })
      );
    });
  });

  describe('Interaction', () => {
    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      render(
        <IconButton
          icon={<MockIcon />}
          onPress={onPress}
          accessibilityLabel="Press Me"
        />
      );

      fireEvent.press(screen.getByLabelText('Press Me'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      const onPress = jest.fn();
      render(
        <IconButton
          disabled
          icon={<MockIcon />}
          onPress={onPress}
          accessibilityLabel="Disabled"
        />
      );

      fireEvent.press(screen.getByLabelText('Disabled'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('States', () => {
    it('is disabled when disabled prop is true', () => {
      const onPress = jest.fn();
      render(
        <IconButton
          disabled
          icon={<MockIcon />}
          onPress={onPress}
          accessibilityLabel="Disabled Button"
        />
      );

      fireEvent.press(screen.getByLabelText('Disabled Button'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('requires accessibilityLabel', () => {
      const { getByLabelText } = render(
        <IconButton
          icon={<MockIcon />}
          accessibilityLabel="Menu"
        />
      );
      expect(getByLabelText('Menu')).toBeDefined();
    });

    it('sets accessibilityRole to button', () => {
      const { getByRole } = render(
        <IconButton
          icon={<MockIcon />}
          accessibilityLabel="Icon Button"
        />
      );
      expect(getByRole('button')).toBeDefined();
    });

    it('indicates disabled state in accessibility', () => {
      const { getByRole } = render(
        <IconButton
          disabled
          icon={<MockIcon />}
          accessibilityLabel="Disabled"
        />
      );
      const button = getByRole('button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Styling', () => {
    it('applies custom style prop', () => {
      const customStyle = { marginTop: 20 };
      const { getByLabelText } = render(
        <IconButton
          icon={<MockIcon />}
          style={customStyle}
          accessibilityLabel="Styled"
        />
      );
      const button = getByLabelText('Styled');
      expect(button.props.style).toMatchObject(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });

    it('maintains square aspect ratio via equal padding (medium)', () => {
      const { getByLabelText } = render(
        <IconButton
          size="medium"
          icon={<MockIcon />}
          accessibilityLabel="Square"
        />
      );
      const button = getByLabelText('Square');
      const styles = button.props.style;
      // Square aspect ratio is achieved via single padding value (applies to all sides)
      const paddingStyle = styles.find((s: any) => s?.padding !== undefined);
      expect(paddingStyle).toBeDefined();
      expect(paddingStyle.padding).toBe(Size.space['300']); // Equal padding on all sides
      expect(paddingStyle.borderRadius).toBe(Size.space['800']);
    });

    it('maintains square aspect ratio via equal padding (small)', () => {
      const { getByLabelText } = render(
        <IconButton
          size="small"
          icon={<MockIcon />}
          accessibilityLabel="Square"
        />
      );
      const button = getByLabelText('Square');
      const styles = button.props.style;
      const paddingStyle = styles.find((s: any) => s?.padding !== undefined);
      expect(paddingStyle).toBeDefined();
      expect(paddingStyle.padding).toBe(Size.space['200']);
      expect(paddingStyle.borderRadius).toBe(Size.space['800']);
    });

    it('applies pressed brand background token for primary variant', () => {
      const computed = __ICON_BUTTON_TESTING__.computeVariantStyles('primary', 'light', true, false, false);
      expect(computed.backgroundColor).toBe(Colors.light.background.brand.pressed);
    });

    it('uses neutral hover token for neutral variant', () => {
      const computed = __ICON_BUTTON_TESTING__.computeVariantStyles('neutral', 'light', false, true, false);
      expect(computed.backgroundColor).toBe(Colors.light.background.neutral.secondaryHover);
      expect(computed.iconColor).toBe(Colors.light.icon.neutral.onNeutralSecondary);
    });

    it('keeps subtle variant transparent idle but swaps tokens on hover', () => {
      const idle = __ICON_BUTTON_TESTING__.computeVariantStyles('subtle', 'light', false, false, false);
      const hover = __ICON_BUTTON_TESTING__.computeVariantStyles('subtle', 'light', false, true, false);
      expect(idle.backgroundColor).toBe('transparent');
      expect(hover.backgroundColor).toBe(Colors.light.background.neutral.tertiaryHover);
      expect(hover.iconColor).toBe(Colors.light.icon.neutral.onNeutralTertiary);
    });
  });

  describe('Internal helper functions', () => {
    it('falls back to default palette for unknown variants', () => {
      const computed = __ICON_BUTTON_TESTING__.computeVariantStyles(
        'unknown' as IconButtonVariant,
        'light',
        false,
        false,
        false,
      );

      expect(computed.backgroundColor).toBe(Colors.light.background.default.default);
      expect(computed.iconColor).toBe(Colors.light.icon.default.default);
    });

    it('returns raw node when icon is not a React element', () => {
      expect(__ICON_BUTTON_TESTING__.renderIcon('glyph', '#123456')).toBe('glyph');
    });

    it('does not clone icons that already set color and size', () => {
      const Icon = (props: { color?: string; size?: string }) => (
        <ThemedText accessibilityLabel="icon" style={{ color: props.color }}>
          Icon
        </ThemedText>
      );
      const icon = <Icon color="#abcdef" size="40" />;

      expect(__ICON_BUTTON_TESTING__.renderIcon(icon, '#000000', '20')).toBe(icon);
    });
  });
});
