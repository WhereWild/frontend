// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import {
  buildGdalMetadataXml,
  embedMetadataIntoTiff,
  UnsupportedTiffWriteError,
} from '../tiffMetadataWriter';
import type { RasterEditableMeta } from '../rasterEditableMeta';
import type { RasterMetadata } from '../rasterMetadata';

const baseMetadata = { noData: -9999 } as unknown as RasterMetadata;

const ratioEditable: RasterEditableMeta = {
  valueType: 'ratio',
  units: '°C',
  renderMin: 0,
  renderMax: 100,
  scale: 0.1,
  offset: -50,
  classes: [],
};

const nominalEditable: RasterEditableMeta = {
  valueType: 'nominal',
  units: '',
  renderMin: 11,
  renderMax: 41,
  scale: 1,
  offset: 0,
  classes: [
    { value: 11, name: 'Water', color: '#0000ff' },
    { value: 21, name: 'Forest', color: '#00ff00' },
  ],
};

describe('buildGdalMetadataXml', () => {
  it('always includes WHEREWILD_VALUE_TYPE', () => {
    const xml = buildGdalMetadataXml({
      valueType: 'circular',
      units: '',
      renderMin: 0,
      renderMax: 360,
      scale: 1,
      offset: 0,
      classes: [],
    });
    expect(xml).toContain('<Item name="WHEREWILD_VALUE_TYPE">circular</Item>');
    expect(xml).not.toContain('<Item name="Scale"');
  });

  it('includes Scale/Offset/UnitType for ratio/interval with a non-default scale', () => {
    const xml = buildGdalMetadataXml(ratioEditable);
    expect(xml).toContain('role="scale">0.1<');
    expect(xml).toContain('role="offset">-50<');
    expect(xml).toContain('role="unittype">°C<');
  });

  it('includes the legend as WHEREWILD_LEGEND JSON for nominal', () => {
    const xml = buildGdalMetadataXml(nominalEditable);
    expect(xml).toContain('WHEREWILD_LEGEND');
    const match = /<Item name="WHEREWILD_LEGEND">(.*?)<\/Item>/.exec(xml);
    expect(match).not.toBeNull();
    const legend = JSON.parse(
      match![1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
    );
    expect(legend).toEqual([
      { id: 11, name: 'Water', color: '#0000ff' },
      { id: 21, name: 'Forest', color: '#00ff00' },
    ]);
  });

  it('escapes XML-unsafe characters', () => {
    const xml = buildGdalMetadataXml({
      ...nominalEditable,
      classes: [{ value: 1, name: 'A & B < C', color: null }],
    });
    expect(xml).toContain('A &amp; B &lt; C');
  });

  // Shape verified directly against GDAL's own source (not guessed): see
  // GDALRasterAttributeTable::Serialize() in gcore/gdal_rat.cpp and the
  // AppendMetadataItem() call site in
  // frmts/gtiff/gtiffdataset_write.cpp, github.com/OSGeo/gdal.
  describe('embeds a real GDAL Raster Attribute Table', () => {
    it('wraps it in the exact Item GDAL itself uses', () => {
      const xml = buildGdalMetadataXml(nominalEditable);
      expect(xml).toContain(
        '<Item name="DEFAULT_RASTER_ATTRIBUTE_TABLE" sample="0" role="rat">',
      );
      expect(xml).toContain('<GDALRasterAttributeTable tableType="thematic">');
    });

    it('defines Value/Class_Name/Red/Green/Blue with GDAL’s exact type/usage codes', () => {
      const xml = buildGdalMetadataXml(nominalEditable);
      expect(xml).toContain(
        '<FieldDefn index="0"><Name>Value</Name><Type typeAsString="Integer">0</Type><Usage usageAsString="Generic">0</Usage></FieldDefn>',
      );
      expect(xml).toContain(
        '<FieldDefn index="1"><Name>Class_Name</Name><Type typeAsString="String">2</Type><Usage usageAsString="Name">2</Usage></FieldDefn>',
      );
      expect(xml).toContain('usageAsString="Red">6<');
      expect(xml).toContain('usageAsString="Green">7<');
      expect(xml).toContain('usageAsString="Blue">8<');
    });

    it('writes one row per class as Value/Name/R/G/B cells', () => {
      const xml = buildGdalMetadataXml(nominalEditable);
      expect(xml).toContain(
        '<Row index="0"><F>11</F><F>Water</F><F>0</F><F>0</F><F>255</F></Row>',
      );
      expect(xml).toContain(
        '<Row index="1"><F>21</F><F>Forest</F><F>0</F><F>255</F><F>0</F></Row>',
      );
    });

    it('omits the Red/Green/Blue columns when no class actually has a color', () => {
      const xml = buildGdalMetadataXml({
        ...nominalEditable,
        valueType: 'ordinal',
        classes: [
          { value: 1, name: 'Low', color: null },
          { value: 2, name: 'High', color: null },
        ],
      });
      expect(xml).not.toContain('usageAsString="Red"');
      expect(xml).toContain('<Row index="0"><F>1</F><F>Low</F></Row>');
    });

    it('includes the Red/Green/Blue columns for ordinal too (its default colors are real colors)', () => {
      const xml = buildGdalMetadataXml({
        ...nominalEditable,
        valueType: 'ordinal',
        classes: [
          { value: 1, name: 'Low', color: '#000080' },
          { value: 2, name: 'High', color: '#800000' },
        ],
      });
      expect(xml).toContain('usageAsString="Red">6<');
      expect(xml).toContain(
        '<Row index="0"><F>1</F><F>Low</F><F>0</F><F>0</F><F>128</F></Row>',
      );
    });

    it('is absent entirely for interval/ratio/circular (no classes)', () => {
      expect(buildGdalMetadataXml(ratioEditable)).not.toContain(
        'DEFAULT_RASTER_ATTRIBUTE_TABLE',
      );
    });
  });
});

// --- A minimal hand-built classic (32-bit) TIFF for exercising the byte
// surgery end to end: 8-byte header, 4 bytes of fake "pixel data", then one
// IFD with a couple of ordinary tags plus a StripOffsets pointing at that
// fake pixel data — enough to verify existing tags/data survive untouched
// and the new tag gets added in sorted position.

const LE = true;

const inlineShort = (v: number): Uint8Array => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint16(0, v, LE);
  return b;
};
const inlineLong = (v: number): Uint8Array => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v, LE);
  return b;
};

