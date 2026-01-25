import React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText, IconButton } from '@/components';
import { Size } from '@/constants/theme';
import type { SelectFieldViewProps } from './useSelectFieldController';

export const SelectFieldView = ({
  label,
  description,
  errorMessage,
  labelColor,
  descriptionColor,
  errorColor,
  isOpen,
  allowSearch,
  showPlaceholder,
  placeholder,
  valueText,
  placeholderColor,
  valueColor,
  fieldStyleOverrides,
  fieldPressablePropsOpen,
  fieldPressablePropsClosed,
  inputRef,
  inputProps,
  iconButtonPropsOpen,
  iconButtonPropsClosed,
  options,
  optionsContainerStyleOverrides,
  optionActiveBackgroundColor,
  scrollViewRef,
  dropShadowStyle,
  containerStyle,
}: SelectFieldViewProps) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <ThemedText variant="body" style={{ color: labelColor }}>
          {label}
        </ThemedText>
      ) : null}
      {description ? (
        <ThemedText variant="body" style={{ color: descriptionColor }}>
          {description}
        </ThemedText>
      ) : null}
      <View style={styles.fieldWrapper}>
        {isOpen ? (
          <Pressable
            {...fieldPressablePropsOpen}
            style={[styles.field, ...fieldStyleOverrides]}
          >
            {allowSearch ? (
              <TextInput
                ref={inputRef}
                {...(inputProps ?? {})}
                style={[styles.input, inputProps?.style]}
              />
            ) : (
              <ThemedText
                variant="singleLineBody"
                style={{ color: showPlaceholder ? placeholderColor : valueColor, flex: 1 }}
              >
                {valueText || placeholder}
              </ThemedText>
            )}
            <IconButton
              variant="subtle"
              size="small"
              icon={iconButtonPropsOpen.icon}
              accessibilityLabel={iconButtonPropsOpen.accessibilityLabel}
              accessibilityRole={iconButtonPropsOpen.accessibilityRole}
              disabled={iconButtonPropsOpen.disabled}
              onPress={iconButtonPropsOpen.onPress}
              {...(iconButtonPropsOpen.extraProps ?? {})}
            />
          </Pressable>
        ) : (
          <Pressable
            {...fieldPressablePropsClosed}
            style={[styles.field, ...fieldStyleOverrides]}
          >
            <ThemedText
              variant="singleLineBody"
              style={{ color: showPlaceholder ? placeholderColor : valueColor, flex: 1 }}
            >
              {valueText || placeholder}
            </ThemedText>
            <IconButton
              variant="subtle"
              size="small"
              icon={iconButtonPropsClosed.icon}
              accessibilityLabel={iconButtonPropsClosed.accessibilityLabel}
              accessibilityRole={iconButtonPropsClosed.accessibilityRole}
              disabled={iconButtonPropsClosed.disabled}
              onPress={iconButtonPropsClosed.onPress}
              {...(iconButtonPropsClosed.extraProps ?? {})}
            />
          </Pressable>
        )}
        {isOpen ? (
          <View style={[styles.optionsContainer, dropShadowStyle, ...optionsContainerStyleOverrides]}>
            <ScrollView ref={scrollViewRef} style={styles.optionsScroll}>
              {options.map((option) => {
                const backgroundColor = option.isHighlighted || option.isSelected
                  ? optionActiveBackgroundColor
                  : 'transparent';

                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityLabel={option.accessibilityLabel}
                    onPress={option.onPress}
                    onPressIn={option.onPressIn}
                    onPressOut={option.onPressOut}
                    onLayout={option.onLayout}
                    style={[styles.optionRow, { backgroundColor }]}
                    {...(option.pressableProps ?? {})}
                  >
                    <ThemedText variant="singleLineBody">{option.label}</ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>
      {errorMessage ? (
        <ThemedText variant="body" style={{ color: errorColor }}>
          {errorMessage}
        </ThemedText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Size.space['200'],
    minWidth: Size.space['8000'],
    maxWidth: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  fieldWrapper: {
    position: 'relative',
    zIndex: 50,
    overflow: 'visible',
  },
  field: {
    minHeight: 44,
    paddingVertical: Size.space['100'],
    paddingLeft: Size.space['400'],
    paddingRight: Size.space['100'],
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['200'],
    borderColor: 'transparent',
  },
  input: {
    flex: 1,
    padding: 0,
  },
  optionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: Size.space['100'],
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['200'],
    overflow: 'hidden',
    maxHeight: 240,
    zIndex: 1000,
    elevation: 1000,
  },
  optionsScroll: {
    paddingVertical: Size.space['100'],
  },
  optionRow: {
    paddingVertical: Size.space['200'],
    paddingHorizontal: Size.space['300'],
  },
});
