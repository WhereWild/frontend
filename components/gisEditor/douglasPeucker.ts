// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The vector equivalent of a raster's overview pyramid: a shapefile with
// millions of vertices (a detailed coastline, a national roads layer) has
// no per-tile decode cost the way an unoptimized raster does — the browser
// just has to hold and draw every vertex of the whole GeoJSON FeatureCollection
// at once (see the render bridge, which loads it as a single source, not
// tiled). Simplifying that vertex count is the equivalent fix, and
// Douglas-Peucker is the standard, well-understood algorithm for it — GDAL,
// mapshaper, and PostGIS's ST_Simplify all use the same core algorithm.
//
// Ramer-Douglas-Peucker, standard recursive form: given a polyline, keep
// the two endpoints; find the point in between farthest from the segment
// connecting them; if that distance exceeds `tolerance`, keep that point
// and recurse on both halves, otherwise discard everything in between.

export type Point = [number, number];

const perpendicularDistanceSq = (
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number => {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const ex = x - x1;
    const ey = y - y1;
    return ex * ex + ey * ey;
  }
  // Cross-product magnitude / segment length gives perpendicular distance;
  // squaring both sides avoids a sqrt per candidate point.
  const cross = dx * (y1 - y) - dy * (x1 - x);
  return (cross * cross) / lengthSq;
};

/**
 * Simplifies a single line (an open polyline, or one ring of a polygon)
 * to within `tolerance` (in the same units as the input coordinates —
 * degrees, for the WGS84 GeoJSON this always runs on post-shpjs). Always
 * keeps the first and last point, so a closed ring stays closed.
 */
export const simplifyLine = (points: Point[], tolerance: number): Point[] => {
  if (points.length <= 2 || tolerance <= 0) return points;
  const toleranceSq = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  // Iterative stack instead of recursion — a real coastline ring can have
  // hundreds of thousands of points, deep enough to risk a stack overflow
  // recursing one call per split.
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [startIdx, endIdx] = stack.pop()!;
    if (endIdx <= startIdx + 1) continue;
    let maxDistSq = -1;
    let maxIdx = -1;
    for (let i = startIdx + 1; i < endIdx; i += 1) {
      const distSq = perpendicularDistanceSq(
        points[i],
        points[startIdx],
        points[endIdx],
      );
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        maxIdx = i;
      }
    }
    if (maxDistSq > toleranceSq) {
      keep[maxIdx] = 1;
      stack.push([startIdx, maxIdx], [maxIdx, endIdx]);
    }
  }

  const result: Point[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
};

type Geometry = {
  type: string;
  coordinates: unknown;
};

type Feature = {
  type: 'Feature';
  geometry: Geometry | null;
  properties: Record<string, unknown> | null;
};

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
};

// A ring needs at least 4 points to stay a valid polygon (3 distinct
// corners + the closing repeat of the first) — simplifyLine's own
// first/last-point guarantee keeps it closed, but a ring with only 3
// points to begin with (or one collapsed down by simplification) is
// degenerate; drop it rather than emit invalid polygon geometry.
const simplifyRing = (ring: Point[], tolerance: number): Point[] | null => {
  const simplified = simplifyLine(ring, tolerance);
  return simplified.length >= 4 ? simplified : null;
};

const simplifyCoordinates = (
  type: string,
  coordinates: unknown,
  tolerance: number,
): unknown => {
  switch (type) {
    case 'LineString':
      return simplifyLine(coordinates as Point[], tolerance);
    case 'MultiLineString':
      return (coordinates as Point[][]).map((line) =>
        simplifyLine(line, tolerance),
      );
    case 'Polygon':
      return (coordinates as Point[][])
        .map((ring) => simplifyRing(ring, tolerance))
        .filter((ring): ring is Point[] => ring != null);
    case 'MultiPolygon':
      return (coordinates as Point[][][])
        .map((polygon) =>
          polygon
            .map((ring) => simplifyRing(ring, tolerance))
            .filter((ring): ring is Point[] => ring != null),
        )
        .filter((polygon) => polygon.length > 0);
    default:
      // Point/MultiPoint have no vertices to simplify away.
      return coordinates;
  }
};

/**
 * Simplifies every feature's geometry in a GeoJSON FeatureCollection by
 * `tolerance` (degrees). A Polygon/MultiPolygon that loses every ring to
 * simplification (a sliver too small to survive) is dropped entirely
 * rather than kept as an empty/invalid geometry.
 */
export const simplifyFeatureCollection = <T extends FeatureCollection>(
  fc: T,
  tolerance: number,
): T => {
  if (tolerance <= 0) return fc;
  const features = fc.features
    .map((f) => {
      if (!f.geometry) return f;
      const coordinates = simplifyCoordinates(
        f.geometry.type,
        f.geometry.coordinates,
        tolerance,
      );
      const isEmptyPolygon =
        (f.geometry.type === 'Polygon' &&
          (coordinates as Point[][]).length === 0) ||
        (f.geometry.type === 'MultiPolygon' &&
          (coordinates as Point[][][]).length === 0);
      if (isEmptyPolygon) return null;
      return { ...f, geometry: { ...f.geometry, coordinates } };
    })
    .filter((f): f is Feature => f != null);
  return { ...fc, features };
};

/** Total vertex count across every feature's geometry — the vector
 * equivalent of "how much data would a raster's tiles have to decode,"
 * used to decide whether to warn and how aggressively to simplify. */
export const countVertices = (fc: FeatureCollection): number => {
  let count = 0;
  const countCoords = (type: string, coordinates: unknown): void => {
    switch (type) {
      case 'Point':
        count += 1;
        break;
      case 'MultiPoint':
      case 'LineString':
        count += (coordinates as unknown[]).length;
        break;
      case 'MultiLineString':
      case 'Polygon':
        for (const ring of coordinates as unknown[][]) count += ring.length;
        break;
      case 'MultiPolygon':
        for (const polygon of coordinates as unknown[][][]) {
          for (const ring of polygon) count += ring.length;
        }
        break;
      default:
        break;
    }
  };
  for (const f of fc.features) {
    if (f.geometry) countCoords(f.geometry.type, f.geometry.coordinates);
  }
  return count;
};

export type OverviewLevel = { tolerance: number; data: FeatureCollection };

// Mirrors a raster overview pyramid's halving-resolution levels: each step
// targets roughly a quarter of the previous level's vertex count (matching
// a raster overview's 2x downsample in each of 2 dimensions). Tolerance is
// in degrees; starting small and doubling keeps early levels visually
// close to the original while still making real progress once a layer
// actually needs several steps down.
const OVERVIEW_TOLERANCE_STEPS = [0.0001, 0.0004, 0.0016, 0.0064, 0.0256];

/**
 * Builds a small pyramid of progressively simplified copies, stopping once
 * a level's vertex count drops under `targetVertexCount` (or the tolerance
 * steps run out) — analogous to how a raster's overview levels stop once
 * they're small enough to render a whole zoomed-out view cheaply. Level 0
 * is always the untouched original, so a reader that only understands "one
 * level" (or a zoom close enough to full detail) still gets the exact
 * source geometry.
 */
export const buildOverviewLevels = (
  fc: FeatureCollection,
  targetVertexCount: number,
): OverviewLevel[] => {
  const levels: OverviewLevel[] = [{ tolerance: 0, data: fc }];
  for (const tolerance of OVERVIEW_TOLERANCE_STEPS) {
    const simplified = simplifyFeatureCollection(fc, tolerance);
    levels.push({ tolerance, data: simplified });
    if (countVertices(simplified) <= targetVertexCount) break;
  }
  return levels;
};
