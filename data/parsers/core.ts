// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Plain JSON-like object record used by parser helpers. */
export type JsonRecord = Record<string, unknown>;

/** Coerces unknown input into a non-array record object. */
export const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};

/** Returns array input as-is, otherwise an empty array. */
export const getArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Returns a string value or null when input is not a string. */
export const toOptionalString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;