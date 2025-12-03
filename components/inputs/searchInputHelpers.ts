import React from 'react';
import { PressableStateCallbackType, TextInput, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

// Shared helper utilities for SearchInput logic and tests.

// The value 2 is empirically measured: it compensates for the default vertical padding
// present in React Native's <TextInput> on web. This offset was determined by visual inspection
// on both Safari and Chrome and on RN version (0.81.5), and may need adjustment if RN changes
// its default input styling in future releases.
export const RN_TEXT_INPUT_VERTICAL_OFFSET = 2;

export type StringRef = { current: string };

export type ClearValueParams = {
  disabled: boolean;
  isControlled: boolean;
  setInternalValue: (next: string) => void;
  previousValueRef: StringRef;
  onQueryChange?: (value: string) => void;
  onClear?: () => void;
};

export const handleClearValue = ({
  disabled,
  isControlled,
  setInternalValue,
  previousValueRef,
  onQueryChange,
  onClear,
}: ClearValueParams) => {
  if (disabled) {
    return false;
  }

  previousValueRef.current = '';
  if (!isControlled) {
    setInternalValue('');
  }
  onQueryChange?.('');
  onClear?.();
  return true;
};

export const submitSearchValue = (
  disabled: boolean,
  submittedValue: string,
  onSubmitSearch?: (value: string) => void,
) => {
  if (disabled) {
    return false;
  }

  onSubmitSearch?.(submittedValue);
  return true;
};

export type IconButtonStyleParams = {
  palette: (typeof Colors)['light'];
  baseIconColor: string;
  disabled: boolean;
  state: PressableStateCallbackType;
};

// Icons stay transparent by default, pick up neutral fills only while hovered/pressed, and
// receive a semantic focus ring (web) so they mimic real buttons without a resting background.
export const resolveIconButtonInteractionStyles = ({
  palette,
  baseIconColor,
  disabled,
  state,
}: IconButtonStyleParams) => {
  const pressed = state.pressed;
  const hovered = Boolean(state.hovered);
  const interactionActive = !disabled && (pressed || hovered);

  // Start with an object so subsequent merges can stay branch-free even when no interaction styles apply.
  let containerStyle: ViewStyle = {};

  if (interactionActive) {
    containerStyle = {
      backgroundColor: pressed
        ? palette.background.neutral.tertiaryPressed
        : palette.background.neutral.tertiaryHover,
    } as ViewStyle;
  }

  const iconColor = interactionActive
    ? palette.icon.neutral.onNeutralTertiary
    : baseIconColor;

  return {
    containerStyle,
    iconColor,
  };
};

export type ContainerHandlerParams = {
  disabled: boolean;
  inputRef: React.RefObject<TextInput | null>;
  setIsHovered: (next: boolean) => void;
  setIsPressing: (next: boolean) => void;
};

export const createContainerHandlers = ({
  disabled,
  inputRef,
  setIsHovered,
  setIsPressing,
}: ContainerHandlerParams) => ({
  // Clicking anywhere in the pill should move focus to the TextInput, mirroring native search bars.
  onPress: () => {
    if (disabled) {
      return;
    }
    inputRef.current?.focus();
  },
  onHoverIn: () => setIsHovered(true),
  onHoverOut: () => setIsHovered(false),
  onPressIn: () => setIsPressing(true),
  onPressOut: () => setIsPressing(false),
});
