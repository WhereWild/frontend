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
import { useResponsive } from '@/hooks/useResponsive';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import {
  NavigationBarTab,
  NavigationBarTabState,
  type NavigationBarTabProps,
  type NavigationBarTabVariant,
} from './NavigationBarTab';
import {
  getMeasuredWidthOrFallback,
  hasAllTabMeasurements,
  updateMeasuredTabWidths,
} from './navigationBarMeasurement';

type NavigationBarTabItem = {
  key: string;
  label: string;
  icon: NavigationBarTabProps['icon'];
  state?: NavigationBarTabState;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

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

const TAB_GAP = Size.space['200'];

const getRequiredHorizontalWidth = (
  tabCount: number,
  measuredTabWidths: Record<string, number>,
  tabKeys: string[],
) => {
  const totalTabWidth = tabKeys.reduce((sum, key) => sum + getMeasuredWidthOrFallback(measuredTabWidths, key), 0);
  const totalGapWidth = Math.max(0, tabCount - 1) * TAB_GAP;
  return totalTabWidth + totalGapWidth;
};

const shouldUseHorizontalVariant = (
  availableWidth: number,
  tabCount: number,
  measuredTabWidths: Record<string, number>,
  tabKeys: string[],
) => {
  if (tabCount <= 1) {
    return true;
  }

  const requiredWidth = getRequiredHorizontalWidth(tabCount, measuredTabWidths, tabKeys);
  return availableWidth >= requiredWidth;
};

const resolveTabVariant = (
  availableWidth: number,
  tabCount: number,
  measuredTabWidths: Record<string, number>,
  tabKeys: string[],
): NavigationBarTabVariant =>
  shouldUseHorizontalVariant(availableWidth, tabCount, measuredTabWidths, tabKeys)
    ? 'horizontal'
    : 'vertical';

export function NavigationBar({
  tabs = DEFAULT_TABS,
  style,
  accessibilityLabel = 'Navigation bar',
  testID,
}: NavigationBarProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const responsive = useResponsive();
  const palette = Colors[mode];
  const safeAreaInsets = React.useContext(SafeAreaInsetsContext);
  const bottomInset = safeAreaInsets?.bottom ?? 0;
  // Most of this component's logic is width measurement: it measures tab widths,
  // adds fixed tab gaps, and picks horizontal vs vertical based on available width.
  const [availableWidth, setAvailableWidth] = React.useState<number | null>(null);
  const [measuredTabWidths, setMeasuredTabWidths] = React.useState<Record<string, number>>({});
  // Keep the last resolved variant visible while we perform hidden measurement for the next width.
  const [resolvedVariant, setResolvedVariant] = React.useState<NavigationBarTabVariant>('horizontal');
  // `true` only while the hidden horizontal layer is collecting measurements.
  const [isMeasuring, setIsMeasuring] = React.useState(true);
  const tabKeys = React.useMemo(() => tabs.map((tab) => tab.key), [tabs]);

  const onTabWidthLayout = React.useCallback((tabKey: string, width: number) => {
    setMeasuredTabWidths((prev) => updateMeasuredTabWidths(prev, tabKeys, tabKey, width));
  }, [tabKeys]);

  React.useEffect(() => {
    if (!isMeasuring || availableWidth === null) {
      return;
    }

    if (tabs.length <= 1) {
      setResolvedVariant('horizontal');
      setIsMeasuring(false);
      return;
    }

    const finalizeMeasurement = () => {
      setResolvedVariant(resolveTabVariant(availableWidth, tabs.length, measuredTabWidths, tabKeys));
      setIsMeasuring(false);
    };

    if (hasAllTabMeasurements(tabKeys, measuredTabWidths)) {
      finalizeMeasurement();
      return;
    }

    // On some RN/iPadOS resize frames, child onLayout callbacks can arrive one tick later.
    // Finalizing on the next macrotask avoids getting stuck in measuring mode while still
    // using whatever widths we have (with min-width fallback for missing tabs).
    const finalizeWithFallback = setTimeout(finalizeMeasurement, 0);
    return () => clearTimeout(finalizeWithFallback);
  }, [availableWidth, isMeasuring, measuredTabWidths, tabKeys, tabs.length]);

  const handleTabsLayout = React.useCallback((width: number) => {
    if (width <= 0) {
      return;
    }

    setAvailableWidth((prev) => {
      if (prev === width) {
        return prev;
      }

      // Re-measure only when width changes.
      setMeasuredTabWidths({});
      setIsMeasuring(true);
      return width;
    });
  }, []);

  const renderTabs = React.useCallback(
    (variant: NavigationBarTabVariant, shouldMeasure: boolean) =>
      tabs.map((tab) => (
        <NavigationBarTab
          key={`${shouldMeasure ? 'measure' : 'visible'}-${tab.key}`}
          label={tab.label}
          icon={tab.icon}
          state={tab.state ?? 'default'}
          variant={variant}
          onPress={tab.onPress}
          onLayout={shouldMeasure ? (width) => onTabWidthLayout(tab.key, width) : undefined}
          accessibilityLabel={tab.accessibilityLabel ?? tab.label}
          testID={tab.testID ?? `navigation-bar-tab-${tab.key}`}
        />
      )),
    [onTabWidthLayout, tabs],
  );

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.safeAreaContainer,
        {
          backgroundColor: palette.background.default.secondary,
          borderTopColor: palette.border.default.secondary,
          paddingBottom: bottomInset,
        },
        style,
      ]}
    >
      <View style={[styles.barContainer, { marginHorizontal: responsive.marginHorizontal }]}>
        <View
          style={styles.tabsHost}
          onLayout={(event) => handleTabsLayout(event.nativeEvent.layout.width)}
        >
          <View style={styles.tabs}>{renderTabs(resolvedVariant, false)}</View>
          {isMeasuring ? (
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.tabs, styles.hiddenMeasureLayer]}
            >
              {renderTabs('horizontal', true)}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    borderTopWidth: Size.stroke.border,
  },
  barContainer: {
    height: 80,
    paddingVertical: Size.space['200'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: TAB_GAP,
  },
  tabsHost: {
    width: '100%',
    maxWidth: 640,
    position: 'relative',
  },
  hiddenMeasureLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  },
});

export const __NAVIGATION_BAR_TESTING__ = {
  getRequiredHorizontalWidth,
  shouldUseHorizontalVariant,
};
