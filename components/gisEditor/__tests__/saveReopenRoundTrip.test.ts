// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

// An end-to-end regression test for the actual /gis-editor "save, then
// reopen" flow, deliberately NOT hand-building a GDAL_METADATA object (the
// other test files feed readWherewildConfig()/readGdalScaleOffset() a
// plain JS object directly) — it goes through the real `geotiff` library on
// both ends, the same way GisEditorScreen.tsx does. This is the only test
// that would have caught the bug where inspectRaster() only ever called
// image.getGDALMetadata(0): geotiff.js's getGDALMetadata(sample) filters
// strictly on the Item's `sample` attribute, so WHEREWILD_VALUE_TYPE/
// WHEREWILD_LEGEND (deliberately written with no `sample` attribute, since
// they're dataset-level, not per-band) were silently invisible to a
// sample=0 call — the save wrote real bytes (the file really did grow) but
// nothing on reopen ever saw them.

import { fromBlob, writeArrayBuffer } from 'geotiff';
import { embedMetadataIntoTiff } from '../tiffMetadataWriter';
import { inspectRaster } from '../rasterMetadata';
import type { RasterEditableMeta } from '../rasterEditableMeta';

const buildTestTiff = async (): Promise<Blob> => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const arrayBuffer = await writeArrayBuffer(values, { height: 3, width: 3 });
  return new Blob([arrayBuffer]);
};

