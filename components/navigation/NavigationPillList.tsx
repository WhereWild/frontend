import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Size } from '@/constants/theme';
import { NavigationPill } from './Pill';

type NavigationPillItem = {
  key: string;
  label: string;
  accessibilityLabel?: string;
  testID?: string;
};

export type NavigationPillListProps = {
  pills: NavigationPillItem[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  direction?: 'horizontal' | 'vertical';
  accessibilityLabel?: string;
  testID?: string;
  onFocusRequest?: (index: number) => void;
};

type KeyEvent = { nativeEvent?: { key?: string }; preventDefault?: () => void };

type PillRef = React.ElementRef<typeof NavigationPill> & { focus?: () => void };

type NavigationPillRef = PillRef | null;

export function NavigationPillList({
  pills,
  selectedKey,
  onSelectionChange,
  direction = 'horizontal',
  accessibilityLabel = 'Navigation pills',
  testID,
  onFocusRequest,
}: NavigationPillListProps) {
  const pillRefs = useRef<NavigationPillRef[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const lastSelectedKeyRef = useRef<string>(selectedKey);
  const [pillWidths, setPillWidths] = useState<Record<string, number>>({});
  const isHorizontal = direction === 'horizontal';

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
        const activeIndex = focusedIndex ?? (selectedIndex >= 0 ? selectedIndex : index);
        const pillKey = pills[activeIndex]?.key;
        if (pillKey) {
          handleSelectionChange(pillKey);
        }
      }
    },
    [focusPill, focusedIndex, getNextIndex, handleSelectionChange, isHorizontal, pills, selectedIndex]
  );

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[
        styles.list,
        isHorizontal ? styles.listHorizontal : styles.listVertical,
      ]}
    >
      {pills.map((pill, index) => {
        const isActive = pill.key === selectedKey;
        const tabbableIndex = focusedIndex ?? (selectedIndex >= 0 ? selectedIndex : 0);
        const isTabbable = index === tabbableIndex;

        return (
          <View
            key={pill.key}
            style={!isHorizontal ? styles.pillWrapperVertical : undefined}
          >
            <NavigationPill
              ref={(node) => {
                pillRefs.current[index] = node;
              }}
              id={pill.key}
              label={pill.label}
              isActive={isActive}
              onPress={handleSelectionChange}
              onKeyDown={onKeyDownForIndex(index)}
              onFocus={() => setFocusedIndex(index)}
              onContentLayout={(width) => {
                if (isHorizontal) {
                  return;
                }
                setPillWidths((prev) => {
                  if (prev[pill.key] === width) {
                    return prev;
                  }
                  return { ...prev, [pill.key]: width };
                });
              }}
              contentWidth={!isHorizontal ? maxPillWidth : undefined}
              focusable={isTabbable}
              tabIndex={isTabbable ? 0 : -1}
              accessibilityLabel={pill.accessibilityLabel ?? pill.label}
              testID={pill.testID}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Size.space['200'],
  },
  listHorizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  listVertical: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  pillWrapperVertical: {
    alignSelf: 'flex-start',
  },
});
