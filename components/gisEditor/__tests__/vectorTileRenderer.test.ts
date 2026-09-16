// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

// readPointValue() and renderTile()'s early-exit path don't touch canvas at
// all — this suite exercises exactly those (the real point-in-polygon/hole
// ray-casting math, and bbox-based tile pre-filtering), the same pragmatic
// split cogTileRenderer.ts's own (untested, canvas-only) rendering has
// always relied on manual/live browser verification for instead.

import { createVectorTileRenderer } from '../vectorTileRenderer';
import type { OverviewLevel } from '../douglasPeucker';
import type { GeoJsonFeatureCollection } from '../shapefileMetadata';

// A square with a square hole punched out of its middle, RFC 7946 winding
// (exterior CCW, hole CW) — real ecoregion-shaped data, not a simplified
// stand-in, since the whole point is to prove the hole subtracts correctly.
const donut: GeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
          [
            [4, 4],
            [4, 6],
            [6, 6],
            [6, 4],
            [4, 4],
          ],
        ],
      },
      properties: { NAME: 'Donut' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [20, 20],
            [21, 20],
            [21, 21],
            [20, 21],
            [20, 20],
          ],
        ],
      },
      properties: { NAME: 'Elsewhere' },
    },
  ],
};

const classIndexByValue = new Map([
  ['Donut', 0],
  ['Elsewhere', 1],
]);
const classColorsById = new Map([
  [0, '#ff0000'],
  [1, '#00ff00'],
]);
const classNamesById = new Map([
  [0, 'Donut'],
  [1, 'Elsewhere'],
]);
const getStyle = () => ({ classColorsById, classNamesById });
const overviewLevels: OverviewLevel[] = [{ tolerance: 0, data: donut }];

describe('createVectorTileRenderer', () => {
  it('readPointValue: a point inside the exterior ring but outside the hole is the class', async () => {
    const renderer = createVectorTileRenderer({
      overviewLevels,
      field: 'NAME',
      classIndexByValue,
      getStyle,
      bbox: [0, 0, 21, 21],
    });
    const hit = await renderer.readPointValue(1, 1); // lat, lon -- well inside the ring, outside the hole
    expect(hit).toEqual({
      value: 0,
      className: 'Donut',
      classColor: '#ff0000',
    });
  });

  it('readPointValue: a point inside the hole is not contained (winding subtracts correctly)', async () => {
    const renderer = createVectorTileRenderer({
      overviewLevels,
      field: 'NAME',
      classIndexByValue,
      getStyle,
      bbox: [0, 0, 21, 21],
    });
    const hit = await renderer.readPointValue(5, 5); // lat, lon -- inside the punched-out hole
    expect(hit).toBeNull();
  });

  it('readPointValue: a point outside every feature bbox is null', async () => {
    const renderer = createVectorTileRenderer({
      overviewLevels,
      field: 'NAME',
      classIndexByValue,
      getStyle,
      bbox: [0, 0, 21, 21],
    });
    const hit = await renderer.readPointValue(50, 50);
    expect(hit).toBeNull();
  });

  it('readPointValue: single-color mode (no field) treats every feature as class 0', async () => {
    const renderer = createVectorTileRenderer({
      overviewLevels,
      field: null,
      classIndexByValue: new Map(),
      getStyle: () => ({
        classColorsById: new Map([[0, '#3388ff']]),
        classNamesById: new Map([[0, 'All features']]),
      }),
      bbox: [0, 0, 21, 21],
    });
    const inDonut = await renderer.readPointValue(1, 1);
    const inElsewhere = await renderer.readPointValue(20.5, 20.5);
    expect(inDonut?.value).toBe(0);
    expect(inElsewhere?.value).toBe(0);
  });

  it('renderTile: a tile with no intersecting features returns null without touching canvas', async () => {
    const renderer = createVectorTileRenderer({
      overviewLevels,
      field: 'NAME',
      classIndexByValue,
      getStyle,
      bbox: [0, 0, 21, 21],
    });
    // z=18 tile far from both features (mid-Pacific) -- guaranteed no bbox
    // overlap, so this returns via the early exit before any canvas call,
    // which is what makes it safe to run under Node's jest environment
    // (no OffscreenCanvas/document here at all).
    const tile = await renderer.renderTile(18, 1, 1, 'localtiles://tile');
    expect(tile).toBeNull();
  });

  it('exposes an opening view centered on the given bbox', () => {
    const renderer = createVectorTileRenderer({
      overviewLevels,
      field: 'NAME',
      classIndexByValue,
      getStyle,
      bbox: [0, 0, 20, 20],
    });
    expect(renderer.view.lat).toBeCloseTo(10);
    expect(renderer.view.lon).toBeCloseTo(10);
  });
});
