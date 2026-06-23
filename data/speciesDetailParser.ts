// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Species detail parser utilities.
 *
 * Responsibility: map raw species detail API payloads into the full
 * `SpeciesApiDetail` contract (aliases, defaults, and metadata fields). This
 * module delegates overview section parsing to `speciesOverviewParser`.
 */
import { parseOverviewSectionsFromDetailSource } from './speciesOverviewParser';
import type { SpeciesApiDetail, SpeciesApiNormalized } from './types';
import { asRecord, toOptionalString } from './parsers/core';

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

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
};

/**
 * Parses and normalizes a species detail payload for UI consumption.
 */
export const parseSpeciesApiDetail = (
  payload: unknown,
  normalized: SpeciesApiNormalized,
): SpeciesApiDetail => {
  const source = asRecord(payload);
  const description = toFirstString(source.description) ?? DESCRIPTION_PENDING;
  const heatmapSource = asRecord(source.heatmap);

  return {
    ...normalized,
    description,
    description_sections: parseOverviewSectionsFromDetailSource(source, description),
    image_license: toFirstString(source.image_license, source.imageLicense),
    image_license_url: toFirstString(source.image_license_url, source.imageLicenseUrl),
    image_creator: toFirstString(source.image_creator, source.imageCreator),
    image_rights_holder: toFirstString(source.image_rights_holder, source.imageRightsHolder),
    image_references: toFirstString(source.image_references, source.imageReferences),
    taxonomyPath: toFirstString(source.taxonomy_path, source.taxonomyPath),
    heatmap: heatmapSource
      ? {
          available: toOptionalBoolean(heatmapSource.available),
          resolved_model_id: toFirstString(
            heatmapSource.resolved_model_id,
            heatmapSource.resolvedModelId,
          ),
            phenology_available: toOptionalBoolean(
              heatmapSource.phenology_available ?? heatmapSource.phenologyAvailable,
            ),
            full_available: toOptionalBoolean(
              heatmapSource.full_available ?? heatmapSource.fullAvailable,
            ),
        }
      : null,
  };
};
