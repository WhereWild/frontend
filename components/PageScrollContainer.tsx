// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Platform, ScrollView, View, type ScrollViewProps } from 'react-native';
import { ScrollLockContext } from '@/context/ScrollLockContext';

type PageScrollContainerProps = Pick<
  ScrollViewProps,
  | 'bounces'
  | 'children'
  | 'contentContainerStyle'
  | 'keyboardShouldPersistTaps'
  | 'style'
  | 'testID'
>;

export function PageScrollContainer({
  children,
  contentContainerStyle,
  style,
  ...scrollViewProps
}: PageScrollContainerProps) {
  const scrollRef = React.useRef<ScrollView>(null);

  const lockScroll = React.useCallback(() => {
    scrollRef.current?.setNativeProps({ scrollEnabled: false });
  }, []);

  const unlockScroll = React.useCallback(() => {
    scrollRef.current?.setNativeProps({ scrollEnabled: true });
  }, []);

  const scrollLock = React.useMemo(
    () => ({ lockScroll, unlockScroll }),
    [lockScroll, unlockScroll],
  );

  if (Platform.OS === 'web') {
    return (
      <View style={style} testID={scrollViewProps.testID}>
        <View style={contentContainerStyle}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollLockContext.Provider value={scrollLock}>
      <ScrollView
        ref={scrollRef}
        style={style}
        contentContainerStyle={contentContainerStyle}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    </ScrollLockContext.Provider>
  );
}
