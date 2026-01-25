import React from 'react';
import { Platform, ScrollView, TextInput, View, type LayoutChangeEvent, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
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
  fieldPressableProps: PressableProps;
  fieldPressableRef: React.RefObject<View | null>;
  fieldWrapperRef: React.RefObject<View | null>;
  onFieldWrapperLayout: () => void;
  dropdownPosition: { top: number; left: number; width: number; height: number } | null;
  onDismiss: () => void;
  inputRef: React.RefObject<TextInput | null>;
  inputProps: TextInputProps;
  iconButtonProps: {
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

/** Height of the field for positioning calculations. */
export const FIELD_HEIGHT = 40;
/** Delay before blur closes dropdown, giving option presses time to register. */
const BLUR_DELAY_MS = 150;
/** Grace period after open to ignore blur from autoFocus race. */
const JUST_OPENED_MS = 100;

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
  const fieldPressableRef = React.useRef<View | null>(null);
  const fieldWrapperRef = React.useRef<View | null>(null);
  const [dropdownPosition, setDropdownPosition] = React.useState<
    { top: number; left: number; width: number; height: number } | null
  >(null);
  const optionLayoutsRef = React.useRef<{ y: number; height: number }[]>([]);
  // Track when the select just opened so we can ignore the initial blur caused by
  // autoFocus mounting the portal input (focus/blur churn that would otherwise close the list).
  const justOpenedRef = React.useRef(false);
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
    // Mark that we just opened so blur handler ignores the initial focus/blur churn.
    justOpenedRef.current = true;
    setTimeout(() => {
      justOpenedRef.current = false;
    }, JUST_OPENED_MS);
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

  const measureDropdownAnchor = React.useCallback(() => {
    const node = fieldWrapperRef.current;
    if (!node || !node.measureInWindow) {
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      setDropdownPosition({
        left: x,
        width,
        height,
        top: y + height + Size.space['100'],
      });
    });
  }, []);

  const handleInputBlur = React.useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    blurTimeoutRef.current = setTimeout(() => {
      // If an option press is in progress, or we've only just opened the field, ignore this blur:
      // - isOptionPressingRef: prevents closing when the input blurs before the option press completes.
      // - justOpenedRef: guards against initial focus/autoFocus churn right after opening.
      if (isOptionPressingRef.current || justOpenedRef.current) {
        return;
      }
      setIsFocused(false);
      closeSelect();
    }, BLUR_DELAY_MS);
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
      // Web only: return keyboard focus to the field after closing the dropdown.
      if (Platform.OS === 'web') {
        requestAnimationFrame(() => {
          (fieldPressableRef.current as unknown as HTMLElement | null)?.focus?.();
        });
      }
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
  const webOptionProps = Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : null;

  // Shared keyboard handler for navigation keys.
  const createKeyDownHandler = (allowOpenOnEnterSpace: boolean) =>
    Platform.OS === 'web'
      ? {
          onKeyDown: (event: { key: string; preventDefault?: () => void; stopPropagation?: () => void }) => {
            const { key } = event;
            if (allowOpenOnEnterSpace && !isOpen && (key === 'Enter' || key === ' ')) {
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
        }
      : null;

  const webKeyDownHandlers = createKeyDownHandler(true);
  const webInputKeyDownHandler = createKeyDownHandler(false);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    // Measure after opening so the portal dropdown can align to the field.
    const frame = requestAnimationFrame(() => {
      measureDropdownAnchor();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, measureDropdownAnchor]);

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

  const inputAccessibilityLabel = label ?? placeholder ?? 'Select field';
  const inputAccessibilityHint = allowSearch
    ? 'Type to filter options.'
    : 'Use arrow keys to navigate options.';

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
    fieldPressableRef,
    fieldPressableProps: {
      ...fieldPressableBase,
      onPress: isOpen
        ? () => {
            setIsFocused(true);
            if (allowSearch && !isDisabled) {
              inputRef.current?.focus();
            }
          }
        : toggleSelect,
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false),
    },
    fieldWrapperRef,
    onFieldWrapperLayout: measureDropdownAnchor,
    dropdownPosition,
    onDismiss: closeSelect,
    inputRef,
    inputProps: allowSearch
      ? {
          accessibilityLabel: inputAccessibilityLabel,
          accessibilityHint: inputAccessibilityHint,
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
          ...webInputKeyDownHandler,
        }
      : {
          // Hidden input for keyboard capture in non-searchable mode
          accessibilityLabel: inputAccessibilityLabel,
          accessibilityHint: inputAccessibilityHint,
          value: '',
          autoFocus: true,
          editable: true,
          style: { position: 'absolute', opacity: 0, height: 1, width: 1 } as any,
          onKeyPress: (event) => handleKeyPress(event.nativeEvent.key, visibleOptions),
          onBlur: handleInputBlur,
          ...webInputKeyDownHandler,
        },
    iconButtonProps: {
      accessibilityLabel: isOpen ? 'Close select' : 'Open select',
      accessibilityRole: 'none',
      disabled: isDisabled,
      icon: iconNode,
      onPress: isOpen ? closeSelect : toggleSelect,
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
