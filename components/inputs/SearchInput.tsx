import React from 'react';
import { TextInputProps, ViewStyle, TextStyle } from 'react-native';
import { SearchInputView } from './SearchInputView';
import { useSearchInputController } from './useSearchInputController';
import {
  handleClearValue,
  submitSearchValue,
  resolveIconButtonInteractionStyles,
  createContainerHandlers,
} from './searchInputHelpers';

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

/**
 * Public SearchInput component: wires consumer props into the controller hook + view.
 */
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
  // Delegate state + event wiring to the controller so this component stays a thin facade.
  const viewProps = useSearchInputController({
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
  });

  return <SearchInputView {...viewProps} />;
};

export const __SEARCH_INPUT_TESTING__ = {
  // Expose lower-level helpers so tests can validate edge-case behaviors without rendering the component.
  handleClearValue,
  submitSearchValue,
  resolveIconButtonInteractionStyles,
  createContainerHandlers,
};