// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// "Save" for a native GeoJSON file in /gis-editor — the vector counterpart
// of tiffMetadataWriter.ts (raster) and shapefileWriter.ts (shapefile
// bundle). Unlike a shapefile's fixed-width .dbf, GeoJSON properties are
// plain JSON with no format-imposed width/type constraints, so this is
// nothing more than adding WW_MODE/WW_FIELD/WW_COLOR keys to each
// feature's `properties` object and re-serializing — no byte-level
// surgery, no field-width bookkeeping, no separate geometry file to leave
// untouched (there's only the one file). shapefileMetadata.ts's
// readSavedConfig() is what reads them back on reopen — the exact same
// reader either format goes through, since both end up as the same
// GeoJsonFeatureCollection shape internally.

import { applyStylingToProperties } from './shapefileWriter';
import type { GeoJsonFeatureCollection } from './shapefileMetadata';
import type { VectorEditableMeta } from './vectorEditableMeta';

export const buildStyledGeoJson = (
  geojson: GeoJsonFeatureCollection,
  editable: VectorEditableMeta,
): Blob => {
  const styledProperties = applyStylingToProperties(geojson.features, editable);
  const features = geojson.features.map((f, i) => ({
    ...f,
    properties: styledProperties[i].properties,
  }));
  const styled: GeoJsonFeatureCollection = { ...geojson, features };
  return new Blob([JSON.stringify(styled)], { type: 'application/geo+json' });
};
