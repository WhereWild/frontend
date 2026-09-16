// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders Web-Mercator map tiles from a browser-parsed GeoJSON, for the
// /gis-editor preview — the vector counterpart of cogTileRenderer.ts, going
// through the exact same VariableHeatmapMap local tileSource pipeline
// (legend, classFilter toggling, click-to-read-a-value, opacity) instead of
// a separate vector-layer/legend/popup implementation. Its class "codes"
// are unordered, so a real categorical raster's exact-lookup colorization
// (colorizeCategoricalBand) is the right model here too — a distinct field
// value is just a synthetic integer id (its index in the styled class
// list) standing in for what would otherwise be a raster's own numeric
// pixel codes, so this can reuse cogTileMath.ts's tile geometry and the
// rest of the local-tile-source contract completely unchanged.
//
// Unlike the COG renderer, there's no non-Mercator warp to worry about —
// GeoJSON (RFC 7946) is always WGS84 — so each ring's lon/lat vertices
// project directly to this tile's pixel space and get filled with Canvas
// 2D's own polygon rasterizer (nonzero winding rule), rather than a
// per-pixel sample loop. A GeoJSON polygon's exterior ring is
// counterclockwise and each hole is clockwise (RFC 7946) — opposite
// windings under the nonzero rule is exactly what makes a hole subtract
// from its exterior, so Canvas fills these correctly with no extra
// bookkeeping.
//
// Rendering itself stays fully ad hoc, per z/x/y, exactly like the COG
// renderer — nothing here pre-rasterizes or caches whole tiles. What the
// caller passes in as `overviewLevels` (see CreateArgs below) IS
// precomputed once, up front — a small Douglas-Peucker pyramid
// (douglasPeucker.ts's buildOverviewLevels, or a cache of one from a
// previous save this tool already wrote — see that module's
// serializeOverviewLevels/deserializeOverviewLevels — reconstructed
// instead of rebuilt) — so a huge, full-detail geometry doesn't get walked
// vertex-by-vertex for every tile at a low zoom where nearly all of that
// detail is imperceptible anyway. This module doesn't build or cache the
// pyramid itself: that's the caller's concern (which cache-or-build
// decision belongs with the caller, not the renderer).

import type { OverviewLevel } from './douglasPeucker';
import {
  hexToRgb,
  lngLatToMercator,
  mercatorToLngLat,
  parseTileStyleFromUrl,
  tileToMercatorBounds,
} from './cogTileMath';
import type { GeoJsonFeatureCollection } from './shapefileMetadata';

const TILE_SIZE = 256;
const POINT_RADIUS = 5;
const LINE_WIDTH = 2;

export type RenderedVectorTile = {
  data: ArrayBuffer;
  classes: { id: number; count: number }[];
};

export type VectorPointValue = {
  value: number;
  className: string | null;
  classColor: string | null;
};

export type VectorTileRenderer = {
  renderTile: (
    z: number,
    x: number,
    y: number,
    url: string,
  ) => Promise<RenderedVectorTile | null>;
  readPointValue: (
    lat: number,
    lon: number,
  ) => Promise<VectorPointValue | null>;
  view: { lat: number; lon: number; zoom: number };
};

type Ring = [number, number][]; // [lon, lat] pairs
type Polygon = Ring[]; // first ring exterior, rest holes

type IndexedFeature = {
  classId: number;
  bbox: [number, number, number, number]; // lon/lat minX, minY, maxX, maxY
  kind: 'polygon' | 'line' | 'point';
  polygons: Polygon[]; // kind 'polygon'
  lines: Ring[]; // kind 'line'
  points: [number, number][]; // kind 'point'
};

const ringsOf = (coordinates: unknown): Ring[] =>
  (coordinates as [number, number][][]).map((ring) =>
    ring.map(([lon, lat]) => [lon, lat] as [number, number]),
  );

