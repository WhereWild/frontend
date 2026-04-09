import React from 'react';
import { Platform } from 'react-native';
import {
  TopAppBar as TopAppBarNative,
  type TopAppBarProps,
  type TopAppBarVariant,
} from './TopAppBar.native';

/**
 * Platform guard wrapper for the native top app bar.
 * Throws on web to enforce native-only usage.
 */
export function TopAppBar(props: TopAppBarProps) {
  if (Platform.OS === 'web') {
    throw new Error('TopAppBar is native-only and is not supported on web.');
  }

  return <TopAppBarNative {...props} />;
}

/** Public props and variant types for top app bar consumers. */
export type { TopAppBarProps, TopAppBarVariant };
