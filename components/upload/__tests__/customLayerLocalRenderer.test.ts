// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type * as DocumentPicker from 'expo-document-picker';
import { inspectRaster } from '@/components/gisEditor/rasterMetadata';
import {
  createCogTileRenderer,
  UnsupportedCrsError,
} from '@/components/gisEditor/cogTileRenderer';
import { inspectGeoJson } from '@/components/gisEditor/shapefileMetadata';
import { createVectorTileRenderer } from '@/components/gisEditor/vectorTileRenderer';
import { buildOverviewLevels } from '@/components/gisEditor/douglasPeucker';
import { resolveAssetBlob } from '@/hooks/upload/uploadWorkflowHelpers';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import { createLocalCustomLayerRenderer } from '../customLayerLocalRenderer';

jest.mock('@/components/gisEditor/rasterMetadata', () => ({
  inspectRaster: jest.fn(),
}));
jest.mock('@/components/gisEditor/cogTileRenderer', () => {
  const actual = jest.requireActual('@/components/gisEditor/cogTileRenderer');
  return { ...actual, createCogTileRenderer: jest.fn() };
});
jest.mock('@/components/gisEditor/shapefileMetadata', () => ({
  inspectGeoJson: jest.fn(),
}));
jest.mock('@/components/gisEditor/vectorTileRenderer', () => ({
  createVectorTileRenderer: jest.fn(),
}));
jest.mock('@/components/gisEditor/douglasPeucker', () => ({
  ...jest.requireActual('@/components/gisEditor/douglasPeucker'),
  buildOverviewLevels: jest.fn(),
}));
jest.mock('@/hooks/upload/uploadWorkflowHelpers', () => ({
  resolveAssetBlob: jest.fn(),
}));

const mockInspectRaster = jest.mocked(inspectRaster);
const mockCreateCogTileRenderer = jest.mocked(createCogTileRenderer);
const mockInspectGeoJson = jest.mocked(inspectGeoJson);
const mockCreateVectorTileRenderer = jest.mocked(createVectorTileRenderer);
const mockBuildOverviewLevels = jest.mocked(buildOverviewLevels);
const mockResolveAssetBlob = jest.mocked(resolveAssetBlob);

const asset = (name: string): DocumentPicker.DocumentPickerAsset =>
  ({
    name,
    uri: `file://${name}`,
  }) as unknown as DocumentPicker.DocumentPickerAsset;

const variableMeta = (
  overrides: Partial<EnvironmentVariableOption> = {},
): EnvironmentVariableOption => ({
  id: 'salinity_two',
  label: 'salinity_two',
  valueType: 'ordinal',
  renderMin: 0,
  renderMax: 4,
  legendClasses: [
    { id: 0, name: 'Non saline', color: '#440154' },
    { id: 4, name: 'Extremely saline', color: '#fde725' },
  ],
  ...overrides,
});