const bboxOfRings = (rings: Ring[]): [number, number, number, number] => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minX) minX = lon;
      if (lat < minY) minY = lat;
      if (lon > maxX) maxX = lon;
      if (lat > maxY) maxY = lat;
    }
  }
  return [minX, minY, maxX, maxY];
};

/**
 * Flattens every feature into a class id (its distinct field value's index
 * in `classIndexByValue`) plus plain lon/lat geometry, once — so
 * renderTile()/readPointValue() only ever do cheap bbox checks and
 * projection math per call, never re-walk the raw GeoJSON. `field === null`
 * means single-color mode (see vectorEditableMeta.ts's vectorClassIndex) —
 * every feature is treated as one synthetic class, id 0, regardless of its
 * own properties.
 */
const buildFeatureIndex = (
  geojson: GeoJsonFeatureCollection,
  field: string | null,
  classIndexByValue: Map<string, number>,
): IndexedFeature[] => {
  const indexed: IndexedFeature[] = [];
  for (const feature of geojson.features) {
    if (!feature.geometry) continue;
    let classId: number;
    if (field == null) {
      classId = 0;
    } else {
      const raw = feature.properties?.[field];
      classId = raw != null ? (classIndexByValue.get(String(raw)) ?? -1) : -1;
    }
    if (classId < 0) continue;
    const { type, coordinates } = feature.geometry;
    if (type === 'Polygon') {
      const rings = ringsOf(coordinates);
      indexed.push({
        classId,
        bbox: bboxOfRings(rings),
        kind: 'polygon',
        polygons: [rings],
        lines: [],
        points: [],
      });
    } else if (type === 'MultiPolygon') {
      const polygons = (coordinates as unknown[]).map((p) => ringsOf(p));
      indexed.push({
        classId,
        bbox: bboxOfRings(polygons.flat()),
        kind: 'polygon',
        polygons,
        lines: [],
        points: [],
      });
    } else if (type === 'LineString') {
      const ring = (coordinates as [number, number][]).map(
        ([lon, lat]) => [lon, lat] as [number, number],
      );
      indexed.push({
        classId,
        bbox: bboxOfRings([ring]),
        kind: 'line',
        polygons: [],
        lines: [ring],
        points: [],
      });
    } else if (type === 'MultiLineString') {
      const lines = (coordinates as [number, number][][]).map((line) =>
        line.map(([lon, lat]) => [lon, lat] as [number, number]),
      );
      indexed.push({
        classId,
        bbox: bboxOfRings(lines),
        kind: 'line',
        polygons: [],
        lines,
        points: [],
      });
    } else if (type === 'Point') {
      const [lon, lat] = coordinates as [number, number];
      indexed.push({
        classId,
        bbox: [lon, lat, lon, lat],
        kind: 'point',
        polygons: [],
        lines: [],
        points: [[lon, lat]],
      });
    } else if (type === 'MultiPoint') {
      const points = (coordinates as [number, number][]).map(
        ([lon, lat]) => [lon, lat] as [number, number],
      );
      indexed.push({
        classId,
        bbox: bboxOfRings([points]),
        kind: 'point',
        polygons: [],
        lines: [],
        points,
      });
    }
  }
  return indexed;
};

