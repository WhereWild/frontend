// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Pure, dependency-free helpers for the client-side COG tile renderer:
// Web-Mercator tile geometry and value->RGBA colorizing.

/** Half the Web-Mercator world extent, in metres (pi * 6378137). */
export const MERCATOR_ORIGIN_SHIFT = 20037508.342789244;

/** Slippy z/x/y -> [minX, minY, maxX, maxY] in EPSG:3857 metres. */
export const tileToMercatorBounds = (
  z: number,
  x: number,
  y: number,
): [number, number, number, number] => {
  const tiles = 2 ** z;
  const world = 2 * MERCATOR_ORIGIN_SHIFT;
  const minX = -MERCATOR_ORIGIN_SHIFT + (x / tiles) * world;
  const maxX = -MERCATOR_ORIGIN_SHIFT + ((x + 1) / tiles) * world;
  const maxY = MERCATOR_ORIGIN_SHIFT - (y / tiles) * world;
  const minY = MERCATOR_ORIGIN_SHIFT - ((y + 1) / tiles) * world;
  return [minX, minY, maxX, maxY];
};

/** EPSG:3857 metres -> [lon, lat] degrees (EPSG:4326). */
export const mercatorToLngLat = (mx: number, my: number): [number, number] => {
  const lon = (mx / MERCATOR_ORIGIN_SHIFT) * 180;
  let lat = (my / MERCATOR_ORIGIN_SHIFT) * 180;
  lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lon, lat];
};

export type ColorLut = Uint8Array; // length 256*3, RGB

/** Interpolate an evenly-spaced [r,g,b] stop list into a 256-entry RGB LUT. */
export const buildColorLut = (stops: [number, number, number][]): ColorLut => {
  const lut = new Uint8Array(256 * 3);
  const n = stops.length;
  if (n === 0) return lut;
  for (let i = 0; i < 256; i += 1) {
    const t = (i / 255) * (n - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, n - 1);
    const f = t - lo;
    for (let c = 0; c < 3; c += 1) {
      lut[i * 3 + c] = Math.round(
        stops[lo][c] + f * (stops[hi][c] - stops[lo][c]),
      );
    }
  }
  return lut;
};

/**
 * Colorize a flat band of sampled values into an RGBA buffer. `noData`,
 * non-finite, and (when `ranges` is given) out-of-range values -> transparent.
 */
export const colorizeBand = (
  values: ArrayLike<number>,
  min: number,
  max: number,
  noData: number | null,
  lut: ColorLut,
  ranges?: [number, number][] | null,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(values.length * 4);
  const span = max - min || 1;
  const hasRanges = !!ranges && ranges.length > 0;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!Number.isFinite(v) || (noData != null && v === noData)) continue;
    if (hasRanges && !ranges!.some(([lo, hi]) => v >= lo && v <= hi)) continue;
    let t = (v - min) / span;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const idx = Math.round(t * 255) * 3;
    out[i * 4] = lut[idx];
    out[i * 4 + 1] = lut[idx + 1];
    out[i * 4 + 2] = lut[idx + 2];
    out[i * 4 + 3] = 255;
  }
  return out;
};

/** Read `colormap`, `render_range` and `value_ranges` from a tile URL query. */
export const parseTileStyleFromUrl = (
  url: string,
): {
  colormap: string | null;
  renderRange: [number, number] | null;
  valueRanges: [number, number][] | null;
} => {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const colormap = params.get('colormap');
  let renderRange: [number, number] | null = null;
  let valueRanges: [number, number][] | null = null;
  const rr = params.get('render_range');
  if (rr) {
    try {
      const parsed = JSON.parse(rr);
      if (
        Array.isArray(parsed) &&
        parsed.length === 2 &&
        typeof parsed[0] === 'number'
      ) {
        renderRange = [parsed[0], parsed[1]];
      }
    } catch {
      // ignore malformed
    }
  }
  const vr = params.get('value_ranges');
  if (vr) {
    try {
      const parsed = JSON.parse(vr);
      if (Array.isArray(parsed)) {
        valueRanges = parsed.filter(
          (r): r is [number, number] =>
            Array.isArray(r) &&
            r.length === 2 &&
            typeof r[0] === 'number' &&
            typeof r[1] === 'number',
        );
      }
    } catch {
      // ignore malformed
    }
  }
  return { colormap, renderRange, valueRanges };
};
