import React from 'react';
import { Pressable, Text, ViewStyle, TextStyle, View } from 'react-native';
import { useColorScheme } from '../hooks/use-color-scheme';
import { Typography, Size, Colors } from '../constants/theme';

// Variants aligned with Figma design system Button component
export type ButtonVariant = 'primary' | 'neutral' | 'subtle';
export type ButtonSize = 'small' | 'medium';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  label?: string;
  iconStart?: React.ReactNode;
  iconEnd?: React.ReactNode;
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

  // Disabled state overrides all variants
  if (disabled) {
    return {
      backgroundColor: palette.background.disabled.default,
      color: palette.text.disabled.onDisabled,
      iconColor: palette.icon.disabled.onDisabled,
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
      };
    }
    case 'subtle': {
      // Subtle variant starts transparent and uses tertiary backgrounds on interaction
      const bg = pressed
        ? palette.background.neutral.tertiaryPressed
        : (hovered ? palette.background.neutral.tertiaryHover : 'transparent');
      const textColor = pressed || hovered
        ? palette.text.neutral.onNeutralTertiary
        : palette.text.neutral.tertiary;
      const iconColor = pressed || hovered
        ? palette.icon.neutral.onNeutralTertiary
        : palette.icon.neutral.tertiary;
      return {
        backgroundColor: bg,
        color: textColor,
        iconColor,
      };
    }
    default: {
      return {
        backgroundColor: palette.background.default.default,
        color: palette.text.default.default,
        iconColor: palette.icon.default.default,
      };
    }
  }
}

const renderIcon = (iconNode: React.ReactNode, color: string) => {
  if (!React.isValidElement(iconNode)) {
    return iconNode;
  }

  const currentProps = iconNode.props as { color?: string };
  const nextProps: Record<string, unknown> = {};

  if (currentProps.color == null) {
    nextProps.color = color;
  }

  if (Object.keys(nextProps).length === 0) {
    return iconNode;
  }

  return React.cloneElement(iconNode, nextProps);
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
  loading = false,
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ||
        (label ?? (typeof children === 'string' ? children : undefined))
      }
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed, hovered }) => {
        const variantStyles = computeVariantStyles(variant, mode, pressed, hovered ?? false, disabled || loading);
        const sizeStyles = computeSizeStyles(size);
        return [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: Size.radius['200'], // 8px - matches Figma design
            backgroundColor: variantStyles.backgroundColor,
            opacity: loading ? 0.7 : 1,
            paddingHorizontal: sizeStyles.paddingHorizontal,
            paddingVertical: sizeStyles.paddingVertical,
            gap: Size.space['200'], // 8px - matches Figma gap
          },
          style,
        ];
      }}
    >
      {({ pressed, hovered }) => {
        const variantStyles = computeVariantStyles(variant, mode, pressed, hovered ?? false, disabled || loading);

        return (
          <>
            {iconStart && !loading && <View>{renderIcon(iconStart, variantStyles.iconColor)}</View>}
            <Text
              style={[
                Typography[mode].singleLineBody,
                {
                  color: variantStyles.color,
                },
                textStyle,
              ]}
            >
              {loading ? '…' : (label ?? children)}
            </Text>
            {iconEnd && !loading && <View>{renderIcon(iconEnd, variantStyles.iconColor)}</View>}
          </>
        );
      }}
    </Pressable>
  );
};

export const __BUTTON_TESTING__ = {
  computeVariantStyles,
};