// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

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

const STRETCH_DISTANCE_NORMALIZER_PX = 240;
const STRETCH_BASE_SCALE = 1.2;
const STRETCH_SCALE_RANGE = 0.2;
const STRETCH_GROW_RATIO = 0.45;
const STRETCH_SHRINK_RATIO = 0.55;

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
  /** Animated horizontal scale to add subtle stretch while indicator moves. */
  indicatorScaleX: Animated.Value;
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
  const indicatorScaleX = React.useRef(new Animated.Value(1)).current;
  const indicatorPressedProgress = React.useRef(new Animated.Value(0)).current;
  const previousTargetSignatureRef = React.useRef<string | null>(null);
  const previousTargetXRef = React.useRef<number | null>(null);
  // Track tab identity separately from layout signature so we can distinguish
  // "same tab resized" from "user changed target tab".
  const previousTargetTabKeyRef = React.useRef<string | null>(null);
  // Keep explicit animation refs to prevent transient re-renders from canceling
  // in-flight indicator motion/stretch during fast screen transitions.
  const indicatorMovementAnimationRef =
    React.useRef<Animated.CompositeAnimation | null>(null);
  const indicatorStretchAnimationRef =
    React.useRef<Animated.CompositeAnimation | null>(null);

  const indicatorBackgroundColor = React.useMemo(
    () =>
      indicatorPressedProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [activeColor, pressedColor],
      }),
    [activeColor, indicatorPressedProgress, pressedColor],
  );

  const resetIndicatorStretch = React.useCallback(() => {
    indicatorScaleX.stopAnimation();
    indicatorScaleX.setValue(1);
  }, [indicatorScaleX]);

  /** Moves indicator to the latest target tab frame. */
  React.useEffect(() => {
    const targetTabKey = tabs[indicatorTargetIndex]?.key;
    const targetLayout = targetTabKey ? tabLayouts[targetTabKey] : undefined;

    if (!targetLayout) {
      indicatorMovementAnimationRef.current?.stop();
      indicatorStretchAnimationRef.current?.stop();
      indicatorMovementAnimationRef.current = null;
      indicatorStretchAnimationRef.current = null;
      resetIndicatorStretch();
      return;
    }

    const didTargetTabKeyChange =
      previousTargetTabKeyRef.current !== targetTabKey;
    const targetSignature = `${targetTabKey ?? ''}|${targetLayout.x}|${targetLayout.width}`;
    const didTargetChange =
      previousTargetSignatureRef.current !== targetSignature;
    const previousTargetX = previousTargetXRef.current;

    indicatorMovementAnimationRef.current?.stop();

    const animation = animateIndicatorToLayout({
      indicatorX,
      indicatorWidth,
      targetLayout,
      duration,
      easing,
      // Snap only for "same tab while layout is resizing" so the indicator
      // does not chase geometry updates, while real tab changes still animate.
      isResizing: isResizing && !didTargetTabKeyChange,
    });
    indicatorMovementAnimationRef.current = animation;

    previousTargetSignatureRef.current = targetSignature;
    previousTargetXRef.current = targetLayout.x;
    previousTargetTabKeyRef.current = targetTabKey;

    if (didTargetChange && !isResizing) {
      const travelDistance =
        previousTargetX === null
          ? 0
          : Math.abs(targetLayout.x - previousTargetX);
      const didIndicatorMove = travelDistance > 0;
      const normalizedTravel = Math.min(
        1,
        travelDistance / STRETCH_DISTANCE_NORMALIZER_PX,
      );
      const stretchPeak =
        STRETCH_BASE_SCALE + normalizedTravel * STRETCH_SCALE_RANGE;

      if (didIndicatorMove) {
        // Stretch is intentionally tied to user-visible travel changes, not to
        // resize ticks, to avoid jitter when layout is settling.
        indicatorStretchAnimationRef.current?.stop();
        resetIndicatorStretch();
        const stretchAnimation = Animated.sequence([
          Animated.timing(indicatorScaleX, {
            toValue: stretchPeak,
            duration: Math.max(1, Math.floor(duration * STRETCH_GROW_RATIO)),
            easing,
            useNativeDriver: false,
          }),
          Animated.timing(indicatorScaleX, {
            toValue: 1,
            duration: Math.max(1, Math.ceil(duration * STRETCH_SHRINK_RATIO)),
            easing,
            useNativeDriver: false,
          }),
        ]);
        indicatorStretchAnimationRef.current = stretchAnimation;
        stretchAnimation.start();
      }
    }
  }, [
    duration,
    easing,
    indicatorTargetIndex,
    resetIndicatorStretch,
    indicatorScaleX,
    indicatorWidth,
    indicatorX,
    isResizing,
    tabLayouts,
    tabs,
  ]);

  React.useEffect(() => {
    return () => {
      indicatorMovementAnimationRef.current?.stop();
      indicatorStretchAnimationRef.current?.stop();
      indicatorMovementAnimationRef.current = null;
      indicatorStretchAnimationRef.current = null;
      resetIndicatorStretch();
    };
  }, [resetIndicatorStretch]);

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
    indicatorScaleX,
    indicatorBackgroundColor,
  };
}
