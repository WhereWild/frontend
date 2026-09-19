// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Answers "which styled class is this lon/lat in" for a categorical GeoJSON
// layer, for sampling many observation points against it at once (see
// components/upload/customLayers.ts's sampleVector) -- the same job the
// backend does for GADM with a spatial-index join (util/upload.py's
// enrich_with_gadm): reject by bounding box first, and only run the exact
// point-in-polygon test on the few polygons a point could actually be in.
//
// Two things make the exact test cheap enough to run for thousands of points
// against a nationwide layer:
//   - one bounding box per polygon *part*, not per feature: an ecoregion is
//     a MultiPolygon whose whole-feature box covers most of a state, so a
//     per-feature box rejects almost nothing;
//   - rings stored as flat Float64Arrays instead of nested [lon, lat] pair
//     arrays -- far less memory and no per-vertex destructuring in the hot
//     loop.
//
// Deliberately separate from vectorTileRenderer.ts's feature index: that one
// exists to draw and click-test tiles at several simplification levels and
// needs lines/points too; this only ever needs full-detail polygons, and
// building it never touches the (expensive) simplification pyramid.

import type { GeoJsonFeatureCollection } from './shapefileMetadata';

type FlatPolygon = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** First ring is the exterior, the rest are holes; each is [x0, y0, x1, y1, ...]. */
  rings: Float64Array[];
};

type SamplerFeature = { classId: number; polygons: FlatPolygon[] };

export type VectorPointSampler = {
  /** The class id of the first feature (in file order) containing the
   * point, or null when it's inside none. */
  sample: (lat: number, lon: number) => number | null;
};

const flattenRing = (ring: [number, number][]): Float64Array => {
  const out = new Float64Array(ring.length * 2);
  for (let i = 0; i < ring.length; i += 1) {
    out[i * 2] = ring[i][0];
    out[i * 2 + 1] = ring[i][1];
  }
  return out;
};

const flattenPolygon = (rings: [number, number][][]): FlatPolygon | null => {
  if (rings.length === 0 || rings[0].length === 0) return null;
  const flat = rings.map(flattenRing);
  const exterior = flat[0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < exterior.length; i += 2) {
    const x = exterior[i];
    const y = exterior[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, rings: flat };
};

// Even-odd ray cast, the same formula utils/geoPolygon.ts's isPointInPolygon
// uses (so results match it exactly), on a flat ring.
const pointInRing = (ring: Float64Array, lon: number, lat: number): boolean => {
  let inside = false;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const xi = ring[i * 2];
    const yi = ring[i * 2 + 1];
    const xj = ring[j * 2];
    const yj = ring[j * 2 + 1];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

const pointInPolygon = (
  polygon: FlatPolygon,
  lon: number,
  lat: number,
): boolean => {
  // A point outside the exterior ring's bounding box can never be inside it.
  if (
    lon < polygon.minX ||
    lon > polygon.maxX ||
    lat < polygon.minY ||
    lat > polygon.maxY
  ) {
    return false;
  }
  if (!pointInRing(polygon.rings[0], lon, lat)) return false;
  for (let i = 1; i < polygon.rings.length; i += 1) {
    if (pointInRing(polygon.rings[i], lon, lat)) return false; // inside a hole
  }
  return true;
};

/** Only Polygon/MultiPolygon features with a field value that has a class
 * in `classIndexByValue` are indexed -- lines/points carry no area to be
 * "inside", and a feature whose value isn't a styled class contributes
 * nothing, so a later feature that does contain the point can still win. */
export const createVectorPointSampler = (
  geojson: GeoJsonFeatureCollection,
  field: string,
  classIndexByValue: ReadonlyMap<string, number>,
): VectorPointSampler => {
  const features: SamplerFeature[] = [];
  for (const feature of geojson.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const classId = classIndexByValue.get(String(feature.properties?.[field]));
    if (classId === undefined) continue;

    const polygons: FlatPolygon[] = [];
    if (geometry.type === 'Polygon') {
      const polygon = flattenPolygon(
        geometry.coordinates as [number, number][][],
      );
      if (polygon) polygons.push(polygon);
    } else if (geometry.type === 'MultiPolygon') {
      for (const part of geometry.coordinates as [number, number][][][]) {
        const polygon = flattenPolygon(part);
        if (polygon) polygons.push(polygon);
      }
    }
    if (polygons.length > 0) features.push({ classId, polygons });
  }

  const sample = (lat: number, lon: number): number | null => {
    for (const feature of features) {
      for (const polygon of feature.polygons) {
        if (pointInPolygon(polygon, lon, lat)) return feature.classId;
      }
    }
    return null;
  };

  return { sample };
};
