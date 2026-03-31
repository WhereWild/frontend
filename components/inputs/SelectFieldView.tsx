import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { IconButton } from '@/components/buttons/IconButton';
import { getInteractiveCursorStyle } from '@/components/interactiveCursorStyle';
import { ThemedText } from '@/components/text/ThemedText';
import { Portal } from '@/components/Portal';
import { Size } from '@/constants/theme';
import type { SelectFieldViewProps } from './useSelectFieldController';
import { FIELD_HEIGHT } from './useSelectFieldController';

const PLACEHOLDER_INPUT_HEIGHT = 20;

// Safari's WebKit engine does not render auto outlines on non-focusable nodes.
// We detect WebKit so we can apply a solid outline fallback for keyboard focus.
let cachedIsWebKitBrowser: boolean | null = null;
let cachedUserAgent: string | null = null;

const isWebKitBrowser = () => {
  if (Platform.OS !== 'web') {
    cachedIsWebKitBrowser = false;
    return cachedIsWebKitBrowser;
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (cachedUserAgent === userAgent && cachedIsWebKitBrowser !== null) {
    return cachedIsWebKitBrowser;
  }
  const isWebKit = /AppleWebKit/i.test(userAgent);
  const isChrome = /Chrome|Chromium/i.test(userAgent);
  const isEdge = /Edg/i.test(userAgent);

  cachedUserAgent = userAgent;
  cachedIsWebKitBrowser = isWebKit && !isChrome && !isEdge;
  return cachedIsWebKitBrowser;
};

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
  fieldBackgroundDefault,
  fieldBackgroundHover,
  fieldBackgroundPressed,
  fieldStyleOverrides,
  fieldPressableProps,
  fieldPressableRef,
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
  optionFocusedBackgroundColor,
  optionHoverBackgroundColor,
  optionPressedBackgroundColor,
  optionActiveTextColor,
  optionDefaultTextColor,
  optionFocusedRingColor,
  scrollViewRef,
  scrollViewProps,
  dropShadowStyle,
  containerStyle,
}: SelectFieldViewProps) => {
  const { style: scrollViewStyle, ...scrollViewRest } = scrollViewProps ?? {};
  const portalAccessibilityLabel = label
    ? `${label} options`
    : placeholder
      ? `${placeholder} options`
      : 'Select options';
  const portalAccessibilityHint = 'Swipe through options and double tap to select.';
  const showSearchPlaceholder = isOpen && allowSearch;
  const hasDropdownPosition = Boolean(dropdownPosition);
  const shouldShowPortalInput = allowSearch && hasDropdownPosition;
  const portalFieldFrame = dropdownPosition
    ? {
      top: dropdownPosition.top - dropdownPosition.height - Size.space['100'],
      left: dropdownPosition.left,
      width: dropdownPosition.width,
      height: dropdownPosition.height,
    }
    : null;
  const portalOptionsFrame = dropdownPosition
    ? {
      top: dropdownPosition.top,
      left: dropdownPosition.left,
      width: dropdownPosition.width,
    }
    : null;

  return (
    <>
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
            ref={fieldPressableRef}
            {...fieldPressableProps}
            style={({ pressed, hovered }) => [
              getInteractiveCursorStyle(iconButtonProps.disabled),
              styles.field,
              {
                backgroundColor: pressed
                  ? fieldBackgroundPressed
                  : hovered
                    ? fieldBackgroundHover
                    : fieldBackgroundDefault,
              },
              ...fieldStyleOverrides,
            ]}
          >
            {({ pressed, hovered }) => (
              <View style={styles.fieldContent} collapsable={false}>
                <View style={styles.fieldValueSlot} collapsable={false}>
                  <View
                    collapsable={false}
                    style={showSearchPlaceholder ? styles.hiddenContentSlot : undefined}
                  >
                    <ThemedText
                      variant="singleLineBody"
                      style={{ color: showPlaceholder ? placeholderColor : valueColor, flex: 1 }}
                    >
                      {valueText || placeholder}
                    </ThemedText>
                  </View>
                  <View
                    collapsable={false}
                    style={!showSearchPlaceholder ? styles.hiddenContentSlot : undefined}
                  >
                    {
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
                    }
                    <View style={[styles.input, { height: PLACEHOLDER_INPUT_HEIGHT }]} />
                  </View>
                </View>
                <View style={styles.fieldIconSlot} collapsable={false}>
                {/*
                 * The select icon visually reads as a button, but the field owns the interaction.
                 * Rendering it as a non-interactive visual avoids nested pressables toggling the
                 * same control while preserving whole-button hover/press affordances.
                 */}
                <IconButton
                  variant="subtle"
                  size="small"
                  interactive={false}
                  hovered={hovered ?? false}
                  pressed={pressed}
                  icon={iconButtonProps.icon}

                  disabled={iconButtonProps.disabled}
                />
                </View>
              </View>
            )}
          </Pressable>
        </View>
        {errorMessage ? (
          <ThemedText variant="body" style={{ color: errorColor }}>
            {errorMessage}
          </ThemedText>
        ) : null}
      </View>
      {isOpen ? (
        <Portal
          visible={true}
          onDismiss={onDismiss}
          accessibilityLabel={portalAccessibilityLabel}
          accessibilityHint={portalAccessibilityHint}
        >
          <View collapsable={false} testID="select-field-portal-backdrop-slot" style={styles.backdropSlot}>
            <Pressable
              style={styles.backdrop}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close dropdown"
            />
          </View>
          <View
            collapsable={false}
            testID="select-field-portal-input-slot"
            accessibilityElementsHidden={!shouldShowPortalInput}
            importantForAccessibility={shouldShowPortalInput ? 'auto' : 'no-hide-descendants'}
            style={[
              styles.portalInputWrapper,
              portalFieldFrame,
              !shouldShowPortalInput && styles.hiddenPortalSlot,
            ]}
          >
            <TextInput
              testID="select-field-portal-input"
              ref={inputRef}
              {...inputProps}
              style={[
                styles.portalInput,
                inputProps.style,
                !shouldShowPortalInput && styles.hiddenPortalInput,
              ]}
            />
          </View>
          <View
            collapsable={false}
            testID="select-field-portal-icon-slot"
            accessibilityElementsHidden={!hasDropdownPosition}
            importantForAccessibility={hasDropdownPosition ? 'auto' : 'no-hide-descendants'}
            style={[
              styles.portalFieldIconRow,
              portalFieldFrame,
              !hasDropdownPosition && styles.hiddenPortalSlot,
            ]}
          >
            <IconButton
              variant="subtle"
              size="small"
              interactive={false}
              icon={iconButtonProps.icon}
              accessibilityLabel={iconButtonProps.accessibilityLabel}
              disabled={iconButtonProps.disabled}
            />
          </View>
          <View
            collapsable={false}
            testID="select-field-portal-options-slot"
            accessibilityElementsHidden={!hasDropdownPosition}
            importantForAccessibility={hasDropdownPosition ? 'auto' : 'no-hide-descendants'}
            style={[
              styles.optionsContainer,
              dropShadowStyle,
              { pointerEvents: 'auto' },
              portalOptionsFrame,
              !hasDropdownPosition && styles.hiddenPortalSlot,
              ...optionsContainerStyleOverrides,
            ]}
          >
            <ScrollView
              ref={scrollViewRef}
              style={[styles.optionsScroll, scrollViewStyle]}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              {...scrollViewRest}
            >
              {options.map((option, index) => {
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityLabel={option.accessibilityLabel}
                    onPress={option.onPress}
                    onPressIn={option.onPressIn}
                    onPressOut={option.onPressOut}
                    onTouchStart={option.onTouchStart}
                    onTouchEnd={option.onTouchEnd}
                    onLayout={option.onLayout}
                    style={({ pressed, hovered }) => [
                      styles.optionRow,
                      {
                        marginBottom: index === options.length - 1 ? 0 : Size.space['050'],
                      },
                      {
                        backgroundColor: option.isSelected
                          ? optionActiveBackgroundColor
                          : pressed
                            ? optionPressedBackgroundColor
                            : hovered
                              ? optionHoverBackgroundColor
                              : option.isHighlighted
                                ? optionFocusedBackgroundColor
                                : 'transparent',
                        ...(Platform.OS === 'web'
                          ? (
                            {
                              // Safari does not render the auto outline for non-focusable nodes.
                              // Use a solid outline with explicit color as a fallback focus ring.
                              outlineStyle: option.isHighlighted
                                ? (isWebKitBrowser() ? 'solid' : 'auto')
                                : 'none',
                              outlineWidth: Size.stroke.focusRing,
                              outlineColor: isWebKitBrowser() ? optionFocusedRingColor : undefined,
                            } as any
                          )
                          : null),
                      },
                    ]}
                    {...(option.pressableProps ?? {})}
                  >
                    <ThemedText
                      variant={option.isSelected ? 'bodyStrong' : 'body'}
                      style={{
                        color: option.isSelected
                          ? optionActiveTextColor
                          : optionDefaultTextColor,
                      }}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Portal>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Size.space['100'],
    minWidth: 240,
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
    marginVertical: Size.space['100'],
    gap: Size.space['100'],
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Size.radius['200'],
  },
  fieldContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['100'],
  },
  fieldValueSlot: {
    flex: 1,
  },
  fieldIconSlot: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: 0,
  },
  hiddenContentSlot: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  backdropSlot: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  hiddenPortalSlot: {
    opacity: 0,
    width: 0,
    height: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  portalInputWrapper: {
    position: 'absolute',
    height: FIELD_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Size.space['400'],
  },
  hiddenPortalInput: {
    opacity: 0,
    width: 0,
    height: 0,
    pointerEvents: 'none',
  },
  portalFieldIconRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: Size.space['100'],
    pointerEvents: 'box-none',
    zIndex: 3,
    elevation: 3,
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
    padding: Size.space['100'],
  },
  optionRow: {
    paddingVertical: Size.space['150'],
    paddingHorizontal: Size.space['200'],
    borderRadius: Size.radius['100'],
  },
});
