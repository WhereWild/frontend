// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

// Exercises inspectShapefile() against real, hand-built ESRI Shapefile
// binary (.shp + .dbf), through the real `shpjs` library — not a hand-built
// GeoJSON mock — the same lesson as tiffMetadataWriter's real-geotiff.js
// round-trip test: a mock can't catch a real parser's real quirks.

import { inspectShapefile } from '../shapefileMetadata';

const BE = false; // big-endian, for the .shp file/record headers
const LE = true; // little-endian, for everything else in .shp, and all of .dbf

// Two clockwise (exterior-ring-correct) unit squares, far enough apart to
// give a real, checkable bounding box.
const SQUARE_A: [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
];
const SQUARE_B: [number, number][] = [
  [10, 10],
  [10, 11],
  [11, 11],
  [11, 10],
  [10, 10],
];

/** A minimal, spec-correct .shp with two single-ring Polygon (shape type 5)
 * records. */
const buildShp = (rings: [number, number][][]): ArrayBuffer => {
  const records = rings.map((ring, i) => {
    // Shape type(4) + box(32) + numParts(4) + numPoints(4) + parts(4) +
    // points(16 each)
    const contentLen = 4 + 32 + 4 + 4 + 4 + ring.length * 16;
    const buf = new ArrayBuffer(contentLen);
    const v = new DataView(buf);
    let o = 0;
    v.setInt32(o, 5, LE); // Polygon
    o += 4;
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    v.setFloat64(o, Math.min(...xs), LE);
    v.setFloat64(o + 8, Math.min(...ys), LE);
    v.setFloat64(o + 16, Math.max(...xs), LE);
    v.setFloat64(o + 24, Math.max(...ys), LE);
    o += 32;
    v.setInt32(o, 1, LE); // numParts
    o += 4;
    v.setInt32(o, ring.length, LE); // numPoints
    o += 4;
    v.setInt32(o, 0, LE); // parts[0] = 0
    o += 4;
    ring.forEach((p) => {
      v.setFloat64(o, p[0], LE);
      v.setFloat64(o + 8, p[1], LE);
      o += 16;
    });
    return { recordNumber: i + 1, content: buf };
  });

  const recordsTotalLen = records.reduce(
    (sum, r) => sum + 8 + r.content.byteLength, // 8-byte record header + content
    0,
  );
  const fileLenWords = (100 + recordsTotalLen) / 2;

  const allXs = rings.flat().map((p) => p[0]);
  const allYs = rings.flat().map((p) => p[1]);

  const out = new ArrayBuffer(100 + recordsTotalLen);
  const v = new DataView(out);
  v.setInt32(0, 9994, BE); // file code
  v.setInt32(24, fileLenWords, BE);
  v.setInt32(28, 1000, LE); // version
  v.setInt32(32, 5, LE); // shape type: Polygon
  v.setFloat64(36, Math.min(...allXs), LE);
  v.setFloat64(44, Math.min(...allYs), LE);
  v.setFloat64(52, Math.max(...allXs), LE);
  v.setFloat64(60, Math.max(...allYs), LE);

  let offset = 100;
  for (const r of records) {
    v.setInt32(offset, r.recordNumber, BE);
    v.setInt32(offset + 4, r.content.byteLength / 2, BE); // content length in words
    new Uint8Array(out, offset + 8, r.content.byteLength).set(
      new Uint8Array(r.content),
    );
    offset += 8 + r.content.byteLength;
  }
  return out;
};

/** A minimal dBase III .dbf with one character field ("NAME") and one
 * record per row value given. */
const buildDbf = (names: string[]): ArrayBuffer => {
  const fieldNameLen = 10; // "NAME" padded to 10 bytes in the descriptor's name slot
  const fieldLen = 20; // width of the NAME column's stored value
  const headerLen = 32 + 32 + 1; // main header + one field descriptor + 0x0D terminator
  const recordLen = 1 + fieldLen; // deletion-flag byte + field bytes
  const out = new ArrayBuffer(headerLen + recordLen * names.length);
  const v = new DataView(out);
  const bytes = new Uint8Array(out);

  v.setUint8(0, 0x03); // dBase III, no memo
  v.setUint8(1, 26);
  v.setUint8(2, 1);
  v.setUint8(3, 1); // arbitrary last-update date
  v.setUint32(4, names.length, LE);
  v.setUint16(8, headerLen, LE);
  v.setUint16(10, recordLen, LE);

  // Field descriptor for "NAME"
  const fieldBase = 32;
  const nameBytes = new TextEncoder().encode('NAME');
  bytes.set(nameBytes, fieldBase);
  // bytes fieldBase+4..fieldBase+10 stay zero-padded (name field slot is 11
  // bytes total: 0..10)
  bytes[fieldBase + fieldNameLen + 1] = 'C'.charCodeAt(0); // type, byte 11
  v.setUint8(fieldBase + 16, fieldLen); // field length, byte 16
  v.setUint8(fieldBase + 17, 0); // decimal count

  bytes[fieldBase + 32] = 0x0d; // header terminator

  let offset = headerLen;
  for (const name of names) {
    bytes[offset] = 0x20; // not deleted
    const valueBytes = new TextEncoder().encode(name.padEnd(fieldLen, ' '));
    bytes.set(valueBytes.slice(0, fieldLen), offset + 1);
    offset += recordLen;
  }
  return out;
};

const buildTestShapefile = (): { shp: Blob; dbf: Blob } => ({
  shp: new Blob([buildShp([SQUARE_A, SQUARE_B])]),
  dbf: new Blob([buildDbf(['Alpha', 'Beta'])]),
});

