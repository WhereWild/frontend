import React from 'react';
import { Animated } from 'react-native';

/**
 * Lazily creates a stable `Animated.Value` ref that persists for the
 * component lifetime and avoids re-instantiation across renders.
 *
 * Note: `initialValue` is only applied on first mount. Subsequent updates
 * should use `.setValue(...)` on the returned ref.
 */
export const useAnimatedValueRef = (initialValue: number) => {
  const ref = React.useRef<Animated.Value | null>(null);

  if (!ref.current) {
    ref.current = new Animated.Value(initialValue);
  }

  return ref as React.MutableRefObject<Animated.Value>;
};
