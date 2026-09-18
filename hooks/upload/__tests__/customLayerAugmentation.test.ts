// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type * as DocumentPicker from 'expo-document-picker';
import { sampleCustomLayer } from '@/components/upload/customLayers';
import { augmentRawTextWithCustomLayers } from '../customLayerAugmentation';

jest.mock('@/components/upload/customLayers', () => ({
  sampleCustomLayer: jest.fn(),
}));

const mockSampleCustomLayer = jest.mocked(sampleCustomLayer);

const asset = (name: string): DocumentPicker.DocumentPickerAsset =>
  ({
    name,
    uri: `file://${name}`,
    file: new Blob(['']),
  }) as unknown as DocumentPicker.DocumentPickerAsset;

describe('augmentRawTextWithCustomLayers', () => {
  beforeEach(() => {
    mockSampleCustomLayer.mockReset();
  });

  it('returns the text unchanged when no custom layers are given', async () => {
    const text = 'latitude,longitude\n1,2\n';
    const result = await augmentRawTextWithCustomLayers(text, ',', []);
    expect(result).toEqual({ augmentedText: text, descriptors: [] });
    expect(mockSampleCustomLayer).not.toHaveBeenCalled();
  });

  it('returns the text unchanged when no coordinate columns are found', async () => {
    const text = 'foo,bar\n1,2\n';
    const result = await augmentRawTextWithCustomLayers(text, ',', [
      asset('x.tif'),
    ]);
    expect(result).toEqual({ augmentedText: text, descriptors: [] });
    expect(mockSampleCustomLayer).not.toHaveBeenCalled();
  });

  it('appends a sampled column and passes correct (lat, lon) points, for a comma-delimited file', async () => {
    mockSampleCustomLayer.mockResolvedValueOnce({
      descriptor: { id: 'rainfall', name: 'rainfall', valueType: 'ratio' },
      values: [5, null],
    });
    const text = 'catalogNumber,latitude,longitude\nA,10,20\nB,30,40\n';

    const result = await augmentRawTextWithCustomLayers(text, ',', [
      asset('rainfall.tif'),
    ]);

    expect(mockSampleCustomLayer).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'rainfall.tif' }),
      [
        { lat: 10, lon: 20 },
        { lat: 30, lon: 40 },
      ],
    );
    expect(result.descriptors).toEqual([
      { id: 'rainfall', name: 'rainfall', valueType: 'ratio' },
    ]);
    expect(result.augmentedText).toBe(
      'catalogNumber,latitude,longitude,rainfall\nA,10,20,5\nB,30,40,',
    );
  });

  it('recognizes tab-delimited files and common coordinate column aliases', async () => {
    mockSampleCustomLayer.mockResolvedValueOnce({
      descriptor: { id: 'kg2', name: 'kg2', valueType: 'nominal' },
      values: [3],
    });
    const text = 'decimalLatitude\tdecimalLongitude\n10\t20\n';

    const result = await augmentRawTextWithCustomLayers(text, '\t', [
      asset('kg2.tif'),
    ]);

    expect(mockSampleCustomLayer).toHaveBeenCalledWith(expect.anything(), [
      { lat: 10, lon: 20 },
    ]);
    expect(result.augmentedText).toBe(
      'decimalLatitude\tdecimalLongitude\tkg2\n10\t20\t3',
    );
  });

  it('omits a layer that returns null (no usable metadata) from both columns and descriptors', async () => {
    mockSampleCustomLayer.mockResolvedValueOnce(null);
    const text = 'latitude,longitude\n1,2\n';

    const result = await augmentRawTextWithCustomLayers(text, ',', [
      asset('bad.tif'),
    ]);

    expect(result).toEqual({ augmentedText: text, descriptors: [] });
  });

  it('samples multiple layers and appends one column each, in order', async () => {
    mockSampleCustomLayer
      .mockResolvedValueOnce({
        descriptor: { id: 'a', name: 'a', valueType: 'ratio' },
        values: [1],
      })
      .mockResolvedValueOnce({
        descriptor: { id: 'b', name: 'b', valueType: 'ratio' },
        values: [2],
      });
    const text = 'latitude,longitude\n1,2\n';

    const result = await augmentRawTextWithCustomLayers(text, ',', [
      asset('a.tif'),
      asset('b.tif'),
    ]);

    expect(result.augmentedText).toBe('latitude,longitude,a,b\n1,2,1,2');
    expect(result.descriptors.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('handles quoted fields containing the delimiter when locating coordinates', async () => {
    mockSampleCustomLayer.mockResolvedValueOnce({
      descriptor: { id: 'a', name: 'a', valueType: 'ratio' },
      values: [9],
    });
    const text = 'name,latitude,longitude\n"Smith, John",10,20\n';

    const result = await augmentRawTextWithCustomLayers(text, ',', [
      asset('a.tif'),
    ]);

    expect(mockSampleCustomLayer).toHaveBeenCalledWith(expect.anything(), [
      { lat: 10, lon: 20 },
    ]);
    expect(result.augmentedText).toBe(
      'name,latitude,longitude,a\n"Smith, John",10,20,9',
    );
  });
});