describe('createLocalCustomLayerRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveAssetBlob.mockResolvedValue(new Blob(['']));
  });

  it('returns null for an unsupported file extension without reading it', async () => {
    const result = await createLocalCustomLayerRenderer(
      asset('data.csv'),
      variableMeta(),
    );
    expect(result).toBeNull();
    expect(mockResolveAssetBlob).not.toHaveBeenCalled();
  });

  describe('raster', () => {
    it("builds a renderer using the variable meta's renderMin/renderMax, not re-derived bounds", async () => {
      mockInspectRaster.mockResolvedValue({
        savedConfig: { valueType: 'ordinal', classes: [] },
        scale: 2,
        offset: 1,
      } as never);
      const rasterRenderer = {
        renderTile: jest.fn(),
        readPointValue: jest.fn(),
        getVisibleRange: jest.fn(),
        view: { lat: 0, lon: 0, zoom: 1 },
        dispose: jest.fn(),
      };
      mockCreateCogTileRenderer.mockResolvedValue(rasterRenderer as never);

      const result = await createLocalCustomLayerRenderer(
        asset('salinity_two.tif'),
        variableMeta(),
      );

      expect(mockCreateCogTileRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          renderMin: 0,
          renderMax: 4,
          valueType: 'ordinal',
          scale: 2,
          offset: 1,
          legendClasses: [
            { id: 0, name: 'Non saline', color: '#440154' },
            { id: 4, name: 'Extremely saline', color: '#fde725' },
          ],
        }),
      );
      expect(result?.renderTile).toBe(rasterRenderer.renderTile);
      expect(result?.readPointValue).toBe(rasterRenderer.readPointValue);
      expect(result?.dispose).toBe(rasterRenderer.dispose);
    });

    it('returns null when the file has no saved WhereWild metadata', async () => {
      mockInspectRaster.mockResolvedValue({ savedConfig: null } as never);
      const result = await createLocalCustomLayerRenderer(
        asset('unlabeled.tif'),
        variableMeta(),
      );
      expect(result).toBeNull();
      expect(mockCreateCogTileRenderer).not.toHaveBeenCalled();
    });

    it('returns null (not a thrown error) for an unsupported CRS', async () => {
      mockInspectRaster.mockResolvedValue({
        savedConfig: { valueType: 'ordinal', classes: [] },
      } as never);
      mockCreateCogTileRenderer.mockRejectedValue(
        new UnsupportedCrsError('nope'),
      );
      const result = await createLocalCustomLayerRenderer(
        asset('weird_crs.tif'),
        variableMeta(),
      );
      expect(result).toBeNull();
    });

    it('re-throws any other renderer construction error', async () => {
      mockInspectRaster.mockResolvedValue({
        savedConfig: { valueType: 'ordinal', classes: [] },
      } as never);
      mockCreateCogTileRenderer.mockRejectedValue(new Error('boom'));
      await expect(
        createLocalCustomLayerRenderer(asset('bad.tif'), variableMeta()),
      ).rejects.toThrow('boom');
    });
  });

  describe('vector', () => {
    const vectorVariableMeta = variableMeta({
      legendClasses: [
        { id: 0, name: 'Forest', color: '#466237' },
        { id: 1, name: 'Wetland', color: '#3D5A80' },
      ],
    });

    it('builds a renderer keyed by the saved category field, using the saved class order for ids', async () => {
      mockInspectGeoJson.mockResolvedValue({
        geojson: { type: 'FeatureCollection', features: [] },
        metadata: {
          savedConfig: {
            mode: 'categorical',
            field: 'landcover',
            classes: [
              { value: 'forest', name: 'Forest', color: '#466237' },
              { value: 'wetland', name: 'Wetland', color: '#3D5A80' },
            ],
          },
          cachedOverviewLevels: null,
          bbox: [-1, -1, 1, 1],
        },
      } as never);
      const vectorRenderer = {
        renderTile: jest.fn(),
        readPointValue: jest.fn(),
        view: { lat: 0, lon: 0, zoom: 1 },
      };
      mockCreateVectorTileRenderer.mockReturnValue(vectorRenderer as never);
      mockBuildOverviewLevels.mockReturnValue([
        { tolerance: 0, data: { type: 'FeatureCollection', features: [] } },
      ] as never);

      const result = await createLocalCustomLayerRenderer(
        asset('landcover.geojson'),
        vectorVariableMeta,
      );

      expect(mockCreateVectorTileRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'landcover',
          bbox: [-1, -1, 1, 1],
        }),
      );
      const callArgs = mockCreateVectorTileRenderer.mock.calls[0][0];
      expect(callArgs.classIndexByValue).toEqual(
        new Map([
          ['forest', 0],
          ['wetland', 1],
        ]),
      );
      expect(callArgs.getStyle()).toEqual({
        classColorsById: new Map([
          [0, '#466237'],
          [1, '#3D5A80'],
        ]),
        classNamesById: new Map([
          [0, 'Forest'],
          [1, 'Wetland'],
        ]),
      });
      expect(result?.renderTile).toBe(vectorRenderer.renderTile);
      expect(result?.readPointValue).toBe(vectorRenderer.readPointValue);
      // No decoder to close for a vector source.
      expect(() => result?.dispose()).not.toThrow();
    });

    it('parses the file and builds the simplification pyramid only once, however often the variable is re-selected', async () => {
      mockInspectGeoJson.mockResolvedValue({
        geojson: { type: 'FeatureCollection', features: [] },
        metadata: {
          savedConfig: {
            mode: 'categorical',
            field: 'landcover',
            classes: [{ value: 'forest', name: 'Forest', color: '#466237' }],
          },
          cachedOverviewLevels: null,
          bbox: null,
        },
      } as never);
      mockCreateVectorTileRenderer.mockReturnValue({
        renderTile: jest.fn(),
        readPointValue: jest.fn(),
        view: { lat: 0, lon: 0, zoom: 1 },
      } as never);
      mockBuildOverviewLevels.mockReturnValue([
        { tolerance: 0, data: { type: 'FeatureCollection', features: [] } },
      ] as never);
      const sameAsset = asset('landcover.geojson');

      await createLocalCustomLayerRenderer(sameAsset, vectorVariableMeta);
      await createLocalCustomLayerRenderer(sameAsset, vectorVariableMeta);

      expect(mockInspectGeoJson).toHaveBeenCalledTimes(1);
      expect(mockBuildOverviewLevels).toHaveBeenCalledTimes(1);
    });

    it('reuses a cached overview pyramid instead of rebuilding it', async () => {
      const cached = [
        { tolerance: 0, data: { type: 'FeatureCollection', features: [] } },
      ];
      mockInspectGeoJson.mockResolvedValue({
        geojson: { type: 'FeatureCollection', features: [] },
        metadata: {
          savedConfig: {
            mode: 'categorical',
            field: 'landcover',
            classes: [{ value: 'forest', name: 'Forest', color: '#466237' }],
          },
          cachedOverviewLevels: cached,
          bbox: null,
        },
      } as never);
      mockCreateVectorTileRenderer.mockReturnValue({
        renderTile: jest.fn(),
        readPointValue: jest.fn(),
        view: { lat: 0, lon: 0, zoom: 1 },
      } as never);

      await createLocalCustomLayerRenderer(
        asset('landcover.geojson'),
        vectorVariableMeta,
      );

      expect(mockBuildOverviewLevels).not.toHaveBeenCalled();
      expect(mockCreateVectorTileRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ overviewLevels: cached }),
      );
    });

    it('returns null for a single-color vector with no category field to key a class id off of', async () => {
      mockInspectGeoJson.mockResolvedValue({
        geojson: { type: 'FeatureCollection', features: [] },
        metadata: {
          savedConfig: { mode: 'single', field: null, classes: [] },
          cachedOverviewLevels: null,
          bbox: null,
        },
      } as never);

      const result = await createLocalCustomLayerRenderer(
        asset('boundary.geojson'),
        vectorVariableMeta,
      );

      expect(result).toBeNull();
      expect(mockCreateVectorTileRenderer).not.toHaveBeenCalled();
    });

    it('returns null when the file has no saved WhereWild metadata', async () => {
      mockInspectGeoJson.mockResolvedValue({
        geojson: { type: 'FeatureCollection', features: [] },
        metadata: { savedConfig: null, cachedOverviewLevels: null, bbox: null },
      } as never);

      const result = await createLocalCustomLayerRenderer(
        asset('unlabeled.geojson'),
        vectorVariableMeta,
      );

      expect(result).toBeNull();
    });
  });
});
