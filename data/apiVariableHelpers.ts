import { parseEnvironmentVariableDefinitions } from './environmentParsers';
import { BACKEND_BASE, fetchJsonOrThrow } from './apiShared';

export type FetchEnvironmentVariablesOptions = {
  units?: string | null;
  signal?: AbortSignal;
};

/**
 * Fetches and normalizes environment variable definitions.
 */
export async function fetchEnvironmentVariables(
  options?: FetchEnvironmentVariablesOptions,
) {
  const params = new URLSearchParams();
  if (options?.units) params.set('unit_system', options.units);
  const url = `${BACKEND_BASE}/variables${params.toString() ? `?${params.toString()}` : ''}`;
  const requestOptions = options?.signal
    ? { signal: options.signal }
    : undefined;
  const payload = await fetchJsonOrThrow(
    url,
    'Failed to fetch variables',
    requestOptions,
  );
  return parseEnvironmentVariableDefinitions(payload);
}
