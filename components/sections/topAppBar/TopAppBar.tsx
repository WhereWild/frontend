import React from 'react';
import { Platform } from 'react-native';
import {
	TopAppBar as TopAppBarNative,
	type TopAppBarProps,
	type TopAppBarVariant,
} from './TopAppBar.native';

export function TopAppBar(props: TopAppBarProps) {
	if (Platform.OS === 'web') {
		throw new Error('TopAppBar is native-only and is not supported on web.');
	}

	return <TopAppBarNative {...props} />;
}

export type { TopAppBarProps, TopAppBarVariant };
