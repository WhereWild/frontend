import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { getInteractiveCursorStyle } from '@/components/interactiveCursorStyle';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSize } from '@/primitives/Icon';
import { ThemedText } from '@/components/text/ThemedText';
import { useNavigationBarTabForegroundTransition } from './useNavigationBarTabForegroundTransition';

type NavigationBarTabVisualState = 'default' | 'active' | 'pressed';
export type NavigationBarTabForegroundTone = 'default' | 'brand';

type NavigationBarTabStyles = {
  textColor: string;
  iconColor: string;
};

type NavigationBarTabIconElement = React.ReactElement<{ color?: string; size?: IconSize }>;
type NavigationBarTabIcon =
  | React.ComponentType<{ color?: string; size?: IconSize }>
  | NavigationBarTabIconElement;

export type NavigationBarTabState = NavigationBarTabVisualState;
export type NavigationBarTabVariant = 'horizontal' | 'vertical';

export type NavigationBarTabProps = {
  label: string;
  icon: NavigationBarTabIcon;
  state?: NavigationBarTabState;
  foregroundTone?: NavigationBarTabForegroundTone;
  variant?: NavigationBarTabVariant;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onLayout?: (width: number) => void;
  onContainerLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
  accessibilityLabel?: string;
  testID?: string;
  disabled?: boolean;
  style?: ViewStyle;
};

const TAB_ICON_SIZE: IconSize = '24';

const resolveVisualState = (
  state: NavigationBarTabState,
  pressed: boolean,
  hovered: boolean,
): NavigationBarTabVisualState => {
  if (state === 'active') {
    return 'active';
  }

  if (state === 'pressed' || pressed || hovered) {
    return 'pressed';
  }

  return 'default';
};

const getVisualStyles = (
  mode: 'light' | 'dark',
  visualState: NavigationBarTabVisualState,
): NavigationBarTabStyles => {
  return resolveDefaultOrOnBrandStyles(mode, visualState !== 'default');
};

const resolveDefaultOrOnBrandStyles = (
  mode: 'light' | 'dark',
  isOnBrand: boolean,
): NavigationBarTabStyles => {
  const palette = Colors[mode];

  if (isOnBrand) {
    return {
      textColor: palette.text.brand.onBrand,
      iconColor: palette.icon.brand.onBrand,
    };
  }

  return {
    textColor: palette.text.default.default,
    iconColor: palette.icon.default.default,
  };
};

const resolveForegroundColors = (
  mode: 'light' | 'dark',
  state: NavigationBarTabState,
  foregroundTone: NavigationBarTabForegroundTone,
): NavigationBarTabStyles => {
  const palette = Colors[mode];

  if (foregroundTone === 'brand') {
    return {
      textColor: palette.text.brand.default,
      iconColor: palette.icon.brand.default,
    };
  }

  return resolveDefaultOrOnBrandStyles(mode, state !== 'default');
};

const renderIcon = (icon: NavigationBarTabIcon, color: string, size: IconSize) => {
  if (React.isValidElement(icon)) {
    const currentProps = icon.props as { color?: string; size?: IconSize };
    return React.cloneElement(icon, {
      color: currentProps.color ?? color,
      size: currentProps.size ?? size,
    });
  }

  return React.createElement(icon, { color, size });
};

export function NavigationBarTab({
  label,
  icon,
  state = 'default',
  foregroundTone = 'default',
  variant = 'horizontal',
  onPress,
  onPressIn,
  onPressOut,
  onLayout,
  onContainerLayout,
  accessibilityLabel,
  testID,
  disabled = false,
  style,
}: NavigationBarTabProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const isVertical = variant === 'vertical';
  const targetForegroundColors = React.useMemo(
    () => resolveForegroundColors(mode, state, foregroundTone),
    [foregroundTone, mode, state],
  );
  const foregroundAnimationKey = foregroundTone === 'brand'
    ? `${mode}|brand`
    : state === 'default'
      ? `${mode}|default`
      : `${mode}|on-brand`;
  const animatedForegroundColors = useNavigationBarTabForegroundTransition({
    targetColors: targetForegroundColors,
    animationKey: foregroundAnimationKey,
  });

  return (
    <Pressable
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      testID={testID}
      style={style}
      onLayout={(event) => {
        const { width, height, x, y } = event.nativeEvent.layout;
        onLayout?.(width);
        onContainerLayout?.({ x, y, width, height });
      }}
    >
      {({ pressed, hovered }) => {
        const visualState = resolveVisualState(state, pressed, hovered ?? false);
        const visualStyles = getVisualStyles(mode, visualState);
        const hasInteractiveOverride = foregroundTone === 'default' && visualState !== state;
        const foregroundColor = hasInteractiveOverride
          ? visualStyles.textColor
          : animatedForegroundColors.textColor;
        const iconColor = hasInteractiveOverride
          ? visualStyles.iconColor
          : animatedForegroundColors.iconColor;

        return (
          <View
            collapsable={false}
            style={[
              getInteractiveCursorStyle(disabled),
              styles.base,
              isVertical ? styles.vertical : styles.horizontal,
              styles.visualReset,
            ]}
          >
            <View collapsable={false}>{renderIcon(icon, iconColor, TAB_ICON_SIZE)}</View>
            <View collapsable={false}>
              <ThemedText
                numberOfLines={1}
                variant="singleLineBodyTinyStrong"
                style={{ color: foregroundColor }}
              >
                {label}
              </ThemedText>
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Size.space['200'],
  },
  horizontal: {
    flexDirection: 'row',
    minWidth: 96,
    minHeight: Size.control.height.medium,
    paddingLeft: Size.space['200'],
    paddingRight: Size.space['300'],
    paddingVertical: Size.space['200'],
    borderRadius: Size.radius['full'],
  },
  vertical: {
    flexDirection: 'column',
    minWidth: 64,
    paddingTop: Size.space['200'],
    paddingBottom: Size.space['150'],
    paddingHorizontal: Size.space['300'],
    borderRadius: Size.radius['400'],
  },
  visualReset: {
    backgroundColor: 'transparent',
  },
});

export const __NAVIGATION_BAR_TAB_TESTING__ = {
  resolveVisualState,
  getVisualStyles,
};
