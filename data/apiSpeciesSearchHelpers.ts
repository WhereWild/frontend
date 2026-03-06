import type { SpeciesApiNormalized } from './types';
import { normalizeCommonNames } from './commonNames';
import { BACKEND_BASE, asRecord, fetchJsonOrThrow, parseNumericTaxonId } from './apiShared';

/** Filter parameters for the species list / search endpoint. */
export type SearchFilterParams = {
  /** Most-specific location GID (county > state > country). */
  locationGid?: string | null;
  /** Ancestor taxon ID to restrict results to a clade. */
  ancestorTaxonId?: number | null;
  /** Restrict to a specific taxonomic rank (e.g. 'species', 'genus'). */
  rank?: string | null;
  /** Whether to include subspecies when rank is 'species'. */
  includeSubspecies?: boolean | null;
  /** Environment variable to sort by. */
  sortVariable?: string | null;
  /** Aggregation metric to sort by (e.g. 'mean', 'median'). */
  sortMetric?: string | null;
  /** Sort direction. */
  sortOrder?: 'asc' | 'desc' | null;
  /** Minimum number of observations required (inclusive). */
  minimumSamples?: number | null;
  /** Maximum number of results to return. Overrides the limit argument when set. */
  numberOfResults?: number | null;
};

/**
 * Normalize a backend species item into the `SpeciesApiNormalized` shape,
 * ensuring `image_source` is a full URL to the static image (suitable for RN <Image>)
 * and normalizing name fields like `scientific_name`, `common_name`, and `common_names`.
 */
export function normalizeToJsonShape(item: unknown): SpeciesApiNormalized {
  const source = asRecord(item);
  const normalizedTaxonId = parseNumericTaxonId(source.taxon_id);
  const imageUrlFromBackend =
    (typeof source.image_url === 'string' ? source.image_url : null) ??
    (typeof source.imageUrl === 'string' ? source.imageUrl : null);
  const imageFile =
    (typeof source.image_file === 'string' ? source.image_file : null) ??
    (typeof source.image_file_name === 'string' ? source.image_file_name : null);
  const imageFileName = imageFile
    ? imageFile
      .replace(/^images\//, '')
      .split(/[\\/]/)
      .filter(Boolean)
      .pop() ?? ''
    : '';
  const imageUrl = imageUrlFromBackend ?? (imageFile
    ? `${BACKEND_BASE}/static/species_images/${encodeURIComponent(imageFileName)}`
    : null);
  const sciName = typeof source.scientific_name === 'string' ? source.scientific_name.trim() : '';

  const commonNames = normalizeCommonNames(source.common_names ?? source.commonNames);

  const rawCommon = source.common_name ?? source.commonName ?? commonNames[0] ?? null;

  const commonName =
    typeof rawCommon === 'string' && rawCommon.trim().length > 0
      ? rawCommon.trim()
      : sciName;
  return {
    taxon_id: normalizedTaxonId,
    scientific_name: sciName,
    common_name: commonName,
    common_names: commonNames,
    image_source: imageUrl,
    _raw: item,
  };
}

/**
 * Fetches species rows from the backend search/list endpoint.
 *
 * `filters.numberOfResults` takes precedence over the `limit` argument when set.
 */
export async function fetchSpeciesList(
  limit?: number,
  q?: string,
  filters?: SearchFilterParams,
): Promise<SpeciesApiNormalized[]> {
  const effectiveLimit = filters?.numberOfResults ?? limit;
  const params = new URLSearchParams();
  if (effectiveLimit) params.set('limit', String(effectiveLimit));
  if (q) params.set('q', q);
  if (filters?.locationGid) params.set('location', filters.locationGid);
  if (filters?.ancestorTaxonId != null) params.set('ancestor_taxon_id', String(filters.ancestorTaxonId));
  if (filters?.rank) params.set('rank', filters.rank);
  if (filters?.includeSubspecies != null) params.set('include_subspecies', String(filters.includeSubspecies));
  if (filters?.sortVariable) params.set('variable', filters.sortVariable);
  if (filters?.sortMetric) params.set('metric', filters.sortMetric);
  if (filters?.sortOrder) params.set('order', filters.sortOrder);
  if (filters?.minimumSamples != null && filters.minimumSamples > 1) {
    params.set('min_samples', String(filters.minimumSamples));
  }

  const url = `${BACKEND_BASE}/api/species${params.toString() ? `?${params.toString()}` : ''}`;

  const data = await fetchJsonOrThrow(url, 'Failed to fetch species list');
  const rows = Array.isArray(data) ? data : [];
  return rows.map((it) => normalizeToJsonShape(it));
}