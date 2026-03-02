import { asRecord, toOptionalString, type JsonRecord } from './parsers/core';

const ENV_BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

/** Base URL for backend API requests. */
export const BACKEND_BASE = ENV_BACKEND_BASE || 'http://localhost:8000';

/** Shared JSON object shape used by parser helpers. */
export type { JsonRecord };
/** Shared parser helpers re-exported for API helper modules. */
export { asRecord, toOptionalString };

/**
 * Parses a taxon identifier from unknown input.
 */
export const parseNumericTaxonId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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

const readErrorText = async (response: Response) => response.text().catch(() => '');

/**
 * Fetches JSON or throws a labeled error with HTTP details.
 */
export const fetchJsonOrThrow = async (
  url: string,
  failureLabel: string,
): Promise<unknown> => {
  const response = await fetch(url);
  if (!response.ok) {
    const txt = await readErrorText(response);
    throw new Error(`${failureLabel}: ${response.status} ${txt}`);
  }

  return response.json();
};