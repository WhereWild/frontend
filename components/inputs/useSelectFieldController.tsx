import React from 'react';
import { Platform, ScrollView, TextInput, type LayoutChangeEvent, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Colors, Shadows, Size, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconChevronDown, IconChevronUp } from '@/assets/icons';

export type SelectOption = {
  label: string;
  value: string;
};

export type SelectFieldProps = {
  label?: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  disabled?: boolean;
  allowSearch?: boolean;
  options?: SelectOption[];
  value: string;
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

export type SelectFieldOptionViewModel = {
  key: string;
  label: string;
  isSelected: boolean;
  isHighlighted: boolean;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  accessibilityLabel: string;
  pressableProps?: Record<string, unknown> | null;
};

export type SelectFieldViewProps = {
  label?: string;
  description?: string;
  errorMessage?: string;
  labelColor: string;
  descriptionColor: string;
  errorColor: string;
  isOpen: boolean;
  allowSearch: boolean;
  showPlaceholder: boolean;
  placeholder: string;
  valueText: string;
  placeholderColor: string;
  valueColor: string;
  fieldStyleOverrides: (ViewStyle | null)[];
  fieldPressablePropsOpen: PressableProps;
  fieldPressablePropsClosed: PressableProps;
  inputRef: React.RefObject<TextInput | null>;
  inputProps?: TextInputProps;
  iconButtonPropsOpen: {
    accessibilityLabel: string;
    disabled: boolean;
    icon: React.ReactNode;
    onPress: () => void;
    accessibilityRole?: 'none';
    extraProps?: Record<string, unknown> | null;
  };
  iconButtonPropsClosed: {
    accessibilityLabel: string;
    disabled: boolean;
    icon: React.ReactNode;
    onPress: () => void;
    accessibilityRole?: 'none';
    extraProps?: Record<string, unknown> | null;
  };
  options: SelectFieldOptionViewModel[];
  optionsContainerStyleOverrides: (ViewStyle | null)[];
  optionActiveBackgroundColor: string;
  scrollViewRef: React.RefObject<ScrollView | null>;
  dropShadowStyle: ViewStyle;
  containerStyle?: StyleProp<ViewStyle>;
};

const primaryDropShadow = Shadows.dropShadow200.layers[0];
const dropShadowStyle = primaryDropShadow
  ? {
      shadowColor: primaryDropShadow.color,
      shadowOffset: {
        width: primaryDropShadow.offsetX,
        height: primaryDropShadow.offsetY,
      },
      shadowOpacity: primaryDropShadow.opacity,
      shadowRadius: primaryDropShadow.blurRadius,
    }
  : {};

export const useSelectFieldController = ({
  label,
  description,
  errorMessage,
  placeholder = 'Select an option',
  disabled = false,
  allowSearch = true,
  options = [],
  value,
  onValueChange,
  onOpenChange,
  style,
}: SelectFieldProps): SelectFieldViewProps => {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  // Keep highlight null until keyboard navigation starts; avoids preselecting an option.
  const [highlightedIndex, setHighlightedIndex] = React.useState<number | null>(null);
  const isOptionPressingRef = React.useRef(false);
  // Defer blur work so option presses can complete on web before closing.
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Disable native outline here; we re-enable it on the wrapper to mimic SearchInput behavior.
  const webFieldOutlineStyle = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null;
  // Remove the input's own outline so the focus ring wraps the full field.
  const webInputOutlineStyle = Platform.OS === 'web'
    ? ({ outlineStyle: 'none', outlineWidth: 0 } as any)
    : null;
  const inputRef = React.useRef<TextInput>(null);
  const scrollViewRef = React.useRef<ScrollView | null>(null);
  const optionLayoutsRef = React.useRef<{ y: number; height: number }[]>([]);
  const [isFocused, setIsFocused] = React.useState(false);

  // Controlled value is the single source of truth for selection.
  const resolvedValue = value ?? '';
  const selectedOption = options.find((option) => option.value === resolvedValue);
  const selectedLabel = selectedOption?.label ?? (resolvedValue ? String(resolvedValue) : '');

  const isDisabled = disabled;
  const isError = !isDisabled && Boolean(errorMessage);
  const showPlaceholder = !selectedLabel;
  const isQueryEmpty = query.trim().length === 0;

  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) {
      return options;
    }
    const normalizedQuery = query.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  const openSelect = React.useCallback(() => {
    if (isDisabled) {
      return;
    }
    setIsOpen(true);
    // Avoid pre-filling the search query so users can type from an empty state.
    setQuery(allowSearch ? '' : selectedLabel);
    // Reset highlight so keyboard navigation starts from "none" until arrows are used.
    setHighlightedIndex(null);
    onOpenChange?.(true);
  }, [allowSearch, isDisabled, onOpenChange, selectedLabel]);

  const closeSelect = React.useCallback(() => {
    setIsOpen(false);
    setQuery('');
    // Clear focus ring when leaving the field via selection or blur.
    setIsFocused(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const handleInputBlur = React.useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    blurTimeoutRef.current = setTimeout(() => {
      if (isOptionPressingRef.current) {
        return;
      }
      setIsFocused(false);
      closeSelect();
    }, 0);
  }, [closeSelect]);

  const handleInputFocus = React.useCallback(() => {
    setIsFocused(true);
  }, []);

  const toggleSelect = React.useCallback(() => {
    if (isOpen) {
      closeSelect();
    } else {
      openSelect();
    }
  }, [closeSelect, isOpen, openSelect]);

  const handleSelectOption = React.useCallback(
    (option: SelectOption) => {
      if (isDisabled) {
        return;
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      onValueChange?.(option.value);
      closeSelect();
    },
    [closeSelect, isDisabled, onValueChange],
  );

  const handleKeyPress = React.useCallback(
    (key: string, optionsList: SelectOption[]) => {
      if (!optionsList.length) {
        return;
      }

      if (key === 'ArrowDown') {
        // Enter the list on first arrow press; then cycle through options.
        setHighlightedIndex((prev) => {
          if (prev === null) {
            return 0;
          }
          return (prev + 1) % optionsList.length;
        });
        return;
      }

      if (key === 'ArrowUp') {
        // Move up from "none" to the last option for parity with native selects.
        setHighlightedIndex((prev) => {
          if (prev === null) {
            return optionsList.length - 1;
          }
          return (prev - 1 + optionsList.length) % optionsList.length;
        });
        return;
      }

      if (key === 'Enter') {
        const option = highlightedIndex === null
          ? null
          : optionsList[highlightedIndex];
        if (option) {
          handleSelectOption(option);
        }
        return;
      }

      if (key === 'Escape') {
        closeSelect();
      }
    },
    [closeSelect, handleSelectOption, highlightedIndex],
  );

  const fieldBackground = isDisabled
    ? palette.background.disabled.default
    : isError
      ? palette.background.danger.default
      : palette.background.default.secondary;

  const labelColor = isDisabled
    ? palette.text.disabled.default
    : palette.text.default.default;
  const descriptionColor = isDisabled
    ? palette.text.disabled.default
    : palette.text.default.secondary;
  const valueColor = isDisabled
    ? palette.text.disabled.onDisabled
    : isError
      ? palette.text.danger.onDanger
      : palette.text.default.default;
  const placeholderColor = isDisabled
    ? palette.text.disabled.onDisabled
    : isError
      ? palette.text.danger.onDangerSecondary
      : palette.text.disabled.default;
  const errorColor = palette.text.danger.default;

  const iconNode = isOpen ? <IconChevronUp size="20" /> : <IconChevronDown size="20" />;
  // Only render the browser focus ring when the wrapper is focused.
  const webFocusRingStyle: ViewStyle | null = Platform.OS === 'web'
    ? ({ outlineStyle: isFocused ? 'auto' : 'none' } as any)
    : null;
  const visibleOptions = allowSearch ? filteredOptions : options;
  // Prevent the chevron button from entering the tab order; focus stays on the field.
  const webIconButtonProps = Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : null;
  // Handle keyboard behavior on web: Enter/Space opens the list; arrows navigate without scrolling.
  const webKeyDownHandlers = Platform.OS === 'web'
    ? ({
        onKeyDown: (event: { key: string; preventDefault?: () => void; stopPropagation?: () => void }) => {
          const { key } = event;
          if (!isOpen && (key === 'Enter' || key === ' ')) {
            event.preventDefault?.();
            event.stopPropagation?.();
            openSelect();
            return;
          }

          if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === 'Escape') {
            event.preventDefault?.();
            event.stopPropagation?.();
          }
          handleKeyPress(key, visibleOptions);
        },
      } as any)
    : null;
  const webOptionProps = Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : null;

  React.useEffect(() => {
    if (highlightedIndex === null) {
      return;
    }
    const layout = optionLayoutsRef.current[highlightedIndex];
    if (!layout) {
      return;
    }
    // Scroll the list to keep the highlighted option visible when navigating via keyboard.
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, layout.y - Size.space['200']),
      animated: true,
    });
  }, [highlightedIndex]);

  const optionsViewModel: SelectFieldOptionViewModel[] = visibleOptions.map((option, index) => {
    const isSelected = option.value === resolvedValue;
    const isHighlighted = highlightedIndex !== null && index === highlightedIndex;
    return {
      key: option.value,
      label: option.label,
      isSelected,
      isHighlighted,
      onPress: () => handleSelectOption(option),
      onPressIn: () => {
        isOptionPressingRef.current = true;
      },
      onPressOut: () => {
        isOptionPressingRef.current = false;
      },
      onLayout: (event) => {
        optionLayoutsRef.current[index] = {
          y: event.nativeEvent.layout.y,
          height: event.nativeEvent.layout.height,
        };
      },
      accessibilityLabel: `Select ${option.label}`,
      pressableProps: webOptionProps,
    };
  });

  const handleTextChange = (nextValue: string) => {
    setQuery(nextValue);
    // Once typing starts, move highlight to the first matching option.
    if (highlightedIndex === null && nextValue.trim().length) {
      setHighlightedIndex(0);
    }
  };

  const fieldPressableBase: PressableProps = {
    disabled: isDisabled,
    accessibilityRole: 'button',
    accessibilityLabel: label ?? 'Select field',
    accessibilityState: { disabled: isDisabled, expanded: isOpen },
    ...webKeyDownHandlers,
  };

  return {
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
    valueText: showPlaceholder ? placeholder : selectedLabel,
    placeholderColor,
    valueColor,
    fieldStyleOverrides: [webFieldOutlineStyle, webFocusRingStyle, { backgroundColor: fieldBackground }],
    fieldPressablePropsOpen: {
      ...fieldPressableBase,
      onPress: () => {
        setIsFocused(true);
        if (allowSearch && !isDisabled) {
          inputRef.current?.focus();
        }
      },
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false),
    },
    fieldPressablePropsClosed: {
      ...fieldPressableBase,
      onPress: toggleSelect,
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false),
    },
    inputRef,
    inputProps: allowSearch
      ? {
          value: query,
          onChangeText: handleTextChange,
          placeholder,
          placeholderTextColor: isDisabled
            ? palette.text.disabled.onDisabled
            : isError
              ? palette.text.danger.onDangerSecondary
              : palette.text.disabled.default,
          autoFocus: true,
          editable: !isDisabled,
          autoCorrect: false,
          autoCapitalize: 'none',
          onKeyPress: (event) => handleKeyPress(event.nativeEvent.key, visibleOptions),
          style: [
            webInputOutlineStyle,
            Typography[mode].singleLineBody,
            {
              color: isDisabled
                ? palette.text.disabled.onDisabled
                : isError
                  ? palette.text.danger.onDanger
                  : isQueryEmpty
                    ? palette.text.disabled.default
                    : palette.text.default.default,
            },
          ],
          onFocus: handleInputFocus,
          onBlur: handleInputBlur,
        }
      : undefined,
    iconButtonPropsOpen: {
      accessibilityLabel: 'Close select',
      accessibilityRole: 'none',
      disabled: isDisabled,
      icon: iconNode,
      onPress: closeSelect,
      extraProps: webIconButtonProps,
    },
    iconButtonPropsClosed: {
      accessibilityLabel: 'Open select',
      accessibilityRole: 'none',
      disabled: isDisabled,
      icon: iconNode,
      onPress: toggleSelect,
      extraProps: webIconButtonProps,
    },
    options: optionsViewModel,
    optionsContainerStyleOverrides: [
      {
        backgroundColor: palette.background.default.tertiary,
        borderColor: palette.border.default.tertiary,
      },
    ],
    optionActiveBackgroundColor: palette.background.default.secondary,
    scrollViewRef,
    dropShadowStyle,
    containerStyle: style,
  };
};
