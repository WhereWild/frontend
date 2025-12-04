import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '../text/ThemedText';

const TRACK_WIDTH = Size.space['400'] + Size.space['600'];
const TRACK_HEIGHT = Size.space['600'];
const TRACK_PADDING = Size.space['100'];
const KNOB_DIAMETER = Size.space['400'];
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_DIAMETER - TRACK_PADDING * 2;
const HIT_SLOP = Size.space['100'];

export type SwitchFieldProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

export function SwitchField({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: SwitchFieldProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [isPressed, setIsPressed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const handleToggle = React.useCallback(() => {
    toggleValue(disabled, onValueChange, value);
  }, [disabled, onValueChange, value]);

  React.useEffect(() => {
    if (disabled) {
      if (isPressed) {
        setIsPressed(false);
      }
      if (isHovered) {
        setIsHovered(false);
      }
    }
  }, [disabled, isPressed, isHovered]);

  const textColors = React.useMemo(
    () => ({
      label: disabled ? palette.text.disabled.default : palette.text.default.default,
      description: disabled
        ? palette.text.disabled.default
        : palette.text.default.secondary,
    }),
    [disabled, palette],
  );

  const trackColors = React.useMemo(
    () => ({
      background: resolveTrackColor(palette, value, disabled, isPressed, isHovered),
      border: resolveBorderColor(palette, value, disabled),
    }),
    [palette, value, disabled, isPressed, isHovered],
  );

  const handlePressIn = React.useCallback(() => {
    setIsPressed(true);
  }, []);

  const handlePressOut = React.useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleHoverIn = React.useCallback(() => {
    if (!disabled) {
      setIsHovered(true);
    }
  }, [disabled]);

  const handleHoverOut = React.useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.row}>
        <ThemedText variant="body" style={[styles.label, { color: textColors.label }]}>
          {label}
        </ThemedText>
        <Pressable
          hitSlop={HIT_SLOP}
          onPress={handleToggle}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled, checked: value }}
          aria-checked={value}
          aria-disabled={disabled}
          testID={testID}
          style={[
            styles.switchPressable,
            styles.track,
            {
              backgroundColor: trackColors.background,
              borderColor: trackColors.border,
            },
          ]}
        >
          <View
            style={[
              styles.knob,
              {
                backgroundColor: resolveKnobColor(palette, value, disabled),
                transform: [
                  {
                    translateX: value ? TRACK_PADDING + KNOB_TRAVEL : TRACK_PADDING,
                  },
                ],
              },
            ]}
          />
        </Pressable>
      </View>

      {description ? (
        <ThemedText
          variant="body"
          style={[styles.description, { color: textColors.description }]}
        >
          {description}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Size.space['300'],
  },
  label: {
    flex: 1,
  },
  switchPressable: {
    alignSelf: 'flex-start',
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT,
    padding: TRACK_PADDING,
    borderWidth: Size.stroke.border,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: 0,
    width: KNOB_DIAMETER,
    height: KNOB_DIAMETER,
    borderRadius: Size.radius.full,
  },
  description: {
    marginTop: Size.space['100'],
  },
});

function resolveTrackColor(
  palette: typeof Colors.light,
  value: boolean,
  disabled: boolean,
  pressed: boolean,
  hovered: boolean,
) {
  if (disabled) {
    return palette.background.disabled.default;
  }
  if (value) {
    if (pressed) {
      return palette.background.brand.pressed;
    }
    if (hovered) {
      return palette.background.brand.hover;
    }
    return palette.background.brand.default;
  }
  if (pressed) {
    return palette.background.default.secondaryPressed;
  }
  if (hovered) {
    return palette.background.default.secondaryHover;
  }
  return palette.background.default.secondary;
}

function resolveBorderColor(
  palette: typeof Colors.light,
  value: boolean,
  disabled: boolean,
) {
  if (disabled || value) {
    return 'transparent';
  }
  return palette.border.neutral.default;
}

function resolveKnobColor(
  palette: typeof Colors.light,
  value: boolean,
  disabled: boolean,
) {
  if (disabled) {
    return palette.icon.disabled.onDisabled;
  }
  if (value) {
    return palette.icon.brand.onBrand;
  }
  return palette.icon.neutral.default;
}

function toggleValue(
  disabled: boolean,
  onValueChange: ((value: boolean) => void) | undefined,
  value: boolean,
) {
  if (disabled) {
    return;
  }
  onValueChange?.(!value);
}
