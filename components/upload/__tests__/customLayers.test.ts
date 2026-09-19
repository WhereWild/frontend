// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type * as DocumentPicker from 'expo-document-picker';
import { inspectRaster } from '@/components/gisEditor/rasterMetadata';
import {
  createCogTileRenderer,
  UnsupportedCrsError,
} from '@/components/gisEditor/cogTileRenderer';
import {
  customLayerIdFromFilename,
  findCustomLayersMissingMetadata,
  inspectCustomLayerAsset,
  inspectGeoJsonCached,
  sampleCustomLayer,
} from '../customLayers';

jest.mock('@/components/gisEditor/rasterMetadata', () => ({
  inspectRaster: jest.fn(),
}));
jest.mock('@/components/gisEditor/cogTileRenderer', () => {
  const actual = jest.requireActual('@/components/gisEditor/cogTileRenderer');
  return {
    ...actual,
    createCogTileRenderer: jest.fn(),
  };
});

const mockInspectRaster = jest.mocked(inspectRaster);
const mockCreateCogTileRenderer = jest.mocked(createCogTileRenderer);

const assetWithBlob = (
  name: string,
  content: string,
): DocumentPicker.DocumentPickerAsset =>
  ({
    name,
    uri: `file://${name}`,
    file: new Blob([content]),
  }) as unknown as DocumentPicker.DocumentPickerAsset;

describe('customLayerIdFromFilename', () => {
  it('slugifies a normal filename', () => {
    expect(customLayerIdFromFilename('Local Wetlands.tif')).toBe(
      'local_wetlands',
    );
  });

  it('strips leading/trailing punctuation after slugifying', () => {
    expect(customLayerIdFromFilename('-my layer-.geojson')).toBe('my_layer');
  });

  it('falls back to a default id for an all-punctuation name', () => {
    expect(customLayerIdFromFilename('***.tif')).toBe('custom_layer');
  });
});

describe('inspectCustomLayerAsset / findCustomLayersMissingMetadata (raster)', () => {
  beforeEach(() => {
    mockInspectRaster.mockReset();
  });

  it('reports metadata present for a configured continuous raster', async () => {
    mockInspectRaster.mockResolvedValueOnce({
      savedConfig: { valueType: 'ratio', classes: [] },
    } as never);
    const result = await inspectCustomLayerAsset(assetWithBlob('x.tif', ''));
    expect(result).toEqual({ kind: 'raster', hasMetadata: true });
  });

  it('reports metadata missing when savedConfig is null', async () => {
    mockInspectRaster.mockResolvedValueOnce({ savedConfig: null } as never);
    const result = await inspectCustomLayerAsset(assetWithBlob('x.tif', ''));
    expect(result).toEqual({ kind: 'raster', hasMetadata: false });
  });

  it('treats a circular raster as missing usable metadata', async () => {
    mockInspectRaster.mockResolvedValueOnce({
      savedConfig: { valueType: 'circular', classes: [] },
    } as never);
    const result = await inspectCustomLayerAsset(assetWithBlob('x.tif', ''));
    expect(result.hasMetadata).toBe(false);
  });

  it('collects filenames missing metadata across a mixed batch', async () => {
    mockInspectRaster
      .mockResolvedValueOnce({
        savedConfig: { valueType: 'ratio', classes: [] },
      } as never)
      .mockResolvedValueOnce({ savedConfig: null } as never);
    const names = await findCustomLayersMissingMetadata([
      assetWithBlob('good.tif', ''),
      assetWithBlob('bad.tif', ''),
    ]);
    expect(names).toEqual(['bad.tif']);
  });

  it('treats an unparseable file as missing metadata rather than throwing', async () => {
    mockInspectRaster.mockRejectedValueOnce(new Error('corrupt'));
    const names = await findCustomLayersMissingMetadata([
      assetWithBlob('bad.tif', ''),
    ]);
    expect(names).toEqual(['bad.tif']);
  });

  it('treats an unsupported extension as missing metadata', async () => {
    const names = await findCustomLayersMissingMetadata([
      assetWithBlob('data.shp', ''),
    ]);
    expect(names).toEqual(['data.shp']);
  });
});

