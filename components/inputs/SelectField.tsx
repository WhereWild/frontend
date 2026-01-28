import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { SelectFieldView } from './SelectFieldView';
import { useSelectFieldController } from './useSelectFieldController';

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

export function SelectField(props: SelectFieldProps) {
  const viewProps = useSelectFieldController(props);
  return <SelectFieldView {...viewProps} />;
}
