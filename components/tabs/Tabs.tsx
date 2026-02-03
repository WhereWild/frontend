import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Tab } from './Tab';

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
  accessibilityLabel?: string;
  testID?: string;
};

type KeyEvent = { nativeEvent?: { key?: string }; preventDefault?: () => void };

type TabsSeparatorProps = { color: string; testID?: string };

const TabsSeparator = ({ color, testID }: TabsSeparatorProps) => (
  <View
    testID={testID}
    style={[styles.separator, { backgroundColor: color }]}
  />
);

type TabLayout = {
  tabWidths: Record<string, number>;
  shouldScroll: boolean;
};

type ComputeTabLayoutArgs = {
  tabs: TabItem[];
  containerWidth: number;
  labelWidths: Record<string, number>;
  horizontalPadding: number;
};

// Computes tab widths and whether to enable horizontal scrolling.
//
// Rules:
// 1) If all labels fit in equal-width tabs, use equal widths.
// 2) If some labels exceed equal width, shrink only the shorter tabs first
//    by distributing the deficit across available slack.
// 3) If slack cannot cover the deficit, enable horizontal scrolling.
const computeTabLayout = ({
  tabs,
  containerWidth,
  labelWidths,
  horizontalPadding,
}: ComputeTabLayoutArgs): TabLayout => {
  if (containerWidth <= 0 || tabs.length === 0) {
    return { tabWidths: {}, shouldScroll: false };
  }

  const equalWidth = containerWidth / tabs.length;
  const requiredWidths = tabs.map((tab) => {
    const labelWidth = labelWidths[tab.key] ?? 0;
    return labelWidth + horizontalPadding;
  });

  const canUseEqualWidths = requiredWidths.every((width) => width <= equalWidth);
  if (canUseEqualWidths) {
    return {
      tabWidths: tabs.reduce<Record<string, number>>((acc, tab) => {
        acc[tab.key] = equalWidth;
        return acc;
      }, {}),
      shouldScroll: false,
    };
  }

  const deficits = requiredWidths.map((width) => Math.max(0, width - equalWidth));
  const totalDeficit = deficits.reduce((sum, value) => sum + value, 0);
  const slacks = requiredWidths.map((width) => Math.max(0, equalWidth - width));
  const totalSlack = slacks.reduce((sum, value) => sum + value, 0);
  const shouldScroll = totalDeficit > totalSlack;

  const desiredWidths = requiredWidths.map((width, index) => {
    if (width >= equalWidth) {
      return width;
    }

    if (shouldScroll || totalSlack === 0) {
      return width;
    }

    const slackShare = slacks[index] / totalSlack;
    const shrinkAmount = totalDeficit * slackShare;
    return Math.max(width, equalWidth - shrinkAmount);
  });

  return {
    tabWidths: tabs.reduce<Record<string, number>>((acc, tab, index) => {
      acc[tab.key] = Math.max(0, desiredWidths[index]);
      return acc;
    }, {}),
    shouldScroll,
  };
};

