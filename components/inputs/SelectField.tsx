import React from 'react';
import { IconCheck, IconChevronDown } from '@/assets/icons';
import { Colors, Shadows, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '../text/ThemedText';
import {
  getOptionRowBackground,
  getSelectFieldColors,
  useSelectDropdown,
  type DropdownPosition,
  type SelectFieldColors,
} from './selectFieldHelpers';

export type SelectFieldOption<Value extends string | number = string> = {
  label: string;
  value: Value;
  disabled?: boolean;
};

export type SelectFieldProps<Value extends string | number = string> = {
  /** Visual label displayed above the field. */
  label?: string;
  /** Supplementary helper text rendered under the label. */
  description?: string;
  /** Error message rendered beneath the field + error border styling. */
  errorMessage?: string;
  /** Placeholder text rendered when no option is selected. */
  placeholder?: string;
  /** Currently selected option value when used as a controlled component. */
  value?: Value;
  /** Initial value when the component manages its own selection state. */
  defaultValue?: Value;
  /** Disable the trigger + option list. */
  disabled?: boolean;
  /** Available options to display inside the list. */
  options: SelectFieldOption<Value>[];
  /** Fired whenever a new option is chosen. */
  onValueChange?: (value: Value) => void;
  /** Optional test identifier applied to the field trigger. */
  testID?: string;
  /** Optional base identifier applied to option rows for deterministic tests. */
  optionTestIDPrefix?: string;
};

export function SelectField<Value extends string | number = string>({
  label,
  description,
  errorMessage,
  placeholder = 'Select an option',
  value,
  defaultValue,
  disabled = false,
  options,
  onValueChange,
  testID = 'select-field-trigger',
  optionTestIDPrefix = 'select-field-option',
}: SelectFieldProps<Value>) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState<Value | undefined>(defaultValue);
  const {
    isOpen,
    toggleDropdown,
    closeDropdown,
    triggerRef,
    dropdownPosition,
    handleFieldLayout,
    updateDropdownPosition,
  } = useSelectDropdown(disabled);

  const selectedValue = isControlled ? value : internalValue;
  const selectedOption = options.find((option) => option.value === selectedValue);
  const showPlaceholder = !selectedOption;

  const colors = React.useMemo(
    () => getSelectFieldColors(palette, { disabled, errorMessage, isOpen }),
    [palette, disabled, errorMessage, isOpen],
  );

  const {
    borderColor,
    backgroundColor,
    textColor,
    placeholderColor,
    iconColor,
    labelColor,
    descriptionColor,
    dropdownBackgroundColor,
    dropdownBorderColor,
    optionTextColor,
    optionCheckColor,
    errorTextColor,
  } = colors;

  const handleSelect = (nextValue: Value) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    if (nextValue !== selectedValue) {
      onValueChange?.(nextValue);
    }

    closeDropdown();
  };

  return (
    <View style={[styles.root, isOpen && styles.rootActive]}>
      {label ? (
        <ThemedText
          variant="bodyStrong"
          style={{ color: labelColor }}
        >
          {label}
        </ThemedText>
      ) : null}

      {description ? (
        <ThemedText
          style={[styles.descriptionText, { color: descriptionColor }]}
        >
          {description}
        </ThemedText>
      ) : null}

      <View style={[styles.fieldWrapper, isOpen && styles.fieldWrapperActive]}>
        <Pressable
          ref={triggerRef}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label ?? placeholder}
          accessibilityState={{
            disabled,
            expanded: isOpen,
          }}
          accessibilityHint={disabled ? undefined : 'Opens a menu with additional options'}
          onPress={toggleDropdown}
          disabled={disabled}
          onLayout={handleFieldLayout}
          style={({ pressed }) => [
            styles.field,
            {
              borderColor,
              backgroundColor: pressed && !disabled
                ? palette.background.default.hover
                : backgroundColor,
            },
          ]}
        >
          <ThemedText
            variant="singleLineBody"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.triggerText, { color: showPlaceholder ? placeholderColor : textColor }]}
          >
            {showPlaceholder ? placeholder : selectedOption?.label}
          </ThemedText>
          <IconChevronDown
            color={iconColor}
            style={isOpen ? styles.chevronOpen : undefined}
          />
        </Pressable>

        <SelectDropdown
          isOpen={isOpen}
          colors={colors}
          options={options}
          selectedValue={selectedValue}
          disabled={disabled}
          optionTestIDPrefix={optionTestIDPrefix}
          dropdownPosition={dropdownPosition}
          closeList={closeDropdown}
          updateDropdownPosition={updateDropdownPosition}
          dropdownBackgroundColor={dropdownBackgroundColor}
          dropdownBorderColor={dropdownBorderColor}
          optionTextColor={optionTextColor}
          optionCheckColor={optionCheckColor}
          onSelect={handleSelect}
        />
      </View>

      {errorMessage ? (
        <ThemedText style={[styles.errorText, { color: errorTextColor }]}>
          {errorMessage}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: Size.space['200'],
    // Ensures dropdown trigger is wide enough for typical label text.
    minWidth: Size.space['4000'],
    position: 'relative',
  },
  descriptionText: {},
  triggerText: {
    flex: 1,
  },
  rootActive: {
    zIndex: 20,
    elevation: 20,
  },
  fieldWrapper: {
    position: 'relative',
    width: '100%',
    zIndex: 0,
  },
  fieldWrapperActive: {
    zIndex: 100,
    elevation: 6,
  },
  field: {
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['200'],
    paddingVertical: Size.space['300'],
    paddingHorizontal: Size.space['400'],
    minHeight: Size.space['800'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['300'],
  },
  dropdownSurface: {
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['200'],
    maxHeight: Size.space['8000'],
    paddingVertical: Size.space['200'],
    paddingHorizontal: Size.space['200'],
    position: 'absolute',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  optionRow: {
    borderRadius: Size.radius['200'],
    paddingVertical: Size.space['200'],
    paddingHorizontal: Size.space['200'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  optionLabelText: {
    flex: 1,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  errorText: {},
});

type SelectDropdownProps<Value extends string | number = string> = {
  isOpen: boolean;
  colors: SelectFieldColors;
  options: SelectFieldOption<Value>[];
  selectedValue?: Value;
  disabled: boolean;
  optionTestIDPrefix: string;
  dropdownPosition?: DropdownPosition;
  closeList: () => void;
  updateDropdownPosition: () => void;
  dropdownBackgroundColor: string;
  dropdownBorderColor: string;
  optionTextColor: string;
  optionCheckColor: string;
  onSelect: (value: Value) => void;
};

function SelectDropdown<Value extends string | number = string>({
  isOpen,
  colors,
  options,
  selectedValue,
  disabled,
  optionTestIDPrefix,
  dropdownPosition,
  closeList,
  updateDropdownPosition,
  dropdownBackgroundColor,
  dropdownBorderColor,
  optionTextColor,
  optionCheckColor,
  onSelect,
}: SelectDropdownProps<Value>) {
  if (!isOpen || !dropdownPosition) {
    return null;
  }

  return (
    <Modal
      transparent
      animationType="none"
      visible
      onRequestClose={closeList}
    >
      <Pressable
        style={styles.overlay}
        onPress={closeList}
        onLayout={updateDropdownPosition}
      >
        <View
          style={[
            styles.dropdownSurface,
            {
              backgroundColor: dropdownBackgroundColor,
              borderColor: dropdownBorderColor,
              top: dropdownPosition.y + dropdownPosition.height + Size.space['200'],
              left: dropdownPosition.x,
              width: dropdownPosition.width || undefined,
            },
            Shadows.dropShadow300.style,
          ]}
          testID="select-field-dropdown"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {options.map((option, index) => {
              const optionSelected = option.value === selectedValue;
              const optionDisabled = disabled || Boolean(option.disabled);
              return (
                <Pressable
                  key={String(option.value)}
                  testID={`${optionTestIDPrefix}-${index}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: optionSelected, disabled: optionDisabled }}
                  disabled={optionDisabled}
                  onPress={() => onSelect(option.value)}
                  style={({ pressed, hovered }) => [
                    styles.optionRow,
                    {
                      backgroundColor: getOptionRowBackground(colors, {
                        selected: optionSelected,
                        disabled: optionDisabled,
                        pressed,
                        hovered,
                      }),
                      opacity: optionDisabled ? 0.5 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    variant="body"
                    style={[styles.optionLabelText, { color: optionTextColor }]}
                  >
                    {option.label}
                  </ThemedText>
                  {optionSelected ? (
                    <IconCheck color={optionCheckColor} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}
