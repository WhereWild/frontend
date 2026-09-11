// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds a copy-pasteable `gdal_translate` command that turns a raster into
// a valid Cloud-Optimized GeoTIFF, for the "how to fix this" panel shown
// when a dropped file fails the COG checklist. Building this in the browser
// isn't feasible without restrictions (see the /gis-editor overview-building
// spike) — GDAL's own filesystem in gdal3.js writes its output through an
// in-memory filesystem, so the result has to fit in the WASM heap (a few GB
// at most) regardless of how the pixels are processed. Pointing at desktop
// GDAL, which has no such ceiling, is the practical fix.

import type { DetectedValueType } from './dataTypeDetection';
import type { RasterMetadata } from './rasterMetadata';

// Averaging (the right choice for continuous data) corrupts anything whose
// pixel values are codes rather than measurements: it blends class IDs into
// numbers that don't correspond to any class, and it blends angles the wrong
// way (359° and 1° average to 180°, not 0°). Overview resampling has to match
// the data, so the suggested command picks it from the detected type instead
// of always defaulting to AVERAGE.
const resamplingFor = (
  detectedType: DetectedValueType | null,
): { method: string; note: string } => {
  if (!detectedType) {
    return {
      method: 'AVERAGE',
      note: "# couldn't guess a data type from this file — if it's categorical (class codes, land cover, ...) use RESAMPLING=MODE instead, or RESAMPLING=NEAREST for angles/bearings",
    };
  }
  switch (detectedType.guess) {
    case 'nominal':
    case 'ordinal':
      return {
        method: 'MODE',
        note: `# detected as ${detectedType.guess} (${detectedType.confidence} confidence) — using MODE instead of AVERAGE so overview pixels stay valid class values`,
      };
    case 'circular':
      return {
        method: 'NEAREST',
        note: `# detected as circular (${detectedType.confidence} confidence) — averaging angles directly is wrong (e.g. 359° and 1° average to 180°, not 0°), so NEAREST is used instead`,
      };
    default:
      return {
        method: 'AVERAGE',
        note:
          detectedType.confidence === 'low'
            ? `# low-confidence guess (${detectedType.guess}) — double-check AVERAGE is right before running this; use MODE/NEAREST instead if this data is actually categorical or circular`
            : `# detected as ${detectedType.guess} (${detectedType.confidence} confidence) — AVERAGE is appropriate for continuous data`,
      };
  }
};

export const buildCogFixCommand = (
  fileName: string,
  metadata: RasterMetadata,
  detectedType: DetectedValueType | null = null,
): string => {
  const outName = fileName.replace(/\.tiff?$/i, '') + '_cog.tif';
  const { method, note } = resamplingFor(detectedType);
  const args = [
    'gdal_translate',
    fileName,
    outName,
    '-of COG',
    '-co COMPRESS=DEFLATE',
    `-co RESAMPLING=${method}`,
    note,
  ];
  if (metadata.noData == null) {
    args.push('# consider -a_nodata <value> if this raster should have one');
  }
  return args.join(' ');
};
