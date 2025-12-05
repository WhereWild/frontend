import React from 'react';
import { Pressable, TextStyle, View, ViewStyle } from 'react-native';
import { Colors, Size, Typography } from '../../constants/theme';
import { useColorScheme } from '../../hooks/useColorScheme';
import { ThemedText } from '../text/ThemedText';

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

const renderIcon = (iconNode: React.ReactNode, color: string) => {
  if (!React.isValidElement(iconNode)) {
    return iconNode;
  }

  const currentProps = iconNode.props as { color?: string; size?: string | number };
  const nextProps: Record<string, unknown> = {};

  if (currentProps.color == null) {
    nextProps.color = color;
  }

  if (currentProps.size == null) {
    nextProps.size = '16';
  }

  if (Object.keys(nextProps).length === 0) {
    return iconNode;
  }

  return React.cloneElement(iconNode, nextProps);
};

// Buttons must hit the design-system heights (40px medium / auto small) without guessing at padding.
// Measure the actual single-line typography and derive padding so glyphs stay optically centered.
const SINGLE_LINE_BODY_LINE_HEIGHT =
  Typography.light.singleLineBody.lineHeight ??
  Typography.light.body.lineHeight ??
  20;
const BUTTON_TARGET_HEIGHT: Record<ButtonSize, number> = {
  small: SINGLE_LINE_BODY_LINE_HEIGHT + Size.space['200'] * 2,
  medium: 40,
};

const getVerticalPadding = (size: ButtonSize, borderWidth: number) => {
  const targetHeight = BUTTON_TARGET_HEIGHT[size] ?? BUTTON_TARGET_HEIGHT.medium;
  const available = targetHeight - SINGLE_LINE_BODY_LINE_HEIGHT - borderWidth * 2;
  return Math.max(0, available / 2);
};

// Size-specific styles matching Figma design
function computeSizeStyles(size: ButtonSize) {
  if (size === 'small') {
    return {
      paddingHorizontal: Size.space['200'], // 8px
    };
  }
  return {
    paddingHorizontal: Size.space['300'], // 12px
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
        const borderWidth = variantStyles.borderWidth ?? 0;
        const paddingHorizontal = Math.max(0, sizeStyles.paddingHorizontal - borderWidth);
        const paddingVertical = getVerticalPadding(size, borderWidth);
        return [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: Size.radius['200'], // 8px - matches Figma design
            backgroundColor: variantStyles.backgroundColor,
            borderColor: variantStyles.borderColor,
            borderWidth: variantStyles.borderWidth,
            opacity: loading ? 0.7 : 1,
            paddingHorizontal,
            paddingVertical,
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
            <ThemedText
              variant="singleLineBody"
              style={[
                {
                  color: variantStyles.color,
                },
                textStyle,
              ]}
            >
              {loading ? '…' : (label ?? children)}
            </ThemedText>
            {iconEnd && !loading && <View>{renderIcon(iconEnd, variantStyles.iconColor)}</View>}
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