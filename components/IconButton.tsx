import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { IconSize } from '@/primitives';
import React from 'react';
import { AccessibilityProps, Pressable, ViewStyle } from 'react-native';

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
  const strokeWidth = Size.stroke.border;
  const transparent = 'transparent';

  if (disabled) {
    return {
      backgroundColor: palette.background.disabled.default,
      iconColor: palette.icon.disabled.onDisabled,
      borderColor: transparent,
      borderWidth: 0,
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
        borderColor: transparent,
        borderWidth: 0,
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
      const iconColor = pressed || hovered
        ? palette.icon.neutral.onNeutralTertiary
        : palette.icon.neutral.tertiary;
      const borderWidth = strokeWidth;
      return {
        backgroundColor: bg,
        iconColor,
        borderColor: isOutlinedState ? palette.border.neutral.tertiary : transparent,
        borderWidth,
      };
    }
    default: {
      return {
        backgroundColor: palette.background.default.default,
        iconColor: palette.icon.default.default,
        borderColor: transparent,
        borderWidth: 0,
      };
    }
  }
}

// Size-specific styles matching Figma design
// Uses "hug" sizing - container wraps icon with padding
function computeSizeStyles(size: IconButtonSize) {
  const borderRadius = Size.space['800']; // 2rem token keeps shape consistent with design
  const iconSize: IconSize = '20';

  if (size === 'small') {
    return {
      padding: Size.space['200'],
      borderRadius,
      iconSize,
    };
  }
  return {
    padding: Size.space['300'],
    borderRadius,
    iconSize,
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
        const borderWidth = variantStyles.borderWidth ?? 0;
        // Only adjust padding for 'subtle' variant, which has a border
        const padding =
          variant === 'subtle'
            ? Math.max(0, sizeStyles.padding - borderWidth)
            : sizeStyles.padding;
        return [
          {
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: sizeStyles.borderRadius,
            backgroundColor: variantStyles.backgroundColor,
            borderColor: variantStyles.borderColor,
            borderWidth: variantStyles.borderWidth,
            padding,
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
