import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSize } from '@/primitives/Icon';
import { ThemedText } from '@/components/text/ThemedText';

type NavigationBarTabVisualState = 'default' | 'active' | 'pressed';

type NavigationBarTabStyles = {
  backgroundColor: string;
  textColor: string;
  iconColor: string;
  borderWidth: number;
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
  variant?: NavigationBarTabVariant;
  onPress?: () => void;
  onLayout?: (width: number) => void;
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
  const palette = Colors[mode];

  if (visualState === 'active') {
    return {
      backgroundColor: palette.background.brand.default,
      textColor: palette.text.brand.onBrand,
      iconColor: palette.icon.brand.onBrand,
      borderWidth: 0,
    };
  }

  if (visualState === 'pressed') {
    return {
      backgroundColor: palette.background.brand.pressed,
      textColor: palette.text.brand.onBrand,
      iconColor: palette.icon.brand.onBrand,
      borderWidth: 0,
    };
  }

  return {
    backgroundColor: 'transparent',
    textColor: palette.text.default.default,
    iconColor: palette.icon.default.default,
    borderWidth: 0,
  };
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
  variant = 'horizontal',
  onPress,
  onLayout,
  accessibilityLabel,
  testID,
  disabled = false,
  style,
}: NavigationBarTabProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const isVertical = variant === 'vertical';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={style}
      onLayout={(event) => onLayout?.(event.nativeEvent.layout.width)}
    >
      {({ pressed, hovered }) => {
        const visualState = resolveVisualState(state, pressed, hovered ?? false);
        const visualStyles = getVisualStyles(mode, visualState);

        return (
          <View
            style={[
              styles.base,
              isVertical ? styles.vertical : styles.horizontal,
              {
                backgroundColor: visualStyles.backgroundColor,
                borderWidth: visualStyles.borderWidth,
              },
            ]}
          >
            {renderIcon(icon, visualStyles.iconColor, TAB_ICON_SIZE)}
            <ThemedText
              numberOfLines={1}
              variant="singleLineBodyTinyStrong"
              style={{ color: visualStyles.textColor }}
            >
              {label}
            </ThemedText>
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
    paddingHorizontal: Size.space['200'],
    borderRadius: Size.radius['400'],
  },
});

export const __NAVIGATION_BAR_TAB_TESTING__ = {
  resolveVisualState,
  getVisualStyles,
};
