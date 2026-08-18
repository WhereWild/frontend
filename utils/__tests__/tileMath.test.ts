// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { bandZoomForRawZoom, deg2tile, OCCURRENCE_BAND_ZOOMS } from '../tileMath';

describe('bandZoomForRawZoom', () => {
  it('returns the exact band for a raw zoom that is itself a band boundary', () => {
    for (const band of OCCURRENCE_BAND_ZOOMS) {
      expect(bandZoomForRawZoom(band)).toBe(band);
    }
  });

  it('snaps a raw zoom between two bands down to the lower one', () => {
    expect(bandZoomForRawZoom(1)).toBe(0);
    expect(bandZoomForRawZoom(3)).toBe(0);
    expect(bandZoomForRawZoom(5)).toBe(4);
    expect(bandZoomForRawZoom(6)).toBe(4);
    expect(bandZoomForRawZoom(9)).toBe(7);
    expect(bandZoomForRawZoom(12)).toBe(10);
  });

  it('clamps a raw zoom past the finest band to the finest band', () => {
    expect(bandZoomForRawZoom(15)).toBe(15);
    expect(bandZoomForRawZoom(20)).toBe(15);
    expect(bandZoomForRawZoom(24)).toBe(15);
  });
});

describe('deg2tile', () => {
  it('maps the world origin to the expected tile at low zoom', () => {
    // (0, 0) lat/lon sits on the boundary between all four z=1 tiles;
    // slippy-map convention rounds it into the SE quadrant (x=1, y=1).
    expect(deg2tile(0, 0, 1)).toEqual({ x: 1, y: 1 });
  });

  it('clamps to the valid [0, 2^z) range at the poles/antimeridian', () => {
    expect(deg2tile(85, 179.9, 2)).toEqual({ x: 3, y: 0 });
    expect(deg2tile(-85, -179.9, 2)).toEqual({ x: 0, y: 3 });
  });

  it('produces a larger tile grid at higher zoom for the same point', () => {
    const low = deg2tile(40.7, -74.0, 4);
    const high = deg2tile(40.7, -74.0, 14);
    expect(low.x).toBeLessThan(high.x);
    expect(low.y).toBeLessThan(high.y);
  });
});
