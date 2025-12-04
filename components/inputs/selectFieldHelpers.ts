import { useState, useRef, useCallback, useEffect } from 'react';
import { Dimensions, type View } from 'react-native';
import { Colors } from '@/constants/theme';

export type Palette = typeof Colors.light;

export type SelectFieldState = {
  disabled: boolean;
  errorMessage?: string;
  isOpen: boolean;
};

// Builds the semantic colors used by SelectField surfaces/text.
export const getSelectFieldColors = (
  palette: Palette,
  { disabled, errorMessage, isOpen }: SelectFieldState,
) => {
  const borderColor = isOpen
    ? palette.border.brand.default
    : 'transparent';

  const backgroundColor = disabled
    ? palette.background.disabled.default
    : errorMessage ? palette.background.danger.default : palette.background.default.secondary;

  const textColor = errorMessage
    ? palette.text.danger.onDanger
    : disabled ? palette.text.disabled.onDisabled : palette.text.default.default;

  return {
    borderColor,
    backgroundColor,
    textColor,
    placeholderColor: errorMessage ? palette.text.danger.onDangerSecondary : palette.text.disabled.default,
    iconColor: disabled ? palette.icon.disabled.onDisabled : palette.icon.default.default,
    labelColor: disabled ? palette.text.disabled.default : palette.text.default.default,
    descriptionColor: disabled ? palette.text.disabled.default : palette.text.default.secondary,
    dropdownBackgroundColor: palette.background.default.tertiary,
    dropdownBorderColor: palette.border.default.tertiary,
    optionSelectedBackground: palette.background.default.secondary,
    optionPressedBackground: palette.background.default.tertiaryPressed,
    optionHoverBackground: palette.background.default.tertiaryHover,
    optionTextColor: palette.text.default.default,
    optionCheckColor: palette.icon.brand.default,
    errorTextColor: palette.text.danger.default,
  } as const;
};

export type SelectFieldColors = ReturnType<typeof getSelectFieldColors>;

// Resolves the background color for each option row based on interaction state.
export const getOptionRowBackground = (
  colors: SelectFieldColors,
  {
    selected,
    disabled,
    pressed,
    hovered,
  }: { selected: boolean; disabled: boolean; pressed: boolean; hovered: boolean },
) => {
  if (selected) {
    return colors.optionSelectedBackground;
  }
  if (pressed && !disabled) {
    return colors.optionPressedBackground;
  }
  if (hovered && !disabled) {
    return colors.optionHoverBackground;
  }
  return 'transparent';
};

export type DropdownPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Encapsulates dropdown open/close state plus the trigger measurement logic.
export const useSelectDropdown = (disabled: boolean) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<View>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | undefined>(undefined);

  // Read the trigger rect so the portal can position itself via absolute coords.
  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    const node = triggerRef.current;
    const measure = node.measureInWindow?.bind(node);

    if (typeof measure === 'function') {
      let resolved = false;
      measure((x, y, width, height) => {
        resolved = true;
        setDropdownPosition({ x, y, width, height });
      });

      setTimeout(() => {
        if (!resolved) {
          setDropdownPosition((current) => current ?? { x: 0, y: 0, width: 0, height: 0 });
        }
      }, 0);
      return;
    }

    // Fallback for environments (like tests) where measureInWindow is unavailable.
    setDropdownPosition({ x: 0, y: 0, width: 0, height: 0 });
  }, []);

  // Toggle the dropdown; measuring before opening keeps the overlay aligned.
  const toggleDropdown = useCallback(() => {
    if (disabled) {
      return;
    }
    setIsOpen((prev) => {
      if (!prev) {
        updateDropdownPosition();
        return true;
      }
      return false;
    });
  }, [disabled, updateDropdownPosition]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleFieldLayout = useCallback(() => {
    if (isOpen) {
      updateDropdownPosition();
    }
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  // Re-measure when the viewport changes (rotation/split-screen) to keep alignment.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const subscription = Dimensions.addEventListener('change', updateDropdownPosition);
    return () => {
      subscription.remove();
    };
  }, [isOpen, updateDropdownPosition]);

  return {
    isOpen,
    toggleDropdown,
    closeDropdown,
    triggerRef,
    dropdownPosition,
    handleFieldLayout,
    updateDropdownPosition,
  } as const;
};
