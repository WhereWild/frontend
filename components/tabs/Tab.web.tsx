// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { forwardRef } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { getInteractiveCursorStyle } from '@/components/interactiveCursorStyle';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  __TAB_TESTING__,
  TabContent,
  type TabProps,
  getTabState,
  styles,
} from './Tab.shared';

type PressableRef = React.ElementRef<typeof Pressable>;
type PressableWithKeyDownProps = PressableProps & {
  onKeyDown?: (event: {
    nativeEvent?: { key?: string };
    preventDefault?: () => void;
  }) => void;
  tabIndex?: 0 | -1;
};

const PressableWithKeyDown =
  Pressable as unknown as React.ForwardRefExoticComponent<
    PressableWithKeyDownProps & React.RefAttributes<View>
  >;

export const Tab = forwardRef<PressableRef, TabProps>(function Tab(
  {
    id,
    label,
    isActive,
    onPress,
    containerStyle,
    separatorColor,
    separatorHidden,
    onKeyDown,
    onFocus,
    onLabelLayout,
    focusable,
    tabIndex,
    accessibilityLabel,
    testID,
  },
  ref,
) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <PressableWithKeyDown
      ref={ref}
      accessibilityRole='tab'
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: isActive }}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      focusable={focusable}
      tabIndex={tabIndex}
      testID={testID}
      onPress={() => {
        if (!isActive) {
          onPress(id);
        }
      }}
      style={({ pressed, hovered }) => {
        const tabState = getTabState(mode, isActive, pressed, hovered ?? false);
        return [
          getInteractiveCursorStyle(),
          styles.container,
          containerStyle,
          {
            backgroundColor: tabState.outerBackgroundColor,
            borderColor: tabState.borderColor,
            borderBottomWidth: tabState.borderBottomWidth,
          },
        ];
      }}
    >
      {({ pressed, hovered }) => {
        const tabState = getTabState(mode, isActive, pressed, hovered ?? false);
        return TabContent({
          label,
          tabState,
          onLabelLayout,
          separatorColor,
          separatorHidden,
        });
      }}
    </PressableWithKeyDown>
  );
});

export type { TabProps };
export { __TAB_TESTING__ };
