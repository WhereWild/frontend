import React from 'react';
import { Animated } from 'react-native';
import {
  animateIndicatorPressedProgress,
  animateIndicatorToLayout,
  type TabLayout,
} from './navigationBarHelpers';

/**
 * Returns:
 * - animated motion values (`indicatorX`, `indicatorWidth`)
 * - interpolated background color (`indicatorBackgroundColor`)
 */

type TabWithKey = {
  key: string;
};

type UseNavigationBarIndicatorParams<TTab extends TabWithKey> = {
  tabs: TTab[];
  tabLayouts: Record<string, TabLayout>;
  indicatorTargetIndex: number;
  previewIndex: number | null;
  isResizing: boolean;
  activeColor: string;
  pressedColor: string;
  duration: number;
  easing: (value: number) => number;
};

export type NavigationBarIndicatorModel = {
  /** Animated x translation for the active indicator. */
  indicatorX: Animated.Value;
  /** Animated width for the active indicator. */
  indicatorWidth: Animated.Value;
  /** Interpolated indicator background color from active to pressed. */
  indicatorBackgroundColor: Animated.AnimatedInterpolation<string | number>;
};

/**
 * Owns animated indicator values and transitions:
 * position/width motion plus pressed-progress color interpolation.
 */
export function useNavigationBarIndicator<TTab extends TabWithKey>({
  tabs,
  tabLayouts,
  indicatorTargetIndex,
  previewIndex,
  isResizing,
  activeColor,
  pressedColor,
  duration,
  easing,
}: UseNavigationBarIndicatorParams<TTab>): NavigationBarIndicatorModel {
  const indicatorX = React.useRef(new Animated.Value(0)).current;
  const indicatorWidth = React.useRef(new Animated.Value(0)).current;
  const indicatorPressedProgress = React.useRef(new Animated.Value(0)).current;

  const indicatorBackgroundColor = React.useMemo(
    () => indicatorPressedProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [activeColor, pressedColor],
    }),
    [activeColor, indicatorPressedProgress, pressedColor],
  );

  /** Moves indicator to the latest target tab frame. */
  React.useEffect(() => {
    const targetTabKey = tabs[indicatorTargetIndex]?.key;
    const targetLayout = targetTabKey ? tabLayouts[targetTabKey] : undefined;

    if (!targetLayout) {
      return;
    }

    const animation = animateIndicatorToLayout({
      indicatorX,
      indicatorWidth,
      targetLayout,
      duration,
      easing,
      isResizing,
    });

    return () => {
      animation?.stop();
    };
  }, [
    duration,
    easing,
    indicatorTargetIndex,
    indicatorWidth,
    indicatorX,
    isResizing,
    tabLayouts,
    tabs,
  ]);

  React.useEffect(() => {
    const animation = animateIndicatorPressedProgress({
      indicatorPressedProgress,
      previewIndex,
      duration,
      easing,
    });

    return () => {
      animation?.stop();
    };
  }, [duration, easing, indicatorPressedProgress, previewIndex]);

  return {
    indicatorX,
    indicatorWidth,
    indicatorBackgroundColor,
  };
}
