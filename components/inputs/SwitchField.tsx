import React, { useCallback, useState } from 'react';
import {
  type PressableStateCallbackType,
  Pressable,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/text/ThemedText';

const TRACK_WIDTH = Size.space['400'] + Size.space['600'];
const TRACK_HEIGHT = Size.space['600'];

export type SwitchFieldProps = {
  value?: boolean;
  defaultValue?: boolean;
  disabled?: boolean;
  label?: string;
  description?: string;
  onValueChange?: (value: boolean) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function SwitchField({
  value,
  defaultValue = false,
  disabled = false,
  label,
  description,
  onValueChange,
  style,
  accessibilityLabel,
}: SwitchFieldProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = typeof value === 'boolean';
  const isOn = isControlled ? value : internalValue;

  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const labelColor = disabled ? palette.text.disabled.default : palette.text.default.default;
  const descriptionColor = disabled ? palette.text.disabled.default : palette.text.default.secondary;

  const trackBackgroundColorDefault = disabled
    ? palette.background.disabled.default
    : isOn
      ? palette.background.brand.default
      : palette.background.default.secondary;
  const trackBackgroundColorHover = disabled
    ? palette.background.disabled.default
    : isOn
      ? palette.background.brand.hover
      : palette.background.default.secondaryHover;
  const trackBackgroundColorPressed = disabled
    ? palette.background.disabled.default
    : isOn
      ? palette.background.brand.pressed
      : palette.background.default.secondaryPressed;
  const trackBorderColor = disabled
    ? palette.border.disabled.default
    : isOn
      ? palette.background.brand.default
      : palette.border.neutral.default;
  const thumbColor = disabled
    ? palette.icon.disabled.onDisabled
    : isOn
      ? palette.icon.brand.onBrand
      : palette.icon.neutral.default;

  const trackBorderWidth = disabled || isOn
    ? 0
    : Size.stroke.border;

  const trackInnerHeight = TRACK_HEIGHT - (trackBorderWidth * 2);
  const thumbSize = trackInnerHeight - Size.space['150'];  // to match Figma design
  const trackPadding = Math.max(0, (trackInnerHeight - thumbSize) / 2);

  const thumbLeft = isOn
    ? TRACK_WIDTH - trackPadding - thumbSize
    : trackPadding;

  const onToggle = useCallback(() => {
    if (disabled) {
      return;
    }
    const nextValue = !isOn;
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  }, [disabled, isControlled, isOn, onValueChange]);

  const pressableStyle = ({ hovered, pressed }: PressableStateCallbackType) => {
    const backgroundColor = pressed
      ? trackBackgroundColorPressed
      : hovered
        ? trackBackgroundColorHover
        : trackBackgroundColorDefault;

    return [
      styles.switch,
      {
        backgroundColor,
        borderColor: trackBorderColor,
        borderWidth: trackBorderWidth,
      },
    ];
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {label ? (
          <ThemedText variant="body" style={[styles.label, { color: labelColor }]}>
            {label}
          </ThemedText>
        ) : null}
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={accessibilityLabel ?? label ?? 'Switch field'}
          accessibilityState={{ checked: isOn, disabled }}
          disabled={disabled}
          onPress={onToggle}
          style={pressableStyle}
        >
          <View
            style={[
              styles.thumb,
              {
                top: trackPadding,
                left: thumbLeft,
                width: thumbSize,
                height: thumbSize,
                backgroundColor: thumbColor,
              },
            ]}
          />
        </Pressable>
      </View>
      {description ? (
        <ThemedText variant="body" style={{ color: descriptionColor }}>
          {description}
        </ThemedText>
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
  label: {
    flex: 1,
  },
  switch: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: Size.radius['full'],
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    borderRadius: Size.radius['full'],
  },
});
