import React from 'react';
import { StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { Colors, Size } from '../../constants/theme';
import { useColorScheme } from '../../hooks/useColorScheme';
import { IconSize } from '../../primitives/Icon';
import { ThemedText } from '../text/ThemedText';
import { RoutePressable } from '../navigation/RoutePressable';
import type { Href } from 'expo-router';
import {
  ButtonIcon,
  computeButtonSizeStyles,
  renderButtonIcon,
  resolveButtonAccessibilityLabel,
} from './buttonShared';

// Variants aligned with Figma design system Button component
export type ButtonVariant = 'primary' | 'neutral' | 'subtle';
export type ButtonSize = 'small' | 'medium';

const TRANSPARENT = 'transparent';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  children?: React.ReactNode;
  label?: string;
  href?: Href;
  hrefPath?: string;
  navigateAfterPress?: boolean;
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

  // Disabled state overrides all variants
  if (disabled) {
    return {
      backgroundColor: palette.background.disabled.default,
      color: palette.text.disabled.onDisabled,
      iconColor: palette.icon.disabled.onDisabled,
      borderColor: TRANSPARENT,
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
        borderColor: TRANSPARENT,
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
        borderColor: TRANSPARENT,
      };
    }
    case 'subtle': {
      // Subtle variant starts transparent and uses tertiary backgrounds on interaction
      const isOutlinedState = !(pressed || hovered);
      const bg = pressed
        ? palette.background.neutral.tertiaryPressed
        : (hovered ? palette.background.neutral.tertiaryHover : TRANSPARENT);
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
        borderColor: isOutlinedState ? palette.border.neutral.tertiary : TRANSPARENT,
      };
    }
    default: {
      return {
        backgroundColor: palette.background.default.default,
        color: palette.text.default.default,
        iconColor: palette.icon.default.default,
        borderColor: TRANSPARENT,
      };
    }
  }
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onPress,
  onLongPress,
  delayLongPress,
  children,
  label,
  href,
  hrefPath,
  navigateAfterPress,
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
    <RoutePressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={resolveButtonAccessibilityLabel(accessibilityLabel, label, children)}
      disabled={disabled}
      onPress={onPress}
      href={href}
      hrefPath={hrefPath}
      navigateAfterPress={navigateAfterPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      style={({ pressed, hovered }) => {
        const variantStyles = computeVariantStyles(variant, mode, pressed, hovered ?? false, disabled);
        const sizeStyles = computeButtonSizeStyles(size);
        const paddingHorizontal = sizeStyles.paddingHorizontal;
        const paddingVertical = sizeStyles.paddingVertical;
        const minHeight = sizeStyles.minHeight;
        return [
          styles.buttonBase,
          {
            backgroundColor: variantStyles.backgroundColor,
            borderColor: variantStyles.borderColor,
            paddingHorizontal,
            paddingVertical,
            minHeight,
          },
          style,
        ];
      }}
    >
      {({ pressed, hovered }) => {
        const variantStyles = computeVariantStyles(variant, mode, pressed, hovered ?? false, disabled);

        return (
          <>
            {iconStart && <View>{renderButtonIcon(iconStart, variantStyles.iconColor, iconSize)}</View>}
            <View style={[styles.textContainer, { minHeight: iconDimension }]}>
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
            {iconEnd && <View>{renderButtonIcon(iconEnd, variantStyles.iconColor, iconSize)}</View>}
          </>
        );
      }}
    </RoutePressable>
  );
};

export const __BUTTON_TESTING__ = {
  computeVariantStyles,
  renderIcon: renderButtonIcon,
};

const styles = StyleSheet.create({
  buttonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Size.radius['200'],
    borderWidth: Size.stroke.border,
    gap: Size.space['200'],
  },
  textContainer: {
    justifyContent: 'center',
  },
});
