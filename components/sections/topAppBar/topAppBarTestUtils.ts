import { Animated } from 'react-native';

export const resolveAnimatedNumeric = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }

  if (
    value &&
    typeof (value as { __getValue?: () => number }).__getValue === 'function'
  ) {
    return (value as { __getValue: () => number }).__getValue();
  }

  return Number.NaN;
};

export const setTimingValue = (
  value: Animated.Value | Animated.ValueXY,
  toValue: unknown,
) => {
  if (value instanceof Animated.Value && typeof toValue === 'number') {
    value.setValue(toValue);
  }
};

export const mockAnimatedTiming = () =>
  jest.spyOn(Animated, 'timing').mockImplementation(
    (value, config) =>
      ({
        start: (callback?: (result: { finished: boolean }) => void) => {
          setTimingValue(value, config.toValue);
          callback?.({ finished: true });
        },
        stop: jest.fn(),
        reset: jest.fn(),
        _startNativeLoop: jest.fn(),
        _isUsingNativeDriver: jest.fn(() => false),
      }) as unknown as Animated.CompositeAnimation,
  );