const buildMinimalTiff = (nextIfdOffset = 0): Uint8Array<ArrayBuffer> => {
  const pixelData = new TextEncoder().encode('PXPX');
  const pixelDataOffset = 8;
  const ifd0Offset = pixelDataOffset + pixelData.length;

  const entries: {
    tag: number;
    type: number;
    count: number;
    value: Uint8Array;
  }[] = [
    { tag: 256, type: 3, count: 1, value: inlineShort(100) }, // ImageWidth
    { tag: 257, type: 3, count: 1, value: inlineShort(50) }, // ImageLength
    { tag: 273, type: 4, count: 1, value: inlineLong(pixelDataOffset) }, // StripOffsets
  ];
  const ifdLen = 2 + entries.length * 12 + 4;
  const ifdBuf = new ArrayBuffer(ifdLen);
  const ifdView = new DataView(ifdBuf);
  ifdView.setUint16(0, entries.length, LE);
  entries.forEach((e, i) => {
    const base = 2 + i * 12;
    ifdView.setUint16(base, e.tag, LE);
    ifdView.setUint16(base + 2, e.type, LE);
    ifdView.setUint32(base + 4, e.count, LE);
    new Uint8Array(ifdBuf, base + 8, 4).set(e.value);
  });
  ifdView.setUint32(2 + entries.length * 12, nextIfdOffset, LE);

  const header = new ArrayBuffer(8);
  const hv = new DataView(header);
  hv.setUint8(0, 0x49);
  hv.setUint8(1, 0x49);
  hv.setUint16(2, 42, LE);
  hv.setUint32(4, ifd0Offset, LE);

  const out = new Uint8Array(
    header.byteLength + pixelData.length + ifdBuf.byteLength,
  );
  out.set(new Uint8Array(header), 0);
  out.set(pixelData, header.byteLength);
  out.set(new Uint8Array(ifdBuf), header.byteLength + pixelData.length);
  return out;
};

// --- A minimal hand-built BigTIFF: 16-byte header, 4 bytes of fake "pixel
// data", then one IFD with 20-byte entries (8-byte counts/values) — same
// tags as the classic fixture above, for exercising the 64-bit code path.

const inlineShort8 = (v: number): Uint8Array => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setUint16(0, v, LE);
  return b;
};
const inlineLong8 = (v: number): Uint8Array => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(v), LE);
  return b;
};

