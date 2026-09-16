// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// "Save" for a native GeoJSON file in /gis-editor — the vector counterpart
// of tiffMetadataWriter.ts. GeoJSON properties are plain JSON with no
// format-imposed width/type constraints, so this is nothing more than
// adding WW_MODE/WW_FIELD/WW_COLOR keys to each feature's `properties`
// object and re-serializing. shapefileMetadata.ts's readSavedConfig() is
// what reads them back on reopen.

import type { GeoJsonFeatureCollection } from './shapefileMetadata';
import type { VectorEditableMeta } from './vectorEditableMeta';

const WW_MODE_FIELD = 'WW_MODE';
const WW_COLOR_FIELD = 'WW_COLOR';
const WW_FIELD_FIELD = 'WW_FIELD';

/**
 * Adds this tool's WW_* styling fields to every feature's properties —
 * WW_COLOR is per-feature (each feature's own class color in categorical
 * mode, or the same flat color for every feature in single mode), so a
 * reader that only understands "there's a color field" — even one that
 * doesn't know what WW_MODE/WW_FIELD mean — still gets a usable per-row
 * color.
 */
export const applyStylingToProperties = (
  features: { properties: Record<string, unknown> | null }[],
  editable: VectorEditableMeta,
): { properties: Record<string, unknown> }[] => {
  if (editable.mode === 'single') {
    return features.map((f) => ({
      properties: {
        ...f.properties,
        [WW_MODE_FIELD]: 'single',
        [WW_COLOR_FIELD]: editable.color,
      },
    }));
  }
  const colorByValue = new Map(editable.classes.map((c) => [c.value, c.color]));
  return features.map((f) => {
    const raw = editable.field != null ? f.properties?.[editable.field] : null;
    const color = raw != null ? colorByValue.get(String(raw)) : undefined;
    return {
      properties: {
        ...f.properties,
        [WW_MODE_FIELD]: 'categorical',
        [WW_FIELD_FIELD]: editable.field,
        [WW_COLOR_FIELD]: color ?? '#888888',
      },
    };
  });
};

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
