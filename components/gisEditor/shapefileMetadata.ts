// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Parses a shapefile in the browser via `shpjs` (require()d at call time so
// it never loads during SSR and rides the /gis-editor route chunk) and
// derives the metadata the editor's UI needs — the vector counterpart of
// rasterMetadata.ts.
//
// shpjs itself reprojects into WGS84 lat/lon using the .prj file (when
// present) before we ever see the GeoJSON, so unlike the raster side there
// is no reprojection math here at all — every bbox/geometry value below is
// already plain WGS84 degrees.

import { countVertices } from './douglasPeucker';

export type VectorFieldType = 'string' | 'number' | 'boolean' | 'other';
export type VectorField = { name: string; type: VectorFieldType };

export type VectorSavedConfig = {
  mode: 'single' | 'categorical';
  color: string | null;
  field: string | null;
  classes: { value: string; name: string; color: string }[];
};

export type VectorMetadata = {
  featureCount: number;
  /** The shape type declared by the .shp header — shapefiles are
   * single-geometry-type by format spec, so this is read off the first
   * feature; null for an empty (0-feature) file. */
  geometryType: string | null;
  vertexCount: number;
  fields: VectorField[];
  bbox: [number, number, number, number] | null;
  crsLabel: string;
  /** shpjs returns an array when the dropped zip contains more than one
   * shapefile — we only ever preview the first, and surface this so the
   * UI can say so instead of silently discarding the rest. */
  additionalLayersInZip: number;
  /** This tool's own previously-saved styling, round-tripped through a
   * WW_MODE/WW_COLOR/WW_FIELD DBF field set — see shapefileWriter.ts. */
  savedConfig: VectorSavedConfig | null;
};

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: string; coordinates: unknown } | null;
    properties: Record<string, unknown> | null;
  }[];
};

export type ShapefileInputFiles = {
  shp: Blob;
  dbf?: Blob | null;
  prj?: Blob | null;
  cpg?: Blob | null;
};

type ShpJsModule = {
  (
    buffer: ArrayBuffer,
  ): Promise<
    | (GeoJsonFeatureCollection & { fileName?: string })
    | GeoJsonFeatureCollection[]
  >;
  (input: {
    shp: ArrayBuffer;
    dbf?: ArrayBuffer;
    prj?: ArrayBuffer;
    cpg?: ArrayBuffer;
  }): Promise<GeoJsonFeatureCollection & { fileName?: string }>;
};

const loadShp = (): ShpJsModule =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('shpjs');

/** Recognizes the shapefile-bundle extensions this tool accepts alongside
 * the required .shp — used by GisEditorScreen to group a multi-file drop. */
export const SHAPEFILE_COMPONENT_EXTENSIONS = [
  '.shp',
  '.dbf',
  '.prj',
  '.cpg',
] as const;

const WW_MODE_FIELD = 'WW_MODE';
const WW_COLOR_FIELD = 'WW_COLOR';
const WW_FIELD_FIELD = 'WW_FIELD';

/** Best-effort EPSG extraction from an ESRI WKT .prj — most real-world .prj
 * files end with an AUTHORITY["EPSG","<code>"] clause on the geographic or
 * projected CRS node; falls back to a generic label when absent (older or
 * hand-written .prj files often omit it entirely — that's not this tool's
 * bug to fix, just something to be honest about in the UI). */
const crsLabelFromPrj = (wkt: string): string => {
  const matches = [...wkt.matchAll(/AUTHORITY\["EPSG","(\d+)"\]/g)];
  if (matches.length > 0) {
    const epsg = matches[matches.length - 1][1];
    return `EPSG:${epsg} (reprojected to WGS84 for preview)`;
  }
  const nameMatch = /^(?:GEOGCS|PROJCS)\["([^"]+)"/.exec(wkt.trim());
  if (nameMatch) return `${nameMatch[1]} (reprojected to WGS84 for preview)`;
  return 'Unknown source CRS (reprojected to WGS84 for preview)';
};

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
 * shapefileWriter.ts), so the first feature's is representative. Malformed
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

/**
 * Parses a shapefile from either a single Blob (a .zip bundling the .shp
 * and its siblings, or a bare .shp with no attributes/CRS) or an explicit
 * {shp, dbf, prj, cpg} set (a multi-file drag-and-drop) into GeoJSON plus
 * this tool's derived metadata.
 */
export const inspectShapefile = async (
  input: Blob | ShapefileInputFiles,
): Promise<{ geojson: GeoJsonFeatureCollection; metadata: VectorMetadata }> => {
  const shp = loadShp();
  let result: GeoJsonFeatureCollection | GeoJsonFeatureCollection[];
  let crsLabel = 'Unknown source CRS (reprojected to WGS84 for preview)';

  if (input instanceof Blob) {
    result = await shp(await input.arrayBuffer());
  } else {
    const object: {
      shp: ArrayBuffer;
      dbf?: ArrayBuffer;
      prj?: ArrayBuffer;
      cpg?: ArrayBuffer;
    } = { shp: await input.shp.arrayBuffer() };
    if (input.dbf) object.dbf = await input.dbf.arrayBuffer();
    if (input.prj) {
      const prjBuffer = await input.prj.arrayBuffer();
      object.prj = prjBuffer;
      crsLabel = crsLabelFromPrj(new TextDecoder().decode(prjBuffer));
    }
    if (input.cpg) object.cpg = await input.cpg.arrayBuffer();
    result = await shp(object);
  }

  const layers = Array.isArray(result) ? result : [result];
  const geojson = layers[0] ?? { type: 'FeatureCollection', features: [] };

  const fieldMap = new Map<string, VectorFieldType>();
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
    }
  }

  const metadata: VectorMetadata = {
    featureCount: geojson.features.length,
    geometryType: geojson.features[0]?.geometry?.type ?? null,
    vertexCount: countVertices(geojson),
    fields: [...fieldMap.entries()].map(([name, type]) => ({ name, type })),
    bbox: boundingBoxOf(geojson),
    crsLabel,
    additionalLayersInZip: Math.max(0, layers.length - 1),
    savedConfig: readSavedConfig(geojson),
  };

  return { geojson, metadata };
};
