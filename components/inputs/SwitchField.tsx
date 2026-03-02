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

const TRANSPARENT = 'transparent';

const TRACK_WIDTH = Size.space['400'] + Size.space['600'];
const TRACK_HEIGHT = Size.space['600'];
const THUMB_DIFFERENCE = Size.space['150'];
const THUMB_SLOT_HEIGHT = TRACK_HEIGHT;
// Subtract a single border width to align the circular thumb visually with the
// inner edge of the track. TRACK_HEIGHT already includes both vertical
// borders; since the thumb slot is positioned from one horizontal side,
// compensating for the leading border only is intentional (subtracting two
// borders would make the slot too narrow and misalign the thumb).
const THUMB_SLOT_WIDTH = TRACK_HEIGHT - Size.stroke.border;
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
  const trackBorderColor = disabled || isOn
    ? TRANSPARENT
    : palette.border.neutral.default;
  const thumbColor = disabled
    ? palette.icon.disabled.onDisabled
    : isOn
      ? palette.icon.brand.onBrand
      : palette.icon.neutral.default;

  const visualBorderWidth = disabled || isOn ? 0 : Size.stroke.border;
  const innerTrackHeight = TRACK_HEIGHT - 2 * visualBorderWidth;
  const thumbSize = innerTrackHeight - THUMB_DIFFERENCE;
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

    const borderColor = trackBorderColor;
    const dynamicTrackStyle: ViewStyle = {
      backgroundColor,
      borderColor,
      justifyContent: isOn ? 'flex-end' : 'flex-start',
    };

    return [
      styles.switch,
      dynamicTrackStyle,
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
          <View style={styles.thumbSlot}>
            <View
              style={[
                styles.thumb,
                {
                  width: thumbSize,
                  height: thumbSize,
                  backgroundColor: thumbColor,
                },
              ]}
            />
          </View>
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
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['full'],
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  thumb: {
    borderRadius: Size.radius['full'],
  },
  thumbSlot: {
    width: THUMB_SLOT_WIDTH,
    height: THUMB_SLOT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
