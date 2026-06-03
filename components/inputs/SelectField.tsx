// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { SelectFieldView } from './SelectFieldView';
import { useSelectFieldController } from './useSelectFieldController';

/**
 * A single SelectField option.
 *
 * - `label`: text shown in the dropdown.
 * - `value`: controlled value emitted via `onValueChange`.
 *
 * When `allowSearch` is enabled, matching is stripping diacritics, trimming and lowercasing.
 */
export type SelectOption = {
  label: string;
  value: string;
};

export type SelectFieldVariant = 'secondary' | 'tertiary';

/**
 * Props for `SelectField`.
 *
 * `SelectField` is a controlled component: pass `value` and update it in `onValueChange`.
 * Use an empty string (`''`) to represent no selection.
 *
 * Search behavior:
 * - Enabled by default (`allowSearch: true`).
 * - Normalizes option `label` at runtime for filtering.
 *
 * Defaults:
 * - `placeholder`: "Select an option"
 * - `disabled`: `false`
 * - `allowSearch`: `true`
 * - `options`: `[]`
 * - `variant`: `'secondary'`
 */
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
  variant?: SelectFieldVariant;
};

export function SelectField(props: SelectFieldProps) {
  const viewProps = useSelectFieldController(props);
  return <SelectFieldView {...viewProps} />;
}
