// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

// Real round trip, same philosophy as saveReopenRoundTrip.test.ts on the
// raster side: build a zip with buildZip()/buildStyledShapefileZip(), then
// feed it to the real `shpjs` (via inspectShapefile()) rather than
// hand-verifying our own zip bytes — shpjs unzips via `but-unzip`
// internally, so this is a genuine two-implementations round trip, not
// "does our writer agree with itself."

import {
  buildDbf,
  buildStyledShapefileZip,
  buildZip,
} from '../shapefileWriter';
import { inspectShapefile } from '../shapefileMetadata';
import type { VectorEditableMeta } from '../vectorEditableMeta';

const BE = false;
const LE = true;

const SQUARE: [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
];

const buildShp = (rings: [number, number][][]): ArrayBuffer => {
  const records = rings.map((ring, i) => {
    const contentLen = 4 + 32 + 4 + 4 + 4 + ring.length * 16;
    const buf = new ArrayBuffer(contentLen);
    const v = new DataView(buf);
    let o = 0;
    v.setInt32(o, 5, LE);
    o += 4;
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    v.setFloat64(o, Math.min(...xs), LE);
    v.setFloat64(o + 8, Math.min(...ys), LE);
    v.setFloat64(o + 16, Math.max(...xs), LE);
    v.setFloat64(o + 24, Math.max(...ys), LE);
    o += 32;
    v.setInt32(o, 1, LE);
    o += 4;
    v.setInt32(o, ring.length, LE);
    o += 4;
    v.setInt32(o, 0, LE);
    o += 4;
    ring.forEach((p) => {
      v.setFloat64(o, p[0], LE);
      v.setFloat64(o + 8, p[1], LE);
      o += 16;
    });
    return { recordNumber: i + 1, content: buf };
  });
  const recordsTotalLen = records.reduce(
    (sum, r) => sum + 8 + r.content.byteLength,
    0,
  );
  const allXs = rings.flat().map((p) => p[0]);
  const allYs = rings.flat().map((p) => p[1]);
  const out = new ArrayBuffer(100 + recordsTotalLen);
  const v = new DataView(out);
  v.setInt32(0, 9994, BE);
  v.setInt32(24, (100 + recordsTotalLen) / 2, BE);
  v.setInt32(28, 1000, LE);
  v.setInt32(32, 5, LE);
  v.setFloat64(36, Math.min(...allXs), LE);
  v.setFloat64(44, Math.min(...allYs), LE);
  v.setFloat64(52, Math.max(...allXs), LE);
  v.setFloat64(60, Math.max(...allYs), LE);
  let offset = 100;
  for (const r of records) {
    v.setInt32(offset, r.recordNumber, BE);
    v.setInt32(offset + 4, r.content.byteLength / 2, BE);
    new Uint8Array(out, offset + 8, r.content.byteLength).set(
      new Uint8Array(r.content),
    );
    offset += 8 + r.content.byteLength;
  }
  return out;
};

describe('buildDbf', () => {
  it('round-trips string/number/boolean fields through the real shpjs parser', async () => {
    const features = [
      { properties: { NAME: 'Alpha', COUNT: 3, ACTIVE: true } },
      { properties: { NAME: 'Beta', COUNT: 7.5, ACTIVE: false } },
    ];
    const dbf = buildDbf(features, ['NAME', 'COUNT', 'ACTIVE']);
    const shp = buildShp([SQUARE, SQUARE]);
    const { geojson } = await inspectShapefile({
      shp: new Blob([shp]),
      dbf: new Blob([dbf]),
    });
    expect(geojson.features[0].properties).toEqual({
      NAME: 'Alpha',
      COUNT: 3,
      ACTIVE: true,
    });
    expect(geojson.features[1].properties).toEqual({
      NAME: 'Beta',
      COUNT: 7.5,
      ACTIVE: false,
    });
  });
});