describe('inspectCustomLayerAsset (vector)', () => {
  const categoricalFeatureCollection = JSON.stringify({
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
          WW_COLOR: '#0f0',
        },
      },
    ],
  });

  const singleModeFeatureCollection = JSON.stringify({
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
        properties: { WW_MODE: 'single', WW_COLOR: '#0f0' },
      },
    ],
  });

  it('reports metadata present for a categorical vector layer', async () => {
    const result = await inspectCustomLayerAsset(
      assetWithBlob('x.geojson', categoricalFeatureCollection),
    );
    expect(result).toEqual({ kind: 'vector', hasMetadata: true });
  });

  it('treats a "single" mode vector as missing usable metadata', async () => {
    const result = await inspectCustomLayerAsset(
      assetWithBlob('x.geojson', singleModeFeatureCollection),
    );
    expect(result.hasMetadata).toBe(false);
  });

  it('treats an unstyled GeoJSON (no WW_* properties at all) as missing metadata', async () => {
    const fc = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: null, properties: { LAND_USE: 'Forest' } },
      ],
    });
    const result = await inspectCustomLayerAsset(
      assetWithBlob('x.geojson', fc),
    );
    expect(result.hasMetadata).toBe(false);
  });
});

describe('sampleCustomLayer (vector)', () => {
  it('samples points into sequential class ids matching first-seen class order', async () => {
    const fc = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [0, 10],
                [10, 10],
                [10, 0],
                [0, 0],
              ],
            ],
          },
          properties: {
            LAND_USE: 'Forest',
            WW_MODE: 'categorical',
            WW_FIELD: 'LAND_USE',
            WW_COLOR: '#0f0',
          },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [20, 0],
                [20, 10],
                [30, 10],
                [30, 0],
                [20, 0],
              ],
            ],
          },
          properties: {
            LAND_USE: 'Grassland',
            WW_MODE: 'categorical',
            WW_FIELD: 'LAND_USE',
            WW_COLOR: '#ff0',
          },
        },
      ],
    });
    const asset = assetWithBlob('landcover.geojson', fc);

    const result = await sampleCustomLayer(asset, [
      { lat: 5, lon: 5 }, // inside "Forest" (first feature -> class 0)
      { lat: 5, lon: 25 }, // inside "Grassland" (second feature -> class 1)
      { lat: 50, lon: 50 }, // outside every feature
    ]);

    expect(result).not.toBeNull();
    expect(result!.values).toEqual([0, 1, null]);
    expect(result!.descriptor).toEqual({
      id: 'landcover',
      name: 'landcover',
      valueType: 'nominal',
      legendClasses: [
        { id: 0, name: 'Forest', color: '#0f0' },
        { id: 1, name: 'Grassland', color: '#ff0' },
      ],
    });
  });

  it('respects polygon holes (a point inside a hole is not inside the feature)', async () => {
    const fc = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [0, 10],
                [10, 10],
                [10, 0],
                [0, 0],
              ], // outer ring
              [
                [4, 4],
                [4, 6],
                [6, 6],
                [6, 4],
                [4, 4],
              ], // hole
            ],
          },
          properties: {
            LAND_USE: 'Forest',
            WW_MODE: 'categorical',
            WW_FIELD: 'LAND_USE',
            WW_COLOR: '#0f0',
          },
        },
      ],
    });
    const asset = assetWithBlob('landcover.geojson', fc);

    const result = await sampleCustomLayer(asset, [
      { lat: 5, lon: 5 }, // inside the hole
      { lat: 1, lon: 1 }, // inside the outer ring, outside the hole
    ]);

    expect(result!.values).toEqual([null, 0]);
  });

  it('returns null for a "single" mode vector (nothing meaningful to sample)', async () => {
    const fc = JSON.stringify({
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
          properties: { WW_MODE: 'single', WW_COLOR: '#0f0' },
        },
      ],
    });
    const result = await sampleCustomLayer(assetWithBlob('x.geojson', fc), [
      { lat: 0.5, lon: 0.5 },
    ]);
    expect(result).toBeNull();
  });
});

describe('display name', () => {
  it("uses a vector layer's saved display name as the variable name, keeping the slugged id", async () => {
    const fc = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [0, 10],
                [10, 10],
                [10, 0],
                [0, 0],
              ],
            ],
          },
          properties: {
            LAND_USE: 'Forest',
            WW_MODE: 'categorical',
            WW_FIELD: 'LAND_USE',
            WW_COLOR: '#0f0',
            WW_NAME: 'Utah Ecoregions',
          },
        },
      ],
    });
    const result = await sampleCustomLayer(
      assetWithBlob('utah_l4.geojson', fc),
      [{ lat: 5, lon: 5 }],
    );
    expect(result!.descriptor.id).toBe('utah_l4');
    expect(result!.descriptor.name).toBe('Utah Ecoregions');
  });

  it("uses a raster layer's saved display name as the variable name, keeping the slugged id", async () => {
    mockInspectRaster.mockResolvedValueOnce({
      savedConfig: {
        valueType: 'ratio',
        classes: [],
        displayName: 'Soil salinity',
      },
      scale: 1,
      offset: 0,
      units: null,
    } as never);
    mockCreateCogTileRenderer.mockResolvedValueOnce({
      readPointValue: jest.fn().mockResolvedValue({ value: 1 }),
      dispose: jest.fn(),
    } as never);
    const result = await sampleCustomLayer(
      { name: 'salinity_two.tif', uri: 'x', file: new Blob(['']) } as never,
      [{ lat: 1, lon: 1 }],
    );
    expect(result!.descriptor.id).toBe('salinity_two');
    expect(result!.descriptor.name).toBe('Soil salinity');
  });
});