export function Tabs({
  tabs,
  selectedKey,
  onSelectionChange,
  accessibilityLabel = 'Tabs',
  testID,
}: TabsProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const tabRefs = useRef<(React.ElementRef<typeof Tab> | null)[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const lastSelectedKeyRef = useRef<string | null>(selectedKey ?? null);
  // Container padding (200 * 2) + pill padding (150 * 2)
  // Extra 2px prevents label ellipsis from appearing at exact-fit widths.
  const textFitBufferPx = 2;
  const horizontalPadding = Size.space['200'] * 2 + Size.space['150'] * 2 + textFitBufferPx;

  const { tabWidths, shouldScroll } = useMemo(
    () =>
      computeTabLayout({
        tabs,
        containerWidth,
        labelWidths,
        horizontalPadding,
      }),
    [containerWidth, horizontalPadding, labelWidths, tabs]
  );

  const handleSelectionChange = useCallback(
    (key: string) => {
      if (key !== selectedKey) {
        onSelectionChange(key);
      }
    },
    [onSelectionChange, selectedKey]
  );

  const focusTab = useCallback((index: number) => {
    const ref = tabRefs.current[index] as { focus?: () => void } | null;
    ref?.focus?.();
  }, []);

  const selectedIndex = useMemo(
    () => tabs.findIndex((tab) => tab.key === selectedKey),
    [tabs, selectedKey]
  );

  useEffect(() => {
    if (selectedIndex < 0) {
      return;
    }

    if (lastSelectedKeyRef.current !== selectedKey) {
      lastSelectedKeyRef.current = selectedKey;
      setFocusedIndex(selectedIndex);
      return;
    }

    if (focusedIndex === null) {
      setFocusedIndex(selectedIndex);
    }
  }, [focusedIndex, selectedIndex, selectedKey]);

  const getNextIndex = useCallback(
    (currentIndex: number, direction: 1 | -1) => {
      const count = tabs.length;
      if (count === 0) return currentIndex;
      return (currentIndex + direction + count) % count;
    },
    [tabs.length]
  );

  const onKeyDownForIndex = useCallback(
    (index: number) => (event: KeyEvent) => {
      const key = event.nativeEvent?.key;
      if (!key) return;

      if (key === 'ArrowRight' || key === 'ArrowLeft') {
        event.preventDefault?.();
        const direction = key === 'ArrowRight' ? 1 : -1;
        const nextIndex = getNextIndex(index, direction);
        focusTab(nextIndex);
        setFocusedIndex(nextIndex);
      }

      if (key === 'Enter' || key === ' ') {
        event.preventDefault?.();
        const activeIndex = focusedIndex ?? index;
        const tabKey = tabs[activeIndex]?.key;
        if (tabKey) {
          handleSelectionChange(tabKey);
        }
      }
    },
    [focusTab, focusedIndex, getNextIndex, handleSelectionChange, tabs]
  );

  const tabsContent = (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={styles.container}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.key === selectedKey;
        const nextIsActive = tabs[index + 1]?.key === selectedKey;
        const shouldRenderSeparator = !isActive && !nextIsActive && index < tabs.length - 1;
        const resolvedWidth = tabWidths[tab.key];
        const tabbableIndex = focusedIndex ?? (selectedIndex >= 0 ? selectedIndex : 0);
        const isTabbable = index === tabbableIndex;

        return (
          <View
            key={tab.key}
            style={[
              styles.tabWrapper,
              resolvedWidth
                ? { width: resolvedWidth, flexGrow: 0, flexBasis: resolvedWidth }
                : { flexGrow: 1, flexBasis: 0 },
            ]}
          >
            <Tab
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              id={tab.key}
              label={tab.label}
              isActive={isActive}
              onPress={handleSelectionChange}
              onKeyDown={onKeyDownForIndex(index)}
              onFocus={() => setFocusedIndex(index)}
              focusable={isTabbable}
              tabIndex={isTabbable ? 0 : -1}
              onLabelLayout={(width) => {
                // Cache measured label width per tab for layout calculations.
                setLabelWidths((prev) => {
                  if (prev[tab.key] === width) {
                    return prev;
                  }
                  return { ...prev, [tab.key]: width };
                });
              }}
              accessibilityLabel={tab.accessibilityLabel ?? tab.label}
              testID={tab.testID}
            />
            {shouldRenderSeparator && (
              <TabsSeparator
                testID={`tabs-separator-${index}`}
                color={palette.border.neutral.default}
              />
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <View
      style={styles.containerWrapper}
      onLayout={(event: LayoutChangeEvent) => {
        // Track available width to decide between equal sizing and scroll.
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      {shouldScroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {tabsContent}
        </ScrollView>
      ) : (
        tabsContent
      )}
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
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },
  tabWrapper: {
    position: 'relative',
    minWidth: 0,
  },
  separator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -Size.space['200'] }],
    width: Size.stroke.border,
    height: Size.space['400'],
  },
});
