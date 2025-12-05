import { Size, Typography } from '@/constants/theme';
import React from 'react';
import {
  Platform,
  Pressable,
  PressableStateCallbackType,
  StyleSheet,
  TextInput,
  TextInputProps,
  ViewStyle,
} from 'react-native';

/**
 * Pure view for SearchInput; expects fully-resolved props from the controller.
 */

export type IconButtonSlotProps = {
  onPress?: () => void;
  accessibilityLabel: string;
  testID: string;
  disabled: boolean;
  hitSlop?: number | object;
  style: (state: PressableStateCallbackType) => (ViewStyle | null)[];
  renderIcon: (state: PressableStateCallbackType) => React.ReactNode;
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
  searchButton: IconButtonSlotProps;
  clearButton?: IconButtonSlotProps;
  inputProps: TextInputProps;
  inputRef: React.RefObject<TextInput | null>;
};

const ICON_BUTTON_EXPANSION = Size.space['200'];
const SEARCH_INPUT_TARGET_HEIGHT = 40;
// Mirror the button sizing math so the pill always hits 40px without hardcoding padding.
const SINGLE_LINE_LINE_HEIGHT =
  Typography.light.singleLineBody.lineHeight ??
  Typography.light.body.lineHeight ??
  20;
const BASE_VERTICAL_PADDING = Math.max(
  0,
  (SEARCH_INPUT_TARGET_HEIGHT - SINGLE_LINE_LINE_HEIGHT) / 2,
);
const CONTAINER_VERTICAL_PADDING = BASE_VERTICAL_PADDING;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Size.radius.full,
    borderWidth: 0,
    paddingHorizontal: Size.space['300'],
    paddingVertical: CONTAINER_VERTICAL_PADDING,
    gap: Size.space['300'],
    // Default outline stays off until the controller toggles it back on for native focus rings.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  iconButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ICON_BUTTON_EXPANSION,
    paddingVertical: ICON_BUTTON_EXPANSION,
    marginHorizontal: -ICON_BUTTON_EXPANSION,
    marginVertical: -ICON_BUTTON_EXPANSION,
    borderRadius: Size.radius.full,
  },
  input: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    // Keep placeholder-visible-first-run design without double outlines on web focus.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : {}),
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
  // Always seed the TextInput with our baseline constraints so consumer overrides only layer on top.
  const mergedInputStyle = Array.isArray(providedInputStyle)
    ? [styles.input, ...providedInputStyle]
    : [styles.input, providedInputStyle ?? null];

  // The outer Pressable captures hover/press affordances so the controller can emulate
  // consistent hover states while letting the browser draw the actual focus ring.
  return (
    <Pressable
      onPress={containerHandlers.onPress}
      onHoverIn={containerHandlers.onHoverIn}
      onHoverOut={containerHandlers.onHoverOut}
      onPressIn={containerHandlers.onPressIn}
      onPressOut={containerHandlers.onPressOut}
      style={[styles.container, ...containerStyle]}
      disabled={disabled}
      accessible
      accessibilityRole="search"
      accessibilityState={{ disabled }}
    >
      <Pressable
        onPress={searchButton.onPress}
        accessibilityRole="button"
        accessibilityLabel={searchButton.accessibilityLabel}
        testID={searchButton.testID}
        hitSlop={searchButton.hitSlop}
        disabled={searchButton.disabled}
        style={(state) => [styles.iconButton, ...searchButton.style(state)]}
      >
        {(state) => searchButton.renderIcon(state)}
      </Pressable>

      <TextInput ref={inputRef} {...restInputProps} style={mergedInputStyle} />

      {clearButton ? (
        <Pressable
          onPress={clearButton.onPress}
          accessibilityRole="button"
          accessibilityLabel={clearButton.accessibilityLabel}
          testID={clearButton.testID}
          hitSlop={clearButton.hitSlop}
          disabled={clearButton.disabled}
          style={(state) => [styles.iconButton, ...clearButton.style(state)]}
        >
          {(state) => clearButton.renderIcon(state)}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export const __SEARCH_INPUT_VIEW_TESTING__ = {
  styles,
};
