import React from 'react';
import { Animated, PanResponder } from 'react-native';
import { Colors, Size, Time, getReactNativeEasing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

const TRANSPARENT = 'transparent';
const TOGGLE_ANIMATION_USE_NATIVE_DRIVER = false;
const HOVER_ANIMATION_USE_NATIVE_DRIVER = false;

export const SWITCH_FIELD_GEOMETRY = {
  trackWidth: Size.space['400'] + Size.space['600'],
  trackHeight: Size.space['600'],
  trackBorderWidth: Size.stroke.border,
  thumbDifference: Size.space['150'],
  dragActivationDistance: Size.space['100'],
} as const;

const SWITCH_THUMB_SLOT_WIDTH = SWITCH_FIELD_GEOMETRY.trackHeight;
const SWITCH_THUMB_TRAVEL_DISTANCE = SWITCH_FIELD_GEOMETRY.trackWidth - SWITCH_THUMB_SLOT_WIDTH;
const SWITCH_OFF_THUMB_SIZE_WITH_VISIBLE_BORDER = SWITCH_FIELD_GEOMETRY.trackHeight
  - (2 * SWITCH_FIELD_GEOMETRY.trackBorderWidth)
  - SWITCH_FIELD_GEOMETRY.thumbDifference;
const SWITCH_ON_THUMB_SIZE = SWITCH_FIELD_GEOMETRY.trackHeight - SWITCH_FIELD_GEOMETRY.thumbDifference;

const interpolateToggleColor = (progress: Animated.Value, offColor: string, onColor: string) => {
  return progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offColor, onColor],
  });
};

const interpolateToggleNumber = (progress: Animated.Value, offValue: number, onValue: number) => {
  return progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offValue, onValue],
  });
};

type UseSwitchFieldControllerParams = {
  value?: boolean;
  defaultValue?: boolean;
  disabled?: boolean;
  onValueChange?: (value: boolean) => void;
};

