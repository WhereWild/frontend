import React from 'react';
import { Pressable, ViewStyle, AccessibilityProps } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { IconSize } from '@/primitives';

export type IconButtonVariant = 'primary' | 'neutral' | 'subtle';
export type IconButtonSize = 'medium' | 'small';

export type IconButtonProps = {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  onPress?: () => void;
  icon: React.ReactNode;
  accessibilityLabel: string;
  style?: ViewStyle;
} & AccessibilityProps;

// Compute variant styles based on state
function computeVariantStyles(
  variant: IconButtonVariant,
  mode: 'light' | 'dark',
  pressed: boolean,
  hovered: boolean,
  disabled: boolean,
) {
  const palette = Colors[mode];

  if (disabled) {
    return {
      backgroundColor: palette.background.disabled.default,
      iconColor: palette.icon.disabled.onDisabled,
    };
  }

  switch (variant) {
    case 'primary': {
      const bg = pressed
        ? palette.background.brand.pressed
        : hovered
          ? palette.background.brand.hover
          : palette.background.brand.default;
      return {
        backgroundColor: bg,
        iconColor: palette.icon.brand.onBrand,
      };
    }
    case 'neutral': {
      const bg = pressed
        ? palette.background.neutral.secondaryPressed
        : hovered
          ? palette.background.neutral.secondaryHover
          : palette.background.neutral.secondary;
      return {
        backgroundColor: bg,
        iconColor: palette.icon.neutral.onNeutralSecondary,
      };
    }
    case 'subtle': {
      // Subtle variant starts transparent and uses tertiary backgrounds on interaction
      const bg = pressed
        ? palette.background.neutral.tertiary
        : (hovered ? palette.background.neutral.tertiaryHover : 'transparent');
      const iconColor = pressed || hovered
        ? palette.icon.neutral.onNeutralTertiary
        : palette.icon.neutral.tertiary;
      return {
        backgroundColor: bg,
        iconColor,
      };
    }
    default: {
      return {
        backgroundColor: palette.background.default.default,
        iconColor: palette.icon.default.default,
      };
    }
  }
}

// Size-specific styles matching Figma design
// Uses "hug" sizing - container wraps icon with padding
function computeSizeStyles(size: IconButtonSize) {
  const borderRadius = Size.space['800']; // 2rem token keeps pill shape consistent with design

  if (size === 'small') {
    return {
      padding: Size.space['200'],
      borderRadius,
      iconSize: '16' as IconSize,
    };
  }
  return {
    padding: Size.space['300'],
    borderRadius,
    iconSize: '20' as IconSize,
  };
}

const renderIcon = (iconNode: React.ReactNode, color: string, iconSize?: IconSize) => {
  if (!React.isValidElement(iconNode)) {
    return iconNode;
  }

  const currentProps = iconNode.props as { color?: string; size?: IconSize };
  const nextProps: Record<string, unknown> = {};

  if (currentProps.color == null) {
    nextProps.color = color;
  }

  if (iconSize && currentProps.size == null) {
    nextProps.size = iconSize;
  }

  if (Object.keys(nextProps).length === 0) {
    return iconNode;
  }

  return React.cloneElement(iconNode, nextProps);
};

export const __ICON_BUTTON_TESTING__ = {
  computeVariantStyles,
  computeSizeStyles,
};

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onPress,
  icon,
  accessibilityLabel,
  style,
  ...accessibilityProps
}) => {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';

  const sizeStyles = React.useMemo(() => computeSizeStyles(size), [size]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }) => {
        const variantStyles = computeVariantStyles(variant, mode, pressed, hovered ?? false, disabled);
        return [
          {
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: sizeStyles.borderRadius,
            backgroundColor: variantStyles.backgroundColor,
            padding: sizeStyles.padding,
          },
          style,
        ];
      }}
      {...accessibilityProps}
    >
      {({ pressed, hovered }) => {
        const variantStyles = computeVariantStyles(variant, mode, pressed, hovered ?? false, disabled);
        return renderIcon(icon, variantStyles.iconColor, sizeStyles.iconSize);
      }}
    </Pressable>
  );
};
