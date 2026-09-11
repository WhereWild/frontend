// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// "Save" for /gis-editor: embeds the configured metadata directly into the
// dropped file's own TIFF tags — not a sidecar — by patching its IFD0 in
// place, in the browser, without decoding or touching a single pixel.
//
// Standard mechanism (confirmed against GDAL's own docs/behavior, not
// guessed): when a GeoTIFF is writable, GDAL stores Scale/Offset/UnitType/
// NoData directly in the file — Scale/Offset/UnitType go into TIFFTAG_
// GDAL_METADATA (42112), an XML blob of <Item name="..." sample="0">value
// </Item> entries; NoData goes into TIFFTAG_GDAL_NODATA (42113), a plain
// ASCII number. It falls back to a PAM .aux.xml sidecar only when the file
// *can't* be rewritten (read-only, or a non-GeoTIFF format) — which is
// exactly the case this file doesn't handle.
//
// Legend (class id -> name/color for nominal/ordinal) has no long-standing
// universal tag: GDAL only gained the ability to embed a full Raster
// Attribute Table in this same tag in version 3.12, and its exact
// serialization isn't something this file can verify against a real GDAL
// install. Rather than guess at that schema and risk producing XML no
// GDAL version actually reads, the legend is written as one more Item in
// the same GDAL_METADATA XML, under a WhereWild-specific name
// (WHEREWILD_LEGEND, a JSON string) — safe by construction (an unrecognized
// Item name is just ignored by every GDAL version) and exactly what
// rasterMetadata.ts's deriveDetectedValueType() looks for first when
// re-opening a file this tool has already saved, so the whole configuration
// round-trips through this app even where general GDAL RAT support can't
// be relied on yet.
//
// How the patch works, structurally: TIFF's IFD chain can live anywhere in
// the file, so nothing has to move. A new IFD0 is built that copies every
// existing tag's 4-byte value/offset field verbatim (offsets into the
// original pixel/strip/tile data stay valid since that data never moves)
// except GDAL_METADATA/GDAL_NODATA, which get new values appended after the
// current end of the file. Only the 4-byte "offset to IFD0" field in the
// 8-byte header is rewritten, to point at the new IFD0. `blob.slice()` is
// lazy, so the original body — pixels, overviews, everything — is never
// read into memory; only the small header + IFD0 + appended bytes are.
//
// Classic (32-bit offset) TIFF only. BigTIFF uses a different header/IFD
// layout entirely (8-byte offsets, 20-byte entries) that this doesn't
// implement — callers should catch UnsupportedTiffWriteError and fall back
// to telling the user why.

import type { RasterEditableMeta } from './rasterEditableMeta';
import type { RasterMetadata } from './rasterMetadata';

export class UnsupportedTiffWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedTiffWriteError';
  }
}

const TAG_GDAL_METADATA = 42112;
const TAG_GDAL_NODATA = 42113;
const TYPE_ASCII = 2;

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The GDAL_METADATA tag's content. Always includes WHEREWILD_VALUE_TYPE (so
 * re-opening a saved file can always tell it was saved by this tool, even
 * one where scale/offset/units/legend are all still defaults) — Scale/
 * Offset/UnitType/WHEREWILD_LEGEND are added only when actually configured.
 */
export const buildGdalMetadataXml = (editable: RasterEditableMeta): string => {
  const isScaled =
    editable.valueType === 'ratio' || editable.valueType === 'interval';
  const isCategorical =
    editable.valueType === 'nominal' || editable.valueType === 'ordinal';
  const items: string[] = [];

  if (isScaled && (editable.scale !== 1 || editable.offset !== 0)) {
    items.push(
      `<Item name="Scale" sample="0" role="scale">${editable.scale}</Item>`,
    );
    items.push(
      `<Item name="Offset" sample="0" role="offset">${editable.offset}</Item>`,
    );
  }
  const units = editable.units.trim();
  if (units && !isCategorical) {
    items.push(
      `<Item name="UnitType" sample="0" role="unittype">${xmlEscape(units)}</Item>`,
    );
  }
  // Always recorded when set, so re-opening a saved file skips
  // re-detection entirely (see rasterMetadata.ts's readWherewildConfig).
  items.push(`<Item name="WHEREWILD_VALUE_TYPE">${editable.valueType}</Item>`);
  if (isCategorical && editable.classes.length > 0) {
    const legend = editable.classes.map((c) => ({
      id: c.value,
      name: c.name,
      color: c.color,
    }));
    items.push(
      `<Item name="WHEREWILD_LEGEND">${xmlEscape(JSON.stringify(legend))}</Item>`,
    );
  }
  return `<GDALMetadata>${items.join('')}</GDALMetadata>`;
};

type RawIfdEntry = {
  tag: number;
  type: number;
  count: number;
  /** The raw 4-byte value/offset field, reused verbatim for any tag we
   * aren't touching — still correct whether it holds an inline value or an
   * offset into file data, since neither ever moves. */
  value: Uint8Array;
};

