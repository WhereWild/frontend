// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// "Save" for a native GeoJSON file in /gis-editor — the vector counterpart
// of tiffMetadataWriter.ts. GeoJSON properties are plain JSON with no
// format-imposed width/type constraints, so this is nothing more than
// adding WW_MODE/WW_FIELD/WW_COLOR keys to each feature's `properties`
// object and re-serializing. shapefileMetadata.ts's readSavedConfig() is
// what reads them back on reopen.

import { serializeOverviewLevels, type OverviewLevel } from './douglasPeucker';
import type { GeoJsonFeatureCollection } from './shapefileMetadata';
import type { VectorEditableMeta } from './vectorEditableMeta';

const WW_MODE_FIELD = 'WW_MODE';
const WW_COLOR_FIELD = 'WW_COLOR';
const WW_FIELD_FIELD = 'WW_FIELD';
const WW_NAME_FIELD = 'WW_NAME';

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
  // Set on every feature like the rest of the WW_* fields (so the first
  // feature's is representative on reopen), and removed rather than left
  // stale when the user clears it -- the properties spread below would
  // otherwise carry a previous save's name straight through.
  const displayName = editable.displayName.trim();
  const withName = (properties: Record<string, unknown>) => {
    if (displayName) properties[WW_NAME_FIELD] = displayName;
    else delete properties[WW_NAME_FIELD];
    return properties;
  };
  if (editable.mode === 'single') {
    return features.map((f) => ({
      properties: withName({
        ...f.properties,
        [WW_MODE_FIELD]: 'single',
        [WW_COLOR_FIELD]: editable.color,
      }),
    }));
  }
  const colorByValue = new Map(editable.classes.map((c) => [c.value, c.color]));
  return features.map((f) => {
    const raw = editable.field != null ? f.properties?.[editable.field] : null;
    const color = raw != null ? colorByValue.get(String(raw)) : undefined;
    return {
      properties: withName({
        ...f.properties,
        [WW_MODE_FIELD]: 'categorical',
        [WW_FIELD_FIELD]: editable.field,
        [WW_COLOR_FIELD]: color ?? '#888888',
      }),
    };
  });
};

/**
 * `overviewLevels`, when given, is the Douglas-Peucker pyramid the preview
 * already built for this exact file this session (see
 * vectorTileRenderer.ts) — embedding it lets a later re-open of this saved
 * file (see shapefileMetadata.ts's cachedOverviewLevels) skip rebuilding it
 * from scratch. Omit it (e.g. a caller that never previewed the file,
 * hypothetically) and the saved file just has no cache to find, same as
 * any file this tool didn't produce.
 */
export const buildStyledGeoJson = (
  geojson: GeoJsonFeatureCollection,
  editable: VectorEditableMeta,
  overviewLevels?: OverviewLevel[],
): Blob => {
  const styledProperties = applyStylingToProperties(geojson.features, editable);
  const features = geojson.features.map((f, i) => ({
    ...f,
    properties: styledProperties[i].properties,
  }));
  const styled: GeoJsonFeatureCollection = {
    ...geojson,
    features,
    wwOverviewPyramid: overviewLevels
      ? serializeOverviewLevels(overviewLevels)
      : geojson.wwOverviewPyramid,
  };
  return new Blob([JSON.stringify(styled)], { type: 'application/geo+json' });
};
