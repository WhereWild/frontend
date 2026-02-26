/**
 * Species detail parser utilities.
 *
 * Responsibility: map raw species detail API payloads into the full
 * `SpeciesApiDetail` contract (aliases, defaults, and metadata fields). This
 * module delegates overview section parsing to `speciesOverviewParser`.
 */
import { parseOverviewSectionsFromDetailSource } from './speciesOverviewParser';
import type { SpeciesApiDetail, SpeciesApiNormalized } from './types';

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' ? (value as JsonRecord) : {};

const toOptionalString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const toFirstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = toOptionalString(value);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
};

const DESCRIPTION_PENDING = 'description pending';

export const parseSpeciesApiDetail = (
  payload: unknown,
  normalized: SpeciesApiNormalized,
): SpeciesApiDetail => {
  const source = asRecord(payload);
  const description = toFirstString(source.description) ?? DESCRIPTION_PENDING;

  return {
    ...normalized,
    description,
    description_sections: parseOverviewSectionsFromDetailSource(source, description),
    image_license: toFirstString(source.image_license, source.imageLicense),
    image_creator: toFirstString(source.image_creator, source.imageCreator),
    image_rights_holder: toFirstString(source.image_rights_holder, source.imageRightsHolder),
    image_references: toFirstString(source.image_references, source.imageReferences),
    taxonomyPath: toFirstString(source.taxonomy_path, source.taxonomyPath),
  };
};