const readHeader = async (
  blob: Blob,
): Promise<{ littleEndian: boolean; ifd0Offset: number }> => {
  const buf = await blob.slice(0, 8).arrayBuffer();
  if (buf.byteLength < 8) {
    throw new UnsupportedTiffWriteError('File is too small to be a TIFF.');
  }
  const view = new DataView(buf);
  const b0 = view.getUint8(0);
  const b1 = view.getUint8(1);
  let littleEndian: boolean;
  if (b0 === 0x49 && b1 === 0x49) littleEndian = true;
  else if (b0 === 0x4d && b1 === 0x4d) littleEndian = false;
  else throw new UnsupportedTiffWriteError('Not a recognizable TIFF file.');
  const magic = view.getUint16(2, littleEndian);
  if (magic === 43) {
    throw new UnsupportedTiffWriteError(
      'Embedding metadata directly isn’t supported yet for BigTIFF files (this one is stored in the 64-bit variant of the format, which uses a different header layout).',
    );
  }
  if (magic !== 42) {
    throw new UnsupportedTiffWriteError('Not a recognizable TIFF file.');
  }
  return { littleEndian, ifd0Offset: view.getUint32(4, littleEndian) };
};

const readIfd0 = async (
  blob: Blob,
  ifd0Offset: number,
  littleEndian: boolean,
): Promise<{ entries: RawIfdEntry[]; nextIfdOffset: number }> => {
  const countBuf = await blob.slice(ifd0Offset, ifd0Offset + 2).arrayBuffer();
  const entryCount = new DataView(countBuf).getUint16(0, littleEndian);
  const ifdLen = 2 + entryCount * 12 + 4;
  const ifdBuf = await blob
    .slice(ifd0Offset, ifd0Offset + ifdLen)
    .arrayBuffer();
  const view = new DataView(ifdBuf);
  const entries: RawIfdEntry[] = [];
  for (let i = 0; i < entryCount; i += 1) {
    const base = 2 + i * 12;
    entries.push({
      tag: view.getUint16(base, littleEndian),
      type: view.getUint16(base + 2, littleEndian),
      count: view.getUint32(base + 4, littleEndian),
      value: new Uint8Array(ifdBuf.slice(base + 8, base + 12)),
    });
  }
  const nextIfdOffset = view.getUint32(2 + entryCount * 12, littleEndian);
  return { entries, nextIfdOffset };
};

/**
 * Returns a new Blob with the configured metadata embedded in TIFF tags
 * 42112 (GDAL_METADATA) and 42113 (GDAL_NODATA) on IFD0 — or the same Blob
 * back, unchanged, if there's nothing to write. Never reads or copies the
 * original pixel data; see the module doc comment for how.
 */
export const embedMetadataIntoTiff = async (
  blob: Blob,
  metadata: RasterMetadata,
  editable: RasterEditableMeta,
): Promise<Blob> => {
  const { littleEndian, ifd0Offset } = await readHeader(blob);
  const { entries, nextIfdOffset } = await readIfd0(
    blob,
    ifd0Offset,
    littleEndian,
  );

  const gdalMetadataXml = buildGdalMetadataXml(editable);
  const noDataStr = metadata.noData != null ? String(metadata.noData) : null;

  // Never leave a stale duplicate of a tag we're rewriting — TIFF readers
  // expect at most one entry per tag.
  const kept = entries.filter(
    (e) => e.tag !== TAG_GDAL_METADATA && e.tag !== TAG_GDAL_NODATA,
  );

  const encoder = new TextEncoder();
  const appended: BlobPart[] = [];
  let cursor = blob.size;

  const padToEven = () => {
    if (cursor % 2 !== 0) {
      appended.push(new Uint8Array([0]));
      cursor += 1;
    }
  };

  const asciiEntry = (
    tag: number,
    text: string,
  ): { tag: number; type: number; count: number; value: Uint8Array } => {
    const bytes = encoder.encode(`${text}\0`);
    const value = new Uint8Array(4);
    if (bytes.length <= 4) {
      value.set(bytes);
    } else {
      padToEven();
      new DataView(value.buffer).setUint32(0, cursor, littleEndian);
      appended.push(bytes);
      cursor += bytes.length;
    }
    return { tag, type: TYPE_ASCII, count: bytes.length, value };
  };

  const newEntries: {
    tag: number;
    type: number;
    count: number;
    value: Uint8Array;
  }[] = [];
  newEntries.push(asciiEntry(TAG_GDAL_METADATA, gdalMetadataXml));
  if (noDataStr != null) {
    newEntries.push(asciiEntry(TAG_GDAL_NODATA, noDataStr));
  }

  const allEntries = [...kept, ...newEntries].sort((a, b) => a.tag - b.tag);

  padToEven(); // IFDs must start at an even file offset.
  const newIfd0Offset = cursor;
  const ifdBuf = new ArrayBuffer(2 + allEntries.length * 12 + 4);
  const ifdView = new DataView(ifdBuf);
  ifdView.setUint16(0, allEntries.length, littleEndian);
  allEntries.forEach((e, i) => {
    const base = 2 + i * 12;
    ifdView.setUint16(base, e.tag, littleEndian);
    ifdView.setUint16(base + 2, e.type, littleEndian);
    ifdView.setUint32(base + 4, e.count, littleEndian);
    new Uint8Array(ifdBuf, base + 8, 4).set(e.value);
  });
  // Preserves the existing chain to any overview sub-IFDs — they, and
  // everything else in the file, are untouched.
  ifdView.setUint32(2 + allEntries.length * 12, nextIfdOffset, littleEndian);
  appended.push(new Uint8Array(ifdBuf));

  const headerBuf = await blob.slice(0, 8).arrayBuffer();
  const newHeader = new Uint8Array(headerBuf);
  new DataView(newHeader.buffer).setUint32(4, newIfd0Offset, littleEndian);

  return new Blob([newHeader, blob.slice(8), ...appended], {
    type: 'image/tiff',
  });
};
