import React from 'react';
import { Pressable, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { Colors, Size } from '../../constants/theme';
import { useColorScheme } from '../../hooks/useColorScheme';
import { IconSize } from '../../primitives/Icon';
import { ThemedText } from '../text/ThemedText';
import {
  ButtonIcon,
  computeButtonSizeStyles,
  renderButtonIcon,
  resolveButtonAccessibilityLabel,
} from './buttonShared';


export type ButtonDangerVariant = 'primary' | 'subtle';
export type ButtonDangerSize = 'small' | 'medium';

const TRANSPARENT = 'transparent';

export interface ButtonDangerProps {
  variant?: ButtonDangerVariant;
  size?: ButtonDangerSize;
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

function computeDangerStyles(
  variant: ButtonDangerVariant,
  mode: 'light' | 'dark',
  pressed: boolean,
  hovered: boolean,
  disabled: boolean,
) {
  const palette = Colors[mode];

  if (disabled) {
    return {
      backgroundColor: palette.background.disabled.default,
      color: palette.text.disabled.onDisabled,
      iconColor: palette.icon.disabled.onDisabled,
      borderColor: TRANSPARENT,
    };
  }

  if (variant === 'primary') {
    return {
      backgroundColor: pressed
        ? palette.background.danger.pressed
        : (hovered ? palette.background.danger.hover : palette.background.danger.default),
      color: palette.text.danger.onDanger,
      iconColor: palette.icon.danger.onDanger,
      borderColor: TRANSPARENT,
    };
  }

  // Subtle variant - transparent background by default, uses secondary backgrounds on interaction
  const isOutlinedState = !(pressed || hovered);
  return {
    backgroundColor: pressed
      ? palette.background.danger.secondaryPressed
      : (hovered ? palette.background.danger.secondaryHover : TRANSPARENT),
    color: pressed || hovered
      ? palette.text.danger.onDangerSecondary
      : palette.text.danger.secondary,
    iconColor: pressed || hovered
      ? palette.icon.danger.onDangerSecondary
      : palette.icon.danger.secondary,
    borderColor: isOutlinedState ? palette.border.danger.secondary : TRANSPARENT,
  };
}

export const ButtonDanger: React.FC<ButtonDangerProps> = ({
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
  const iconSize: IconSize = '16';
  const iconDimension = Number(iconSize);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={resolveButtonAccessibilityLabel(accessibilityLabel, label, children)}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }) => {
        const variantStyles = computeDangerStyles(variant, mode, pressed, hovered ?? false, disabled);
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
        const variantStyles = computeDangerStyles(variant, mode, pressed, hovered ?? false, disabled);
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
    </Pressable>
  );
};

export const __BUTTON_DANGER_TESTING__ = {
  computeDangerStyles,
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