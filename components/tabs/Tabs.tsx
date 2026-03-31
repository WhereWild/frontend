import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Tab } from './Tab';
import { computeTabLayout } from './tabLayout';
import { useTabsKeyboardNav } from './useTabsKeyboardNav';

type TabItem = {
  key: string;
  label: string;
  accessibilityLabel?: string;
  testID?: string;
};

export type TabsProps = {
  tabs: TabItem[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  disableNativeHoverVisuals?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

type TabsSeparatorProps = { color: string; testID?: string; hidden?: boolean };

const TabsSeparator = ({ color, testID, hidden = false }: TabsSeparatorProps) => (
  <View
    collapsable={false}
    testID={testID}
    style={[
      styles.separator,
      { backgroundColor: color, pointerEvents: 'none' },
      hidden ? styles.separatorHidden : undefined,
    ]}
  />
);

const MIN_TAB_WIDTH_PX = 96;
const NON_SCROLL_FIT_BUFFER_PX = 12;

export function Tabs({
  tabs,
  selectedKey,
  onSelectionChange,
  disableNativeHoverVisuals = false,
  accessibilityLabel = 'Tabs',
  testID,
}: TabsProps) {
  const isWeb = Platform.OS === 'web';
  const showSeparatorHosts = isWeb;
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [containerWidth, setContainerWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});
  const [overflowSuspended, setOverflowSuspended] = useState(true);
  // Container padding (200 * 2) + pill padding (150 * 2)
  // Extra 2px prevents label ellipsis from appearing at exact-fit widths.
  const textFitBufferPx = 2;
  const horizontalPadding = Size.space['200'] * 2 + Size.space['150'] * 2 + textFitBufferPx;
  const minimumScrollableTabWidthPx = MIN_TAB_WIDTH_PX;

  const {
    focusedIndex,
    selectedIndex,
    setFocusedIndex,
    handleSelectionChange,
    onKeyDownForIndex,
    setTabRefForIndex,
  } = useTabsKeyboardNav({
    tabs,
    selectedKey,
    onSelectionChange,
    enabled: isWeb,
  });

  const { tabWidths, shouldScroll } = useMemo(
    () =>
      computeTabLayout({
        tabs,
        containerWidth,
        labelWidths,
        horizontalPadding,
        minimumTabWidth: minimumScrollableTabWidthPx,
        nonScrollFitBufferPx: NON_SCROLL_FIT_BUFFER_PX,
      }),
    [containerWidth, horizontalPadding, labelWidths, minimumScrollableTabWidthPx, tabs]
  );

  const hasMeasuredAllLabels = useMemo(
    () => tabs.every((tab) => typeof labelWidths[tab.key] === 'number' && labelWidths[tab.key] > 0),
    [labelWidths, tabs],
  );

  const shouldScrollResolved = !hasMeasuredAllLabels ? true : shouldScroll;
  const shouldShowOverflowOutsideScrollHost = hasMeasuredAllLabels && !overflowSuspended;

  useLayoutEffect(() => {
    if (!hasMeasuredAllLabels || containerWidth <= 0 || !overflowSuspended) {
      return;
    }

    setOverflowSuspended(false);
  }, [containerWidth, hasMeasuredAllLabels, overflowSuspended]);

  // Returns width/flex styles for tab wrappers in scroll and non-scroll modes.
  const getTabWrapperStyle = useCallback(
    (resolvedWidth: number | undefined) => {
      if (shouldScrollResolved) {
        return resolvedWidth
          ? {
            width: resolvedWidth,
            flexGrow: 0,
            flexBasis: resolvedWidth,
          }
          : {
            width: minimumScrollableTabWidthPx,
            flexGrow: 0,
            flexBasis: minimumScrollableTabWidthPx,
          };
      }

      return resolvedWidth
        ? {
          flexGrow: resolvedWidth,
          flexBasis: 0,
        }
        : { flexGrow: 1, flexBasis: 0 };
    },
    [minimumScrollableTabWidthPx, shouldScrollResolved],
  );

  // Persists the measured label width for a tab key, keeping the max observed width.
  // This intentionally does not shrink widths on later measurements to avoid layout jitter
  // when label measurement fluctuates across renders.
  const onLabelLayoutForKey = useCallback(
    (tabKey: string) => (width: number) => {
      setLabelWidths((prev) => {
        const nextWidth = Math.max(prev[tabKey] ?? 0, width);
        if (prev[tabKey] === nextWidth) {
          return prev;
        }
        setOverflowSuspended(true);
        return { ...prev, [tabKey]: nextWidth };
      });
    },
    [],
  );

  // Renders a single tab wrapper, tab element, and optional separator.
  const renderTabItem = useCallback(
    (tab: TabItem, index: number) => {
      const isActive = tab.key === selectedKey;
      const nextIsActive = tabs[index + 1]?.key === selectedKey;
      const shouldShowSeparator = !isActive && !nextIsActive && index < tabs.length - 1;
      const resolvedWidth = tabWidths[tab.key];
      const tabbableIndex = focusedIndex ?? (selectedIndex >= 0 ? selectedIndex : 0);
      const isTabbable = isWeb && index === tabbableIndex;
      const tabLayoutStyle = getTabWrapperStyle(resolvedWidth);

      if (!isWeb) {
        return (
          <Tab
            key={tab.key}
            ref={setTabRefForIndex(index)}
            id={tab.key}
            label={tab.label}
            isActive={isActive}
            onPress={handleSelectionChange}
            containerStyle={tabLayoutStyle}
            separatorColor={palette.border.neutral.default}
            separatorHidden={!shouldShowSeparator}
            disableNativeHoverVisuals={disableNativeHoverVisuals}
            onFocus={() => setFocusedIndex(index)}
            onLabelLayout={onLabelLayoutForKey(tab.key)}
            accessibilityLabel={tab.accessibilityLabel ?? tab.label}
            testID={tab.testID}
          />
        );
      }

      return (
        <View
          collapsable={false}
          key={tab.key}
          style={[styles.tabWrapper, tabLayoutStyle]}
        >
          {/** Keyboard navigation props are web-only. */}
          <Tab
            ref={setTabRefForIndex(index)}
            id={tab.key}
            label={tab.label}
            isActive={isActive}
            onPress={handleSelectionChange}
            containerStyle={styles.tabPressableWeb}
            disableNativeHoverVisuals={disableNativeHoverVisuals}
            onFocus={isWeb ? () => setFocusedIndex(index) : undefined}
            onLabelLayout={onLabelLayoutForKey(tab.key)}
            accessibilityLabel={tab.accessibilityLabel ?? tab.label}
            testID={tab.testID}
            {...(isWeb
              ? {
                onKeyDown: onKeyDownForIndex(index),
                focusable: isTabbable,
                tabIndex: isTabbable ? 0 : -1,
              }
              : {})}
          />
          {showSeparatorHosts && index < tabs.length - 1 && (
            <TabsSeparator
              testID={`tabs-separator-${index}`}
              color={palette.border.neutral.default}
              hidden={!shouldShowSeparator}
            />
          )}
        </View>
      );
    },
    [
      focusedIndex,
      getTabWrapperStyle,
      handleSelectionChange,
      isWeb,
      onKeyDownForIndex,
      onLabelLayoutForKey,
      palette.border.neutral.default,
      showSeparatorHosts,
      selectedIndex,
      selectedKey,
      setFocusedIndex,
      setTabRefForIndex,
      tabWidths,
      tabs,
      disableNativeHoverVisuals,
    ],
  );

  // Captures container width to drive scroll/non-scroll layout decisions.
  const onContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setContainerWidth((previousWidth) => {
      if (previousWidth === nextWidth) {
        return previousWidth;
      }

      setOverflowSuspended(true);
      return nextWidth;
    });
  }, []);

  const tabsContent = (
    <View
      collapsable={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.container, shouldScrollResolved ? styles.containerScroll : styles.containerFixed]}
    >
      {tabs.map(renderTabItem)}
    </View>
  );

  return (
    <View
      collapsable={false}
      style={styles.containerWrapper}
      onLayout={onContainerLayout}
    >
      <ScrollView
        testID="tabs-scroll-host"
        horizontal
        scrollEnabled={shouldScrollResolved}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        style={shouldShowOverflowOutsideScrollHost ? styles.scrollHostVisible : undefined}
        contentContainerStyle={[
          styles.scrollContent,
          !shouldScrollResolved ? styles.scrollContentFixed : undefined,
          shouldShowOverflowOutsideScrollHost ? styles.scrollContentVisible : undefined,
        ]}
      >
        {tabsContent}
      </ScrollView>
    </View>
  );
}

export const __TABS_TESTING__ = {
  computeTabLayout,
};

const styles = StyleSheet.create({
  containerWrapper: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['0'],
  },
  containerFixed: {
    width: '100%',
  },
  containerScroll: {
    minWidth: '100%',
    alignSelf: 'flex-start',
  },
  scrollContent: {
    paddingRight: Size.space['200'],
  },
  scrollContentFixed: {
    flexGrow: 1,
  },
  scrollContentVisible: {
    overflow: 'visible',
  },
  scrollHostVisible: {
    overflow: 'visible',
  },
  tabWrapper: {
    position: 'relative',
    minWidth: 0,
  },
  tabPressableWeb: {
    width: '100%',
  },
  separator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -Size.space['200'] }],
    width: Size.stroke.border,
    height: Size.space['400'],
  },
  separatorHidden: {
    opacity: 0,
  },
});
