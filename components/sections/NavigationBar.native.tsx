import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  IconBookmark,
  IconCompass,
  IconHome,
  IconSearch,
  IconSettings,
} from '@/assets/icons';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  NavigationBarTab,
  NavigationBarTabState,
  type NavigationBarTabProps,
  type NavigationBarTabVariant,
} from './NavigationBarTab';

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

const DEFAULT_TABS: NavigationBarTabItem[] = [
  { key: 'home', label: 'Home', icon: IconHome, state: 'pressed' },
  { key: 'explore', label: 'Long Label', icon: IconCompass, state: 'active' },
  { key: 'search', label: 'Search', icon: IconSearch, state: 'default' },
  { key: 'library', label: 'Library', icon: IconBookmark, state: 'default' },
  { key: 'settings', label: 'Settings', icon: IconSettings, state: 'default' },
];

const HORIZONTAL_MIN_TAB_WIDTH = 96;
const TAB_GAP = Size.space['200'];

const getRequiredHorizontalWidth = (tabCount: number) => {
  const totalTabWidth = tabCount * HORIZONTAL_MIN_TAB_WIDTH;
  const totalGapWidth = Math.max(0, tabCount - 1) * TAB_GAP;
  return totalTabWidth + totalGapWidth;
};

const shouldUseHorizontalVariant = (
  availableWidth: number,
  tabCount: number,
) => {
  if (tabCount <= 1) {
    return true;
  }

  const requiredWidth = getRequiredHorizontalWidth(tabCount);
  return availableWidth >= requiredWidth;
};

export function NavigationBar({
  tabs = DEFAULT_TABS,
  style,
  accessibilityLabel = 'Navigation bar',
  testID,
}: NavigationBarProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [availableWidth, setAvailableWidth] = React.useState(0);
  const tabVariant: NavigationBarTabVariant = shouldUseHorizontalVariant(
    availableWidth,
    tabs.length,
  )
    ? 'horizontal'
    : 'vertical';

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: palette.background.default.secondary,
          borderTopColor: palette.border.default.secondary,
        },
        style,
      ]}
    >
      <View
        style={styles.tabs}
        onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
      >
        {tabs.map((tab) => (
          <NavigationBarTab
            key={tab.key}
            label={tab.label}
            icon={tab.icon}
            state={tab.state ?? 'default'}
            variant={tabVariant}
            onPress={tab.onPress}
            accessibilityLabel={tab.accessibilityLabel ?? tab.label}
            testID={tab.testID ?? `navigation-bar-tab-${tab.key}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 80,
    borderTopWidth: Size.stroke.border,
    paddingHorizontal: Size.space['400'],
    paddingVertical: Size.space['200'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    width: '100%',
    maxWidth: 640,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: TAB_GAP,
  },
});

export const __NAVIGATION_BAR_TESTING__ = {
  getRequiredHorizontalWidth,
  shouldUseHorizontalVariant,
};
