import React from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  IconBookmark,
  IconCompass,
  IconHome,
  IconSearch,
  IconSettings,
} from '@/assets/icons';
import { Colors, Size, Time, getReactNativeEasing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import {
  NavigationBarTab,
  NavigationBarTabState,
  type NavigationBarTabProps,
  type NavigationBarTabVariant,
} from './NavigationBarTab';
import { getMeasuredWidthOrFallback } from './navigationBarMeasurement';
import { useNavigationBarPanResponder } from './useNavigationBarPanResponder';
import { useNavigationBarLayoutModel } from './useNavigationBarLayoutModel';
import { useNavigationBarSelectionModel } from './useNavigationBarSelectionModel';
import { useNavigationBarIndicator } from './useNavigationBarIndicator';

type NavigationBarTabItem = {
  key: string;
  label: string;
  icon: NavigationBarTabProps['icon'];
  state?: NavigationBarTabState;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

const areNavigationTabItemsEqual = (
  previous: NavigationBarTabItem,
  next: NavigationBarTabItem,
) => previous.key === next.key
  && previous.label === next.label
  && previous.icon === next.icon
  && previous.state === next.state
  && previous.onPress === next.onPress
  && previous.accessibilityLabel === next.accessibilityLabel
  && previous.testID === next.testID;

const areNavigationTabsEqual = (
  previousTabs: NavigationBarTabItem[],
  nextTabs: NavigationBarTabItem[],
) => previousTabs.length === nextTabs.length
  && previousTabs.every((previousTab, index) => areNavigationTabItemsEqual(previousTab, nextTabs[index]!));

// Keeps an internal stable tabs reference when callers pass a new array instance
// with equivalent tab items, so downstream hook dependencies don't churn needlessly.
const useStableNavigationTabs = (tabs: NavigationBarTabItem[]) => {
  const stableTabsRef = React.useRef(tabs);

  if (!areNavigationTabsEqual(stableTabsRef.current, tabs)) {
    stableTabsRef.current = tabs;
  }

  return stableTabsRef.current;
};

export type NavigationBarProps = {
  /**
   * Ordered tab definitions to render in the bar.
   * If at least one tab includes `state`, the component treats selection as controlled.
   */
  tabs?: NavigationBarTabItem[];
  /** Optional style override for the safe-area root container. */
  style?: StyleProp<ViewStyle>;
  /** Accessibility label applied to the tablist container. */
  accessibilityLabel?: string;
  /** Optional test id for the tablist root. */
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
const DEFAULT_BOTTOM_PADDING = Size.space['200'];
const NAV_ANIMATION_DURATION = Time.duration.short;
const RESIZE_SETTLE_DELAY_MS = Time.duration.short;
const RESIZE_WIDTH_REMEASURE_THRESHOLD_PX = 1;

/** Computes total horizontal space required from measured tab widths + fixed tab gaps. */
const getRequiredHorizontalWidth = (
  tabCount: number,
  measuredTabWidths: Record<string, number>,
  tabKeys: string[],
) => {
  const totalTabWidth = tabKeys.reduce((sum, key) => sum + getMeasuredWidthOrFallback(measuredTabWidths, key), 0);
  const totalGapWidth = Math.max(0, tabCount - 1) * TAB_GAP;
  return totalTabWidth + totalGapWidth;
};

/** Returns true when the available width can fit all tabs in horizontal mode. */
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

/** Resolves tab presentation variant based on available host width and measured tab widths. */
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
  // Interface contract:
  // - Controlled mode: caller provides tab `state` and handles navigation in `onPress`.
  // - Uncontrolled mode: internal active index updates on selection.
  // - Drag/press gestures preview tabs and commit on release through tab `onPress`.
  const stableTabs = useStableNavigationTabs(tabs);
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const responsive = useResponsive();
  const palette = Colors[mode];
  const safeAreaInsets = React.useContext(SafeAreaInsetsContext);
  const bottomInset = safeAreaInsets?.bottom ?? 0;
  const safeAreaBottomPadding = Math.max(bottomInset - DEFAULT_BOTTOM_PADDING, 0);
  const safeAreaBottomPaddingAnimatedRef = React.useRef(
    new Animated.Value(safeAreaBottomPadding),
  );
  const hasAnimatedSafeAreaPaddingRef = React.useRef(false);
  const tabKeys = React.useMemo(() => stableTabs.map((tab) => tab.key), [stableTabs]);
  const {
    activeIndex,
    previewIndex,
    setPreviewIndex,
    commitTabSelection,
    resolveDerivedState,
    resolveTabForegroundTone,
  } = useNavigationBarSelectionModel({ tabs: stableTabs });
  const indicatorTargetIndex = previewIndex ?? activeIndex;
  const {
    tabKeySignature,
    resolvedVariant,
    isMeasuring,
    tabLayouts,
    isResizingRef,
    onTabWidthLayout,
    handleTabsLayout,
    handleTabContainerLayout,
    getTabIndexAtPoint,
  } = useNavigationBarLayoutModel({
    tabs: stableTabs,
    tabKeys,
    resolveTabVariant,
    resizeSettleDelayMs: RESIZE_SETTLE_DELAY_MS,
    remeasureThresholdPx: RESIZE_WIDTH_REMEASURE_THRESHOLD_PX,
  });

  const easing = React.useMemo(() => getReactNativeEasing('in-and-out'), []);
  const {
    indicatorX,
    indicatorWidth,
    indicatorScaleX,
    indicatorBackgroundColor,
  } = useNavigationBarIndicator({
    tabs: stableTabs,
    tabLayouts,
    indicatorTargetIndex,
    previewIndex,
    isResizing: isResizingRef.current,
    activeColor: palette.background.brand.default,
    pressedColor: palette.background.brand.pressed,
    duration: NAV_ANIMATION_DURATION,
    easing,
  });

  const activeTab = stableTabs[activeIndex];
  const activeLayout = activeTab ? tabLayouts[activeTab.key] : undefined;

  const {
    tabsHostRef,
    measureTabsHostInWindow,
    panHandlers,
    shouldHandleTabPress,
  } = useNavigationBarPanResponder({
    getTabIndexAtPoint,
    setPreviewIndex,
    commitTabSelection,
  });

  const handleTabPress = React.useCallback((index: number) => {
    if (!shouldHandleTabPress()) {
      return;
    }

    commitTabSelection(index);
  }, [commitTabSelection, shouldHandleTabPress]);

  React.useEffect(() => {
    if (!hasAnimatedSafeAreaPaddingRef.current) {
      hasAnimatedSafeAreaPaddingRef.current = true;
      safeAreaBottomPaddingAnimatedRef.current.setValue(safeAreaBottomPadding);
      return;
    }

    const animation = Animated.timing(safeAreaBottomPaddingAnimatedRef.current, {
      toValue: safeAreaBottomPadding,
      duration: NAV_ANIMATION_DURATION,
      easing,
      useNativeDriver: false,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [easing, safeAreaBottomPadding]);

  React.useEffect(() => {
    measureTabsHostInWindow();
  }, [measureTabsHostInWindow, resolvedVariant, tabKeySignature]);

  const handleTabsHostLayout = React.useCallback((event: LayoutChangeEvent) => {
    handleTabsLayout(event.nativeEvent.layout.width, event.nativeEvent.layout.height);
    measureTabsHostInWindow();
  }, [handleTabsLayout, measureTabsHostInWindow]);

  const indicatorRadius = resolvedVariant === 'horizontal' ? Size.radius['full'] : Size.radius['400'];

  const renderTabs = React.useCallback(
    (variant: NavigationBarTabVariant, shouldMeasure: boolean) =>
      stableTabs.map((tab, index) => {
        return (
          <NavigationBarTab
            key={`${shouldMeasure ? 'measure' : 'visible'}-${tab.key}`}
            label={tab.label}
            icon={tab.icon}
            state={resolveDerivedState(index)}
            foregroundTone={resolveTabForegroundTone(index)}
            variant={variant}
            onPress={shouldMeasure ? undefined : () => handleTabPress(index)}
            onLayout={shouldMeasure ? (width) => onTabWidthLayout(tab.key, width) : undefined}
            onContainerLayout={
              shouldMeasure
                ? undefined
                : (layout) => handleTabContainerLayout(tab.key, layout)
            }
            accessibilityLabel={tab.accessibilityLabel ?? tab.label}
            testID={tab.testID ?? `navigation-bar-tab-${tab.key}`}
          />
        );
      }),
    [
      handleTabContainerLayout,
      handleTabPress,
      onTabWidthLayout,
      resolveDerivedState,
      resolveTabForegroundTone,
      stableTabs,
    ],
  );

  const activeIndicatorNode = activeLayout ? (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.activeIndicator,
        {
          transform: [{ translateX: indicatorX }, { scaleX: indicatorScaleX }],
          width: indicatorWidth,
          top: activeLayout.y,
          height: activeLayout.height,
          borderRadius: indicatorRadius,
          backgroundColor: indicatorBackgroundColor,
        },
      ]}
    />
  ) : null;

  const measuringLayerNode = isMeasuring ? (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tabs, styles.hiddenMeasureLayer]}
    >
      {renderTabs('horizontal', true)}
    </View>
  ) : null;

  return (
    <Animated.View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.safeAreaContainer,
        {
          backgroundColor: palette.background.default.secondary,
          borderTopColor: palette.border.default.secondary,
          paddingBottom: safeAreaBottomPaddingAnimatedRef.current,
        },
        style,
      ]}
    >
      <View style={[styles.barContainer, { marginHorizontal: responsive.marginHorizontal }]}>
        <View
          ref={tabsHostRef}
          style={styles.tabsHost}
          onLayout={handleTabsHostLayout}
          onTouchStart={measureTabsHostInWindow}
          {...panHandlers}
        >
          {activeIndicatorNode}
          <View style={styles.tabs}>{renderTabs(resolvedVariant, false)}</View>
          {measuringLayerNode}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    borderTopWidth: Size.stroke.border,
  },
  barContainer: {
    height: Size.bar.height.tall,
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
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
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
  areNavigationTabsEqual,
};
