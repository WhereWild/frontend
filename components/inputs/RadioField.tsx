import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  type PressableStateCallbackType,
  Pressable,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { Colors, Size, Time, getReactNativeEasing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/text/ThemedText';

const INDICATOR_SIZE = Size.control.dimension.tiny;
const INDICATOR_DOT_SIZE_DIFFERENCE = Size.space['150'];
const INDICATOR_DOT_SIZE = INDICATOR_SIZE - INDICATOR_DOT_SIZE_DIFFERENCE;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

type IndicatorColors = {
  backgroundColor: string;
  borderColor: string;
  fillColor: string;
};

const getIndicatorColors = (
  mode: 'light' | 'dark',
  checked: boolean,
  disabled: boolean,
  hovered: boolean,
  pressed: boolean,
): IndicatorColors => {
  const palette = Colors[mode];

  if (disabled) {
    return {
      backgroundColor: checked
        ? palette.background.disabled.default
        : palette.background.default.secondary,
      borderColor: checked
        ? palette.background.disabled.default
        : palette.border.disabled.default,
      fillColor: palette.icon.disabled.onDisabled,
    };
  }

  if (checked) {
    const selectedBackground = hovered
      ? palette.background.brand.hover
      : palette.background.brand.default;

    return {
      backgroundColor: selectedBackground,
      borderColor: selectedBackground,
      fillColor: palette.icon.brand.onBrand,
    };
  }

  if (pressed) {
    return {
      backgroundColor: palette.background.default.pressed,
      borderColor: palette.border.default.default,
      fillColor: palette.icon.brand.onBrand,
    };
  }

  if (hovered) {
    return {
      backgroundColor: palette.background.default.hover,
      borderColor: palette.border.default.default,
      fillColor: palette.icon.brand.onBrand,
    };
  }

  return {
    backgroundColor: palette.background.default.default,
    borderColor: palette.border.default.default,
    fillColor: palette.icon.brand.onBrand,
  };
};

export type RadioFieldProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  label?: string;
  description?: string;
  onValueChange?: (checked: boolean) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function RadioField({
  checked,
  defaultChecked = false,
  disabled = false,
  label,
  description,
  onValueChange,
  style,
  accessibilityLabel,
  testID,
}: RadioFieldProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const [isHovered, setIsHovered] = useState(false);
  const isControlled = typeof checked === 'boolean';
  const isChecked = isControlled ? checked : internalChecked;
  const indicatorOpacityRef = useRef<Animated.Value | null>(null);
  const dotOpacityRef = useRef<Animated.Value | null>(null);

  if (indicatorOpacityRef.current === null) {
    indicatorOpacityRef.current = new Animated.Value(1);
  }

  if (dotOpacityRef.current === null) {
    dotOpacityRef.current = new Animated.Value(0);
  }

  const indicatorOpacity = indicatorOpacityRef.current;
  const dotOpacity = dotOpacityRef.current;

  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const labelColor = disabled ? palette.text.disabled.default : palette.text.default.default;
  const descriptionColor = disabled
    ? palette.text.disabled.default
    : palette.text.default.secondary;

  const onSelect = useCallback(() => {
    if (disabled || isChecked) {
      return;
    }

    if (!isControlled) {
      setInternalChecked(true);
    }

    onValueChange?.(true);
  }, [disabled, isChecked, isControlled, onValueChange]);

  useEffect(() => {
    if (disabled) {
      indicatorOpacity.setValue(1);
      return;
    }

    Animated.timing(indicatorOpacity, {
      toValue: isHovered ? 0.92 : 1,
      duration: Time.duration.short,
      easing: getReactNativeEasing('in-and-out'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [disabled, indicatorOpacity, isHovered]);

  useEffect(() => {
    Animated.timing(dotOpacity, {
      toValue: isChecked ? 1 : 0,
      duration: Time.duration.short,
      easing: getReactNativeEasing('in-and-out'),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [dotOpacity, isChecked]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel={accessibilityLabel ?? label ?? 'Radio field'}
          accessibilityState={{ selected: isChecked, disabled }}
          disabled={disabled}
          onHoverIn={() => setIsHovered(true)}
          onHoverOut={() => setIsHovered(false)}
          onPress={onSelect}
          testID={testID}
        >
          {({ hovered, pressed }: PressableStateCallbackType) => {
            const indicatorColors = getIndicatorColors(
              mode,
              isChecked,
              disabled,
              hovered ?? false,
              pressed,
            );

            return (
              <Animated.View
                style={[
                  styles.indicator,
                  {
                    opacity: indicatorOpacity,
                    backgroundColor: indicatorColors.backgroundColor,
                    borderColor: indicatorColors.borderColor,
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.indicatorDot,
                    {
                      opacity: dotOpacity,
                      backgroundColor: indicatorColors.fillColor,
                    },
                  ]}
                />
              </Animated.View>
            );
          }}
        </Pressable>
        {label ? (
          <ThemedText variant="body" style={[styles.label, { color: labelColor }]}>
            {label}
          </ThemedText>
        ) : null}
      </View>
      {description ? (
        <View style={styles.descriptionRow}>
          <View style={styles.spacer} />
          <ThemedText variant="body" style={[styles.label, { color: descriptionColor }]}>
            {description}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 340,
    gap: Size.space['100'],
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['300'],
  },
  descriptionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['300'],
  },
  spacer: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
  },
  label: {
    flex: 1,
  },
  indicator: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['full'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorDot: {
    width: INDICATOR_DOT_SIZE,
    height: INDICATOR_DOT_SIZE,
    borderRadius: Size.radius['full'],
  },
});
