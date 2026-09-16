// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// "Save" for a shapefile in /gis-editor — the vector counterpart of
// tiffMetadataWriter.ts. Styling never touches geometry, so .shp/.shx/.prj/
// .cpg pass through completely unchanged; only the .dbf is rewritten, with
// two or three extra fields appended for this tool's own styling
// (WW_MODE always, WW_COLOR for single-color mode or per-feature in
// categorical mode, WW_FIELD naming which existing field categorical mode
// colors by) — real fields in the shapefile's own attribute table, not a
// sidecar. shapefileMetadata.ts's readSavedConfig() is what reads them
// back on reopen.
//
// Unlike a GeoTIFF, a DBF's header records the record length and every
// field's byte offset within it — adding a field changes both, so unlike
// the raster writer's byte-preserving append trick, the whole .dbf has to
// be regenerated from its parsed properties. That's fine here: shapefiles
// don't reach the multi-gigabyte sizes that made the raster append trick
// worth the complexity in the first place.
//
// The four component files are bundled into a single downloadable .zip —
// the normal way shapefiles are distributed — using a minimal hand-written
// ZIP writer (store/no-compression only; a shapefile's actual bytes are
// already about as small as they get, so compression buys little here for
// a lot of extra complexity).

import type { VectorEditableMeta } from './vectorEditableMeta';

const WW_MODE_FIELD = 'WW_MODE';
const WW_COLOR_FIELD = 'WW_COLOR';
const WW_FIELD_FIELD = 'WW_FIELD';

type DbfFieldType = 'C' | 'N' | 'L';
type DbfFieldSpec = {
  name: string;
  type: DbfFieldType;
  length: number;
  decimals: number;
};

const DBF_HEADER_SIZE = 32;
const DBF_FIELD_DESCRIPTOR_SIZE = 32;
// DBF field names are stored in an 11-byte slot (10 usable chars + a null
// terminator) — real shapefile attribute names are essentially always
// within this already (it's the shapefile-format-wide limit), so this
// only ever bites WW_* names we control ourselves, all comfortably short.
const DBF_FIELD_NAME_SLOT = 11;

const dbfFieldSpecFor = (name: string, values: unknown[]): DbfFieldSpec => {
  const nonNull = values.filter((v) => v != null);
  if (nonNull.every((v) => typeof v === 'boolean')) {
    return { name, type: 'L', length: 1, decimals: 0 };
  }
  if (nonNull.length > 0 && nonNull.every((v) => typeof v === 'number')) {
    const decimals = nonNull.some((v) => !Number.isInteger(v as number))
      ? 6
      : 0;
    const rendered = nonNull.map((v) => (v as number).toFixed(decimals));
    const length = Math.min(254, Math.max(1, ...rendered.map((s) => s.length)));
    return { name, type: 'N', length, decimals };
  }
  const rendered = nonNull.map((v) => String(v));
  const length = Math.min(
    254,
    Math.max(1, ...rendered.map((s) => s.length), 1),
  );
  return { name, type: 'C', length, decimals: 0 };
};

const renderDbfValue = (value: unknown, spec: DbfFieldSpec): string => {
  if (spec.type === 'L') {
    if (value == null) return '?';
    return value ? 'T' : 'F';
  }
  if (spec.type === 'N') {
    if (value == null) return ''.padStart(spec.length, ' ');
    return (value as number).toFixed(spec.decimals).padStart(spec.length, ' ');
  }
  return String(value ?? '')
    .padEnd(spec.length, ' ')
    .slice(0, spec.length);
};

/**
 * Rebuilds a dBase III .dbf (no memo file) from a feature list's
 * properties, in `fieldOrder` — the original attribute fields, in their
 * original order, followed by whichever WW_* fields this save adds.
 */
export const buildDbf = (
  features: { properties: Record<string, unknown> | null }[],
  fieldOrder: string[],
): ArrayBuffer => {
  const specs = fieldOrder.map((name) =>
    dbfFieldSpecFor(
      name,
      features.map((f) => f.properties?.[name]),
    ),
  );
  const recordLength = 1 + specs.reduce((sum, s) => sum + s.length, 0);
  const headerLength =
    DBF_HEADER_SIZE + specs.length * DBF_FIELD_DESCRIPTOR_SIZE + 1;
  const out = new ArrayBuffer(headerLength + recordLength * features.length);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  const encoder = new TextEncoder();

  view.setUint8(0, 0x03);
  const now = new Date();
  view.setUint8(1, Math.max(0, now.getFullYear() - 1900));
  view.setUint8(2, now.getMonth() + 1);
  view.setUint8(3, now.getDate());
  view.setUint32(4, features.length, true);
  view.setUint16(8, headerLength, true);
  view.setUint16(10, recordLength, true);

  specs.forEach((spec, i) => {
    const base = DBF_HEADER_SIZE + i * DBF_FIELD_DESCRIPTOR_SIZE;
    const nameBytes = encoder
      .encode(spec.name)
      .slice(0, DBF_FIELD_NAME_SLOT - 1);
    bytes.set(nameBytes, base);
    bytes[base + DBF_FIELD_NAME_SLOT] = spec.type.charCodeAt(0);
    view.setUint8(base + 16, spec.length);
    view.setUint8(base + 17, spec.decimals);
  });
  bytes[DBF_HEADER_SIZE + specs.length * DBF_FIELD_DESCRIPTOR_SIZE] = 0x0d;

  features.forEach((f, r) => {
    let offset = headerLength + r * recordLength;
    bytes[offset] = 0x20; // not deleted
    offset += 1;
    specs.forEach((spec) => {
      const rendered = renderDbfValue(f.properties?.[spec.name], spec);
      bytes.set(encoder.encode(rendered).slice(0, spec.length), offset);
      offset += spec.length;
    });
  });

  return out;
};