describe('vector sampling performance behavior', () => {
  const collection = JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [0, 10],
              [10, 10],
              [10, 0],
              [0, 0],
            ],
          ],
        },
        properties: {
          LAND_USE: 'Forest',
          WW_MODE: 'categorical',
          WW_FIELD: 'LAND_USE',
          WW_COLOR: '#0f0',
        },
      },
    ],
  });

  it('parses an attached file once, however many callers ask', async () => {
    const asset = assetWithBlob('landcover.geojson', collection);
    const first = inspectGeoJsonCached(asset);
    expect(inspectGeoJsonCached(asset)).toBe(first);
    await inspectCustomLayerAsset(asset);
    await sampleCustomLayer(asset, [{ lat: 5, lon: 5 }]);
    const { geojson } = await first;
    expect((await inspectGeoJsonCached(asset)).geojson).toBe(geojson);
  });

  it('does not remember a failed parse, so a fixed file can be retried', async () => {
    const asset = assetWithBlob('bad.geojson', '{not json');
    const first = inspectGeoJsonCached(asset);
    await expect(first).rejects.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = inspectGeoJsonCached(asset);
    expect(second).not.toBe(first);
    await expect(second).rejects.toThrow();
  });

  it('yields to the event loop and reports progress while sampling many points, without changing the result', async () => {
    let now = 0;
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => (now += 40));
    const progress = jest.fn();
    try {
      const points = Array.from({ length: 200 }, (_, i) => ({
        lat: i % 2 === 0 ? 5 : 50,
        lon: 5,
      }));
      const result = await sampleCustomLayer(
        assetWithBlob('landcover.geojson', collection),
        points,
        progress,
      );
      expect(result!.values).toEqual(
        points.map((_, i) => (i % 2 === 0 ? 0 : null)),
      );
      expect(progress).toHaveBeenCalled();
      const [done, total] = progress.mock.calls[progress.mock.calls.length - 1];
      expect(total).toBe(200);
      expect(done).toBeGreaterThan(0);
    } finally {
      nowSpy.mockRestore();
    }
  });
});

describe('sampleCustomLayer (raster)', () => {
  beforeEach(() => {
    mockInspectRaster.mockReset();
    mockCreateCogTileRenderer.mockReset();
  });

  it('samples each point via readPointValue and disposes the renderer afterward', async () => {
    mockInspectRaster.mockResolvedValueOnce({
      savedConfig: { valueType: 'ratio', classes: [] },
      scale: 1,
      offset: 0,
      units: 'mm',
    } as never);
    const readPointValue = jest
      .fn()
      .mockResolvedValueOnce({ value: 5 })
      .mockResolvedValueOnce(null);
    const dispose = jest.fn();
    mockCreateCogTileRenderer.mockResolvedValueOnce({
      readPointValue,
      dispose,
    } as never);

    const result = await sampleCustomLayer(assetWithBlob('rainfall.tif', ''), [
      { lat: 1, lon: 2 },
      { lat: 3, lon: 4 },
    ]);

    expect(result!.values).toEqual([5, null]);
    expect(result!.descriptor).toEqual({
      id: 'rainfall',
      name: 'rainfall',
      valueType: 'ratio',
      units: 'mm',
      legendClasses: null,
    });
    expect(readPointValue).toHaveBeenNthCalledWith(1, 1, 2);
    expect(readPointValue).toHaveBeenNthCalledWith(2, 3, 4);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('returns null for an unsupported CRS instead of throwing', async () => {
    mockInspectRaster.mockResolvedValueOnce({
      savedConfig: { valueType: 'ratio', classes: [] },
      scale: 1,
      offset: 0,
    } as never);
    mockCreateCogTileRenderer.mockRejectedValueOnce(
      new UnsupportedCrsError('nope'),
    );

    const result = await sampleCustomLayer(assetWithBlob('x.tif', ''), [
      { lat: 1, lon: 2 },
    ]);
    expect(result).toBeNull();
  });

  it('returns null for a circular raster without ever creating a renderer', async () => {
    mockInspectRaster.mockResolvedValueOnce({
      savedConfig: { valueType: 'circular', classes: [] },
    } as never);

    const result = await sampleCustomLayer(assetWithBlob('wind.tif', ''), [
      { lat: 1, lon: 2 },
    ]);
    expect(result).toBeNull();
    expect(mockCreateCogTileRenderer).not.toHaveBeenCalled();
  });
});
