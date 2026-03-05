import React from 'react';
import { Platform } from 'react-native';
import TopAppBarDevScreenNative from './top-app-bar.native';

export default function TopAppBarDevScreen() {
  if (Platform.OS === 'web') {
    throw new Error('The /dev/top-app-bar route is native-only and is not supported on web.');
  }

  return <TopAppBarDevScreenNative />;
}
