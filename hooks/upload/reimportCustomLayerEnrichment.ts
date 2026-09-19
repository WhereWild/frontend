// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Lets a custom layer be added in "Extra options" even when starting from a
// re-imported ("stage 2") ZIP, not just a fresh raw upload. A layer already
// present in the re-imported data just gets wired up for local point-value/
// tile rendering (see customLayerLocalRenderer.ts) with no re-processing --
// its values are already there. A genuinely new layer needs the exact same
// treatment a stage-1 upload gives one: sampled against every occurrence,
// then run back through the real backend pipeline so its stats get computed
// the same way any other layer's would.
//
// The key fact that makes this possible without reimplementing the
// backend's statistics engine client-side: build_archive's _package_archive
// writes the FULL, unbinned per-occurrence DataFrame straight to
// occurrence.parquet (see util/upload.py) -- so a re-imported bundle's raw
// occurrence rows are exactly the raw-upload-shaped input a fresh raw
// upload would have started from, still available to feed back into that
// same pipeline. What's deliberately NOT carried through is any real
// catalog variable's column (bio_1, salinity, ...): the normal upload
// pipeline always re-samples every one of those fresh from the actual
// rasters (enrich_with_gis) regardless of what's in the file, and
// pre-populating one is flatly rejected (see util.upload.
// check_reserved_columns) since it would just be overwritten anyway.
// Existing *custom* layers get no such automatic re-sampling (the backend
// has no raster of its own to resample them from), so their columns are
// carried through explicitly, with a descriptor reconstructed from their
// own already-known metadata -- no original file needed for a preserved
// layer, only for the newly attached one(s).

import type * as DocumentPicker from 'expo-document-picker';
import type { EnvironmentVariableDefinition } from '@/data/types';
import type { UploadFileValue } from '@/data/api';
import type {
  RawOccurrenceRow,
  UploadedDescriptionImage,
} from '@/data/uploadLocalSpeciesDataSource';
import {
  customLayerIdFromFilename,
  CUSTOM_LAYER_VARIABLE_CATEGORY,
  type CustomLayerDescriptor,
} from '@/components/upload/customLayers';

const REIMPORT_BASE_COLUMNS = [
  'catalogNumber',
  'decimalLatitude',
  'decimalLongitude',
  'observationName',
  'imageUrl',
] as const;

const CUSTOM_LAYER_VALUE_TYPES = new Set<CustomLayerDescriptor['valueType']>([
  'ratio',
  'interval',
  'nominal',
  'ordinal',
]);

const isCustomLayerValueType = (
  value: string | null | undefined,
): value is CustomLayerDescriptor['valueType'] =>
  CUSTOM_LAYER_VALUE_TYPES.has(value as CustomLayerDescriptor['valueType']);

// Same escaping splitDelimitedLine (customLayerAugmentation.ts) expects to
// be able to parse back: quote a field that contains a comma, quote, or
// newline, doubling any embedded quotes.
const escapeCsvField = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

/** Every existing custom-layer variable in a re-imported bundle, reconstructed
 * as a CustomLayerDescriptor from its own already-round-tripped metadata --
 * no original file needed. Real catalog variables are never included here
 * (see this module's own doc comment on why they're dropped instead). */
export const findExistingCustomLayerDescriptors = (
  variableDefinitions: EnvironmentVariableDefinition[],
): CustomLayerDescriptor[] =>
  variableDefinitions
    .filter((def) => def.category === CUSTOM_LAYER_VARIABLE_CATEGORY)
    .filter((def) => isCustomLayerValueType(def.valueType))
    .map((def) => ({
      id: def.id,
      name: def.name ?? def.id,
      valueType: def.valueType as CustomLayerDescriptor['valueType'],
      units: def.units ?? null,
      legendClasses:
        def.legendClasses?.map((cls) => ({
          id: Number(cls.id),
          name: cls.name,
          color: cls.color ?? null,
        })) ?? null,
    }));