export function useSwitchFieldController({
  value,
  defaultValue = false,
  disabled = false,
  onValueChange,
}: UseSwitchFieldControllerParams) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressing, setIsPressing] = React.useState(false);
  const isControlled = typeof value === 'boolean';
  const isOn = isControlled ? value : internalValue;
  const toggleProgressRef = React.useRef<Animated.Value | null>(null);
  const hoverProgressRef = React.useRef<Animated.Value | null>(null);
  const dragStartProgressRef = React.useRef(isOn ? 1 : 0);
  const isDraggingRef = React.useRef(false);
  const didDragRef = React.useRef(false);

  if (toggleProgressRef.current === null) {
    toggleProgressRef.current = new Animated.Value(isOn ? 1 : 0);
  }

  if (hoverProgressRef.current === null) {
    hoverProgressRef.current = new Animated.Value(0);
  }

  const toggleProgress = toggleProgressRef.current;
  const hoverProgress = hoverProgressRef.current;

  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const labelColor = disabled ? palette.text.disabled.default : palette.text.default.default;
  const descriptionColor = disabled ? palette.text.disabled.default : palette.text.default.secondary;

  const trackBackgroundColorOffDefault = disabled
    ? palette.background.disabled.default
    : palette.background.default.secondary;
  const trackBackgroundColorOnDefault = disabled
    ? palette.background.disabled.default
    : palette.background.brand.default;
  const trackBackgroundColorOffHover = disabled
    ? palette.background.disabled.default
    : palette.background.default.secondaryHover;
  const trackBackgroundColorOnHover = disabled
    ? palette.background.disabled.default
    : palette.background.brand.hover;
  const trackBackgroundColorOffPressed = disabled
    ? palette.background.disabled.default
    : palette.background.default.secondaryPressed;
  const trackBackgroundColorOnPressed = disabled
    ? palette.background.disabled.default
    : palette.background.brand.pressed;
  const trackBorderColorOffDefault = disabled
    ? TRANSPARENT
    : palette.border.neutral.default;
  const trackBorderColorOnDefault = disabled
    ? TRANSPARENT
    : palette.background.brand.default;
  const trackBorderColorOffHover = disabled
    ? TRANSPARENT
    : palette.border.neutral.default;
  const trackBorderColorOnHover = disabled
    ? TRANSPARENT
    : palette.background.brand.hover;
  const trackBorderColorOffPressed = disabled
    ? TRANSPARENT
    : palette.border.neutral.default;
  const trackBorderColorOnPressed = disabled
    ? TRANSPARENT
    : palette.background.brand.pressed;
  const thumbColorOff = disabled
    ? palette.icon.disabled.onDisabled
    : palette.icon.neutral.default;
  const thumbColorOn = disabled
    ? palette.icon.disabled.onDisabled
    : palette.icon.brand.onBrand;
  const offThumbSize = disabled
    ? SWITCH_ON_THUMB_SIZE
    : SWITCH_OFF_THUMB_SIZE_WITH_VISIBLE_BORDER;

  const animateToggleTo = React.useCallback((nextValue: boolean) => {
    Animated.timing(toggleProgress, {
      toValue: nextValue ? 1 : 0,
      duration: Time.duration.medium,
      easing: getReactNativeEasing('in-and-out'),
      useNativeDriver: TOGGLE_ANIMATION_USE_NATIVE_DRIVER,
    }).start();
  }, [toggleProgress]);

  React.useEffect(() => {
    if (isDraggingRef.current) {
      return;
    }

    animateToggleTo(isOn);
  }, [animateToggleTo, isOn]);

  React.useEffect(() => {
    if (!disabled) {
      return;
    }

    setIsHovered(false);
    setIsPressing(false);
  }, [disabled]);

  React.useEffect(() => {
    if (disabled || isPressing) {
      hoverProgress.setValue(0);
      return;
    }

    // Hover is rendered as its own overlay so both enter and exit share one
    // symmetric opacity animation instead of mixing snapped base colors with fades.
    Animated.timing(hoverProgress, {
      toValue: isHovered ? 1 : 0,
      duration: Time.duration.short,
      easing: getReactNativeEasing('in-and-out'),
      useNativeDriver: HOVER_ANIMATION_USE_NATIVE_DRIVER,
    }).start();
  }, [disabled, hoverProgress, isHovered, isPressing]);

  const commitValueChange = React.useCallback((nextValue: boolean) => {
    if (disabled) {
      return;
    }

    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  }, [disabled, isControlled, onValueChange]);

  const handleToggle = React.useCallback(() => {
    commitValueChange(!isOn);
  }, [commitValueChange, isOn]);

  const finalizeDrag = React.useCallback((dragTranslate: number) => {
    const nextProgress = Math.min(1, Math.max(0, dragTranslate / SWITCH_THUMB_TRAVEL_DISTANCE));
    const nextValue = nextProgress >= 0.5;
    const committedVisualValue = isControlled ? isOn : nextValue;

    isDraggingRef.current = false;
    setIsPressing(false);
    didDragRef.current = true;
    animateToggleTo(committedVisualValue);

    if (nextValue !== isOn) {
      commitValueChange(nextValue);
    }
  }, [animateToggleTo, commitValueChange, isControlled, isOn]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gestureState) => {
      if (disabled) {
        return false;
      }

      return Math.abs(gestureState.dx) >= SWITCH_FIELD_GEOMETRY.dragActivationDistance
        && Math.abs(gestureState.dx) >= Math.abs(gestureState.dy);
    },
    onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
      if (disabled) {
        return false;
      }

      return Math.abs(gestureState.dx) >= SWITCH_FIELD_GEOMETRY.dragActivationDistance
        && Math.abs(gestureState.dx) >= Math.abs(gestureState.dy);
    },
    onPanResponderGrant: () => {
      // Drag lives on the host view instead of the Pressable so horizontal
      // motion can take over without fighting click and accessibility semantics.
      isDraggingRef.current = true;
      setIsPressing(true);
      toggleProgress.stopAnimation((currentValue) => {
        dragStartProgressRef.current = currentValue;
        toggleProgress.setValue(currentValue);
      });
    },
    onPanResponderMove: (_event, gestureState) => {
      if (!isDraggingRef.current) {
        return;
      }

      const nextProgress = Math.min(
        1,
        Math.max(0, dragStartProgressRef.current + (gestureState.dx / SWITCH_THUMB_TRAVEL_DISTANCE)),
      );

      toggleProgress.setValue(nextProgress);
    },
    onPanResponderRelease: (_event, gestureState) => {
      if (!isDraggingRef.current) {
        return;
      }

      const dragTranslate = Math.min(
        SWITCH_THUMB_TRAVEL_DISTANCE,
        Math.max(0, (dragStartProgressRef.current * SWITCH_THUMB_TRAVEL_DISTANCE) + gestureState.dx),
      );

      finalizeDrag(dragTranslate);
    },
    onPanResponderTerminate: () => {
      if (!isDraggingRef.current) {
        return;
      }

      isDraggingRef.current = false;
      setIsPressing(false);
      animateToggleTo(isOn);
    },
    onPanResponderTerminationRequest: () => true,
  }), [animateToggleTo, disabled, finalizeDrag, isOn, toggleProgress]);

  const handlePress = React.useCallback(() => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    handleToggle();
  }, [handleToggle]);

  // The border is a visual overlay, so the thumb should align to the full pill
  // bounds rather than compensating for the border width in layout math.
  const thumbTranslate = interpolateToggleNumber(toggleProgress, 0, SWITCH_THUMB_TRAVEL_DISTANCE);

  return {
    isOn,
    labelColor,
    descriptionColor,
    hoverProgress,
    panHandlers: panResponder.panHandlers,
    onHoverIn: () => setIsHovered(true),
    onHoverOut: () => setIsHovered(false),
    onPress: handlePress,
    onPressIn: () => {
      didDragRef.current = false;
      setIsPressing(true);
    },
    onPressOut: () => setIsPressing(false),
    trackBackgroundColor: isPressing
      ? interpolateToggleColor(toggleProgress, trackBackgroundColorOffPressed, trackBackgroundColorOnPressed)
      : interpolateToggleColor(toggleProgress, trackBackgroundColorOffDefault, trackBackgroundColorOnDefault),
    trackBorderColor: isPressing
      ? interpolateToggleColor(toggleProgress, trackBorderColorOffPressed, trackBorderColorOnPressed)
      : interpolateToggleColor(toggleProgress, trackBorderColorOffDefault, trackBorderColorOnDefault),
    hoverFillColor: interpolateToggleColor(toggleProgress, trackBackgroundColorOffHover, trackBackgroundColorOnHover),
    hoverBorderColor: interpolateToggleColor(toggleProgress, trackBorderColorOffHover, trackBorderColorOnHover),
    thumbAnimatedColor: interpolateToggleColor(toggleProgress, thumbColorOff, thumbColorOn),
    // Disabled-off hides the border, so the thumb should size against the full
    // fill area instead of pretending there is still an inset border to clear.
    thumbAnimatedSize: interpolateToggleNumber(toggleProgress, offThumbSize, SWITCH_ON_THUMB_SIZE),
    thumbTranslate,
  };
}