const bboxesIntersect = (
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/** Standard ray-casting point-in-ring test (even-odd on one ring). */
const pointInRing = (lon: number, lat: number, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

/** A point is in a polygon if it's in the exterior ring and not in any hole. */
const pointInPolygon = (
  lon: number,
  lat: number,
  polygon: Polygon,
): boolean => {
  if (!pointInRing(lon, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(lon, lat, polygon[i])) return false;
  }
  return true;
};

type CreateArgs = {
  /** Level 0 is always the untouched original — see douglasPeucker.ts's
   * buildOverviewLevels()/OverviewLevel doc comments. The caller decides
   * whether to build this fresh or reconstruct it from a previous save's
   * cache (shapefileMetadata.ts's VectorMetadata.cachedOverviewLevels);
   * this module only ever consumes whatever it's given. */
  overviewLevels: OverviewLevel[];
  field: string | null;
  /** Distinct field value -> synthetic integer class id (its position in
   * the styled class list) -- see this module's doc comment for why. Fixed
   * for the renderer's lifetime: renaming/recoloring a class never changes
   * which id a feature maps to, only what that id looks like (see
   * getStyle below), so this never needs to trigger a geometry rebuild. */
  classIndexByValue: Map<string, number>;
  /** Read fresh on every renderTile()/readPointValue() call rather than
   * captured once — a class rename/recolor is just a new object the
   * caller's own state holds, with no reason to rebuild the (expensive:
   * simplification pyramid + per-feature geometry index) rest of this
   * renderer just because a swatch changed. */
  getStyle: () => {
    classColorsById: Map<number, string>;
    classNamesById: Map<number, string>;
  };
  bbox: [number, number, number, number] | null; // lon/lat, for the opening view
};

export const createVectorTileRenderer = ({
  overviewLevels,
  field,
  classIndexByValue,
  getStyle,
  bbox,
}: CreateArgs): VectorTileRenderer => {
  // Indexed once per level here, not per tile.
  const featuresByLevel: IndexedFeature[][] = overviewLevels.map((level) =>
    buildFeatureIndex(
      level.data as GeoJsonFeatureCollection,
      field,
      classIndexByValue,
    ),
  );
  // readPointValue always wants the real, full-detail geometry — a
  // simplified ring can nudge a boundary by up to `tolerance` degrees,
  // which is fine for what a tile pixel can even show but not for "is this
  // exact click inside the real polygon."
  const fullDetailFeatures = featuresByLevel[0];

  /** Picks the coarsest overview level whose simplification tolerance is
   * still finer than what a source-pixel actually spans at this tile's
   * zoom — mirrors cogTileRenderer.ts's own "coarsest level whose
   * resolution is still fine enough" walk, using degrees instead of the
   * source raster's projected units. */
  const levelForZoom = (z: number): IndexedFeature[] => {
    const degreesPerTile = 360 / 2 ** z;
    const neededTolerance = degreesPerTile / TILE_SIZE;
    let chosen = 0;
    for (let i = 0; i < overviewLevels.length; i += 1) {
      if (overviewLevels[i].tolerance <= neededTolerance) chosen = i;
      else break;
    }
    return featuresByLevel[chosen];
  };

  const view = bbox
    ? {
        lat: (bbox[1] + bbox[3]) / 2,
        lon: (bbox[0] + bbox[2]) / 2,
        zoom: Math.max(
          1,
          Math.min(14, Math.log2(360 / Math.max(1e-4, bbox[2] - bbox[0]))),
        ),
      }
    : { lat: 0, lon: 0, zoom: 1 };

  const renderTile = async (
    z: number,
    x: number,
    y: number,
    url: string,
  ): Promise<RenderedVectorTile | null> => {
    const { classColorsById } = getStyle();
    const rgbById = new Map<number, [number, number, number]>();
    for (const [id, hex] of classColorsById) {
      const rgb = hexToRgb(hex);
      if (rgb) rgbById.set(id, rgb);
    }

    const style = parseTileStyleFromUrl(url);
    const filterSet =
      style.classFilter && style.classFilter.length > 0
        ? new Set(style.classFilter)
        : null;

    const [minX, minY, maxX, maxY] = tileToMercatorBounds(z, x, y);
    const [tileMinLon, tileMinLat] = mercatorToLngLat(minX, minY);
    const [tileMaxLon, tileMaxLat] = mercatorToLngLat(maxX, maxY);
    const tileBbox: [number, number, number, number] = [
      tileMinLon,
      tileMinLat,
      tileMaxLon,
      tileMaxLat,
    ];

    const candidates = levelForZoom(z).filter(
      (f) =>
        (!filterSet || filterSet.has(f.classId)) &&
        bboxesIntersect(f.bbox, tileBbox),
    );
    if (candidates.length === 0) return null;

    const toPx = ([lon, lat]: [number, number]): [number, number] => {
      const [mx, my] = lngLatToMercator(lon, lat);
      return [
        ((mx - minX) / (maxX - minX)) * TILE_SIZE,
        ((maxY - my) / (maxY - minY)) * TILE_SIZE,
      ];
    };

    const canvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
        : document.createElement('canvas');
    if (!(canvas instanceof OffscreenCanvas)) {
      canvas.width = TILE_SIZE;
      canvas.height = TILE_SIZE;
    }
    const ctx = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return null;

    let drewAnything = false;
    for (const feature of candidates) {
      const rgb = rgbById.get(feature.classId);
      if (!rgb) continue;
      const color = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      if (feature.kind === 'polygon') {
        ctx.beginPath();
        for (const polygon of feature.polygons) {
          for (const ring of polygon) {
            ring.forEach((coord, i) => {
              const [px, py] = toPx(coord);
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.closePath();
          }
        }
        ctx.fillStyle = color;
        ctx.fill('nonzero');
        drewAnything = true;
      } else if (feature.kind === 'line') {
        ctx.beginPath();
        for (const line of feature.lines) {
          line.forEach((coord, i) => {
            const [px, py] = toPx(coord);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = LINE_WIDTH;
        ctx.stroke();
        drewAnything = true;
      } else {
        for (const point of feature.points) {
          const [px, py] = toPx(point);
          ctx.beginPath();
          ctx.arc(px, py, POINT_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        drewAnything = true;
      }
    }
    if (!drewAnything) return null;

    // Pixel-count tally, same shape as the raster path's
    // tallyCategoricalCounts — matched by exact drawn RGB against the same
    // small reverse-color table used to fill above (a few dozen entries at
    // most), so this stays cheap even at 256*256 pixels.
    const colorKeyToId = new Map<string, number>();
    for (const [id, rgb] of rgbById) {
      colorKeyToId.set(`${rgb[0]},${rgb[1]},${rgb[2]}`, id);
    }
    const imageData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    const counts = new Map<number, number>();
    for (let i = 0; i < imageData.data.length; i += 4) {
      const a = imageData.data[i + 3];
      if (a === 0) continue;
      const key = `${imageData.data[i]},${imageData.data[i + 1]},${imageData.data[i + 2]}`;
      const id = colorKeyToId.get(key);
      if (id == null) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const classes = [...counts.entries()].map(([id, count]) => ({ id, count }));

    const data =
      canvas instanceof OffscreenCanvas
        ? await (
            await canvas.convertToBlob({ type: 'image/png' })
          ).arrayBuffer()
        : await new Promise<ArrayBuffer | null>((resolve) => {
            (canvas as HTMLCanvasElement).toBlob(async (blob) => {
              resolve(blob ? await blob.arrayBuffer() : null);
            }, 'image/png');
          });
    if (!data) return null;
    return { data, classes };
  };

  const readPointValue = async (
    lat: number,
    lon: number,
  ): Promise<VectorPointValue | null> => {
    const { classColorsById, classNamesById } = getStyle();
    for (const feature of fullDetailFeatures) {
      if (
        lon < feature.bbox[0] ||
        lon > feature.bbox[2] ||
        lat < feature.bbox[1] ||
        lat > feature.bbox[3]
      ) {
        continue;
      }
      if (feature.kind === 'polygon') {
        const hit = feature.polygons.some((polygon) =>
          pointInPolygon(lon, lat, polygon),
        );
        if (!hit) continue;
      }
      // Line/point features only get the cheap bbox check above (a precise
      // "click within N pixels of a line/point" hit test isn't worth the
      // complexity for what's realistically always polygon data here —
      // real-world attribute-styled vector layers in this tool are
      // ecoregion/land-classification-shaped, not sparse point sets).
      return {
        value: feature.classId,
        className: classNamesById.get(feature.classId) ?? null,
        classColor: classColorsById.get(feature.classId) ?? null,
      };
    }
    return null;
  };

  return { renderTile, readPointValue, view };
};