describe('inspectShapefile', () => {
  it('parses feature count, geometry type, vertex count, fields, and bbox from real .shp/.dbf bytes', async () => {
    const { shp, dbf } = buildTestShapefile();
    const { geojson, metadata } = await inspectShapefile({ shp, dbf });

    expect(metadata.featureCount).toBe(2);
    expect(metadata.geometryType).toBe('Polygon');
    expect(metadata.vertexCount).toBe(10); // two closed 5-point rings
    expect(metadata.fields).toEqual([
      { name: 'NAME', type: 'string', likelyCategorical: true },
    ]);
    expect(metadata.bbox).toEqual([0, 0, 11, 11]);
    expect(metadata.additionalLayersInZip).toBe(0);
    expect(metadata.savedConfig).toBeNull();

    expect(geojson.features[0].properties?.NAME).toBe('Alpha');
    expect(geojson.features[1].properties?.NAME).toBe('Beta');
  });

  it('falls back to a generic CRS label when no .prj is given', async () => {
    const { shp, dbf } = buildTestShapefile();
    const { metadata } = await inspectShapefile({ shp, dbf });
    expect(metadata.crsLabel).toContain('reprojected to WGS84');
  });

  it('extracts an EPSG code from a real ESRI WKT .prj', async () => {
    const { shp, dbf } = buildTestShapefile();
    const wkt =
      'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],' +
      'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]';
    const prj = new Blob([new TextEncoder().encode(wkt)]);
    const { metadata } = await inspectShapefile({ shp, dbf, prj });
    expect(metadata.crsLabel).toContain('EPSG:4326');
  });

  it('parses a bare .shp with no .dbf (no attributes) without throwing', async () => {
    const shp = new Blob([buildShp([SQUARE_A])]);
    const { metadata } = await inspectShapefile({ shp });
    expect(metadata.featureCount).toBe(1);
    expect(metadata.fields).toEqual([]);
  });

  it('flags a numeric field as non-categorical when every row is unique (an ID/measurement), but not a low-cardinality one', async () => {
    const shp = new Blob([buildShp([SQUARE_A, SQUARE_B, SQUARE_A, SQUARE_B])]);
    const dbf = new Blob([
      buildDbfWithFields([
        { name: 'OBJECTID', values: ['1', '2', '3', '4'], type: 'N' },
        { name: 'EPA_REGION', values: ['8', '8', '9', '9'], type: 'N' },
        { name: 'NAME', values: ['A', 'B', 'A', 'B'] },
      ]),
    ]);
    const { metadata } = await inspectShapefile({ shp, dbf });
    expect(metadata.fields).toEqual([
      { name: 'OBJECTID', type: 'number', likelyCategorical: false },
      { name: 'EPA_REGION', type: 'number', likelyCategorical: true },
      { name: 'NAME', type: 'string', likelyCategorical: true },
    ]);
  });

  it('reads back a previously-saved single-color style', async () => {
    const shp = new Blob([buildShp([SQUARE_A])]);
    const dbf = new Blob([
      // A .dbf shpjs can parse with the WW_* fields this tool writes on
      // save — hand-built the same way, just with different field names.
      (() => {
        const buf = buildDbfWithFields([
          { name: 'WW_MODE', values: ['single'] },
          { name: 'WW_COLOR', values: ['#ff0000'] },
        ]);
        return buf;
      })(),
    ]);
    const { metadata } = await inspectShapefile({ shp, dbf });
    expect(metadata.savedConfig).toEqual({
      mode: 'single',
      color: '#ff0000',
      field: null,
      classes: [],
    });
  });
});

/** Same idea as buildDbf() but for an arbitrary set of same-length-record
 * fields, needed for the WW_*-field round-trip test above. `type` defaults
 * to 'C' (character); pass 'N' for a numeric field (still stored as
 * fixed-width ASCII digits, per the DBF format — just tagged 'N' so
 * shpjs's parser returns a JS number instead of a string). */
function buildDbfWithFields(
  fields: { name: string; values: string[]; type?: 'C' | 'N' }[],
): ArrayBuffer {
  const fieldLen = 20;
  const numRecords = fields[0]?.values.length ?? 0;
  const headerLen = 32 + 32 * fields.length + 1;
  const recordLen = 1 + fieldLen * fields.length;
  const out = new ArrayBuffer(headerLen + recordLen * numRecords);
  const v = new DataView(out);
  const bytes = new Uint8Array(out);

  v.setUint8(0, 0x03);
  v.setUint32(4, numRecords, LE);
  v.setUint16(8, headerLen, LE);
  v.setUint16(10, recordLen, LE);

  fields.forEach((field, i) => {
    const base = 32 + i * 32;
    bytes.set(new TextEncoder().encode(field.name), base);
    bytes[base + 11] = (field.type ?? 'C').charCodeAt(0);
    v.setUint8(base + 16, fieldLen);
    v.setUint8(base + 17, 0);
  });
  bytes[32 + 32 * fields.length] = 0x0d;

  for (let r = 0; r < numRecords; r += 1) {
    const recordOffset = headerLen + r * recordLen;
    bytes[recordOffset] = 0x20;
    fields.forEach((field, i) => {
      const valueBytes = new TextEncoder().encode(
        field.values[r].padEnd(fieldLen, ' '),
      );
      bytes.set(valueBytes.slice(0, fieldLen), recordOffset + 1 + i * fieldLen);
    });
  }
  return out;
}
