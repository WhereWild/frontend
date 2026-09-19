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
      displayName: '',
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
      displayName: null,
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
      displayName: '',
      mode: 'single',
      color: '#ff8800',
      field: null,
      classes: [],
    };
    const blob = buildStyledGeoJson(baseFc, editable);
    const { metadata } = await inspectGeoJson(blob);
    expect(metadata.savedConfig).toEqual({
      displayName: null,
      mode: 'single',
      color: '#ff8800',
      field: null,
      classes: [],
    });
  });

  it('round-trips the display name in both modes, and keeps it out of the field list', async () => {
    for (const editable of [
      {
        displayName: 'Ecoregions (L4)',
        mode: 'single' as const,
        color: '#ff0000',
        field: null,
        classes: [],
      },
      {
        displayName: 'Ecoregions (L4)',
        mode: 'categorical' as const,
        color: '#3388ff',
        field: 'LAND_USE',
        classes: [
          { value: 'Forest', name: 'Forest', color: '#00ff00' },
          { value: 'Water', name: 'Water', color: '#0000ff' },
        ],
      },
    ] satisfies VectorEditableMeta[]) {
      const blob = buildStyledGeoJson(baseFc, editable);
      const { metadata } = await inspectGeoJson(blob);
      expect(metadata.savedConfig?.displayName).toBe('Ecoregions (L4)');
      expect(metadata.fields.map((f) => f.name)).toEqual(['LAND_USE']);
    }
  });

  it('removes a previously saved name when the field is cleared, instead of carrying it through', async () => {
    const named: VectorEditableMeta = {
      displayName: 'Old name',
      mode: 'single',
      color: '#ff0000',
      field: null,
      classes: [],
    };
    const first = await inspectGeoJson(buildStyledGeoJson(baseFc, named));
    const cleared = await inspectGeoJson(
      buildStyledGeoJson(first.geojson, { ...named, displayName: '  ' }),
    );

    expect(cleared.metadata.savedConfig?.displayName).toBeNull();
    expect(
      cleared.geojson.features.every(
        (f) => !('WW_NAME' in (f.properties ?? {})),
      ),
    ).toBe(true);
  });
});
