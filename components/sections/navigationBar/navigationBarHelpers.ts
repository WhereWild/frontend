import { Animated } from 'react-native';
import type { NavigationBarTabForegroundTone, NavigationBarTabState } from './NavigationBarTab';

export type TabLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HostLayout = {
  width: number;
  height: number;
};

export type TabWithKey = {
  key: string;
};

/** Returns true when host container width/height changed between layout passes. */
export const hasHostLayoutChanged = (
  previousLayout: HostLayout | null,
  width: number,
  height: number,
) => !previousLayout || previousLayout.width !== width || previousLayout.height !== height;

/** Returns true when width delta exceeds the configured remeasure threshold. */
export const shouldRemeasureWidth = (
  previousWidth: number | null,
  nextWidth: number,
  thresholdPx: number,
) => previousWidth === null || Math.abs(previousWidth - nextWidth) > thresholdPx;

/** Hit-tests tab layouts and returns the tab index at a local x/y point. */
export const findTabIndexAtPoint = <TTab extends TabWithKey>(
  tabs: TTab[],
  tabLayouts: Record<string, TabLayout>,
  x: number,
  y: number,
): number | null => {
  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index];
    const layout = tabLayouts[tab.key];

    if (!layout) {
      continue;
    }

    const withinX = x >= layout.x && x <= layout.x + layout.width;
    const withinY = y >= layout.y && y <= layout.y + layout.height;

    if (withinX && withinY) {
      return index;
    }
  }

  return null;
};

/** True when the indicator is previewing a tab different from the current active tab. */
export const isIndicatorAwayFromActiveTab = (
  activeIndex: number,
  previewIndex: number | null,
) => previewIndex !== null && previewIndex !== activeIndex;

/** Resolves visual state for each tab from active/preview interaction state. */
export const resolveNavigationTabState = (
  index: number,
  activeIndex: number,
  previewIndex: number | null,
): NavigationBarTabState => {
  if (index === activeIndex && isIndicatorAwayFromActiveTab(activeIndex, previewIndex)) {
    return 'default';
  }

  if (index === activeIndex) {
    return 'active';
  }

  if (previewIndex === index) {
    return 'pressed';
  }

  return 'default';
};

/** Resolves tab foreground tone so active tab can stay brand when indicator moves away. */
export const resolveNavigationTabForegroundTone = (
  index: number,
  activeIndex: number,
  previewIndex: number | null,
): NavigationBarTabForegroundTone => {
  if (index === activeIndex && isIndicatorAwayFromActiveTab(activeIndex, previewIndex)) {
    return 'brand';
  }

  return 'default';
};

type IndicatorAnimationParams = {
  indicatorX: Animated.Value;
  indicatorWidth: Animated.Value;
  targetLayout: TabLayout;
  duration: number;
  easing: (value: number) => number;
  isResizing: boolean;
};

/**
 * Moves the active indicator to a tab frame.
 * Uses immediate value updates while resizing; otherwise runs timed animation.
 */
export const animateIndicatorToLayout = ({
  indicatorX,
  indicatorWidth,
  targetLayout,
  duration,
  easing,
  isResizing,
}: IndicatorAnimationParams) => {
  // Resize mode uses immediate updates so the indicator tracks layout frames
  // in real time instead of restarting short animations every resize tick.
  if (isResizing) {
    indicatorX.stopAnimation();
    indicatorWidth.stopAnimation();
    indicatorX.setValue(targetLayout.x);
    indicatorWidth.setValue(targetLayout.width);
    return null;
  }

  const animation = Animated.parallel([
    Animated.timing(indicatorX, {
      toValue: targetLayout.x,
      duration,
      easing,
      useNativeDriver: false,
    }),
    Animated.timing(indicatorWidth, {
      toValue: targetLayout.width,
      duration,
      easing,
      useNativeDriver: false,
    }),
  ]);

  animation.start();
  return animation;
};

type PressedProgressAnimationParams = {
  indicatorPressedProgress: Animated.Value;
  previewIndex: number | null;
  duration: number;
  easing: (value: number) => number;
};

/**
 * Animates normalized pressed progress for indicator color interpolation.
 * `previewIndex === null` maps to active color progress `0`, otherwise pressed `1`.
 */
export const animateIndicatorPressedProgress = ({
  indicatorPressedProgress,
  previewIndex,
  duration,
  easing,
}: PressedProgressAnimationParams) => {
  // Preview state is represented as a single normalized progress value used
  // by color interpolation in the host component.
  const animation = Animated.timing(indicatorPressedProgress, {
    toValue: previewIndex === null ? 0 : 1,
    duration,
    easing,
    useNativeDriver: false,
  });

  animation.start();
  return animation;
};
