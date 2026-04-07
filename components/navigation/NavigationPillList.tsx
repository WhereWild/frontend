import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Size } from '@/constants/theme';
import { NavigationPill } from './NavigationPill';

type NavigationPillItem = {
  key: string;
  label: string;
  accessibilityLabel?: string;
  testID?: string;
  icon?: React.ReactNode;
};

export type NavigationPillListProps = {
  pills: NavigationPillItem[];
  selectedKey: string;
  highlightedKey?: string;
  onSelectionChange: (key: string) => void;
  direction?: 'horizontal' | 'vertical';
  accessibilityLabel?: string;
  testID?: string;
  onFocusRequest?: (index: number) => void;
  highlightOutlineColor?: string;
};

type KeyEvent = { nativeEvent?: { key?: string }; preventDefault?: () => void };

type PillRef = React.ElementRef<typeof NavigationPill> & { focus?: () => void };

type NavigationPillRef = PillRef | null;

export function NavigationPillList({
  pills,
  selectedKey,
  highlightedKey,
  onSelectionChange,
  direction = 'horizontal',
  accessibilityLabel = 'Navigation pills',
  testID,
  onFocusRequest,
  highlightOutlineColor,
}: NavigationPillListProps) {
  const isWeb = Platform.OS === 'web';
  const pillRefs = useRef<NavigationPillRef[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [pillWidths, setPillWidths] = useState<Record<string, number>>({});
  const isHorizontal = direction === 'horizontal';
  const useNativeStableHorizontalRow = isHorizontal && !isWeb;
  const stableNativeHorizontalPillsRef = useRef<NavigationPillItem[]>(pills);

  if (useNativeStableHorizontalRow) {
    const currentByKey = new Map(pills.map((pill) => [pill.key, pill] as const));
    const hiddenPills = stableNativeHorizontalPillsRef.current.filter(
      (pill) => !currentByKey.has(pill.key),
    );

    stableNativeHorizontalPillsRef.current = [...pills, ...hiddenPills];
  } else {
    stableNativeHorizontalPillsRef.current = pills;
  }

  const renderedPills = useNativeStableHorizontalRow ? stableNativeHorizontalPillsRef.current : pills;
  const currentPillKeys = useMemo(() => new Set(pills.map((pill) => pill.key)), [pills]);

  const selectedIndex = useMemo(
    () => pills.findIndex((pill) => pill.key === selectedKey),
    [pills, selectedKey]
  );

  const maxPillWidth = useMemo(() => {
    if (isHorizontal) {
      return null;
    }
    const widths = Object.values(pillWidths);
    if (widths.length === 0) {
      return null;
    }
    return Math.max(...widths);
  }, [isHorizontal, pillWidths]);

  useEffect(() => {
    if (!isWeb) {
      return;
    }

    if (selectedIndex < 0) {
      return;
    }
    setFocusedIndex(selectedIndex);
  }, [isWeb, selectedIndex]);

  const handleSelectionChange = useCallback(
    (key: string) => {
      if (key !== selectedKey) {
        onSelectionChange(key);
      }
    },
    [onSelectionChange, selectedKey]
  );

  const focusPill = useCallback((index: number) => {
    const ref = pillRefs.current[index];
    ref?.focus?.();
    onFocusRequest?.(index);
  }, [onFocusRequest]);

  const updateVerticalPillWidth = useCallback(
    (pillKey: string, width: number) => {
      if (isHorizontal) {
        return;
      }
      setPillWidths((prev) => {
        if (prev[pillKey] === width) {
          return prev;
        }
        return { ...prev, [pillKey]: width };
      });
    },
    [isHorizontal],
  );

  const getNextIndex = useCallback(
    (currentIndex: number, directionStep: 1 | -1) => {
      const count = pills.length;
      if (count === 0) return currentIndex;
      return (currentIndex + directionStep + count) % count;
    },
    [pills.length]
  );

  const onKeyDownForIndex = useCallback(
    (index: number) => (event: KeyEvent) => {
      const key = event.nativeEvent?.key;
      if (!key) return;

      const isForward = isHorizontal ? key === 'ArrowRight' : key === 'ArrowDown';
      const isBackward = isHorizontal ? key === 'ArrowLeft' : key === 'ArrowUp';

      if (isForward || isBackward) {
        event.preventDefault?.();
        const directionStep: 1 | -1 = isForward ? 1 : -1;
        const nextIndex = getNextIndex(index, directionStep);
        focusPill(nextIndex);
        setFocusedIndex(nextIndex);
      }

      if (key === 'Enter' || key === ' ') {
        event.preventDefault?.();
        const pillKey = pills[index]?.key;
        if (pillKey) {
          handleSelectionChange(pillKey);
        }
      }
    },
    [focusPill, getNextIndex, handleSelectionChange, isHorizontal, pills]
  );

  return (
    <View
      collapsable={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.list,
        isHorizontal
          ? useNativeStableHorizontalRow
            ? styles.listHorizontalNative
            : styles.listHorizontal
          : styles.listVertical,
      ]}
    >
      {renderedPills.map((pill, index) => {
        const isVisible = currentPillKeys.has(pill.key);
        const isActive = isVisible && pill.key === selectedKey;
        const isHighlighted = isVisible && pill.key === highlightedKey;
        const tabbableIndex = focusedIndex ?? (selectedIndex >= 0 ? selectedIndex : 0);
        const isTabbable = isWeb && isVisible && index === tabbableIndex;
        const hasTrailingVisibleSibling = renderedPills
          .slice(index + 1)
          .some((nextPill) => currentPillKeys.has(nextPill.key));
        const pillSpacingStyle = isHorizontal
          ? useNativeStableHorizontalRow
            ? isVisible && hasTrailingVisibleSibling
              ? styles.pillSpacingHorizontalNative
              : undefined
            : styles.pillSpacingHorizontal
          : isVisible && hasTrailingVisibleSibling
            ? styles.pillSpacingVertical
            : undefined;

        const pillNode = (
          <NavigationPill
            ref={(node) => {
              pillRefs.current[index] = node;
            }}
            id={pill.key}
            label={pill.label}
            isActive={isActive}
            isHighlighted={isHighlighted}
            onPress={handleSelectionChange}
            onKeyDown={isWeb ? onKeyDownForIndex(index) : undefined}
            onFocus={isWeb ? () => setFocusedIndex(index) : undefined}
            onContentLayout={(width) => updateVerticalPillWidth(pill.key, width)}
            contentWidth={!isHorizontal ? maxPillWidth ?? undefined : undefined}
            focusable={isWeb ? isTabbable : undefined}
            tabIndex={isWeb ? (isTabbable ? 0 : -1) : undefined}
            accessibilityLabel={pill.accessibilityLabel ?? pill.label}
            testID={pill.testID}
            icon={pill.icon}
            highlightOutlineColor={highlightOutlineColor}
            style={!isVisible ? styles.hiddenPill : undefined}
          />
        );

        return (
          <View
            key={pill.key}
            collapsable={false}
            accessibilityElementsHidden={!isVisible}
            importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
            style={[
              styles.pillWrapper,
              isHorizontal ? styles.pillWrapperHorizontal : styles.pillWrapperVertical,
              pillSpacingStyle,
              !isVisible && styles.hiddenPillWrapper,
            ]}
          >
            {pillNode}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {},
  listHorizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  listHorizontalNative: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  listVertical: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  pillWrapper: {
    alignSelf: 'flex-start',
  },
  pillWrapperHorizontal: {
    flexShrink: 0,
  },
  pillWrapperVertical: {
    alignSelf: 'flex-start',
  },
  pillSpacingHorizontal: {
    marginRight: Size.space['200'],
    marginBottom: Size.space['200'],
  },
  pillSpacingHorizontalNative: {
    marginRight: Size.space['200'],
    marginBottom: Size.space['200'],
  },
  pillSpacingVertical: {
    marginBottom: Size.space['200'],
  },
  hiddenPillWrapper: {
    width: 0,
    height: 0,
    marginRight: 0,
    marginBottom: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  hiddenPill: {
    pointerEvents: 'none',
  },
});
