import type { SpeciesApiNormalized } from './types';
import { normalizeCommonNames } from './commonNames';
import {
  BACKEND_BASE,
  asRecord,
  fetchJsonOrThrow,
  parseNumericTaxonId,
} from './apiShared';

/**
 * Normalize a backend species item into the `SpeciesApiNormalized` shape,
 * ensuring `image_source` is a full URL to the static image (suitable for RN <Image>)
 * and normalizing name fields like `scientific_name`, `common_name`, and `common_names`.
 */
export function normalizeToJsonShape(item: unknown): SpeciesApiNormalized {
  const source = asRecord(item);
  const normalizedTaxonId = parseNumericTaxonId(source.taxon_id);
  const directImageSource =
    (typeof source.image_source === 'string' ? source.image_source : null) ??
    (typeof source.imageSource === 'string' ? source.imageSource : null);
  const imageUrlFromBackend =
    (typeof source.image_url === 'string' ? source.image_url : null) ??
    (typeof source.imageUrl === 'string' ? source.imageUrl : null);
  const imageFile =
    (typeof source.image_file === 'string' ? source.image_file : null) ??
    (typeof source.image_file_name === 'string'
      ? source.image_file_name
      : null);
  const imageFileName = imageFile
    ? (imageFile
        .replace(/^images\//, '')
        .split(/[\\/]/)
        .filter(Boolean)
        .pop() ?? '')
    : '';
  const imageUrl =
    directImageSource ??
    imageUrlFromBackend ??
    (imageFile
      ? `${BACKEND_BASE}/static/species_images/${encodeURIComponent(imageFileName)}`
      : null);
  const sciName =
    typeof source.scientific_name === 'string'
      ? source.scientific_name.trim()
      : '';

  const commonNames = normalizeCommonNames(
    source.common_names ?? source.commonNames,
  );

  const rawCommon =
    source.common_name ?? source.commonName ?? commonNames[0] ?? null;

  const commonName =
    typeof rawCommon === 'string' && rawCommon.trim().length > 0
      ? rawCommon.trim()
      : sciName;
  const taxonGroup =
    typeof source.taxon_group === 'string' ? source.taxon_group : null;
  return {
    taxon_id: normalizedTaxonId,
    scientific_name: sciName,
    common_name: commonName,
    common_names: commonNames,
    image_source: imageUrl,
    taxon_group: taxonGroup,
    _raw: item,
  };
}