describe('save/reopen round trip through the real geotiff.js parser', () => {
  it('restores a nominal legend (edited names + colors) after save + reopen', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);

    const editable: RasterEditableMeta = {
      displayName: '',
      valueType: 'nominal',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [
        { value: 1, name: 'Water (edited)', color: '#123456' },
        { value: 2, name: 'Forest', color: '#00ff00' },
      ],
    };

    const saved = await embedMetadataIntoTiff(blob, metadata, editable);
    const reopened = await inspectRaster(saved);

    expect(reopened.savedConfig).not.toBeNull();
    expect(reopened.savedConfig?.valueType).toBe('nominal');
    expect(reopened.savedConfig?.classes).toEqual([
      { id: 1, name: 'Water (edited)', color: '#123456' },
      { id: 2, name: 'Forest', color: '#00ff00' },
    ]);
  });

  it('restores a legend where only one of several classes was actually renamed', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);

    // Only class 2's name was ever edited by the user — 1 and 3 are still
    // whatever classesFor()'s default naming produced ("1"/"3").
    const editable: RasterEditableMeta = {
      displayName: '',
      valueType: 'nominal',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [
        { value: 1, name: '1', color: '#111111' },
        { value: 2, name: 'Forest (renamed)', color: '#00ff00' },
        { value: 3, name: '3', color: '#333333' },
      ],
    };

    const saved = await embedMetadataIntoTiff(blob, metadata, editable);
    const reopened = await inspectRaster(saved);

    expect(reopened.savedConfig?.classes).toEqual([
      { id: 1, name: '1', color: '#111111' },
      { id: 2, name: 'Forest (renamed)', color: '#00ff00' },
      { id: 3, name: '3', color: '#333333' },
    ]);
  });

  it('round-trips a class name containing XML-special characters', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);
    const editable: RasterEditableMeta = {
      displayName: '',
      valueType: 'nominal',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [{ value: 1, name: 'A & B < C "quoted"', color: '#123456' }],
    };

    const saved = await embedMetadataIntoTiff(blob, metadata, editable);
    const reopened = await inspectRaster(saved);

    expect(reopened.savedConfig?.classes).toEqual([
      { id: 1, name: 'A & B < C "quoted"', color: '#123456' },
    ]);
  });

  it('writes a real TIFF ColorMap + Photometric=Palette for nominal (the mechanism QGIS auto-renders on load)', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);
    const editable: RasterEditableMeta = {
      displayName: '',
      valueType: 'nominal',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [
        { value: 1, name: 'Water', color: '#0000ff' },
        { value: 2, name: 'Forest', color: '#00ff00' },
      ],
    };

    const saved = await embedMetadataIntoTiff(blob, metadata, editable);

    const tiff = await fromBlob(saved);
    const image = await tiff.getImage(0);
    const fileDirectory = image.getFileDirectory();
    expect(fileDirectory.PhotometricInterpretation).toBe(3); // Palette

    const colorMap: number[] = fileDirectory.ColorMap;
    const size = colorMap.length / 3;
    const at = (index: number) => [
      colorMap[index],
      colorMap[size + index],
      colorMap[2 * size + index],
    ];
    expect(at(1)).toEqual([0, 0, 255 * 257]);
    expect(at(2)).toEqual([0, 255 * 257, 0]);
    expect(at(0)).toEqual([0, 0, 0]); // untouched index defaults to black

    const reopened = await inspectRaster(saved);
    expect(reopened.hasColorMap).toBe(true);
  });

  it('also writes a ColorMap for ordinal data (its default sequential colors are real colors too)', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);
    const editable: RasterEditableMeta = {
      displayName: '',
      valueType: 'ordinal',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [
        { value: 1, name: 'Low', color: '#0000ff' },
        { value: 2, name: 'High', color: '#ff0000' },
      ],
    };

    const saved = await embedMetadataIntoTiff(blob, metadata, editable);
    const tiff = await fromBlob(saved);
    const image = await tiff.getImage(0);
    const fileDirectory = image.getFileDirectory();
    expect(fileDirectory.PhotometricInterpretation).toBe(3);
    const colorMap: number[] = fileDirectory.ColorMap;
    const size = colorMap.length / 3;
    expect([colorMap[1], colorMap[size + 1], colorMap[2 * size + 1]]).toEqual([
      0,
      0,
      255 * 257,
    ]);

    const reopened = await inspectRaster(saved);
    expect(reopened.savedConfig?.classes).toEqual([
      { id: 1, name: 'Low', color: '#0000ff' },
      { id: 2, name: 'High', color: '#ff0000' },
    ]);
  });

  it('does not write a ColorMap for interval/ratio (pixel values are not category codes)', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);
    const editable: RasterEditableMeta = {
      displayName: '',
      valueType: 'ratio',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [],
    };

    const saved = await embedMetadataIntoTiff(blob, metadata, editable);
    const tiff = await fromBlob(saved);
    const image = await tiff.getImage(0);
    expect(image.getFileDirectory().PhotometricInterpretation).not.toBe(3);
  });

  it('reverts a stale ColorMap when re-saving after switching away from nominal/ordinal', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);
    const nominal: RasterEditableMeta = {
      displayName: '',
      valueType: 'nominal',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [{ value: 1, name: 'Water', color: '#0000ff' }],
    };
    const savedAsNominal = await embedMetadataIntoTiff(blob, metadata, nominal);
    const reopenedAsNominal = await inspectRaster(savedAsNominal);
    expect(reopenedAsNominal.hasColorMap).toBe(true);

    // The user then re-classifies this same raster as continuous and saves
    // again — the ColorMap/Palette from the earlier nominal save must not
    // silently survive into a file now described as continuous.
    const ratio: RasterEditableMeta = {
      displayName: '',
      valueType: 'ratio',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [],
    };
    const savedAsRatio = await embedMetadataIntoTiff(
      savedAsNominal,
      reopenedAsNominal,
      ratio,
    );
    const reopenedAsRatio = await inspectRaster(savedAsRatio);
    expect(reopenedAsRatio.hasColorMap).toBe(false);

    const tiff = await fromBlob(savedAsRatio);
    const image = await tiff.getImage(0);
    expect(image.getFileDirectory().PhotometricInterpretation).not.toBe(3);
  });

  it('restores scale/offset/units for ratio through the real parser', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);

    const editable: RasterEditableMeta = {
      displayName: '',
      valueType: 'ratio',
      units: '°C',
      renderMin: 0,
      renderMax: 100,
      scale: 0.1,
      offset: -50,
      classes: [],
    };

    const saved = await embedMetadataIntoTiff(blob, metadata, editable);
    const reopened = await inspectRaster(saved);

    expect(reopened.scale).toBe(0.1);
    expect(reopened.offset).toBe(-50);
    expect(reopened.units).toBe('°C');
    expect(reopened.savedConfig?.valueType).toBe('ratio');
  });

  it('round-trips again after a second save (edit -> save -> reopen -> edit -> save -> reopen)', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);
    const first: RasterEditableMeta = {
      displayName: '',
      valueType: 'nominal',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [{ value: 1, name: 'First', color: '#ff0000' }],
    };
    const savedOnce = await embedMetadataIntoTiff(blob, metadata, first);
    const reopenedOnce = await inspectRaster(savedOnce);
    expect(reopenedOnce.savedConfig?.classes).toEqual([
      { id: 1, name: 'First', color: '#ff0000' },
    ]);

    const second: RasterEditableMeta = {
      ...first,
      classes: [{ value: 1, name: 'Second', color: '#00ff00' }],
    };
    const savedTwice = await embedMetadataIntoTiff(
      savedOnce,
      reopenedOnce,
      second,
    );
    const reopenedTwice = await inspectRaster(savedTwice);
    expect(reopenedTwice.savedConfig?.classes).toEqual([
      { id: 1, name: 'Second', color: '#00ff00' },
    ]);
  });

  it('restores the display name after save + reopen, including characters that need XML escaping', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);
    const editable: RasterEditableMeta = {
      displayName: '  Salinity & <Soil> "Two"  ',
      valueType: 'ratio',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [],
    };

    const reopened = await inspectRaster(
      await embedMetadataIntoTiff(blob, metadata, editable),
    );

    // Trimmed on the way out, restored exactly otherwise.
    expect(reopened.savedConfig?.displayName).toBe('Salinity & <Soil> "Two"');
  });

  it('saves no name at all when the field is blank, so reopen sees null rather than an empty string', async () => {
    const blob = await buildTestTiff();
    const metadata = await inspectRaster(blob);
    const editable: RasterEditableMeta = {
      displayName: '   ',
      valueType: 'ratio',
      units: '',
      renderMin: 1,
      renderMax: 9,
      scale: 1,
      offset: 0,
      classes: [],
    };

    const reopened = await inspectRaster(
      await embedMetadataIntoTiff(blob, metadata, editable),
    );

    expect(reopened.savedConfig).not.toBeNull();
    expect(reopened.savedConfig?.displayName).toBeNull();
  });
});