/**
 * Adds this tool's WW_* styling fields to every feature's properties (a
 * plain object merge, ahead of buildDbf() actually writing them out) —
 * WW_COLOR is per-feature (each feature's own class color in categorical
 * mode, or the same flat color for every feature in single mode), so a
 * reader that only understands "there's a color field" — even one that
 * doesn't know what WW_MODE/WW_FIELD mean — still gets a usable per-row
 * color.
 */
export const applyStylingToProperties = (
  features: { properties: Record<string, unknown> | null }[],
  editable: VectorEditableMeta,
): { properties: Record<string, unknown> }[] => {
  if (editable.mode === 'single') {
    return features.map((f) => ({
      properties: {
        ...f.properties,
        [WW_MODE_FIELD]: 'single',
        [WW_COLOR_FIELD]: editable.color,
      },
    }));
  }
  const colorByValue = new Map(editable.classes.map((c) => [c.value, c.color]));
  return features.map((f) => {
    const raw = editable.field != null ? f.properties?.[editable.field] : null;
    const color = raw != null ? colorByValue.get(String(raw)) : undefined;
    return {
      properties: {
        ...f.properties,
        [WW_MODE_FIELD]: 'categorical',
        [WW_FIELD_FIELD]: editable.field,
        [WW_COLOR_FIELD]: color ?? '#888888',
      },
    };
  });
};

// --- Minimal ZIP (store method only) writer -------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

// MS-DOS date/time packed format ZIP's local/central headers use — exact
// value is cosmetic (unzip tools show it as the entry's timestamp), so a
// fixed "now, rounded to even seconds" is fine rather than round-tripping
// anything from the source files.
const dosDateTime = (): { time: number; date: number } => {
  const d = new Date();
  const time =
    (d.getHours() << 11) |
    (d.getMinutes() << 5) |
    Math.floor(d.getSeconds() / 2);
  const date =
    ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
};

/**
 * Bundles named entries into a single ZIP Blob, uncompressed (store
 * method) — the standard shapefile distribution format, and simple enough
 * to hand-write correctly: local file header + data per entry, then one
 * central directory record per entry, then a single end-of-central-
 * directory record referencing them.
 */
export const buildZip = (
  entries: { name: string; data: ArrayBuffer }[],
): Blob => {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime();
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;
  let centralDirSize = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = new Uint8Array(entry.data);
    const crc = crc32(data);

    const local = new ArrayBuffer(30);
    const lv = new DataView(local);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression: store
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.byteLength, true);
    lv.setUint32(22, data.byteLength, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra field length
    localParts.push(local, nameBytes, data);

    const central = new ArrayBuffer(46);
    const cv = new DataView(central);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.byteLength, true);
    cv.setUint32(24, data.byteLength, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra field length
    cv.setUint16(32, 0, true); // comment length
    cv.setUint16(34, 0, true); // disk number start
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // offset of local header
    centralParts.push(central, nameBytes);
    centralDirSize += central.byteLength + nameBytes.length;

    offset += local.byteLength + nameBytes.length + data.byteLength;
  }

  const centralDirOffset = offset;

  const end = new ArrayBuffer(22);
  const ev = new DataView(end);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);
  ev.setUint16(20, 0, true); // comment length

  return new Blob([...localParts, ...centralParts, end], {
    type: 'application/zip',
  });
};

export type OriginalShapefileFiles = {
  shpName: string;
  shp: ArrayBuffer;
  shx: ArrayBuffer | null;
  prj: ArrayBuffer | null;
  cpg: ArrayBuffer | null;
};

/**
 * Produces a downloadable .zip with the styled shapefile: .shp/.shx/.prj/
 * .cpg copied through byte-for-byte from the original (styling never
 * touches geometry), plus a freshly built .dbf carrying the original
 * attributes plus this save's WW_* fields.
 */
export const buildStyledShapefileZip = (
  original: OriginalShapefileFiles,
  features: { properties: Record<string, unknown> | null }[],
  originalFieldNames: string[],
  editable: VectorEditableMeta,
): Blob => {
  const styledFeatures = applyStylingToProperties(features, editable);
  const wwFields =
    editable.mode === 'single'
      ? [WW_MODE_FIELD, WW_COLOR_FIELD]
      : [WW_MODE_FIELD, WW_FIELD_FIELD, WW_COLOR_FIELD];
  const dbf = buildDbf(styledFeatures, [...originalFieldNames, ...wwFields]);

  const baseName = original.shpName.replace(/\.shp$/i, '');
  const entries: { name: string; data: ArrayBuffer }[] = [
    { name: `${baseName}.shp`, data: original.shp },
    { name: `${baseName}.dbf`, data: dbf },
  ];
  if (original.shx)
    entries.push({ name: `${baseName}.shx`, data: original.shx });
  if (original.prj)
    entries.push({ name: `${baseName}.prj`, data: original.prj });
  if (original.cpg)
    entries.push({ name: `${baseName}.cpg`, data: original.cpg });

  return buildZip(entries);
};
