// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tab } from './Tab';

type KeyboardTabItem = {
  key: string;
};

type KeyEvent = { nativeEvent?: { key?: string }; preventDefault?: () => void };

type UseTabsKeyboardNavArgs = {
  tabs: KeyboardTabItem[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  enabled?: boolean;
};

type UseTabsKeyboardNavResult = {
  focusedIndex: number | null;
  selectedIndex: number;
  setFocusedIndex: (index: number | null) => void;
  handleSelectionChange: (key: string) => void;
  onKeyDownForIndex: (index: number) => (event: KeyEvent) => void;
  setTabRefForIndex: (
    index: number,
  ) => (node: React.ElementRef<typeof Tab> | null) => void;
};

// Manages roving focus, keyboard interactions, and controlled selection for tabs.
export const useTabsKeyboardNav = ({
  tabs,
  selectedKey,
  onSelectionChange,
  enabled = true,
}: UseTabsKeyboardNavArgs): UseTabsKeyboardNavResult => {
  const tabRefs = useRef<(React.ElementRef<typeof Tab> | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const lastSelectedKeyRef = useRef<string | null>(selectedKey ?? null);

  // Emits selection changes only when the target tab differs from the current one.
  const handleSelectionChange = useCallback(
    (key: string) => {
      if (key !== selectedKey) {
        onSelectionChange(key);
      }
    },
    [onSelectionChange, selectedKey],
  );

  // Moves focus to the tab element at the given index, if available.
  const focusTab = useCallback((index: number) => {
    const ref = tabRefs.current[index] as { focus?: () => void } | null;
    ref?.focus?.();
  }, []);

  const selectedIndex = useMemo(
    () => tabs.findIndex((tab) => tab.key === selectedKey),
    [tabs, selectedKey],
  );

  // Keeps roving focus aligned with selected tab on first render and controlled updates.
  useEffect(() => {
    if (!enabled) {
      return;
    }

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
  }, [enabled, focusedIndex, selectedIndex, selectedKey]);

  // Returns wrapped next index for left/right keyboard navigation.
  const getNextIndex = useCallback(
    (currentIndex: number, direction: 1 | -1) => {
      const count = tabs.length;
      if (count === 0) return currentIndex;
      return (currentIndex + direction + count) % count;
    },
    [tabs.length],
  );

  // Handles arrow key focus movement and Enter/Space activation.
  const onKeyDownForIndex = useCallback(
    (index: number) => (event: KeyEvent) => {
      if (!enabled) {
        return;
      }

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
    [
      enabled,
      focusTab,
      focusedIndex,
      getNextIndex,
      handleSelectionChange,
      tabs,
    ],
  );

  // Stores each tab ref for keyboard focus movement.
  const setTabRefForIndex = useCallback(
    (index: number) => (node: React.ElementRef<typeof Tab> | null) => {
      tabRefs.current[index] = node;
    },
    [],
  );

  return {
    focusedIndex,
    selectedIndex,
    setFocusedIndex,
    handleSelectionChange,
    onKeyDownForIndex,
    setTabRefForIndex,
  };
};
