import Constants from 'expo-constants';
import { asRecord, toOptionalString, type JsonRecord } from './parsers/core';

const runtimeBackendBase = Constants.expoConfig?.extra?.backendUrl;

/** Base URL for backend API requests. */
export const BACKEND_BASE = runtimeBackendBase || 'http://localhost:8000';

let _cachedVersion: string | null = null;

// Fetch version eagerly at module load so it's ready by the time species pages load.
fetch(`${BACKEND_BASE}/version`)
  .then((r) => r.json())
  .then((data: unknown) => {
    const v = (data as Record<string, unknown>)?.version;
    if (typeof v === 'string' && v) _cachedVersion = v;
  })
  .catch(() => {});

/**
 * Appends ?v={crawl_version} to a URL for Cloudflare cache-busting.
 * No-ops if the version hasn't been fetched yet or is unavailable.
 */
export const withVersion = (url: string): string => {
  if (!_cachedVersion) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(_cachedVersion)}`;
};

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
