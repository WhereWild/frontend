import React from 'react';
import { ViewStyle } from 'react-native';
import { IconSize } from '@/primitives/Icon';

// Web/unsupported-platform fallback for the native-only NavigationBarTab.
// Keeps shared imports type-safe while intentionally rendering nothing.

type NavigationBarTabVisualState = 'default' | 'active' | 'pressed';
export type NavigationBarTabForegroundTone = 'default' | 'brand';

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
  _mode: 'light' | 'dark',
  _visualState: NavigationBarTabVisualState,
): NavigationBarTabStyles => ({
  backgroundColor: 'transparent',
  textColor: 'transparent',
  iconColor: 'transparent',
  borderWidth: 0,
});

export function NavigationBarTab(_props: NavigationBarTabProps) {
  return null;
}

export const __NAVIGATION_BAR_TAB_TESTING__ = {
  resolveVisualState,
  getVisualStyles,
};
