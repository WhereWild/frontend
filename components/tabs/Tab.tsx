import React, { forwardRef } from 'react';
import { Platform, Pressable } from 'react-native';
import type { TabProps } from './Tab.shared.tsx';
import { __TAB_TESTING__ } from './Tab.shared.tsx';
import { Tab as NativeTab } from './Tab.native.tsx';
import { Tab as WebTab } from './Tab.web.tsx';

type PressableRef = React.ElementRef<typeof Pressable>;

export const Tab = forwardRef<PressableRef, TabProps>(function Tab(props, ref) {
  const { onKeyDown, focusable, tabIndex, ...nativeProps } = props;

  if (Platform.OS === 'web') {
    return <WebTab ref={ref} {...props} />;
  }

  void onKeyDown;
  void focusable;
  void tabIndex;

  return <NativeTab ref={ref} {...nativeProps} />;
});

export type { TabProps };
export { __TAB_TESTING__ };