const buildMinimalBigTiff = (nextIfdOffset = 0): Uint8Array<ArrayBuffer> => {
  const pixelData = new TextEncoder().encode('PXPX');
  const pixelDataOffset = 16;
  const ifd0Offset = pixelDataOffset + pixelData.length;

  const entries: {
    tag: number;
    type: number;
    count: number;
    value: Uint8Array;
  }[] = [
    { tag: 256, type: 3, count: 1, value: inlineShort8(100) }, // ImageWidth
    { tag: 257, type: 3, count: 1, value: inlineShort8(50) }, // ImageLength
    { tag: 273, type: 4, count: 1, value: inlineLong8(pixelDataOffset) }, // StripOffsets
  ];
  const ifdLen = 8 + entries.length * 20 + 8;
  const ifdBuf = new ArrayBuffer(ifdLen);
  const ifdView = new DataView(ifdBuf);
  ifdView.setBigUint64(0, BigInt(entries.length), LE);
  entries.forEach((e, i) => {
    const base = 8 + i * 20;
    ifdView.setUint16(base, e.tag, LE);
    ifdView.setUint16(base + 2, e.type, LE);
    ifdView.setBigUint64(base + 4, BigInt(e.count), LE);
    new Uint8Array(ifdBuf, base + 12, 8).set(e.value);
  });
  ifdView.setBigUint64(8 + entries.length * 20, BigInt(nextIfdOffset), LE);

  const header = new ArrayBuffer(16);
  const hv = new DataView(header);
  hv.setUint8(0, 0x49);
  hv.setUint8(1, 0x49);
  hv.setUint16(2, 43, LE); // BigTIFF magic
  hv.setUint16(4, 8, LE); // bytesize of offsets
  hv.setUint16(6, 0, LE); // reserved
  hv.setBigUint64(8, BigInt(ifd0Offset), LE);

  const out = new Uint8Array(
    header.byteLength + pixelData.length + ifdBuf.byteLength,
  );
  out.set(new Uint8Array(header), 0);
  out.set(pixelData, header.byteLength);
  out.set(new Uint8Array(ifdBuf), header.byteLength + pixelData.length);
  return out;
};

const parseIfd0 = async (blob: Blob, big = false) => {
  if (big) {
    const headerBuf = await blob.slice(0, 16).arrayBuffer();
    const ifd0Offset = Number(new DataView(headerBuf).getBigUint64(8, LE));
    const countBuf = await blob.slice(ifd0Offset, ifd0Offset + 8).arrayBuffer();
    const count = Number(new DataView(countBuf).getBigUint64(0, LE));
    const ifdBuf = await blob
      .slice(ifd0Offset, ifd0Offset + 8 + count * 20 + 8)
      .arrayBuffer();
    const view = new DataView(ifdBuf);
    const entries: {
      tag: number;
      type: number;
      count: number;
      value: Uint8Array;
    }[] = [];
    for (let i = 0; i < count; i += 1) {
      const base = 8 + i * 20;
      entries.push({
        tag: view.getUint16(base, LE),
        type: view.getUint16(base + 2, LE),
        count: Number(view.getBigUint64(base + 4, LE)),
        value: new Uint8Array(ifdBuf.slice(base + 12, base + 20)),
      });
    }
    const nextIfdOffset = Number(view.getBigUint64(8 + count * 20, LE));
    return { ifd0Offset, entries, nextIfdOffset };
  }
  const headerBuf = await blob.slice(0, 8).arrayBuffer();
  const hv = new DataView(headerBuf);
  const ifd0Offset = hv.getUint32(4, LE);
  const countBuf = await blob.slice(ifd0Offset, ifd0Offset + 2).arrayBuffer();
  const count = new DataView(countBuf).getUint16(0, LE);
  const ifdBuf = await blob
    .slice(ifd0Offset, ifd0Offset + 2 + count * 12 + 4)
    .arrayBuffer();
  const view = new DataView(ifdBuf);
  const entries: {
    tag: number;
    type: number;
    count: number;
    value: Uint8Array;
  }[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = 2 + i * 12;
    entries.push({
      tag: view.getUint16(base, LE),
      type: view.getUint16(base + 2, LE),
      count: view.getUint32(base + 4, LE),
      value: new Uint8Array(ifdBuf.slice(base + 8, base + 12)),
    });
  }
  const nextIfdOffset = view.getUint32(2 + count * 12, LE);
  return { ifd0Offset, entries, nextIfdOffset };
};

const readAsciiValue = async (
  blob: Blob,
  entry: { type: number; count: number; value: Uint8Array },
  big = false,
): Promise<string> => {
  let bytes: Uint8Array;
  if (entry.count <= entry.value.length) {
    bytes = entry.value.slice(0, entry.count);
  } else if (big) {
    const offset = Number(
      new DataView(entry.value.buffer).getBigUint64(entry.value.byteOffset, LE),
    );
    bytes = new Uint8Array(
      await blob.slice(offset, offset + entry.count).arrayBuffer(),
    );
  } else {
    const offset = new DataView(entry.value.buffer).getUint32(
      entry.value.byteOffset,
      LE,
    );
    bytes = new Uint8Array(
      await blob.slice(offset, offset + entry.count).arrayBuffer(),
    );
  }
  return new TextDecoder().decode(bytes).replace(/\0+$/, '');
};

