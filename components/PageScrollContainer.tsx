// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Platform, ScrollView, View, type ScrollViewProps } from 'react-native';

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
  if (Platform.OS === 'web') {
    return (
      <View style={style} testID={scrollViewProps.testID}>
        <View style={contentContainerStyle}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  );
}
