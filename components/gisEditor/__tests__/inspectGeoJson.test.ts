// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import { readFileSync } from 'fs';
import { inspectGeoJson } from '../shapefileMetadata';

describe('inspectGeoJson', () => {
  it('parses a real GeoJSON file produced by scripts/examples/fetch_state_ecoregions.py', async () => {
    // Generated once (not committed — too large) via:
    //   python3 scripts/examples/fetch_state_ecoregions.py "Rhode Island" \
    //     --output /tmp/ri.geojson
    // then copied out; this test skips itself if that file isn't present,
    // since it's a real-data spot check, not something CI can regenerate
    // (the script hits the live EPA site).
    let bytes: Buffer;
    try {
      bytes = readFileSync('/tmp/ri_ecoregions_test.geojson');
    } catch {
      return;
    }
    const { metadata, geojson } = await inspectGeoJson(
      new Blob([new Uint8Array(bytes)]),
    );
    expect(metadata.savedConfig?.mode).toBe('categorical');
    expect(metadata.savedConfig?.field).toBe('ECO_LABEL');
    expect(geojson.features.length).toBeGreaterThan(0);
    expect(metadata.crsLabel).toContain('WGS84');
  });

  it('parses a hand-built FeatureCollection and detects saved WW_* styling', async () => {
    const fc = {
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
          properties: {
            LAND_USE: 'Forest',
            WW_MODE: 'categorical',
            WW_FIELD: 'LAND_USE',
            WW_COLOR: '#00ff00',
          },
        },
      ],
    };
    const blob = new Blob([JSON.stringify(fc)]);
    const { metadata, geojson } = await inspectGeoJson(blob);
    expect(metadata.featureCount).toBe(1);
    expect(metadata.geometryType).toBe('Polygon');
    expect(metadata.fields).toEqual([
      { name: 'LAND_USE', type: 'string', likelyCategorical: true },
    ]);
    expect(metadata.savedConfig).toEqual({
      mode: 'categorical',
      color: null,
      field: 'LAND_USE',
      classes: [{ value: 'Forest', name: 'Forest', color: '#00ff00' }],
    });
    expect(geojson.features[0].properties?.LAND_USE).toBe('Forest');
  });

  it('flags a numeric field as non-categorical when every row is unique (an ID/measurement), but not a low-cardinality one', async () => {
    const feature = (objectid: number, region: number, name: string) => ({
      type: 'Feature' as const,
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
      properties: { OBJECTID: objectid, EPA_REGION: region, NAME: name },
    });
    const fc = {
      type: 'FeatureCollection',
      features: [
        feature(1, 8, 'A'),
        feature(2, 8, 'B'),
        feature(3, 9, 'A'),
        feature(4, 9, 'B'),
      ],
    };
    const { metadata } = await inspectGeoJson(new Blob([JSON.stringify(fc)]));
    expect(metadata.fields).toEqual([
      { name: 'OBJECTID', type: 'number', likelyCategorical: false },
      { name: 'EPA_REGION', type: 'number', likelyCategorical: true },
      { name: 'NAME', type: 'string', likelyCategorical: true },
    ]);
  });

  it('rejects invalid JSON with a clear error', async () => {
    const blob = new Blob(['not json at all {']);
    await expect(inspectGeoJson(blob)).rejects.toThrow('valid JSON');
  });

  it('rejects valid JSON that is not a FeatureCollection', async () => {
    const blob = new Blob([
      JSON.stringify({ type: 'Feature', properties: {} }),
    ]);
    await expect(inspectGeoJson(blob)).rejects.toThrow('FeatureCollection');
  });
});
