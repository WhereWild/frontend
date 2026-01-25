import React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText, IconButton } from '@/components';
import { Portal } from '@/components/Portal';
import { Size } from '@/constants/theme';
import type { SelectFieldViewProps } from './useSelectFieldController';
import { FIELD_HEIGHT } from './useSelectFieldController';

const PLACEHOLDER_INPUT_HEIGHT = 20;

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
  fieldPressableProps,
  fieldWrapperRef,
  onFieldWrapperLayout,
  dropdownPosition,
  onDismiss,
  inputRef,
  inputProps,
  iconButtonProps,
  options,
  optionsContainerStyleOverrides,
  optionActiveBackgroundColor,
  scrollViewRef,
  dropShadowStyle,
  containerStyle,
}: SelectFieldViewProps) => {
  const portalAccessibilityLabel = label
    ? `${label} options`
    : placeholder
      ? `${placeholder} options`
      : 'Select options';
  const portalAccessibilityHint = 'Swipe through options and double tap to select.';

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
      <View ref={fieldWrapperRef} onLayout={onFieldWrapperLayout} style={styles.fieldWrapper}>
        <Pressable
          {...fieldPressableProps}
          style={[styles.field, ...fieldStyleOverrides]}
        >
          {isOpen && allowSearch ? (
            /* 
             * When the dropdown is open with search enabled, we render the actual TextInput
             * inside the Portal (see the portal-mounted input that uses inputRef/inputProps).
             *
             * This View is a non-interactive placeholder that keeps the field row height and
             * layout stable while the real input lives in the portal overlay. The fixed
             * PLACEHOLDER_INPUT_HEIGHT is chosen to visually match the portal input so that
             * opening/closing the dropdown does not cause the field to jump or resize.
             *
             * If you change the height or layout of the portal input, update this placeholder
             * accordingly so that the dual-input pattern (placeholder here + real input in
             * the Portal) continues to behave and look consistent.
             */
            <View style={[styles.input, { height: PLACEHOLDER_INPUT_HEIGHT }]} />
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
            icon={iconButtonProps.icon}
            accessibilityLabel={iconButtonProps.accessibilityLabel}
            accessibilityRole={iconButtonProps.accessibilityRole}
            disabled={iconButtonProps.disabled}
            onPress={iconButtonProps.onPress}
            {...(iconButtonProps.extraProps ?? {})}
          />
        </Pressable>
      </View>
      <Portal
        visible={isOpen}
        onDismiss={onDismiss}
        accessibilityLabel={portalAccessibilityLabel}
        accessibilityHint={portalAccessibilityHint}
      >
        <Pressable
          style={styles.backdrop}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close dropdown"
        />
        {/* Input inside Portal for keyboard events */}
        {allowSearch && dropdownPosition ? (
          <View
            style={[
              styles.portalInputWrapper,
              {
                top: dropdownPosition.top - dropdownPosition.height - Size.space['100'],
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                height: dropdownPosition.height,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              {...inputProps}
              style={[styles.portalInput, inputProps.style]}
            />
          </View>
        ) : (
          /* Hidden input to capture keyboard events for non-searchable variant */
          <TextInput
            ref={inputRef}
            {...inputProps}
          />
        )}
        <View
          pointerEvents="auto"
          style={[
            styles.optionsContainer,
            dropShadowStyle,
            dropdownPosition
              ? {
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                }
              : null,
            ...optionsContainerStyleOverrides,
          ]}
        >
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
      </Portal>
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
  },
  fieldWrapper: {
    position: 'relative',
  },
  field: {
    minHeight: FIELD_HEIGHT,
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  portalInputWrapper: {
    position: 'absolute',
    height: FIELD_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Size.space['400'],
  },
  portalInput: {
    flex: 1,
    padding: 0,
  },
  optionsContainer: {
    position: 'absolute',
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['200'],
    overflow: 'hidden',
    maxHeight: 240,
  },
  optionsScroll: {
    paddingVertical: Size.space['100'],
  },
  optionRow: {
    paddingVertical: Size.space['200'],
    paddingHorizontal: Size.space['300'],
  },
});
