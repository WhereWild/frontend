import { IconSearch, IconX } from '@/assets/icons';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import {
  Platform,
  TextInput,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { type SearchInputViewProps } from './SearchInputView';
import {
  createContainerHandlers,
  handleClearValue,
  submitSearchValue,
} from './searchInputHelpers';

/**
 * Central hook + helper exports for SearchInput. Keeps business logic separate from presentation.
 */

export type UseSearchInputControllerArgs = {
  variant: 'secondary' | 'tertiary';
  value?: string;
  defaultValue: string;
  placeholder: string;
  disabled: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  onQueryChange?: (value: string) => void;
  onCharacterAdd?: (character: string, value: string) => void;
  onSubmitSearch?: (value: string) => void;
  onClear?: () => void;
  textInputProps: TextInputProps;
  /**
   * @internal Testing seam so we can simulate runtimes where the last glyph cannot be derived
   * (for example, environments lacking `String.prototype.at`). Production code should not pass
   * this prop.
   */
  characterReader?: (value: string) => string | undefined;
};

export const readLastCharacter = (value: string): string | undefined =>
  value.at(-1);

type TextInputFocusHandlerEvent = Parameters<
  NonNullable<TextInputProps['onFocus']>
>[0];
type TextInputSubmitHandlerEvent = Parameters<
  NonNullable<TextInputProps['onSubmitEditing']>
>[0];

export const useSearchInputController = ({
  variant,
  value,
  defaultValue,
  placeholder,
  disabled,
  containerStyle,
  inputStyle,
  onQueryChange,
  onCharacterAdd,
  onSubmitSearch,
  onClear,
  textInputProps,
  characterReader,
}: UseSearchInputControllerArgs): SearchInputViewProps => {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  // Mirror controlled/uncontrolled <TextInput> semantics so higher-level forms can opt in gradually.
  const [isFocused, setIsFocused] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressing, setIsPressing] = React.useState(false);
  const isControlled = value != null;
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = isControlled ? value : internalValue;
  // Track the prior string length so we can tell whether characters were appended or removed.
  const previousValueRef = React.useRef(currentValue);
  const inputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    if (!disabled) {
      return;
    }

    setIsHovered(false);
    setIsPressing(false);
  }, [disabled]);

  React.useEffect(() => {
    previousValueRef.current = currentValue;
  }, [currentValue]);

  const palette = Colors[mode];
  const background =
    variant === 'secondary'
      ? {
          default: palette.background.default.secondary,
          hover: palette.background.default.secondaryHover,
          pressed: palette.background.default.secondaryPressed,
        }
      : {
          default: palette.background.default.tertiary,
          hover: palette.background.default.tertiaryHover,
          pressed: palette.background.default.tertiaryPressed,
        };
  // Map interaction state -> semantic tokens so hover/press/focus follow the design system.
  const backgroundColor = disabled
    ? palette.background.disabled.default
    : isFocused
      ? background.default
      : isPressing
        ? background.pressed
        : isHovered
          ? background.hover
          : background.default;
  const textColor = disabled
    ? palette.text.disabled.onDisabled
    : palette.text.default.default;

  const handleChangeText = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    if (nextValue.length > previousValueRef.current.length) {
      const newChar = (characterReader ?? readLastCharacter)(nextValue);
      if (newChar) {
        onCharacterAdd?.(newChar, nextValue);
      }
    }

    previousValueRef.current = nextValue;
    onQueryChange?.(nextValue);
  };

  const clearValue = () => {
    handleClearValue({
      disabled,
      isControlled,
      setInternalValue,
      previousValueRef,
      onQueryChange,
      onClear,
    });
  };

  const showClearButton = !disabled && currentValue.length > 0;
  const submitSearch = (submittedValue: string) => {
    submitSearchValue(disabled, submittedValue, onSubmitSearch);
  };

  const containerDynamicStyle: ViewStyle = {
    backgroundColor,
  };

  const webOutlineStyle: ViewStyle | null =
    Platform.OS === 'web'
      ? ({
          // Toggle the browser's native focus ring instead of drawing a custom outline; relies on
          // TextInput focus/blur handlers staying in sync with actual browser focus.
          outlineStyle: isFocused ? 'auto' : 'none',
        } as unknown as ViewStyle)
      : null;

  const containerHandlers = createContainerHandlers({
    disabled,
    inputRef,
    setIsHovered,
    setIsPressing,
  });

  const searchButton = {
    onPress: () => submitSearch(currentValue),
    accessibilityLabel: 'Start search',
    disabled,
    icon: <IconSearch />,
  };

  const clearButton = showClearButton
    ? {
        onPress: clearValue,
        accessibilityLabel: 'Clear search',
        disabled: false,
        icon: <IconX />,
      }
    : undefined;

  // Forward events to the underlying TextInput so consumers injecting raw TextInput props
  // still receive callbacks.
  const handleFocus = (event: TextInputFocusHandlerEvent) => {
    setIsFocused(true);
    textInputProps.onFocus?.(event);
  };

  const handleBlur = (event: TextInputFocusHandlerEvent) => {
    setIsFocused(false);
    textInputProps.onBlur?.(event);
  };

  const handleSubmitEditing = (event: TextInputSubmitHandlerEvent) => {
    submitSearch(event.nativeEvent?.text ?? currentValue);
    textInputProps.onSubmitEditing?.(event);
  };

  // Bundle every prop needed by the pure view, keeping RN-specific knowledge localized here.
  const viewInputProps: TextInputProps = {
    ...textInputProps,
    style: [
      Typography[mode].singleLineBody,
      { color: textColor },
      inputStyle ?? null,
    ],
    editable: !disabled,
    focusable: !disabled,
    value: currentValue,
    placeholder,
    placeholderTextColor: disabled
      ? palette.text.disabled.onDisabled
      : palette.text.disabled.default,
    onChangeText: handleChangeText,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onSubmitEditing: handleSubmitEditing,
    accessibilityLabel: textInputProps.accessibilityLabel ?? 'Search input',
    selectionColor: palette.text.default.default,
  };

  return {
    disabled,
    containerStyle: [
      containerDynamicStyle,
      webOutlineStyle,
      containerStyle ?? null,
    ],
    containerHandlers,
    searchButton,
    clearButton,
    inputProps: viewInputProps,
    inputRef,
  };
};
