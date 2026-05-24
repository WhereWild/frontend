import { BACKEND_BASE, fetchJsonOrThrow } from './apiShared';

export type PhenologyOption = { value: string; label: string };

export async function fetchPhenologyValues(): Promise<PhenologyOption[]> {
  const payload = await fetchJsonOrThrow(
    `${BACKEND_BASE}/phenology_values`,
    'Failed to fetch phenology values',
  );
  return Array.isArray(payload) ? (payload as PhenologyOption[]) : [];
}
