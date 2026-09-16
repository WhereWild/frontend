// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Parses a dropped .geojson/.json file and derives the metadata the
// editor's UI needs — the vector counterpart of rasterMetadata.ts. GeoJSON
// (RFC 7946) fixes its coordinate reference system at WGS84 by spec, so
// there's no reprojection math here at all.

import {
  countVertices,
  deserializeOverviewLevels,
  type OverviewLevel,
} from './douglasPeucker';

export type VectorFieldType = 'string' | 'number' | 'boolean' | 'other';
export type VectorField = {
  name: string;
  type: VectorFieldType;
  /** False for a numeric field with too many distinct values to be a
   * realistic category (a per-feature ID or measurement — OBJECTID,
   * Shape_Leng/Shape_Area on a real downloaded EPA ecoregion shapefile
   * are exactly this) — used to keep the "color by" field picker from
   * being cluttered with columns nobody would actually want to color by.
   * Always true for string/boolean fields: unlike a float measurement, a
   * text column being wide or numerous-valued doesn't mean it isn't
   * meant as a label (e.g. a 125-char concatenated "key" field is still a
   * legitimate, if ugly, category). */
  likelyCategorical: boolean;
};

/** Above this many distinct values, a *numeric* field reads as an ID or
 * measurement rather than a category — matches
 * vectorEditableMeta.ts's own MAX_CATEGORICAL_CLASSES ceiling for the same
 * reason (a real raster/vector legend with this many rows isn't useful
 * either way). */
const CATEGORICAL_MAX_DISTINCT = 64;

export type VectorSavedConfig = {
  mode: 'single' | 'categorical';
  color: string | null;
  field: string | null;
  classes: { value: string; name: string; color: string }[];
};

export type VectorMetadata = {
  featureCount: number;
  /** Read off the first feature; null for an empty (0-feature) file. A
   * GeoJSON FeatureCollection isn't required to be single-geometry-type the
   * way a shapefile is, but every file this tool has actually seen is. */
  geometryType: string | null;
  vertexCount: number;
  fields: VectorField[];
  bbox: [number, number, number, number] | null;
  crsLabel: string;
  /** This tool's own previously-saved styling, round-tripped through
   * WW_MODE/WW_COLOR/WW_FIELD properties — see geoJsonWriter.ts. */
  savedConfig: VectorSavedConfig | null;
  /** A Douglas-Peucker overview pyramid this tool already built and saved
   * alongside the file last time (see douglasPeucker.ts's
   * serializeOverviewLevels()/deserializeOverviewLevels() and
   * geoJsonWriter.ts) — null if this file was never saved by this tool, or
   * the cache didn't validate (wrong version/target/tolerance steps),
   * either way meaning the caller has to build it fresh. */
  cachedOverviewLevels: OverviewLevel[] | null;
};

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: string; coordinates: unknown } | null;
    properties: Record<string, unknown> | null;
  }[];
  /** See VectorMetadata.cachedOverviewLevels's doc comment — an opaque
   * value only douglasPeucker.ts's own serialize/deserialize functions
   * interpret. */
  wwOverviewPyramid?: unknown;
};

const WW_MODE_FIELD = 'WW_MODE';
const WW_COLOR_FIELD = 'WW_COLOR';
const WW_FIELD_FIELD = 'WW_FIELD';

const fieldTypeOf = (value: unknown): VectorFieldType => {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'string';
  return 'other';
};

const isVectorSavedConfig = (v: unknown): v is VectorSavedConfig =>
  !!v &&
  typeof v === 'object' &&
  ((v as VectorSavedConfig).mode === 'single' ||
    (v as VectorSavedConfig).mode === 'categorical');

/** Reads this tool's own previously-saved styling back out of the parsed
 * properties — every feature carries the same WW_* values (see
 * geoJsonWriter.ts), so the first feature's is representative. Malformed
 * or foreign WW_* fields (some other tool's data that happens to collide)
 * fall back to null rather than throwing, same policy as
 * rasterMetadata.ts's readWherewildConfig(). */
