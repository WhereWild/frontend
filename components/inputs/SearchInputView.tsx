import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { IconButton } from '@/components/buttons/IconButton';
import { Size } from '@/constants/theme';

/**
 * Pure view for SearchInput; expects fully-resolved props from the controller.
 */

export type SearchInputIconButtonProps = {
  onPress?: () => void;
  accessibilityLabel: string;
  disabled: boolean;
  enableHaptics?: boolean;
  icon: React.ReactNode;
};

export type SearchInputViewProps = {
  disabled: boolean;
  containerStyle: (ViewStyle | null)[];
  containerHandlers: {
    onPress: () => void;
    onHoverIn: () => void;
    onHoverOut: () => void;
    onPressIn: () => void;
    onPressOut: () => void;
  };
  searchButton: SearchInputIconButtonProps;
  clearButton?: SearchInputIconButtonProps;
  inputProps: TextInputProps;
  inputRef: React.RefObject<TextInput | null>;
};

const FALLBACK_CLEAR_BUTTON: SearchInputIconButtonProps = {
  accessibilityLabel: 'Clear search',
  disabled: true,
  enableHaptics: false,
  icon: null,
  onPress: undefined,
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Size.control.height.medium,
    borderRadius: Size.radius.full,
    paddingHorizontal: Size.space['100'],
    gap: Size.space['100'],
    // Default outline stays off until the controller toggles it back on for native focus rings.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  input: {
    flex: 1,
    height: '100%',
    minWidth: 0,
    maxWidth: '100%',
    padding: 0,
    textAlignVertical: 'center',
    // Keep placeholder-visible-first-run design without double outlines on web focus.
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none', outlineWidth: 0 } as any)
      : {}),
  },
  clearButtonSlot: {
    width: Size.control.dimension.medium,
    height: Size.control.dimension.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonSlotHidden: {
    opacity: 0,
  },
});

export function SearchInputView({
  disabled,
  containerStyle,
  containerHandlers,
  searchButton,
  clearButton,
  inputProps,
  inputRef,
}: SearchInputViewProps) {
  const { style: providedInputStyle, ...restInputProps } = inputProps;
  const resolvedClearButton = clearButton ?? FALLBACK_CLEAR_BUTTON;
  // Always seed the TextInput with our baseline constraints so consumer overrides only layer on top.
  const mergedInputStyle = Array.isArray(providedInputStyle)
    ? [styles.input, ...providedInputStyle]
    : [styles.input, providedInputStyle ?? null];

  // The outer Pressable captures hover/press affordances so the controller can emulate
  // consistent hover states while letting the browser draw the actual focus ring.
  return (
    <Pressable
      collapsable={false}
      onPress={containerHandlers.onPress}
      onHoverIn={containerHandlers.onHoverIn}
      onHoverOut={containerHandlers.onHoverOut}
      onPressIn={containerHandlers.onPressIn}
      onPressOut={containerHandlers.onPressOut}
      style={[styles.container, ...containerStyle]}
      disabled={disabled}
      // The outer pressable is unfocusable; focus is managed on the TextInput inside.
      accessible={false}
      focusable={false}
      {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : {})}
    >
      <IconButton
        variant='subtle'
        size='small'
        icon={searchButton.icon}
        accessibilityLabel={searchButton.accessibilityLabel}
        disabled={searchButton.disabled}
        enableHaptics={searchButton.enableHaptics}
        onPress={searchButton.onPress}
      />

      <TextInput ref={inputRef} {...restInputProps} style={mergedInputStyle} />

      <View
        collapsable={false}
        accessibilityElementsHidden={!clearButton}
        importantForAccessibility={clearButton ? 'auto' : 'no-hide-descendants'}
        pointerEvents={clearButton ? 'auto' : 'none'}
        style={[
          styles.clearButtonSlot,
          !clearButton ? styles.clearButtonSlotHidden : undefined,
        ]}
      >
        <IconButton
          variant='subtle'
          size='small'
          icon={resolvedClearButton.icon}
          accessibilityLabel={resolvedClearButton.accessibilityLabel}
          disabled={resolvedClearButton.disabled}
          enableHaptics={resolvedClearButton.enableHaptics}
          onPress={resolvedClearButton.onPress}
        />
      </View>
    </Pressable>
  );
}

export const __SEARCH_INPUT_VIEW_TESTING__ = {
  styles,
};
