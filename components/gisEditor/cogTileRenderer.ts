// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders Web-Mercator map tiles from a browser-parsed GeoTIFF, for the
// /gis-editor preview. Runs in the app (parent) context; the map iframe
// requests each tile over postMessage — see VariableHeatmapMap's
// tileSource={{kind:'local'}} + LOCAL_TILE_BRIDGE in
// speciesOccurrenceMapHelpers.ts. `geotiff` / `proj4` are require()d at call
// time so they never load during SSR.

import {
  buildColorLut,
  colorizeBand,
  colorizeCategoricalBand,
  hexToRgb,
  lngLatToMercator,
  mercatorToLngLat,
  parseTileStyleFromUrl,
  tallyCategoricalCounts,
  tileToMercatorBounds,
} from './cogTileMath';
import type { ValueTypeGuess } from './dataTypeDetection';
import type { RasterMetadata } from './rasterMetadata';
import {
  CIRCULAR_COLORMAPS,
  COLORMAPS,
} from '@/components/sections/speciesOccurrenceMap/variableColors';

const TILE_SIZE = 256;
const MESH = 16;

export class UnsupportedCrsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedCrsError';
  }
}

export type RenderedTile = {
  data: ArrayBuffer;
  /** Present only for nominal/ordinal rasters — pixel counts per class in
   * this tile, mirroring the backend's X-Nominal-Classes header so the
   * legend's visible-classes tracking works for local sources too. */
  classes?: { id: number; count: number }[];
};

export type PointValue = {
  value: number;
  /** Nominal/ordinal only — the matching legend class's name/color, mirroring
   * the backend point-query endpoint's class_name/class_color fields. */
  className?: string | null;
  classColor?: string | null;
};

export type CogTileRenderer = {
  renderTile: (
    z: number,
    x: number,
    y: number,
    url: string,
  ) => Promise<RenderedTile | null>;
  /** Reads the raw pixel value at a map click — the local equivalent of the
   * backend's /gis/point endpoint (see VariableHeatmapMap's pointQueryUrl).
   * Reads the full-resolution level directly (a single-pixel window), not
   * an overview, since this needs the actual value, not a downsampled
   * estimate. Null when the point is outside the raster or lands on noData. */
  readPointValue: (lat: number, lon: number) => Promise<PointValue | null>;
  view: { lat: number; lon: number; zoom: number };
  dispose: () => void;
};

type Proj4Converter = {
  forward: (c: [number, number]) => [number, number];
  inverse: (c: [number, number]) => [number, number];
};
type Proj4Fn = (from: string, to: string) => Proj4Converter;

type GeoImage = {
  getWidth(): number;
  getHeight(): number;
  getBoundingBox(): number[];
  getFileDirectory(): { NewSubfileType?: number };
  readRasters(opts: Record<string, unknown>): Promise<ArrayLike<number>[]>;
};

const loadGeoTiff = (): {
  fromBlob: (b: Blob) => Promise<{
    getImageCount(): Promise<number>;
    getImage(i: number): Promise<GeoImage>;
  }>;
} =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('geotiff');

const loadProj4 = (): Proj4Fn => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('proj4');
  return (mod.default ?? mod) as Proj4Fn;
};

const loadGeokeysToProj4 = (): {
  toProj4: (g: Record<string, unknown>) => { proj4: string };
} =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('geotiff-geokeys-to-proj4');

const resolveRasterProj4 = (metadata: RasterMetadata): string => {
  const epsg = metadata.epsg;
  if (epsg === 4326) return 'EPSG:4326';
  if (epsg === 3857 || epsg === 900913 || epsg === 3785 || epsg === 102100) {
    return 'EPSG:3857';
  }
  if (!metadata.geoKeys) {
    throw new UnsupportedCrsError(
      'This raster has no resolvable coordinate system, so it can’t be previewed on the map.',
    );
  }
  try {
    const { proj4: def } = loadGeokeysToProj4().toProj4(metadata.geoKeys);
    if (!def) throw new Error('empty');
    return def;
  } catch {
    throw new UnsupportedCrsError(
      `Preview doesn’t support this raster's coordinate system${epsg ? ` (EPSG:${epsg})` : ''} yet.`,
    );
  }
};

type Level = {
  image: GeoImage;
  width: number;
  height: number;
  resX: number;
  resY: number;
};

