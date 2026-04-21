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

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

const toOptionalStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => toOptionalString(entry))
    .filter((entry): entry is string => entry !== null);
  return normalized;
};

const toOptionalRecord = (
  value: unknown,
): Record<string, unknown> | undefined => {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : undefined;
};

const hasRecordEntries = (value: Record<string, unknown>) =>
  Object.keys(value).length > 0;

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
  const classicHeatmapSource = asRecord(heatmapSource?.classic);
  const inferenceHeatmapSource = asRecord(
    heatmapSource?.inference ?? heatmapSource?.inferenceHeatmap,
  );

  return {
    ...normalized,
    description,
    description_sections: parseOverviewSectionsFromDetailSource(source, description),
    image_license: toFirstString(source.image_license, source.imageLicense),
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
          ...(hasRecordEntries(classicHeatmapSource)
            ? {
                classic: {
                  available: toOptionalBoolean(classicHeatmapSource.available),
                  requested_model_id: toFirstString(
                    classicHeatmapSource.requested_model_id,
                    classicHeatmapSource.requestedModelId,
                  ),
                  resolved_model_id: toFirstString(
                    classicHeatmapSource.resolved_model_id,
                    classicHeatmapSource.resolvedModelId,
                  ),
                  model_dir: toFirstString(
                    classicHeatmapSource.model_dir,
                    classicHeatmapSource.modelDir,
                  ),
                  taxon_id: toFirstString(classicHeatmapSource.taxon_id),
                  feature_columns: toOptionalStringArray(
                    classicHeatmapSource.feature_columns ??
                      classicHeatmapSource.featureColumns,
                  ),
                  summary: toOptionalRecord(classicHeatmapSource.summary),
                  metrics: toOptionalRecord(classicHeatmapSource.metrics),
                  phenology_available: toOptionalBoolean(
                    classicHeatmapSource.phenology_available ??
                      classicHeatmapSource.phenologyAvailable,
                  ),
                  full_available: toOptionalBoolean(
                    classicHeatmapSource.full_available ??
                      classicHeatmapSource.fullAvailable,
                  ),
                  tile_url: toFirstString(
                    classicHeatmapSource.tile_url,
                    classicHeatmapSource.tileUrl,
                  ),
                },
              }
            : {}),
          ...(hasRecordEntries(inferenceHeatmapSource)
            ? {
                inference: {
                  available: toOptionalBoolean(inferenceHeatmapSource.available),
                  species_key: toOptionalNumber(
                    inferenceHeatmapSource.species_key ??
                      inferenceHeatmapSource.speciesKey,
                  ),
                  native_resolution: toOptionalNumber(
                    inferenceHeatmapSource.native_resolution ??
                      inferenceHeatmapSource.nativeResolution,
                  ),
                  tile_url: toFirstString(
                    inferenceHeatmapSource.tile_url,
                    inferenceHeatmapSource.tileUrl,
                  ),
                },
              }
            : {}),
        }
      : null,
  };
};
