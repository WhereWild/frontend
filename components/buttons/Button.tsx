import React from 'react';
import { Pressable, TextStyle, View, ViewStyle } from 'react-native';
import { Colors, Size } from '../../constants/theme';
import { useColorScheme } from '../../hooks/useColorScheme';
import { IconSize } from '../../primitives/Icon';
import { ThemedText } from '../text/ThemedText';

// Variants aligned with Figma design system Button component
export type ButtonVariant = 'primary' | 'neutral' | 'subtle';
export type ButtonSize = 'small' | 'medium';

type ButtonIconElement = React.ReactElement<{ color?: string; size?: IconSize }>;
type ButtonIcon = React.ComponentType<{ color?: string; size?: IconSize }> | ButtonIconElement;

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  label?: string;
  iconStart?: ButtonIcon;
  iconEnd?: ButtonIcon;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

// Map variant + mode + interaction state to colors from semantic tokens
function computeVariantStyles(
  variant: ButtonVariant,
  mode: 'light' | 'dark',
  pressed: boolean,
  hovered: boolean,
  disabled: boolean
) {
  const palette = Colors[mode];
  const strokeWidth = Size.stroke.border;
  const transparent = 'transparent';

  // Disabled state overrides all variants
  if (disabled) {
    return {
      backgroundColor: palette.background.disabled.default,
      color: palette.text.disabled.onDisabled,
      iconColor: palette.icon.disabled.onDisabled,
      borderColor: transparent,
      borderWidth: 0,
    };
  }

  switch (variant) {
    case 'primary': {
      const bg = pressed
        ? palette.background.brand.pressed
        : (hovered ? palette.background.brand.hover : palette.background.brand.default);
      return {
        backgroundColor: bg,
        color: palette.text.brand.onBrand,
        iconColor: palette.icon.brand.onBrand,
        borderColor: transparent,
        borderWidth: 0,
      };
    }
    case 'neutral': {
      const bg = pressed
        ? palette.background.neutral.secondaryPressed
        : (hovered ? palette.background.neutral.secondaryHover : palette.background.neutral.secondary);
      return {
        backgroundColor: bg,
        color: palette.text.neutral.onNeutralSecondary,
        iconColor: palette.icon.neutral.onNeutralSecondary,
        borderColor: transparent,
        borderWidth: 0,
      };
    }
    case 'subtle': {
      // Subtle variant starts transparent and uses tertiary backgrounds on interaction
      const isOutlinedState = !(pressed || hovered);
      const bg = pressed
        ? palette.background.neutral.tertiaryPressed
        : (hovered ? palette.background.neutral.tertiaryHover : transparent);
      const textColor = pressed || hovered
        ? palette.text.neutral.onNeutralTertiary
        : palette.text.neutral.tertiary;
      const iconColor = pressed || hovered
        ? palette.icon.neutral.onNeutralTertiary
        : palette.icon.neutral.tertiary;
      const borderWidth = strokeWidth;
      return {
        backgroundColor: bg,
        color: textColor,
        iconColor,
        borderColor: isOutlinedState ? palette.border.neutral.tertiary : transparent,
        borderWidth,
      };
    }
    default: {
      return {
        backgroundColor: palette.background.default.default,
        color: palette.text.default.default,
        iconColor: palette.icon.default.default,
        borderColor: transparent,
        borderWidth: 0,
      };
    }
  }
}

const renderIcon = (icon: ButtonIcon | undefined, color: string, size: IconSize) => {
  if (!icon) return null;

  if (React.isValidElement(icon)) {
    const currentProps = icon.props as { color?: string; size?: IconSize };
    return React.cloneElement(icon, {
      color: currentProps.color ?? color,
      size: currentProps.size ?? size,
    });
  }

  return React.createElement(icon, { color, size });
};

// Size-specific styles matching Figma design
function computeSizeStyles(size: ButtonSize) {
  if (size === 'small') {
    return {
      paddingHorizontal: Size.space['200'], // 8px
      paddingVertical: Size.space['200'], // 8px
    };
  }
  return {
    paddingHorizontal: Size.space['300'], // 12px
    paddingVertical: Size.space['300'], // 12px
  };
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onPress,
  children,
  label,
  iconStart,
  iconEnd,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const iconSize: IconSize = '16'; // Figma default glyph for buttons
  const iconDimension = Number(iconSize);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ||
        (label ?? (typeof children === 'string' ? children : undefined))
      }
        disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }) => {
          const variantStyles = computeVariantStyles(variant, mode, pressed, hovered ?? false, disabled);
        const sizeStyles = computeSizeStyles(size);
        const borderWidth = variantStyles.borderWidth ?? 0;
        const paddingHorizontal = Math.max(0, sizeStyles.paddingHorizontal - borderWidth);
        const paddingVertical = Math.max(0, sizeStyles.paddingVertical - borderWidth);
        return [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: Size.radius['200'], // 8px - matches Figma design
            backgroundColor: variantStyles.backgroundColor,
            borderColor: variantStyles.borderColor,
            borderWidth: variantStyles.borderWidth,
            opacity: 1,
            paddingHorizontal,
            paddingVertical,
            gap: Size.space['200'], // 8px - matches Figma gap
          },
          style,
        ];
      }}
    >
      {({ pressed, hovered }) => {
        const variantStyles = computeVariantStyles(variant, mode, pressed, hovered ?? false, disabled);

        return (
          <>
            {iconStart && <View>{renderIcon(iconStart, variantStyles.iconColor, iconSize)}</View>}
            <View style={{ minHeight: iconDimension, justifyContent: 'center' }}>
              <ThemedText
                variant="singleLineBody"
                style={[
                  {
                    color: variantStyles.color,
                  },
                  textStyle,
                ]}
              >
                {label ?? children}
              </ThemedText>
            </View>
            {iconEnd && <View>{renderIcon(iconEnd, variantStyles.iconColor, iconSize)}</View>}
          </>
        );
      }}
    </Pressable>
  );
};

export const __BUTTON_TESTING__ = {
  computeVariantStyles,
  renderIcon,
};