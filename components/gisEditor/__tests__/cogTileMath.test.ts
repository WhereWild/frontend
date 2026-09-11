// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import {
  buildColorLut,
  colorizeBand,
  MERCATOR_ORIGIN_SHIFT,
  mercatorToLngLat,
  parseTileStyleFromUrl,
  tileToMercatorBounds,
} from '../cogTileMath';

describe('tileToMercatorBounds', () => {
  it('covers the whole world at z0', () => {
    expect(tileToMercatorBounds(0, 0, 0)).toEqual([
      -MERCATOR_ORIGIN_SHIFT,
      -MERCATOR_ORIGIN_SHIFT,
      MERCATOR_ORIGIN_SHIFT,
      MERCATOR_ORIGIN_SHIFT,
    ]);
  });
});

describe('mercatorToLngLat', () => {
  it('maps the origin to (0,0) and the extent to ±180 / ~85.05', () => {
    expect(mercatorToLngLat(0, 0)).toEqual([0, 0]);
    const [lon, lat] = mercatorToLngLat(
      MERCATOR_ORIGIN_SHIFT,
      MERCATOR_ORIGIN_SHIFT,
    );
    expect(lon).toBeCloseTo(180);
    expect(lat).toBeCloseTo(85.0511, 3);
  });
});

describe('buildColorLut / colorizeBand', () => {
  const lut = buildColorLut([
    [0, 0, 0],
    [255, 255, 255],
  ]);

  it('maps min/max to first/last colour, opaque', () => {
    const rgba = colorizeBand([0, 10], 0, 10, null, lut);
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 255]);
    expect(Array.from(rgba.slice(4, 8))).toEqual([255, 255, 255, 255]);
  });

  it('makes nodata / non-finite transparent', () => {
    const rgba = colorizeBand([5, -9999, NaN], 0, 10, -9999, lut);
    expect(rgba[3]).toBe(255);
    expect(Array.from(rgba.slice(4, 12))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('masks pixels outside the value ranges', () => {
    const rgba = colorizeBand([2, 8], 0, 10, null, lut, [[5, 10]]);
    expect(rgba[3]).toBe(0); // 2 is outside
    expect(rgba[7]).toBe(255); // 8 is inside
  });
});

describe('parseTileStyleFromUrl', () => {
  it('reads colormap, render_range and value_ranges', () => {
    const url =
      'localtiles://api/variables/x/tiles/1/2/3.png?colormap=plasma&render_range=%5B10%2C20%5D&value_ranges=%5B%5B1%2C2%5D%5D';
    expect(parseTileStyleFromUrl(url)).toEqual({
      colormap: 'plasma',
      renderRange: [10, 20],
      valueRanges: [[1, 2]],
    });
  });

  it('returns nulls for a bare url', () => {
    expect(parseTileStyleFromUrl('localtiles://api/x/tiles/1/2/3.png')).toEqual(
      {
        colormap: null,
        renderRange: null,
        valueRanges: null,
      },
    );
  });
});