describe('embedMetadataIntoTiff', () => {
  it('adds GDAL_METADATA/GDAL_NODATA without disturbing existing tags or pixel data', async () => {
    const original = buildMinimalTiff();
    const blob = new Blob([original]);
    const result = await embedMetadataIntoTiff(
      blob,
      baseMetadata,
      ratioEditable,
    );

    // Original pixel bytes, at their original offset, are untouched.
    const pixelBytes = await result.slice(8, 12).arrayBuffer();
    expect(new TextDecoder().decode(pixelBytes)).toBe('PXPX');

    const { entries, nextIfdOffset } = await parseIfd0(result);
    const tags = entries.map((e) => e.tag);
    expect(tags).toEqual([...tags].sort((a, b) => a - b)); // still ascending
    expect(tags).toContain(256);
    expect(tags).toContain(257);
    expect(tags).toContain(273);
    expect(tags).toContain(42112);
    expect(tags).toContain(42113);
    expect(nextIfdOffset).toBe(0);

    const gdalMeta = entries.find((e) => e.tag === 42112)!;
    expect(await readAsciiValue(result, gdalMeta)).toContain(
      'role="scale">0.1<',
    );
    const noData = entries.find((e) => e.tag === 42113)!;
    expect(await readAsciiValue(result, noData)).toBe('-9999');

    // Unrelated tags kept byte-for-byte.
    const strip = entries.find((e) => e.tag === 273)!;
    expect(
      new DataView(strip.value.buffer).getUint32(strip.value.byteOffset, LE),
    ).toBe(8);
  });

  it('preserves the link to an existing overview sub-IFD', async () => {
    const original = buildMinimalTiff(9999);
    const blob = new Blob([original]);
    const result = await embedMetadataIntoTiff(
      blob,
      baseMetadata,
      ratioEditable,
    );
    const { nextIfdOffset } = await parseIfd0(result);
    expect(nextIfdOffset).toBe(9999);
  });

  it('replaces rather than duplicates an existing GDAL_METADATA/GDAL_NODATA tag', async () => {
    const blob = new Blob([buildMinimalTiff()]);
    const once = await embedMetadataIntoTiff(blob, baseMetadata, ratioEditable);
    const twice = await embedMetadataIntoTiff(once, baseMetadata, {
      ...ratioEditable,
      scale: 2,
    });
    const { entries } = await parseIfd0(twice);
    expect(entries.filter((e) => e.tag === 42112)).toHaveLength(1);
    expect(entries.filter((e) => e.tag === 42113)).toHaveLength(1);
    const gdalMeta = entries.find((e) => e.tag === 42112)!;
    expect(await readAsciiValue(twice, gdalMeta)).toContain('role="scale">2<');
  });

  it('embeds metadata into a BigTIFF without disturbing existing tags or pixel data', async () => {
    const original = buildMinimalBigTiff();
    const blob = new Blob([original]);
    const result = await embedMetadataIntoTiff(
      blob,
      baseMetadata,
      ratioEditable,
    );

    // Original pixel bytes, at their original offset, are untouched.
    const pixelBytes = await result.slice(16, 20).arrayBuffer();
    expect(new TextDecoder().decode(pixelBytes)).toBe('PXPX');

    const { entries, nextIfdOffset } = await parseIfd0(result, true);
    const tags = entries.map((e) => e.tag);
    expect(tags).toEqual([...tags].sort((a, b) => a - b));
    expect(tags).toContain(256);
    expect(tags).toContain(273);
    expect(tags).toContain(42112);
    expect(tags).toContain(42113);
    expect(nextIfdOffset).toBe(0);

    const gdalMeta = entries.find((e) => e.tag === 42112)!;
    expect(await readAsciiValue(result, gdalMeta, true)).toContain(
      'role="scale">0.1<',
    );
    const noData = entries.find((e) => e.tag === 42113)!;
    expect(await readAsciiValue(result, noData, true)).toBe('-9999');
  });

  it('preserves the overview sub-IFD link in a BigTIFF', async () => {
    const original = buildMinimalBigTiff(9999);
    const blob = new Blob([original]);
    const result = await embedMetadataIntoTiff(
      blob,
      baseMetadata,
      ratioEditable,
    );
    const { nextIfdOffset } = await parseIfd0(result, true);
    expect(nextIfdOffset).toBe(9999);
  });

  it('rejects a truncated/malformed BigTIFF header', async () => {
    const blob = new Blob([
      new Uint8Array([0x49, 0x49, 43, 0, 8, 0, 0, 0, 1, 2, 3]),
    ]);
    await expect(
      embedMetadataIntoTiff(blob, baseMetadata, ratioEditable),
    ).rejects.toThrow(UnsupportedTiffWriteError);
  });

  it('rejects a file that is not a recognizable TIFF', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])]);
    await expect(
      embedMetadataIntoTiff(blob, baseMetadata, ratioEditable),
    ).rejects.toThrow(UnsupportedTiffWriteError);
  });
});
