import React from 'react';
import { Pressable, TextStyle, View, ViewStyle } from 'react-native';
import { Colors, Size } from '../../constants/theme';
import { useColorScheme } from '../../hooks/useColorScheme';
import { IconSize } from '../../primitives/Icon';
import { ThemedText } from '../text/ThemedText';


export type ButtonDangerVariant = 'primary' | 'subtle';
export type ButtonDangerSize = 'small' | 'medium';

type ButtonIconElement = React.ReactElement<{ color?: string; size?: IconSize }>;
type ButtonIcon = React.ComponentType<{ color?: string; size?: IconSize }> | ButtonIconElement;

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
  const strokeWidth = Size.stroke.border;
  const transparent = 'transparent';

  if (disabled) {
    return {
      backgroundColor: palette.background.disabled.default,
      color: palette.text.disabled.onDisabled,
      iconColor: palette.icon.disabled.onDisabled,
      borderColor: transparent,
      borderWidth: 0,
    };
  }

  if (variant === 'primary') {
    return {
      backgroundColor: pressed
        ? palette.background.danger.pressed
        : (hovered ? palette.background.danger.hover : palette.background.danger.default),
      color: palette.text.danger.onDanger,
      iconColor: palette.icon.danger.onDanger,
      borderColor: transparent,
      borderWidth: 0,
    };
  }

  // Subtle variant - transparent background by default, uses secondary backgrounds on interaction
  const isOutlinedState = !(pressed || hovered);
  const borderWidth = strokeWidth;
  return {
    backgroundColor: pressed
      ? palette.background.danger.secondaryPressed
      : (hovered ? palette.background.danger.secondaryHover : transparent),
    color: pressed || hovered
      ? palette.text.danger.onDangerSecondary
      : palette.text.danger.secondary,
    iconColor: pressed || hovered
      ? palette.icon.danger.onDangerSecondary
      : palette.icon.danger.secondary,
    borderColor: isOutlinedState ? palette.border.danger.secondary : transparent,
    borderWidth,
  };
}

function computeSizeStyles(size: ButtonDangerSize) {
  if (size === 'small') {
    return {
      paddingHorizontal: Size.space['200'],
      paddingVertical: Size.space['150'],
    };
  }
  return {
    paddingHorizontal: Size.space['300'],
    paddingVertical: Size.space['250'],
  };
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
      accessibilityLabel={
        accessibilityLabel ||
        (label ?? (typeof children === 'string' ? children : undefined))
      }
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }) => {
        const v = computeDangerStyles(variant, mode, pressed, hovered ?? false, disabled);
        const s = computeSizeStyles(size);
        const borderWidth = v.borderWidth ?? 0;
        const paddingHorizontal = Math.max(0, s.paddingHorizontal - borderWidth);
        const paddingVertical = Math.max(0, s.paddingVertical - borderWidth);
        return [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: Size.radius['200'],
            backgroundColor: v.backgroundColor,
            borderColor: v.borderColor,
            borderWidth: v.borderWidth,
            opacity: 1,
            paddingHorizontal,
            paddingVertical,
            gap: Size.space['200'],
          },
          style,
        ];
      }}
    >
      {({ pressed, hovered }) => {
        const v = computeDangerStyles(variant, mode, pressed, hovered ?? false, disabled);
        return (
          <>
            {iconStart && <View>{renderIcon(iconStart, v.iconColor, iconSize)}</View>}
            <View style={{ minHeight: iconDimension, justifyContent: 'center' }}>
              <ThemedText
                variant="singleLineBody"
                style={[
                  {
                    color: v.color,
                  },
                  textStyle,
                ]}
              >
                {label ?? children}
              </ThemedText>
            </View>
            {iconEnd && <View>{renderIcon(iconEnd, v.iconColor, iconSize)}</View>}
          </>
        );
      }}
    </Pressable>
  );
};

export const __BUTTON_DANGER_TESTING__ = {
  computeDangerStyles,
  renderIcon,
};
