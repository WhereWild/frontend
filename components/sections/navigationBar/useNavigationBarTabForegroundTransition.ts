// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Animated, processColor } from 'react-native';
import { Time, getReactNativeEasing } from '@/constants/theme';

type ForegroundColors = {
  textColor: string;
  iconColor: string;
};

type UseNavigationBarTabForegroundTransitionParams = {
  targetColors: ForegroundColors;
  animationKey: string;
};

const FOREGROUND_FADE_DURATION = Time.duration.medium;

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

const colorToChannels = (color: string) => {
  const processedColor = processColor(color);

  if (typeof processedColor !== 'number') {
    return {
      red: 0,
      green: 0,
      blue: 0,
      alpha: 1,
    };
  }

  const normalizedColor = processedColor >>> 0;

  return {
    alpha: ((normalizedColor >>> 24) & 255) / 255,
    red: (normalizedColor >>> 16) & 255,
    green: (normalizedColor >>> 8) & 255,
    blue: normalizedColor & 255,
  };
};

const mixColor = (fromColor: string, toColor: string, progress: number) => {
  const mix = clampUnit(progress);
  const from = colorToChannels(fromColor);
  const to = colorToChannels(toColor);

  const red = Math.round(from.red + (to.red - from.red) * mix);
  const green = Math.round(from.green + (to.green - from.green) * mix);
  const blue = Math.round(from.blue + (to.blue - from.blue) * mix);
  const alpha = from.alpha + (to.alpha - from.alpha) * mix;

  return `rgba(${red}, ${green}, ${blue}, ${clampUnit(alpha).toFixed(3)})`;
};

export const useNavigationBarTabForegroundTransition = ({
  targetColors,
  animationKey,
}: UseNavigationBarTabForegroundTransitionParams): ForegroundColors => {
  const targetTextColor = targetColors.textColor;
  const targetIconColor = targetColors.iconColor;
  const foregroundProgress = React.useRef(new Animated.Value(1)).current;
  const hasAnimatedForegroundRef = React.useRef(false);
  const animatedForegroundListenerIdRef = React.useRef<string | null>(null);
  const fadeEasing = React.useMemo(
    () => getReactNativeEasing('in-and-out'),
    [],
  );
  const [animatedColors, setAnimatedColors] = React.useState<ForegroundColors>({
    textColor: targetTextColor,
    iconColor: targetIconColor,
  });
  const animatedColorsRef = React.useRef(animatedColors);

  React.useEffect(() => {
    animatedColorsRef.current = animatedColors;
  }, [animatedColors]);

  React.useEffect(() => {
    // Seed the first render with target colors and skip animating from an implicit default.
    if (!hasAnimatedForegroundRef.current) {
      hasAnimatedForegroundRef.current = true;
      setAnimatedColors({
        textColor: targetTextColor,
        iconColor: targetIconColor,
      });
      return;
    }

    const fromColors = animatedColorsRef.current;
    const toTextColor = targetTextColor;
    const toIconColor = targetIconColor;

    if (
      fromColors.textColor === toTextColor &&
      fromColors.iconColor === toIconColor
    ) {
      // Avoid restarting an animation when effective colors are unchanged.
      setAnimatedColors({
        textColor: toTextColor,
        iconColor: toIconColor,
      });
      return;
    }

    foregroundProgress.stopAnimation();
    foregroundProgress.setValue(0);

    animatedForegroundListenerIdRef.current = foregroundProgress.addListener(
      ({ value }) => {
        setAnimatedColors({
          textColor: mixColor(fromColors.textColor, toTextColor, value),
          iconColor: mixColor(fromColors.iconColor, toIconColor, value),
        });
      },
    );

    const animation = Animated.timing(foregroundProgress, {
      toValue: 1,
      duration: FOREGROUND_FADE_DURATION,
      easing: fadeEasing,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (animatedForegroundListenerIdRef.current) {
        foregroundProgress.removeListener(
          animatedForegroundListenerIdRef.current,
        );
        animatedForegroundListenerIdRef.current = null;
      }

      if (finished) {
        setAnimatedColors({
          textColor: toTextColor,
          iconColor: toIconColor,
        });
      }
    });

    return () => {
      // Stop in-flight animation/listeners so interrupted transitions don't leak updates.
      animation.stop();
      if (animatedForegroundListenerIdRef.current) {
        foregroundProgress.removeListener(
          animatedForegroundListenerIdRef.current,
        );
        animatedForegroundListenerIdRef.current = null;
      }
    };
  }, [
    animationKey,
    fadeEasing,
    foregroundProgress,
    targetIconColor,
    targetTextColor,
  ]);

  return animatedColors;
};

export const __NAVIGATION_BAR_TAB_FOREGROUND_TRANSITION_TESTING__ = {
  clampUnit,
  colorToChannels,
  mixColor,
};