const readSavedConfig = (
  fc: GeoJsonFeatureCollection,
): VectorSavedConfig | null => {
  const props = fc.features[0]?.properties;
  const mode = props?.[WW_MODE_FIELD];
  if (mode !== 'single' && mode !== 'categorical') return null;
  if (mode === 'single') {
    const color = props?.[WW_COLOR_FIELD];
    return typeof color === 'string'
      ? { mode: 'single', color, field: null, classes: [] }
      : null;
  }
  const field = props?.[WW_FIELD_FIELD];
  if (typeof field !== 'string') return null;
  const classes = new Map<string, string>();
  for (const f of fc.features) {
    const value = f.properties?.[field];
    const color = f.properties?.[WW_COLOR_FIELD];
    if (value != null && typeof color === 'string') {
      classes.set(String(value), color);
    }
  }
  const parsed: VectorSavedConfig = {
    mode: 'categorical',
    color: null,
    field,
    classes: [...classes.entries()].map(([value, color]) => ({
      value,
      name: value,
      color,
    })),
  };
  return isVectorSavedConfig(parsed) ? parsed : null;
};

const boundingBoxOf = (
  fc: GeoJsonFeatureCollection,
): [number, number, number, number] | null => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (coords: unknown[]): void => {
    if (typeof coords[0] === 'number') {
      const [x, y] = coords as [number, number];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    for (const c of coords) visit(c as unknown[]);
  };
  for (const f of fc.features) {
    if (f.geometry) visit(f.geometry.coordinates as unknown[]);
  }
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
};

const deriveVectorMetadata = (
  geojson: GeoJsonFeatureCollection,
  crsLabel: string,
): VectorMetadata => {
  const fieldMap = new Map<string, VectorFieldType>();
  const distinctValues = new Map<string, Set<string>>();
  for (const f of geojson.features) {
    for (const [key, value] of Object.entries(f.properties ?? {})) {
      if (
        key === WW_MODE_FIELD ||
        key === WW_COLOR_FIELD ||
        key === WW_FIELD_FIELD
      ) {
        continue;
      }
      if (!fieldMap.has(key)) fieldMap.set(key, fieldTypeOf(value));
      // Only tracked to distinguish "definitely too many to be a
      // category" from "not sure yet" — capped so a genuinely huge
      // dataset doesn't pay to fully count every numeric column's
      // cardinality just to confirm what's already obvious past this point.
      let seen = distinctValues.get(key);
      if (!seen) {
        seen = new Set();
        distinctValues.set(key, seen);
      }
      if (seen.size <= CATEGORICAL_MAX_DISTINCT) seen.add(String(value));
    }
  }

  const featureCount = geojson.features.length;
  return {
    featureCount,
    geometryType: geojson.features[0]?.geometry?.type ?? null,
    vertexCount: countVertices(geojson),
    fields: [...fieldMap.entries()].map(([name, type]) => {
      const distinctCount = distinctValues.get(name)?.size ?? 0;
      return {
        name,
        type,
        // A numeric field only reads as a category if it both stays under
        // the flat cap AND isn't just a per-row unique ID/measurement —
        // OBJECTID and Shape_Leng/Shape_Area on a real EPA shapefile have
        // distinctCount == featureCount (every row unique), which the flat
        // cap alone wouldn't catch on a small file (e.g. 37 rows, well
        // under 64).
        likelyCategorical:
          type !== 'number' ||
          (distinctCount <= CATEGORICAL_MAX_DISTINCT &&
            distinctCount < featureCount),
      };
    }),
    bbox: boundingBoxOf(geojson),
    crsLabel,
    savedConfig: readSavedConfig(geojson),
    cachedOverviewLevels: deserializeOverviewLevels(
      geojson.wwOverviewPyramid,
      geojson,
    ),
  };
};

const isGeoJsonFeatureCollection = (
  value: unknown,
): value is GeoJsonFeatureCollection =>
  !!value &&
  typeof value === 'object' &&
  (value as { type?: unknown }).type === 'FeatureCollection' &&
  Array.isArray((value as { features?: unknown }).features);

/**
 * Parses a plain .geojson/.json file — just JSON.parse. GeoJSON (RFC 7946)
 * fixes its coordinate reference system at WGS84 by spec, so there's no CRS
 * to read and no reprojection to do; a source that used some other CRS
 * anyway (a pre-RFC-7946 file with an explicit "crs" member) isn't detected
 * here — its coordinates are taken at face value, same as every other
 * GeoJSON consumer that doesn't special-case that legacy member.
 */
export const inspectGeoJson = async (
  blob: Blob,
): Promise<{ geojson: GeoJsonFeatureCollection; metadata: VectorMetadata }> => {
  const text = await blob.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  if (!isGeoJsonFeatureCollection(parsed)) {
    throw new Error(
      'That JSON file isn’t a GeoJSON FeatureCollection (expected a top-level `{"type": "FeatureCollection", "features": [...]}`).',
    );
  }
  const metadata = deriveVectorMetadata(parsed, 'WGS84 (GeoJSON standard)');
  return { geojson: parsed, metadata };
};
