import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { IconSearch, IconX } from '@/assets/icons';
import { Colors, Size, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

export type SearchInputProps = Omit<
  TextInputProps,
  'onChange' | 'onChangeText' | 'style' | 'value' | 'defaultValue' | 'placeholder' | 'editable'
> & {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  /** Fires whenever the text changes. */
  onQueryChange?: (value: string) => void;
  /** Fires only when a new character is appended to the current value. */
  onCharacterAdd?: (character: string, value: string) => void;
  /** Invoked when the search is submitted via icon press or return key. */
  onSubmitSearch?: (value: string) => void;
  /** Invoked after the clear icon resets the field. */
  onClear?: () => void;
};

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  defaultValue = '',
  placeholder = 'Search',
  disabled = false,
  containerStyle,
  inputStyle,
  onQueryChange,
  onCharacterAdd,
  onSubmitSearch,
  onClear,
  ...textInputProps
}) => {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const [isFocused, setIsFocused] = React.useState(false);
  const isControlled = value != null;
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = isControlled ? value! : internalValue;
  const previousValueRef = React.useRef(currentValue);

  React.useEffect(() => {
    previousValueRef.current = currentValue;
  }, [currentValue]);

  const palette = Colors[mode];
  const interactiveBorderWidth = isFocused && !disabled ? Size.stroke.border : 0;
  const backgroundColor = disabled
    ? palette.background.disabled.default
    : palette.background.default.tertiary;
  const textColor = disabled
    ? palette.text.disabled.onDisabled
    : palette.text.default.tertiary;
  const iconColor = disabled
    ? palette.icon.disabled.onDisabled
    : palette.icon.default.tertiary;
  const borderColor = isFocused && !disabled ? palette.border.default.tertiary : 'transparent';
  const paddingHorizontal = Math.max(0, Size.space['300'] - interactiveBorderWidth);
  const paddingVertical = Math.max(0, Size.space['300'] - interactiveBorderWidth);

  const handleChangeText = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    if (nextValue.length > previousValueRef.current.length) {
      const newChar = nextValue.at(-1);
      if (newChar) {
        onCharacterAdd?.(newChar, nextValue);
      }
    }

    previousValueRef.current = nextValue;

    onQueryChange?.(nextValue);
  };

  const clearValue = () => {
    if (disabled) {
      return;
    }

    previousValueRef.current = '';
    if (!isControlled) {
      setInternalValue('');
    }
    onQueryChange?.('');
    onClear?.();
  };

  const showClearButton = !disabled && currentValue.length > 0;
  const submitSearch = (submittedValue: string) => {
    if (disabled) {
      return;
    }
    onSubmitSearch?.(submittedValue);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderColor,
          borderWidth: interactiveBorderWidth,
          paddingHorizontal,
          paddingVertical,
          opacity: disabled ? 0.75 : 1,
        },
        containerStyle,
      ]}
      pointerEvents={disabled ? 'none' : 'auto'}
      accessible
      accessibilityRole="search"
      accessibilityState={{ disabled }}
    >
      <Pressable
        onPress={() => submitSearch(currentValue)}
        accessibilityRole="button"
        accessibilityLabel="Start search"
        testID="search-input-icon"
        hitSlop={8}
        style={styles.iconButton}
        disabled={disabled}
      >
        <IconSearch size="16" color={iconColor} />
      </Pressable>

      <TextInput
        {...textInputProps}
        style={[
          styles.input,
          Typography[mode].singleLineBody,
          { color: textColor },
          inputStyle,
        ]}
        editable={!disabled}
        value={currentValue}
        placeholder={placeholder}
        placeholderTextColor={
          disabled ? palette.text.disabled.onDisabled : palette.text.default.tertiary
        }
        onChangeText={handleChangeText}
        onFocus={(event) => {
          setIsFocused(true);
          textInputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          textInputProps.onBlur?.(event);
        }}
        onSubmitEditing={(event) => {
          submitSearch(event.nativeEvent?.text ?? currentValue);
          textInputProps.onSubmitEditing?.(event);
        }}
        accessibilityLabel={textInputProps.accessibilityLabel ?? 'Search input'}
        selectionColor={palette.text.default.default}
      />

      {showClearButton ? (
        <Pressable
          onPress={clearValue}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          testID="search-input-clear"
          hitSlop={8}
          style={styles.iconButton}
        >
          <IconX size="16" color={iconColor} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Size.radius.full,
    borderWidth: 0,
    // Chrome/Web adds a default outline on focus; suppress it so only semantic borders appear.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : {}),
  },
  iconButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Size.space['050'],
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : {}),
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: Size.space['100'],
    // Keep placeholder-visible-first-run design without double outlines on web focus.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : {}),
  },
});

export const __SEARCH_INPUT_TESTING__ = {
  styles,
};