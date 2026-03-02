import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Size.radius.full,
    paddingHorizontal: Size.space['100'],
    paddingVertical: Size.space['100'],
    gap: Size.space['100'],
    // Default outline stays off until the controller toggles it back on for native focus rings.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
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
      // The outer pressable is unfocusable; focus is managed on the TextInput inside.
      accessible={false}
      focusable={false}
      {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : {})}
    >
      <IconButton
        variant="subtle"
        size="small"
        icon={searchButton.icon}
        accessibilityLabel={searchButton.accessibilityLabel}
        disabled={searchButton.disabled}
        onPress={searchButton.onPress}
      />

      <TextInput ref={inputRef} {...restInputProps} style={mergedInputStyle} />

      {clearButton ? (
        <IconButton
          variant="subtle"
          size="small"
          icon={clearButton.icon}
          accessibilityLabel={clearButton.accessibilityLabel}
          disabled={clearButton.disabled}
          onPress={clearButton.onPress}
        />
      ) : null}
    </Pressable>
  );
}

export const __SEARCH_INPUT_VIEW_TESTING__ = {
  styles,
};
