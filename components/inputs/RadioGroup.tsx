import React, { useCallback, useState } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/text/ThemedText';
import { RadioField } from './RadioField';

export type RadioGroupOption = {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

export type RadioGroupProps = {
  options: RadioGroupOption[];
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  label?: string;
  description?: string;
  onValueChange?: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function RadioGroup({
  options,
  value,
  defaultValue,
  disabled = false,
  label,
  description,
  onValueChange,
  style,
  accessibilityLabel,
  testID,
}: RadioGroupProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const isControlled = typeof value === 'string';
  const resolvedValue = isControlled ? value : internalValue;

  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const labelColor = disabled
    ? palette.text.disabled.default
    : palette.text.default.default;
  const descriptionColor = disabled
    ? palette.text.disabled.default
    : palette.text.default.secondary;

  const onSelectValue = useCallback(
    (nextValue: string) => {
      if (disabled || nextValue === resolvedValue) {
        return;
      }

      if (!isControlled) {
        setInternalValue(nextValue);
      }

      onValueChange?.(nextValue);
    },
    [disabled, isControlled, onValueChange, resolvedValue],
  );

  return (
    <View
      accessibilityRole='radiogroup'
      accessibilityLabel={accessibilityLabel ?? label ?? 'Radio group'}
      style={[styles.container, style]}
      testID={testID}
    >
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
      <View style={styles.options}>
        {options.map((option) => {
          const optionDisabled = disabled || Boolean(option.disabled);
          return (
            <RadioField
              key={option.value}
              label={option.label}
              description={option.description}
              checked={resolvedValue === option.value}
              disabled={optionDisabled}
              onValueChange={() => onSelectValue(option.value)}
              accessibilityLabel={option.accessibilityLabel ?? option.label}
              testID={option.testID}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 340,
    gap: Size.space['100'],
  },
  options: {
    gap: Size.space['300'],
  },
});
