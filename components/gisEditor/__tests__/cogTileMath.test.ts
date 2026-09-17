// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import {
  buildColorLut,
  colorizeBand,
  colorizeCategoricalBand,
  hexToRgb,
  lngLatToMercator,
  MERCATOR_ORIGIN_SHIFT,
  mercatorToLngLat,
  parseTileStyleFromUrl,
  sampleValueRange,
  tallyCategoricalCounts,
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

describe('lngLatToMercator', () => {
  it('is the inverse of mercatorToLngLat', () => {
    const [mx, my] = lngLatToMercator(-97.5, 39.2);
    const [lon, lat] = mercatorToLngLat(mx, my);
    expect(lon).toBeCloseTo(-97.5, 6);
    expect(lat).toBeCloseTo(39.2, 6);
  });

  it('maps the origin to (0,0)', () => {
    const [mx, my] = lngLatToMercator(0, 0);
    expect(mx).toBeCloseTo(0);
    expect(my).toBeCloseTo(0);
  });

  it('clamps latitude to the mercator limit', () => {
    const [, my] = lngLatToMercator(0, 89);
    expect(my).toBeCloseTo(MERCATOR_ORIGIN_SHIFT, 0);
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

  it('masks pixels excluded by classFilter', () => {
    const rgba = colorizeBand([1, 2, 3], 1, 3, null, lut, null, [1, 3]);
    expect(rgba[3]).toBe(255); // 1 is included
    expect(rgba[7]).toBe(0); // 2 is excluded
    expect(rgba[11]).toBe(255); // 3 is included
  });
});

describe('colorizeCategoricalBand', () => {
  const colorsById = new Map<number, [number, number, number]>([
    [1, [255, 0, 0]],
    [2, [0, 255, 0]],
  ]);

  it('colors pixels by exact class match, leaving unknown classes transparent', () => {
    const rgba = colorizeCategoricalBand([1, 2, 5], null, colorsById);
    expect([...rgba.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...rgba.slice(4, 8)]).toEqual([0, 255, 0, 255]);
    expect(rgba[11]).toBe(0); // class 5 has no color
  });

  it('treats noData as transparent', () => {
    const rgba = colorizeCategoricalBand([1, -9999], -9999, colorsById);
    expect(rgba[7]).toBe(0);
  });

  it('masks classes excluded by classFilter', () => {
    const rgba = colorizeCategoricalBand([1, 2], null, colorsById, [1]);
    expect(rgba[3]).toBe(255); // class 1 included
    expect(rgba[7]).toBe(0); // class 2 filtered out
  });
});

describe('tallyCategoricalCounts', () => {
  it('counts pixels per class, ignoring noData', () => {
    const counts = tallyCategoricalCounts([1, 1, 2, -9999, 1], -9999);
    expect(counts).toEqual(
      expect.arrayContaining([
        { id: 1, count: 3 },
        { id: 2, count: 1 },
      ]),
    );
  });

  it('is unaffected by classFilter (reports all classes present)', () => {
    // tallyCategoricalCounts has no classFilter param — this documents why:
    // the legend needs to know about excluded classes too, to let them be
    // toggled back on.
    const counts = tallyCategoricalCounts([1, 2, 3], null);
    expect(counts.map((c) => c.id).sort()).toEqual([1, 2, 3]);
  });
});

describe('sampleValueRange', () => {
  it('finds the min/max, ignoring noData and non-finite samples', () => {
    expect(sampleValueRange([3, -9999, NaN, 7, 1], -9999)).toEqual({
      min: 1,
      max: 7,
    });
  });

  it('returns null when every sample is missing/noData', () => {
    expect(sampleValueRange([-9999, -9999], -9999)).toBeNull();
    expect(sampleValueRange([], null)).toBeNull();
  });

  it('treats null noData as "no sentinel to exclude"', () => {
    expect(sampleValueRange([0, -5, 10], null)).toEqual({ min: -5, max: 10 });
  });
});

describe('hexToRgb', () => {
  it('parses a hex color', () => {
    expect(hexToRgb('#ff8800')).toEqual([255, 136, 0]);
  });

  it('parses without a leading #', () => {
    expect(hexToRgb('00ff00')).toEqual([0, 255, 0]);
  });

  it('returns null for malformed input', () => {
    expect(hexToRgb('not-a-color')).toBeNull();
    expect(hexToRgb('#fff')).toBeNull();
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
      classFilter: null,
    });
  });

  it('returns nulls for a bare url', () => {
    expect(parseTileStyleFromUrl('localtiles://api/x/tiles/1/2/3.png')).toEqual(
      {
        colormap: null,
        renderRange: null,
        valueRanges: null,
        classFilter: null,
      },
    );
  });

  it('reads repeated class_filter params', () => {
    const url =
      'localtiles://api/x/tiles/1/2/3.png?class_filter=1&class_filter=3';
    expect(parseTileStyleFromUrl(url).classFilter).toEqual([1, 3]);
  });
});
