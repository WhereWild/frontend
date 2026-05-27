import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { IconMinus, IconPlus } from '@/assets/icons';
import { IconButton } from '@/components/buttons/IconButton';
import {
  Colors,
  Size,
  Time,
  Typography,
  getReactNativeEasing,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/text/ThemedText';
import { triggerBoundHaptic, triggerSelectionHaptic } from '@/utils/haptics';

type NumberSpinnerValueChangeContext = 'increment' | 'decrement' | 'input';

const USE_NATIVE_DRIVER =
  Platform.OS !== 'web' && !!NativeModules.NativeAnimatedModule;
const HOLD_REPEAT_INTERVAL_MS = 100;
const HOLD_REPEAT_DELAY_MS = 250;

export type NumberSpinnerProps = {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places to display and accept. When set, enables float input/output. */
  precision?: number;
  disabled?: boolean;
  label?: string;
  description?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  decrementAccessibilityLabel?: string;
  incrementAccessibilityLabel?: string;
  onValueChange?: (
    value: number,
    context: NumberSpinnerValueChangeContext,
  ) => void;
};

const clampValue = (value: number, min?: number, max?: number) => {
  let nextValue = value;

  if (typeof min === 'number') {
    nextValue = Math.max(min, nextValue);
  }

  if (typeof max === 'number') {
    nextValue = Math.min(max, nextValue);
  }

  return nextValue;
};

const normalizeNumericInput = (
  rawInput: string,
  allowNegative: boolean,
  allowDecimal: boolean,
) => {
  const trimmed = rawInput.trim();

  if (!allowNegative && !allowDecimal) {
    return trimmed.replace(/\D+/g, '');
  }

  const isNegative = allowNegative && trimmed.startsWith('-');
  const unsigned = trimmed.replace(/^-/, '');

  if (allowDecimal) {
    // Keep digits and at most one decimal point
    const dotIndex = unsigned.indexOf('.');
    let normalized: string;
    if (dotIndex === -1) {
      normalized = unsigned.replace(/\D+/g, '');
    } else {
      const intPart = unsigned.slice(0, dotIndex).replace(/\D+/g, '');
      const fracPart = unsigned.slice(dotIndex + 1).replace(/\D+/g, '');
      normalized = `${intPart}.${fracPart}`;
    }
    return isNegative ? `-${normalized}` : normalized;
  }

  const digits = unsigned.replace(/\D+/g, '');
  if (digits.length === 0) {
    return isNegative ? '-' : '';
  }
  return isNegative ? `-${digits}` : digits;
};

const parseNormalizedValue = (valueText: string, decimal: boolean) => {
  const parsed = decimal
    ? Number.parseFloat(valueText)
    : Number.parseInt(valueText, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export function NumberSpinner({
  value,
  defaultValue = 1,
  min,
  max,
  step = 1,
  precision,
  disabled = false,
  label,
  description,
  style,
  accessibilityLabel,
  decrementAccessibilityLabel = 'Decrease value',
  incrementAccessibilityLabel = 'Increase value',
  onValueChange,
}: NumberSpinnerProps) {
  const isDecimal = typeof precision === 'number' && precision > 0;
  const inputRef = useRef<TextInput>(null);
  const [internalValue, setInternalValue] = useState(
    clampValue(defaultValue, min, max),
  );
  const formatValue = (v: number) =>
    isDecimal ? v.toFixed(precision) : String(v);
  const [draftValue, setDraftValue] = useState(
    formatValue(clampValue(defaultValue, min, max)),
  );
  const [isFocused, setIsFocused] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const hoverOverlayOpacityRef = useRef<Animated.Value>(new Animated.Value(0));
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentValueRef = useRef<number>(0);
  const suppressTapIncrementRef = useRef(false);
  const suppressTapDecrementRef = useRef(false);
  const hoverOverlayOpacity = hoverOverlayOpacityRef.current;
  const isControlled = typeof value === 'number';
  const currentValue = clampValue(
    isControlled ? value : internalValue,
    min,
    max,
  );
  currentValueRef.current = currentValue;

  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const allowNegativeInput = typeof min === 'number' && min < 0;

  const isAtMin = typeof min === 'number' && currentValue <= min;
  const isAtMax = typeof max === 'number' && currentValue >= max;
  const decrementDisabled = disabled || isAtMin;
  const incrementDisabled = disabled || isAtMax;

  const labelColor = disabled
    ? palette.text.disabled.default
    : palette.text.default.default;
  const descriptionColor = disabled
    ? palette.text.disabled.default
    : palette.text.default.secondary;
  const pillBackground = disabled
    ? palette.background.disabled.default
    : isPressing
      ? palette.background.default.secondaryPressed
      : palette.background.default.secondary;
  const webOutlineStyle =
    Platform.OS === 'web'
      ? ({ outlineStyle: isFocused ? 'auto' : 'none' } as unknown as ViewStyle)
      : null;
  const valueColor = disabled
    ? palette.text.disabled.onDisabled
    : palette.text.default.default;

  useEffect(() => {
    if (!disabled) {
      return;
    }

    setIsFocused(false);
    setIsEditing(false);
    setIsHovered(false);
    setIsPressing(false);
  }, [disabled]);

  useEffect(() => {
    if (disabled) {
      hoverOverlayOpacity.setValue(0);
      return;
    }

    if (isPressing) {
      hoverOverlayOpacity.setValue(0);
      return;
    }

    Animated.timing(hoverOverlayOpacity, {
      toValue: isHovered ? 1 : 0,
      duration: Time.duration.short,
      easing: getReactNativeEasing('in-and-out'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [disabled, hoverOverlayOpacity, isHovered, isPressing]);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setDraftValue(formatValue(currentValue));
  }, [currentValue, isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const roundToPrecision = (v: number) =>
    isDecimal
      ? Math.round(v * Math.pow(10, precision!)) / Math.pow(10, precision!)
      : v;

  const commitValue = (
    nextValue: number,
    context: NumberSpinnerValueChangeContext,
  ) => {
    const clamped = roundToPrecision(clampValue(nextValue, min, max));
    const current = currentValueRef.current;
    const isStepChange = context === 'increment' || context === 'decrement';
    const hitBoundary =
      isStepChange &&
      ((typeof min === 'number' && clamped === min) ||
        (typeof max === 'number' && clamped === max));

    if (!isControlled) {
      setInternalValue(clamped);
      currentValueRef.current = clamped;
    }

    if (clamped !== current) {
      if (hitBoundary) {
        triggerBoundHaptic();
      } else if (isStepChange) {
        triggerSelectionHaptic();
      }

      onValueChange?.(clamped, context);
    }
  };

  const stopHold = () => {
    if (holdIntervalRef.current != null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const startHold = (direction: 'increment' | 'decrement') => {
    if (disabled) {
      return;
    }

    stopHold();

    const current = currentValueRef.current;
    const firstValue =
      direction === 'increment' ? current + step : current - step;
    commitValue(firstValue, direction);

    holdIntervalRef.current = setInterval(() => {
      const nextCurrent = currentValueRef.current;

      if (
        (direction === 'increment' &&
          typeof max === 'number' &&
          nextCurrent >= max) ||
        (direction === 'decrement' &&
          typeof min === 'number' &&
          nextCurrent <= min)
      ) {
        stopHold();
        return;
      }

      const nextValue =
        direction === 'increment' ? nextCurrent + step : nextCurrent - step;
      commitValue(nextValue, direction);
    }, HOLD_REPEAT_INTERVAL_MS);
  };

  const normalizeAndCommitInput = (rawInput: string) => {
    const normalized = normalizeNumericInput(
      rawInput,
      allowNegativeInput,
      isDecimal,
    );

    if (normalized.length === 0 || normalized === '-' || normalized === '.') {
      setDraftValue(normalized);
      return;
    }

    const parsed = parseNormalizedValue(normalized, isDecimal);
    if (parsed == null) {
      return;
    }

    const clamped = roundToPrecision(clampValue(parsed, min, max));
    setDraftValue(isDecimal ? normalized : String(clamped));
    commitValue(clamped, 'input');
  };

  const finalizeInputValue = () => {
    const parsed = parseNormalizedValue(draftValue, isDecimal);
    if (parsed == null) {
      setDraftValue(formatValue(currentValue));
      return;
    }

    const clamped = roundToPrecision(clampValue(parsed, min, max));
    setDraftValue(formatValue(clamped));
    commitValue(clamped, 'input');
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current != null) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
      }
    };
  }, []);

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <ThemedText variant='body' style={{ color: labelColor }}>
          {label}
        </ThemedText>
      ) : null}

      {description ? (
        <ThemedText variant='body' style={{ color: descriptionColor }}>
          {description}
        </ThemedText>
      ) : null}

      <Pressable
        style={[
          styles.pill,
          {
            backgroundColor: pillBackground,
          },
          webOutlineStyle,
        ]}
        onPress={() => {
          if (disabled) {
            return;
          }

          inputRef.current?.focus();
        }}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        onPressIn={() => setIsPressing(true)}
        onPressOut={() => setIsPressing(false)}
        disabled={disabled}
        accessible={false}
        focusable={false}
        {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : {})}
        accessibilityRole='adjustable'
        accessibilityLabel={accessibilityLabel ?? label ?? 'Number spinner'}
        accessibilityValue={{
          now: currentValue,
          min,
          max,
        }}
      >
        <Animated.View
          style={[
            styles.noPointerEvents,
            styles.hoverOverlay,
            {
              opacity: hoverOverlayOpacity,
              backgroundColor: palette.background.default.secondaryHover,
            },
          ]}
        />

        <View style={styles.contentRow}>
          <IconButton
            variant='subtle'
            size='small'
            icon={<IconMinus size='16' />}
            accessibilityLabel={decrementAccessibilityLabel}
            disabled={decrementDisabled}
            onLongPress={() => {
              suppressTapDecrementRef.current = true;
              startHold('decrement');
            }}
            onPressOut={stopHold}
            delayLongPress={HOLD_REPEAT_DELAY_MS}
            onPress={() => {
              if (suppressTapDecrementRef.current) {
                suppressTapDecrementRef.current = false;
                return;
              }

              commitValue(currentValue - step, 'decrement');
            }}
          />

          <TextInput
            ref={inputRef}
            value={draftValue}
            editable={!disabled}
            focusable={!disabled}
            {...(Platform.OS === 'web'
              ? ({ tabIndex: disabled ? -1 : 0 } as any)
              : {})}
            inputMode='numeric'
            keyboardType={
              allowNegativeInput ? 'numbers-and-punctuation' : 'number-pad'
            }
            selectTextOnFocus
            onChangeText={normalizeAndCommitInput}
            onFocus={() => {
              setIsFocused(true);
              setIsEditing(true);
            }}
            onBlur={() => {
              setIsFocused(false);
              setIsEditing(false);
              finalizeInputValue();
            }}
            onSubmitEditing={finalizeInputValue}
            style={[
              styles.valueInput,
              Typography[mode].singleLineBody,
              {
                color: valueColor,
              },
            ]}
            accessibilityLabel='Spinner value'
          />

          <IconButton
            variant='subtle'
            size='small'
            icon={<IconPlus size='16' />}
            accessibilityLabel={incrementAccessibilityLabel}
            disabled={incrementDisabled}
            onLongPress={() => {
              suppressTapIncrementRef.current = true;
              startHold('increment');
            }}
            onPressOut={stopHold}
            delayLongPress={HOLD_REPEAT_DELAY_MS}
            onPress={() => {
              if (suppressTapIncrementRef.current) {
                suppressTapIncrementRef.current = false;
                return;
              }

              commitValue(currentValue + step, 'increment');
            }}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Size.space['100'],
    minWidth: 240,
    maxWidth: '100%',
  },
  pill: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    height: Size.control.height.medium,
    borderRadius: Size.radius.full,
    padding: Size.space['100'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['100'],
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  noPointerEvents: {
    pointerEvents: 'none',
  },
  contentRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['100'],
    zIndex: 1,
  },
  valueInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0 } as any)
      : {}),
  },
});
