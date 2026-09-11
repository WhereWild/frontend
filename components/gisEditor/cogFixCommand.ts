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

import type { RasterMetadata } from './rasterMetadata';

export const buildCogFixCommand = (
  fileName: string,
  metadata: RasterMetadata,
): string => {
  const outName = fileName.replace(/\.tiff?$/i, '') + '_cog.tif';
  const args = [
    'gdal_translate',
    fileName,
    outName,
    '-of COG',
    '-co COMPRESS=DEFLATE',
    // Categorical rasters aren't previewable in this tool yet (see
    // rasterMetadata.ts), so every file that reaches this panel is
    // continuous — AVERAGE is the right default resampling for that.
    // Swap to NEAREST or MODE for land-cover/classification-style data.
    '-co RESAMPLING=AVERAGE',
  ];
  if (metadata.noData == null) {
    args.push('# consider -a_nodata <value> if this raster should have one');
  }
  return args.join(' ');
};