export type CustomLayerReimportPlan = {
  /** Which of the caller's attached files (`Extra options`' customLayers)
   * are already present in the re-imported data (by slugged filename id),
   * needing no re-processing at all -- just wiring into customLayerAssets. */
  alreadyPresent: DocumentPicker.DocumentPickerAsset[];
  /** Attached files with no matching variable in the re-imported data --
   * these need the full stage-1-equivalent treatment. */
  newLayers: DocumentPicker.DocumentPickerAsset[];
};

/** Splits attached custom-layer files into "already in this dataset" vs
 * "genuinely new", by comparing each file's slugged id (same convention
 * every custom layer id already uses) against the re-imported bundle's own
 * existing custom-layer variables. */
export const planCustomLayerReimport = (
  customLayers: DocumentPicker.DocumentPickerAsset[],
  existingCustomLayerIds: ReadonlySet<string>,
): CustomLayerReimportPlan => {
  const alreadyPresent: DocumentPicker.DocumentPickerAsset[] = [];
  const newLayers: DocumentPicker.DocumentPickerAsset[] = [];
  for (const asset of customLayers) {
    if (existingCustomLayerIds.has(customLayerIdFromFilename(asset.name))) {
      alreadyPresent.push(asset);
    } else {
      newLayers.push(asset);
    }
  }
  return { alreadyPresent, newLayers };
};

/** Builds the raw-upload-shaped CSV a re-imported bundle's own occurrence
 * rows can drive back through the normal upload pipeline: identity/location
 * columns plus one column per existing custom-layer variable being
 * preserved (its raw per-occurrence value, unchanged -- no re-sampling
 * needed). augmentRawTextWithCustomLayers (customLayerAugmentation.ts) then
 * appends the genuinely new layer(s) on top of this, exactly like it does
 * for a fresh stage-1 upload. */
export const buildReimportRawCsv = (
  occurrences: RawOccurrenceRow[],
  preservedDescriptors: CustomLayerDescriptor[],
): string => {
  const columns: string[] = [
    ...REIMPORT_BASE_COLUMNS,
    ...preservedDescriptors.map((d) => d.id),
  ];
  const header = columns.join(',');
  const rows = occurrences.map((row) =>
    columns.map((col) => escapeCsvField(row[col])).join(','),
  );
  return [header, ...rows].join('\n');
};

export type ReimportExtras = {
  generateDescription: boolean;
  image: UploadFileValue | undefined;
  imageFilename: string | undefined;
  imageUrl: string | undefined;
  parentTaxonId: string | undefined;
};

/** What a Step 2 re-upload sends for the description/image/parent-taxon
 * "extras": whatever the re-imported ZIP already carried, with anything set
 * in Extra options taking precedence. Without this a re-upload would
 * silently drop them -- the backend rebuilds the archive from scratch, and
 * has nothing of its own to remember them by. A description is regenerated
 * (not copied) since it's derived from the stats, which now include the new
 * layer(s). */
export const resolveReimportExtras = (
  existing: UploadedDescriptionImage | undefined,
  chosen: {
    generateDescription?: boolean;
    image?: UploadFileValue;
    imageFilename?: string;
    imageUrl?: string;
    parentTaxonId?: string;
  },
): ReimportExtras => {
  const hasChosenImage = chosen.image !== undefined;
  const carriedImage = !hasChosenImage ? existing?.imageBlob : null;
  return {
    generateDescription:
      chosen.generateDescription === true ||
      (existing?.descriptionSections?.length ?? 0) > 0,
    image: hasChosenImage ? chosen.image : (carriedImage ?? undefined),
    imageFilename: hasChosenImage
      ? chosen.imageFilename
      : carriedImage
        ? (existing?.imageFilename ?? undefined)
        : undefined,
    // The ZIP's own imageUrl for an embedded image is a local object URL,
    // never something to send -- only a genuinely remote one is.
    imageUrl:
      chosen.imageUrl ??
      (hasChosenImage || existing?.imageBlob
        ? undefined
        : (existing?.imageUrl ?? undefined)),
    parentTaxonId: chosen.parentTaxonId ?? existing?.parentTaxonId ?? undefined,
  };
};
