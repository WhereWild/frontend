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
  mercatorToLngLat,
  parseTileStyleFromUrl,
  tileToMercatorBounds,
} from './cogTileMath';
import type { RasterMetadata } from './rasterMetadata';
import { COLORMAPS } from '@/components/sections/speciesOccurrenceMap/variableColors';

const TILE_SIZE = 256;
const MESH = 16;

export class UnsupportedCrsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedCrsError';
  }
}

export type CogTileRenderer = {
  renderTile: (
    z: number,
    x: number,
    y: number,
    url: string,
  ) => Promise<ArrayBuffer | null>;
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
};

export const createCogTileRenderer = async ({
  blob,
  metadata,
  renderMin,
  renderMax,
}: CreateArgs): Promise<CogTileRenderer> => {
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
    const key = name in COLORMAPS ? name : 'viridis';
    let l = lutCache.get(key);
    if (!l) {
      l = buildColorLut(
        COLORMAPS[key as keyof typeof COLORMAPS].stops as [
          number,
          number,
          number,
        ][],
      );
      lutCache.set(key, l);
    }
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
  ): Promise<ArrayBuffer | null> => {
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

    const rgba = colorizeBand(
      samples,
      min,
      max,
      noData,
      lut,
      style.valueRanges,
    );
    return encodePng(rgba);
  };

  return {
    renderTile,
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