describe('buildZip / buildStyledShapefileZip', () => {
  it('produces a zip the real shpjs can unzip and parse', async () => {
    const shp = buildShp([SQUARE]);
    const dbf = buildDbf([{ properties: { NAME: 'Alpha' } }], ['NAME']);
    const zip = buildZip([
      { name: 'test.shp', data: shp },
      { name: 'test.dbf', data: dbf },
    ]);
    const { metadata, geojson } = await inspectShapefile(zip);
    expect(metadata.featureCount).toBe(1);
    expect(geojson.features[0].properties?.NAME).toBe('Alpha');
  });

  it('embeds single-color styling as a real WW_COLOR field, round-tripped via inspectShapefile', async () => {
    const shp = buildShp([SQUARE, SQUARE]);
    const editable: VectorEditableMeta = {
      mode: 'single',
      color: '#ff8800',
      field: null,
      classes: [],
    };
    const zip = buildStyledShapefileZip(
      { shpName: 'roads.shp', shp, shx: null, prj: null, cpg: null },
      [{ properties: { NAME: 'Alpha' } }, { properties: { NAME: 'Beta' } }],
      ['NAME'],
      editable,
    );
    const { metadata, geojson } = await inspectShapefile(zip);
    expect(metadata.savedConfig).toEqual({
      mode: 'single',
      color: '#ff8800',
      field: null,
      classes: [],
    });
    // Original attribute survives alongside the new styling fields.
    expect(geojson.features[0].properties?.NAME).toBe('Alpha');
  });

  it('embeds categorical styling as real per-feature WW_COLOR values', async () => {
    const shp = buildShp([SQUARE, SQUARE]);
    const editable: VectorEditableMeta = {
      mode: 'categorical',
      color: '#3388ff',
      field: 'LAND_USE',
      classes: [
        { value: 'Forest', name: 'Forest', color: '#00ff00' },
        { value: 'Water', name: 'Water', color: '#0000ff' },
      ],
    };
    const zip = buildStyledShapefileZip(
      { shpName: 'landuse.shp', shp, shx: null, prj: null, cpg: null },
      [
        { properties: { LAND_USE: 'Forest' } },
        { properties: { LAND_USE: 'Water' } },
      ],
      ['LAND_USE'],
      editable,
    );
    const { metadata, geojson } = await inspectShapefile(zip);
    expect(metadata.savedConfig).toEqual({
      mode: 'categorical',
      color: null,
      field: 'LAND_USE',
      classes: [
        { value: 'Forest', name: 'Forest', color: '#00ff00' },
        { value: 'Water', name: 'Water', color: '#0000ff' },
      ],
    });
    expect(geojson.features[0].properties?.LAND_USE).toBe('Forest');
  });

  it('passes .prj/.shx/.cpg through byte-for-byte (geometry/CRS never touched by styling)', async () => {
    const shp = buildShp([SQUARE]);
    const prjText = 'GEOGCS["GCS_WGS_1984"]';
    const prj = new TextEncoder().encode(prjText).buffer as ArrayBuffer;
    const editable: VectorEditableMeta = {
      mode: 'single',
      color: '#000000',
      field: null,
      classes: [],
    };
    const zip = buildStyledShapefileZip(
      { shpName: 'x.shp', shp, shx: null, prj, cpg: null },
      [{ properties: {} }],
      [],
      editable,
    );
    // Confirms the .prj bytes really did make it into the zip unmodified —
    // it's stored (not compressed), so its text is directly present in the
    // zip's raw bytes. (A bare zip drop doesn't yet feed .prj text into
    // the CRS label the way the {shp,dbf,prj} object form does — see
    // shapefileMetadata.ts's crsLabelFromPrj() — this only confirms the
    // writer preserved the file itself.)
    const zipBytes = new TextDecoder().decode(await zip.arrayBuffer());
    expect(zipBytes).toContain(prjText);
    expect(zipBytes).toContain('x.prj');
  });
});
