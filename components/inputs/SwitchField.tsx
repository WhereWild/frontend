import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { getInteractiveCursorStyle } from '@/components/interactiveCursorStyle';
import { Size } from '@/constants/theme';
import { ThemedText } from '@/components/text/ThemedText';
import {
  SWITCH_FIELD_GEOMETRY,
  useSwitchFieldController,
} from './useSwitchFieldController';

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
  const {
    isOn,
    labelColor,
    descriptionColor,
    hoverProgress,
    panHandlers,
    onHoverIn,
    onHoverOut,
    onPress,
    onPressIn,
    onPressOut,
    trackBackgroundColor,
    trackBorderColor,
    hoverFillColor,
    hoverBorderColor,
    thumbAnimatedColor,
    thumbAnimatedSize,
    thumbTranslate,
  } = useSwitchFieldController({
    value,
    defaultValue,
    disabled,
    onValueChange,
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {label ? (
          <ThemedText
            variant='body'
            style={[styles.label, { color: labelColor }]}
          >
            {label}
          </ThemedText>
        ) : null}
        <View style={styles.switch} {...panHandlers}>
          <Animated.View
            testID='switch-track'
            style={[
              styles.trackFill,
              {
                pointerEvents: 'none',
                backgroundColor: trackBackgroundColor,
              },
            ]}
          />
          <Animated.View
            testID='switch-border'
            style={[
              styles.trackBorder,
              {
                pointerEvents: 'none',
                borderColor: trackBorderColor,
              },
            ]}
          />
          <Animated.View
            testID='switch-hover-fill'
            style={[
              styles.hoverOverlay,
              {
                pointerEvents: 'none',
                backgroundColor: hoverFillColor,
                opacity: hoverProgress,
              },
            ]}
          />
          <Animated.View
            testID='switch-hover-border'
            style={[
              styles.hoverBorder,
              {
                pointerEvents: 'none',
                borderColor: hoverBorderColor,
                opacity: hoverProgress,
              },
            ]}
          />
          <Pressable
            accessibilityRole='switch'
            accessibilityLabel={accessibilityLabel ?? label ?? 'Switch field'}
            accessibilityState={{ checked: isOn, disabled }}
            disabled={disabled}
            onHoverIn={onHoverIn}
            onHoverOut={onHoverOut}
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={[
              styles.switchInteraction,
              getInteractiveCursorStyle(disabled),
            ]}
          >
            <Animated.View
              style={[
                styles.thumbSlot,
                {
                  transform: [{ translateX: thumbTranslate }],
                },
              ]}
            >
              <Animated.View
                testID='switch-thumb'
                style={[
                  styles.thumb,
                  {
                    width: thumbAnimatedSize,
                    height: thumbAnimatedSize,
                    backgroundColor: thumbAnimatedColor,
                  },
                ]}
              />
            </Animated.View>
          </Pressable>
        </View>
      </View>
      {description ? (
        <ThemedText variant='body' style={{ color: descriptionColor }}>
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
    width: SWITCH_FIELD_GEOMETRY.trackWidth,
    height: SWITCH_FIELD_GEOMETRY.trackHeight,
    borderRadius: Size.radius['full'],
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  trackFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Size.radius['full'],
  },
  trackBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: SWITCH_FIELD_GEOMETRY.trackBorderWidth,
    borderRadius: Size.radius['full'],
  },
  switchInteraction: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hoverOverlay: {
    position: 'absolute',
    top: SWITCH_FIELD_GEOMETRY.trackBorderWidth,
    right: SWITCH_FIELD_GEOMETRY.trackBorderWidth,
    bottom: SWITCH_FIELD_GEOMETRY.trackBorderWidth,
    left: SWITCH_FIELD_GEOMETRY.trackBorderWidth,
    borderRadius: Size.radius['full'],
  },
  hoverBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: SWITCH_FIELD_GEOMETRY.trackBorderWidth,
    borderRadius: Size.radius['full'],
  },
  thumb: {
    borderRadius: Size.radius['full'],
  },
  thumbSlot: {
    width: SWITCH_FIELD_GEOMETRY.trackHeight,
    height: SWITCH_FIELD_GEOMETRY.trackHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
