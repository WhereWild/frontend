// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import { buildStyledGeoJson } from '../geoJsonWriter';
import { inspectGeoJson } from '../shapefileMetadata';
import type { GeoJsonFeatureCollection } from '../shapefileMetadata';
import type { VectorEditableMeta } from '../vectorEditableMeta';

const baseFc: GeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
            [0, 0],
          ],
        ],
      },
      properties: { LAND_USE: 'Forest' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [10, 10],
            [10, 11],
            [11, 11],
            [11, 10],
            [10, 10],
          ],
        ],
      },
      properties: { LAND_USE: 'Water' },
    },
  ],
};

describe('buildStyledGeoJson', () => {
  it('round-trips categorical styling through the real inspectGeoJson reader, geometry intact', async () => {
    const editable: VectorEditableMeta = {
      mode: 'categorical',
      color: '#3388ff',
      field: 'LAND_USE',
      classes: [
        { value: 'Forest', name: 'Forest', color: '#00ff00' },
        { value: 'Water', name: 'Water', color: '#0000ff' },
      ],
    };
    const blob = buildStyledGeoJson(baseFc, editable);
    const { metadata, geojson } = await inspectGeoJson(blob);

    expect(metadata.savedConfig).toEqual({
      mode: 'categorical',
      color: null,
      field: 'LAND_USE',
      classes: [
        { value: 'Forest', name: 'Forest', color: '#00ff00' },
        { value: 'Water', name: 'Water', color: '#0000ff' },
      ],
    });
    // Original geometry and attribute untouched.
    expect(geojson.features[0].geometry).toEqual(baseFc.features[0].geometry);
    expect(geojson.features[0].properties?.LAND_USE).toBe('Forest');
    expect(geojson.features[1].geometry).toEqual(baseFc.features[1].geometry);
  });

  it('round-trips single-color styling', async () => {
    const editable: VectorEditableMeta = {
      mode: 'single',
      color: '#ff8800',
      field: null,
      classes: [],
    };
    const blob = buildStyledGeoJson(baseFc, editable);
    const { metadata } = await inspectGeoJson(blob);
    expect(metadata.savedConfig).toEqual({
      mode: 'single',
      color: '#ff8800',
      field: null,
      classes: [],
    });
  });
});
