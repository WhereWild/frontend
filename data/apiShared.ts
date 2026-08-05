// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import Constants from 'expo-constants';
import { asRecord, toOptionalString, type JsonRecord } from './parsers/core';

const runtimeBackendBase = Constants.expoConfig?.extra?.backendUrl;

/** Base URL for backend API requests. */
export const BACKEND_BASE = runtimeBackendBase || 'http://localhost:8000';

/** Shared JSON object shape used by parser helpers. */
export type { JsonRecord };
/** Shared parser helpers re-exported for API helper modules. */
export { asRecord, toOptionalString };

/**
 * Parses a taxon identifier from unknown input.
 *
 * Taxon IDs are opaque strings (COL XR taxon keys, e.g. "6SRLS") — not
 * necessarily numeric — so this only validates presence, it never coerces
 * through Number(). A previous numeric-only version silently dropped every
 * alphanumeric ID.
 */
export const parseTaxonId = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
};

/** Returns a string fallback when the source value is not a string. */
export const toRequiredString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

/** Returns a finite numeric fallback when the source value is not numeric. */
export const toRequiredNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readErrorText = async (response: Response) =>
  response.text().catch(() => '');

/**
 * Fetches JSON or throws a labeled error with HTTP details.
 */
export const fetchJsonOrThrow = async (
  url: string,
  failureLabel: string,
  requestInit?: RequestInit,
): Promise<unknown> => {
  const response = requestInit
    ? await fetch(url, requestInit)
    : await fetch(url);
  if (!response.ok) {
    const txt = await readErrorText(response);
    throw new Error(`${failureLabel}: ${response.status} ${txt}`);
  }

  return response.json();
};

export const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError';