type CreateArgs = {
  blob: Blob;
  metadata: RasterMetadata;
  renderMin: number;
  renderMax: number;
  valueType: ValueTypeGuess;
  /** Names are used by readPointValue() for both nominal and ordinal.
   * Colors are only used for nominal pixel colorization (see isNominal
   * below) — ordinal renders through the same continuous min/max stretch as
   * interval/ratio/circular (see rasterEditableMeta.ts), so its legend
   * swatches carry a default color but the pixels themselves don't need
   * per-class lookup. */
  legendClasses: { id: number; name: string; color: string | null }[] | null;
  /** display = raw * scale + offset — interval/ratio only (see
   * rasterEditableMeta.ts); pass 1/0 for every other value type. Applied
   * before both the continuous colorize stretch and readPointValue(), and
   * NOT applied before the noData/finite check (noData is a raw sentinel —
   * scaling it first would stop it from matching). */
  scale: number;
  offset: number;
};

export const createCogTileRenderer = async ({
  blob,
  metadata,
  renderMin,
  renderMax,
  valueType,
  legendClasses,
  scale,
  offset,
}: CreateArgs): Promise<CogTileRenderer> => {
  const isCategorical = valueType === 'nominal' || valueType === 'ordinal';
  const isNominal = valueType === 'nominal';
  const isScaled = valueType === 'ratio' || valueType === 'interval';
  const toDisplay = (raw: number) => (isScaled ? raw * scale + offset : raw);
  const colorsById = new Map<number, [number, number, number]>();
  const classById = new Map<number, { name: string; color: string | null }>();
  if (legendClasses) {
    for (const cls of legendClasses) {
      classById.set(cls.id, { name: cls.name, color: cls.color });
      if (isNominal && cls.color) {
        const rgb = hexToRgb(cls.color);
        if (rgb) colorsById.set(cls.id, rgb);
      }
    }
  }
  const rasterProj = resolveRasterProj4(metadata); // may throw UnsupportedCrsError
  const noData = metadata.noData;

  const projKind: 'mercator' | 'geographic' | 'other' =
    rasterProj === 'EPSG:3857'
      ? 'mercator'
      : rasterProj === 'EPSG:4326'
        ? 'geographic'
        : 'other';
  const toRaster: Proj4Converter | null =
    projKind === 'other' ? loadProj4()('EPSG:4326', rasterProj) : null;

  const project = (mx: number, my: number): [number, number] => {
    if (projKind === 'mercator') return [mx, my];
    const [lon, lat] = mercatorToLngLat(mx, my);
    if (projKind === 'geographic') return [lon, lat];
    return toRaster!.forward([lon, lat]);
  };

  const lutCache = new Map<string, Uint8Array>();
  const lutFor = (name: string): Uint8Array => {
    let l = lutCache.get(name);
    if (l) return l;
    // Circular variables' colormap ids (e.g. "twilight_90") live in a
    // separate table from the sequential ones — check both before falling
    // back, so a circular raster's tiles pick up its cyclic colormap
    // instead of silently defaulting to viridis.
    const stops =
      COLORMAPS[name as keyof typeof COLORMAPS]?.stops ??
      CIRCULAR_COLORMAPS[name as keyof typeof CIRCULAR_COLORMAPS]?.stops ??
      COLORMAPS.viridis.stops;
    l = buildColorLut(stops as [number, number, number][]);
    lutCache.set(name, l);
    return l;
  };

  const tiff = await loadGeoTiff().fromBlob(blob);
  const count = await tiff.getImageCount();

  const full = await tiff.getImage(0);
  const fb = full.getBoundingBox();
  const extent: [number, number, number, number] = [fb[0], fb[1], fb[2], fb[3]];

  const levels: Level[] = [];
  for (let i = 0; i < count; i += 1) {
    const image = i === 0 ? full : await tiff.getImage(i);
    if (((image.getFileDirectory().NewSubfileType ?? 0) & 4) !== 0) continue;
    const width = image.getWidth();
    const height = image.getHeight();
    levels.push({
      image,
      width,
      height,
      resX: (extent[2] - extent[0]) / width,
      resY: (extent[3] - extent[1]) / height,
    });
  }
  levels.sort((a, b) => a.resX - b.resX);

  // Suggested opening view.
  const toLngLat = (rx: number, ry: number): [number, number] => {
    if (projKind === 'geographic') return [rx, ry];
    if (projKind === 'mercator') return mercatorToLngLat(rx, ry);
    return toRaster!.inverse([rx, ry]);
  };
  const [cLon, cLat] = toLngLat(
    (extent[0] + extent[2]) / 2,
    (extent[1] + extent[3]) / 2,
  );
  const [wLon] = toLngLat(extent[0], (extent[1] + extent[3]) / 2);
  const [eLon] = toLngLat(extent[2], (extent[1] + extent[3]) / 2);
  const lonSpan = Math.max(1e-4, Math.abs(eLon - wLon));
  const view = {
    lat: Number.isFinite(cLat) ? cLat : 0,
    lon: Number.isFinite(cLon) ? cLon : 0,
    zoom: Math.max(1, Math.min(12, Math.log2(360 / lonSpan))),
  };

  let disposed = false;

  const renderTile = async (
    z: number,
    x: number,
    y: number,
    url: string,
  ): Promise<RenderedTile | null> => {
    if (disposed) return null;
    const style = parseTileStyleFromUrl(url);
    const lut = lutFor(style.colormap ?? 'viridis');
    const min = style.renderRange ? style.renderRange[0] : renderMin;
    const max = style.renderRange ? style.renderRange[1] : renderMax;

    const [minX, minY, maxX, maxY] = tileToMercatorBounds(z, x, y);

    let rMinX = Infinity;
    let rMinY = Infinity;
    let rMaxX = -Infinity;
    let rMaxY = -Infinity;
    for (let s = 0; s <= 8; s += 1) {
      const t = s / 8;
      const probes: [number, number][] = [
        [minX + t * (maxX - minX), minY],
        [minX + t * (maxX - minX), maxY],
        [minX, minY + t * (maxY - minY)],
        [maxX, minY + t * (maxY - minY)],
      ];
      for (const [mx, my] of probes) {
        const [rx, ry] = project(mx, my);
        if (!Number.isFinite(rx) || !Number.isFinite(ry)) continue;
        if (rx < rMinX) rMinX = rx;
        if (ry < rMinY) rMinY = ry;
        if (rx > rMaxX) rMaxX = rx;
        if (ry > rMaxY) rMaxY = ry;
      }
    }
    if (!Number.isFinite(rMinX)) return null;
    if (
      rMaxX <= extent[0] ||
      rMinX >= extent[2] ||
      rMaxY <= extent[1] ||
      rMinY >= extent[3]
    ) {
      return null;
    }

    const neededRes = (rMaxX - rMinX) / TILE_SIZE;
    let level = levels[0];
    for (const lvl of levels) {
      if (lvl.resX <= neededRes) level = lvl;
      else break;
    }

    const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
    const wx0 = Math.max(
      0,
      Math.floor(clamp((rMinX - extent[0]) / level.resX, level.width) - 1),
    );
    const wx1 = Math.min(
      level.width,
      Math.ceil(clamp((rMaxX - extent[0]) / level.resX, level.width) + 1),
    );
    const wy0 = Math.max(
      0,
      Math.floor(clamp((extent[3] - rMaxY) / level.resY, level.height) - 1),
    );
    const wy1 = Math.min(
      level.height,
      Math.ceil(clamp((extent[3] - rMinY) / level.resY, level.height) + 1),
    );
    if (wx1 <= wx0 || wy1 <= wy0) return null;
    const winW = wx1 - wx0;
    const winH = wy1 - wy0;

    const bandResult = await level.image.readRasters({
      window: [wx0, wy0, wx1, wy1],
      samples: [0],
    });
    if (disposed) return null;
    const band = bandResult[0];

    const toCol = (rx: number) =>
      Math.round((rx - extent[0]) / level.resX - 0.5) - wx0;
    const toRow = (ry: number) =>
      Math.round((extent[3] - ry) / level.resY - 0.5) - wy0;

    // Warp mesh for non-4326/3857 CRS; direct otherwise.
    let meshCol: Float64Array | null = null;
    let meshRow: Float64Array | null = null;
    if (projKind === 'other') {
      const dim = MESH + 1;
      meshCol = new Float64Array(dim * dim);
      meshRow = new Float64Array(dim * dim);
      for (let gy = 0; gy < dim; gy += 1) {
        const my = maxY - (gy / MESH) * (maxY - minY);
        for (let gx = 0; gx < dim; gx += 1) {
          const mx = minX + (gx / MESH) * (maxX - minX);
          const [rx, ry] = project(mx, my);
          meshCol[gy * dim + gx] = toCol(rx);
          meshRow[gy * dim + gx] = toRow(ry);
        }
      }
    }

    const samples = new Float64Array(TILE_SIZE * TILE_SIZE);
    let anyValid = false;
    for (let py = 0; py < TILE_SIZE; py += 1) {
      const my = maxY - ((py + 0.5) / TILE_SIZE) * (maxY - minY);
      const gyf = ((py + 0.5) / TILE_SIZE) * MESH;
      const gy0 = Math.min(MESH - 1, Math.floor(gyf));
      const fy = gyf - gy0;
      for (let px = 0; px < TILE_SIZE; px += 1) {
        const outIdx = py * TILE_SIZE + px;
        let col: number;
        let row: number;
        if (meshCol && meshRow) {
          const dim = MESH + 1;
          const gxf = ((px + 0.5) / TILE_SIZE) * MESH;
          const gx0 = Math.min(MESH - 1, Math.floor(gxf));
          const fx = gxf - gx0;
          const i00 = gy0 * dim + gx0;
          const bl = (a: Float64Array) =>
            a[i00] * (1 - fx) * (1 - fy) +
            a[i00 + 1] * fx * (1 - fy) +
            a[i00 + dim] * (1 - fx) * fy +
            a[i00 + dim + 1] * fx * fy;
          col = Math.round(bl(meshCol));
          row = Math.round(bl(meshRow));
        } else {
          const mx = minX + ((px + 0.5) / TILE_SIZE) * (maxX - minX);
          const [rx, ry] = project(mx, my);
          col = toCol(rx);
          row = toRow(ry);
        }
        if (col >= 0 && col < winW && row >= 0 && row < winH) {
          samples[outIdx] = band[row * winW + col];
          anyValid = true;
        } else {
          samples[outIdx] = Number.NaN;
        }
      }
    }
    if (!anyValid) return null;

    // Ratio/interval only — raw*scale+offset, applied before colorizing so
    // the stretch operates in the same display domain as renderMin/renderMax
    // (which are already scaled, see rasterEditableMeta.ts). Never applied
    // to nominal/ordinal (class codes) or circular (unscaled by design), so
    // this can't collide with the noData/tally comparisons below, which
    // always run against raw class-code-shaped values for those types.
    if (isScaled) {
      for (let i = 0; i < samples.length; i += 1) {
        if (Number.isFinite(samples[i])) samples[i] = toDisplay(samples[i]);
      }
    }
    const effectiveNoData =
      isScaled && noData != null ? toDisplay(noData) : noData;

    // Nominal codes are unordered — interpolating between two of them is
    // meaningless, so they're colorized by exact lookup instead of the
    // continuous min/max stretch. Ordinal stays on the continuous path (its
    // rank order makes a sequential colormap sensible), same as
    // interval/ratio/circular.
    const rgba =
      isNominal && colorsById.size > 0
        ? colorizeCategoricalBand(
            samples,
            noData,
            colorsById,
            style.classFilter,
          )
        : colorizeBand(
            samples,
            min,
            max,
            effectiveNoData,
            lut,
            style.valueRanges,
            style.classFilter,
          );
    const classes = isCategorical
      ? tallyCategoricalCounts(samples, noData)
      : undefined;

    const data = await encodePng(rgba);
    if (!data) return null;
    return { data, classes };
  };

  // levels is sorted ascending by resX (pixel size), so index 0 is the
  // finest/full resolution — the last entry is the smallest overview.
  const fullRes = levels[0];

  const readPointValue = async (
    lat: number,
    lon: number,
  ): Promise<PointValue | null> => {
    if (disposed) return null;
    const [mx, my] = lngLatToMercator(lon, lat);
    const [rx, ry] = project(mx, my);
    if (!Number.isFinite(rx) || !Number.isFinite(ry)) return null;
    if (rx < extent[0] || rx > extent[2] || ry < extent[1] || ry > extent[3]) {
      return null;
    }
    const col = Math.floor((rx - extent[0]) / fullRes.resX);
    const row = Math.floor((extent[3] - ry) / fullRes.resY);
    if (col < 0 || col >= fullRes.width || row < 0 || row >= fullRes.height) {
      return null;
    }
    const bandResult = await fullRes.image.readRasters({
      window: [col, row, col + 1, row + 1],
      samples: [0],
    });
    if (disposed) return null;
    const raw = bandResult[0][0];
    if (!Number.isFinite(raw) || (noData != null && raw === noData)) {
      return null;
    }
    if (isCategorical) {
      const cls = classById.get(Math.round(raw));
      return {
        value: raw,
        className: cls?.name ?? null,
        classColor: cls?.color ?? null,
      };
    }
    return { value: toDisplay(raw) };
  };

  return {
    renderTile,
    readPointValue,
    view,
    dispose: () => {
      disposed = true;
    },
  };
};

const encodePng = async (
  rgba: Uint8ClampedArray,
): Promise<ArrayBuffer | null> => {
  const imageData = new ImageData(
    new Uint8ClampedArray(rgba),
    TILE_SIZE,
    TILE_SIZE,
  );
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(imageData, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blob.arrayBuffer();
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  return blob ? blob.arrayBuffer() : null;
};
