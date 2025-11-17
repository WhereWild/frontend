import React from 'react';
import { Pressable, ViewStyle, AccessibilityProps } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  // Unusual design decision: Border radius is 32px (var(--sds-typography-scale-06))
  // for both sizes per Figma, creating a pill-shaped button.
  // This deviates from the 8px radius used on regular buttons.
  const borderRadius = 32; // 2rem converted to pixels
  
  if (size === 'small') {
    return {
      padding: Size.space['200'], // 8px
      borderRadius,
      iconSize: 20,
    };
  }
  return {
    padding: Size.space['300'], // 12px
    borderRadius,
    iconSize: 20,
  };
}

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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }) => {
        const v = computeVariantStyles(variant, mode, pressed, hovered ?? false, disabled);
        const s = computeSizeStyles(size);
        return [
          {
            alignItems: 'center',
            justifyContent: 'center',
            // Using "hug" sizing - no hardcoded width/height
            borderRadius: s.borderRadius,
            backgroundColor: v.backgroundColor,
            padding: s.padding,
          },
          style,
        ];
      }}
      {...accessibilityProps}
    >
      {icon}
    </Pressable>
  );
};
