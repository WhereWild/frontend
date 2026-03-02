import { parseEnvironmentVariableDefinitions } from './environmentParsers';
import { BACKEND_BASE, fetchJsonOrThrow } from './apiShared';

/**
 * Fetches and normalizes environment variable definitions.
 */
export async function fetchEnvironmentVariables(options?: { units?: string | null }) {
  const params = new URLSearchParams();
  if (options?.units) params.set('unit_system', options.units);
  const url = `${BACKEND_BASE}/variables${params.toString() ? `?${params.toString()}` : ''}`;
  const payload = await fetchJsonOrThrow(url, 'Failed to fetch variables');
  return parseEnvironmentVariableDefinitions(payload);
}