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
 * non-finite, (when `ranges` is given) out-of-range, and (when `classFilter`
 * is given) excluded-class values -> transparent. `classFilter` applies even
 * to continuous data because ordinal values are still discrete class codes
 * under the hood — toggling a class off in the legend should hide it whether
 * the pixels were colorized continuously (ordinal) or by exact match
 * (nominal, see colorizeCategoricalBand below).
 */
export const colorizeBand = (
  values: ArrayLike<number>,
  min: number,
  max: number,
  noData: number | null,
  lut: ColorLut,
  ranges?: [number, number][] | null,
  classFilter?: number[] | null,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(values.length * 4);
  const span = max - min || 1;
  const hasRanges = !!ranges && ranges.length > 0;
  const filterSet =
    classFilter && classFilter.length > 0 ? new Set(classFilter) : null;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!Number.isFinite(v) || (noData != null && v === noData)) continue;
    if (hasRanges && !ranges!.some(([lo, hi]) => v >= lo && v <= hi)) continue;
    if (filterSet && !filterSet.has(Math.round(v))) continue;
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

/**
 * Colorize a flat band of class-code values by exact lookup rather than
 * interpolation — for nominal data, where the numeric values are unordered
 * codes and blending two of them together would be meaningless. Values with
 * no matching color, or excluded by `classFilter`, are left transparent.
 */
export const colorizeCategoricalBand = (
  values: ArrayLike<number>,
  noData: number | null,
  colorsById: Map<number, [number, number, number]>,
  classFilter?: number[] | null,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(values.length * 4);
  const filterSet =
    classFilter && classFilter.length > 0 ? new Set(classFilter) : null;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!Number.isFinite(v) || (noData != null && v === noData)) continue;
    const id = Math.round(v);
    if (filterSet && !filterSet.has(id)) continue;
    const color = colorsById.get(id);
    if (!color) continue;
    const o = i * 4;
    out[o] = color[0];
    out[o + 1] = color[1];
    out[o + 2] = color[2];
    out[o + 3] = 255;
  }
  return out;
};

/**
 * Counts how many sampled pixels fall in each class, regardless of
 * `classFilter` — this feeds the legend's "which classes are visible /
 * their pixel counts" tracking, which needs to see excluded classes too so
 * they can still be toggled back on. Mirrors the backend's
 * `X-Nominal-Classes` tile response header for remote sources.
 */
export const tallyCategoricalCounts = (
  values: ArrayLike<number>,
  noData: number | null,
): { id: number; count: number }[] => {
  const counts = new Map<number, number>();
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!Number.isFinite(v) || (noData != null && v === noData)) continue;
    const id = Math.round(v);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].map(([id, count]) => ({ id, count }));
};

/** `#rrggbb` -> `[r, g, b]`, or null if malformed. */
export const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Read `colormap`, `render_range`, `value_ranges` and `class_filter` from a
 * tile URL query. */
export const parseTileStyleFromUrl = (
  url: string,
): {
  colormap: string | null;
  renderRange: [number, number] | null;
  valueRanges: [number, number][] | null;
  classFilter: number[] | null;
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
  const cf = params
    .getAll('class_filter')
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const classFilter = cf.length > 0 ? cf : null;
  return { colormap, renderRange, valueRanges, classFilter };
};
