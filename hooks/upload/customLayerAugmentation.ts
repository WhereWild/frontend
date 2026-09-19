// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type * as DocumentPicker from 'expo-document-picker';
import {
  sampleCustomLayer,
  type CustomLayerDescriptor,
  type ObservationPoint,
} from '@/components/upload/customLayers';

// Mirrors wherewild's util/upload.py _LAT_ALIASES/_LON_ALIASES (normalized
// form) closely enough to find the same coordinate columns a real upload
// already recognizes -- this only needs to locate them to sample each
// custom layer's value per row, not to normalize/rename anything itself
// (the backend still does that on the augmented file exactly as before).
const LAT_ALIASES = [
  'decimallatitude',
  'latitude',
  'lat',
  'latdd',
  'latitudedd',
  'y',
];
const LON_ALIASES = [
  'decimallongitude',
  'longitude',
  'lon',
  'lng',
  'long',
  'londd',
  'longitudedd',
  'x',
];

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Quote-aware single-line field splitter -- deliberately simpler than a
// full RFC 4180 parser: rows are split on plain newlines (no support for a
// quoted field containing an embedded newline), which is fine for the
// tabular lat/lon/measurement data this upload path actually sees.
const splitDelimitedLine = (line: string, delimiter: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current);
  return fields;
};

export type CustomLayerAugmentationResult = {
  augmentedText: string;
  descriptors: CustomLayerDescriptor[];
  /** The asset each usable descriptor was actually sampled from, keyed by
   * descriptor.id — lets a caller keep the raw file around (see
   * useUploadWorkflow.ts) for local point-value/tile rendering later in
   * the same session, without re-deriving the id from the filename (which
   * would work today since both use customLayerIdFromFilename, but ties
   * two unrelated call sites to staying in sync for no reason). */
  assetsById: Map<string, DocumentPicker.DocumentPickerAsset>;
};

/** Samples every attached custom layer at each row's (lat, lon) entirely
 * client-side and appends one new column per usable layer to `text` --
 * this backend never receives the raw raster/vector file, only these
 * already-sampled values plus a small JSON description of what each
 * column means (see util.upload.parse_custom_layer_metadata). Returns
 * `text` unchanged (with no descriptors) when there's nothing to sample,
 * no recognizable coordinate columns, or every attached layer turns out
 * to have no usable metadata (already surfaced separately as a warning --
 * see findCustomLayersMissingMetadata). CSV/TSV only; Parquet raw uploads
 * don't go through this path in this phase. */
export const augmentRawTextWithCustomLayers = async (
  text: string,
  delimiter: ',' | '\t',
  customLayers: DocumentPicker.DocumentPickerAsset[],
): Promise<CustomLayerAugmentationResult> => {
  if (customLayers.length === 0) {
    return { augmentedText: text, descriptors: [], assetsById: new Map() };
  }

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmptyLines = lines.filter(
    (line, index) => index === 0 || line.length > 0,
  );
  const [headerLine, ...rowLines] = nonEmptyLines;
  if (!headerLine) {
    return { augmentedText: text, descriptors: [], assetsById: new Map() };
  }

  const headers = splitDelimitedLine(headerLine, delimiter).map(
    normalizeHeader,
  );
  const latIndex = headers.findIndex((h) => LAT_ALIASES.includes(h));
  const lonIndex = headers.findIndex((h) => LON_ALIASES.includes(h));
  if (latIndex === -1 || lonIndex === -1) {
    return { augmentedText: text, descriptors: [], assetsById: new Map() };
  }

  const points: ObservationPoint[] = rowLines.map((line) => {
    const fields = splitDelimitedLine(line, delimiter);
    return { lat: Number(fields[latIndex]), lon: Number(fields[lonIndex]) };
  });

  const descriptors: CustomLayerDescriptor[] = [];
  const newColumns: (number | null)[][] = [];
  const assetsById = new Map<string, DocumentPicker.DocumentPickerAsset>();
  for (const asset of customLayers) {
    // Sequential, not Promise.all: each layer's own sampling is already
    // sequential per-point (see customLayers.ts) -- no benefit to racing
    // multiple layers' decoders against each other, only added memory
    // pressure from several open GeoTIFF readers at once.

    const result = await sampleCustomLayer(asset, points);
    if (!result) continue;
    descriptors.push(result.descriptor);
    newColumns.push(result.values);
    assetsById.set(result.descriptor.id, asset);
  }

  if (descriptors.length === 0) {
    return { augmentedText: text, descriptors: [], assetsById: new Map() };
  }

  const newHeaderLine = [headerLine, ...descriptors.map((d) => d.id)].join(
    delimiter,
  );
  const newRowLines = rowLines.map((line, rowIndex) => {
    const extras = newColumns.map((column) => {
      const value = column[rowIndex];
      return value === null || value === undefined ? '' : String(value);
    });
    return [line, ...extras].join(delimiter);
  });

  return {
    augmentedText: [newHeaderLine, ...newRowLines].join('\n'),
    descriptors,
    assetsById,
  };
};
