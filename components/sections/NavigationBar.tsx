import { StyleProp, ViewStyle } from 'react-native';
import {
  NavigationBarTabState,
  type NavigationBarTabProps,
} from './NavigationBarTab';

// Web/unsupported-platform fallback for the native-only NavigationBar.
// Keeps shared imports type-safe while intentionally rendering nothing.

type NavigationBarTabItem = {
  key: string;
  label: string;
  icon: NavigationBarTabProps['icon'];
  state?: NavigationBarTabState;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

export type NavigationBarVariant = 'tablet' | 'phone';

export type NavigationBarProps = {
  tabs?: NavigationBarTabItem[];
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function NavigationBar(_props: NavigationBarProps) {
  return null;
}

export const __NAVIGATION_BAR_TESTING__ = {
  getRequiredHorizontalWidth: (_tabCount: number) => 0,
  shouldUseHorizontalVariant: (_availableWidth: number, _tabCount: number) => false,
};
