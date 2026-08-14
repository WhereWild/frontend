// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The measurement types (levels of measurement) a catalog variable's
 * `value_type` can be — same vocabulary used by the /guides/variables/types
 * reference pages. */
export const VARIABLE_TYPES = [
  { key: 'nominal', label: 'Nominal' },
  { key: 'ordinal', label: 'Ordinal' },
  { key: 'interval', label: 'Interval' },
  { key: 'ratio', label: 'Ratio' },
  { key: 'circular', label: 'Circular' },
] as const;

export type VariableTypeKey = (typeof VARIABLE_TYPES)[number]['key'];

export const isVariableTypeKey = (value: string): value is VariableTypeKey =>
  VARIABLE_TYPES.some((type) => type.key === value);
