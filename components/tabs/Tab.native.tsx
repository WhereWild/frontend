import React, { forwardRef } from 'react';
import { Pressable } from 'react-native';
import { getInteractiveCursorStyle } from '@/components/interactiveCursorStyle';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  __TAB_TESTING__,
  TabContent,
  type NativeTabProps,
  getTabState,
  styles,
} from './Tab.shared';

type PressableRef = React.ElementRef<typeof Pressable>;

export const Tab = forwardRef<PressableRef, NativeTabProps>(function Tab(
  {
    id,
    label,
    isActive,
    onPress,
    containerStyle,
    separatorColor,
    separatorHidden,
    disableNativeHoverVisuals = false,
    onFocus,
    onLabelLayout,
    accessibilityLabel,
    testID,
  },
  ref,
) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [isPressed, setIsPressed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const tabState = getTabState(
    mode,
    isActive,
    isPressed,
    disableNativeHoverVisuals ? false : isHovered,
  );

  return (
    <Pressable
      ref={ref}
      collapsable={false}
      accessibilityRole='tab'
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: isActive }}
      onFocus={onFocus}
      testID={testID}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={() => {
        if (!isActive) {
          onPress(id);
        }
      }}
      style={[
        getInteractiveCursorStyle(),
        styles.container,
        containerStyle,
        {
          backgroundColor: tabState.outerBackgroundColor,
          borderColor: tabState.borderColor,
          borderBottomWidth: tabState.borderBottomWidth,
        },
      ]}
    >
      {TabContent({
        label,
        tabState,
        onLabelLayout,
        separatorColor,
        separatorHidden,
      })}
    </Pressable>
  );
});

export type { NativeTabProps as TabProps };
export { __TAB_TESTING__ };
