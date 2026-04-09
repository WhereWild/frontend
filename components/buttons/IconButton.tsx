import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { IconSize } from '@/primitives';
import { getInteractiveCursorStyle } from '@/components/interactiveCursorStyle';
import React from 'react';
import {
  AccessibilityProps,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  getButtonSurfaceTransitionStyle,
  renderButtonIconElement,
  useHoverOnlyButtonTransitions,
} from './buttonShared';

export type IconButtonVariant = 'primary' | 'neutral' | 'subtle';
export type IconButtonSize = 'medium' | 'small';

type IconButtonBaseProps = {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  showPointerCursor?: boolean;
  hovered?: boolean;
  pressed?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  delayLongPress?: number;
  icon: React.ReactNode;
  style?: ViewStyle;
} & AccessibilityProps;

export type IconButtonProps =
  | (IconButtonBaseProps & {
      interactive?: true;
      accessibilityLabel: string;
    })
  | (IconButtonBaseProps & {
      interactive: false;
      accessibilityLabel?: string;
    });

const TRANSPARENT = 'transparent';

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
        ? palette.background.neutral.tertiaryPressed
        : hovered
          ? palette.background.neutral.tertiaryHover
          : TRANSPARENT;
      const iconColor =
        pressed || hovered
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

function computeSizeStyles(size: IconButtonSize) {
  // Icon button dimensions follow control tokens by size
  const iconSizeMedium: IconSize = '20';
  const iconSizeSmall: IconSize = '16';

  if (size === 'small') {
    return {
      width: Size.control.dimension.medium,
      height: Size.control.dimension.medium,
      iconSize: iconSizeSmall,
    };
  }
  return {
    width: Size.control.dimension.large,
    height: Size.control.dimension.large,
    iconSize: iconSizeMedium,
  };
}

const renderIcon = (
  iconNode: React.ReactNode,
  color: string,
  iconSize?: IconSize,
  animate = true,
) => {
  return renderButtonIconElement(iconNode, color, iconSize, { animate });
};

export const __ICON_BUTTON_TESTING__ = {
  computeVariantStyles,
  computeSizeStyles,
  renderIcon,
};

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  showPointerCursor = true,
  interactive = true,
  hovered = false,
  pressed = false,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
  delayLongPress,
  icon,
  accessibilityLabel,
  style,
  ...accessibilityProps
}) => {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const { hoverOnlyTransitionHandlers, shouldAnimateTransitions } =
    useHoverOnlyButtonTransitions({
      onPressIn,
      onPressOut,
    });

  const sizeStyles = React.useMemo(() => computeSizeStyles(size), [size]);

  if (!interactive) {
    const variantStyles = computeVariantStyles(
      variant,
      mode,
      pressed,
      hovered,
      disabled,
    );

    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility='no-hide-descendants'
        style={[
          showPointerCursor ? getInteractiveCursorStyle(disabled) : null,
          styles.buttonBase,
          {
            backgroundColor: variantStyles.backgroundColor,
            pointerEvents: 'none',
            width: sizeStyles.width,
            height: sizeStyles.height,
          },
          style,
        ]}
      >
        {renderIcon(icon, variantStyles.iconColor, sizeStyles.iconSize)}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      {...hoverOnlyTransitionHandlers}
      style={({ pressed, hovered }) => {
        const variantStyles = computeVariantStyles(
          variant,
          mode,
          pressed,
          hovered ?? false,
          disabled,
        );
        return [
          showPointerCursor ? getInteractiveCursorStyle(disabled) : null,
          styles.buttonBase,
          getButtonSurfaceTransitionStyle(shouldAnimateTransitions),
          {
            backgroundColor: variantStyles.backgroundColor,
            width: sizeStyles.width,
            height: sizeStyles.height,
          },
          style,
        ];
      }}
      {...accessibilityProps}
    >
      {({ pressed, hovered }) => {
        const variantStyles = computeVariantStyles(
          variant,
          mode,
          pressed,
          hovered ?? false,
          disabled,
        );
        return renderIcon(
          icon,
          variantStyles.iconColor,
          sizeStyles.iconSize,
          shouldAnimateTransitions,
        );
      }}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Size.radius['full'],
  },
});
