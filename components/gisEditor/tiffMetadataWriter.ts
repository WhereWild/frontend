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
// Legend (class id -> name/color for nominal/ordinal) is written two ways
// in the same GDAL_METADATA XML:
//  - A real GDAL Raster Attribute Table, as an
//    <Item name="DEFAULT_RASTER_ATTRIBUTE_TABLE" sample="0" role="rat">
//    wrapping a <GDALRasterAttributeTable> tree — the exact structure
//    GDAL's own GTiff driver writes (GDAL >= 3.12; verified against
//    gcore/gdal_rat.cpp's GDALRasterAttributeTable::Serialize() and
//    frmts/gtiff/gtiffdataset_write.cpp's AppendMetadataItem() call site in
//    github.com/OSGeo/gdal, not guessed at). Older GDAL/QGIS just won't
//    render the legend from this, the same as any other item it doesn't
//    recognize — this never breaks a reader that predates 3.12, it's just
//    inert to it.
//  - A WhereWild-specific Item (WHEREWILD_LEGEND, a JSON string) alongside
//    it, which is what rasterMetadata.ts's readWherewildConfig() actually
//    reads back on reopen — simpler and more robust to parse in JS than
//    re-parsing our own RAT XML, and works regardless of GDAL version.
//
// For nominal (unordered categorical) data specifically, a THIRD mechanism
// is also written, because it's the only one of the three that's actually
// guaranteed to render with zero clicks in every TIFF viewer, not just
// GDAL-aware ones: a real TIFF ColorMap (tag 320) plus
// PhotometricInterpretation=Palette (tag 262) — the original, pre-GDAL TIFF
// palette mechanism. QGIS (and everything else) auto-detects
// Photometric=Palette on load and switches straight to a "Paletted/Unique
// values" render with the embedded colors, no configuration needed. This
// only carries colors (the TIFF ColorMap has no text field, and pixel
// value = palette index) — the RAT/WHEREWILD_LEGEND above are still what
// carries names, for this app and for GDAL-aware readers. Skipped when the
// class values or band count/dtype don't fit a palette index (see
// buildPaletteEntries below) — in that case only the RAT/legend are
// written, same as before.
//
// How the patch works, structurally: TIFF's IFD chain can live anywhere in
// the file, so nothing has to move. A new IFD0 is built that copies every
// existing tag's value/offset field verbatim (offsets into the original
// pixel/strip/tile data stay valid since that data never moves) except
// GDAL_METADATA/GDAL_NODATA, which get new values appended after the
// current end of the file. Only the "offset to IFD0" field in the header
// is rewritten, to point at the new IFD0. `blob.slice()` is lazy, so the
// original body — pixels, overviews, everything — is never read into
// memory; only the small header + IFD0 + appended bytes are.
//
// Classic (32-bit offset) and BigTIFF (64-bit offset) are both supported.
// BigTIFF's header/IFD layout differs only in field widths — an 8-byte
// "offset to IFD0" instead of 4, an 8-byte entry count instead of 2,
// 20-byte entries (8-byte value/offset) instead of 12-byte (4-byte
// value/offset) — so the same "copy every tag's value/offset field
// verbatim, append new tag values after EOF, patch the IFD0 pointer"
// technique applies unchanged; only the byte widths below vary by format.

import { hexToRgb } from './cogTileMath';
import type { RasterEditableMeta } from './rasterEditableMeta';
import type { RasterMetadata } from './rasterMetadata';

export class UnsupportedTiffWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedTiffWriteError';
  }
}

const TAG_PHOTOMETRIC_INTERPRETATION = 262;
const TAG_GDAL_METADATA = 42112;
const TAG_GDAL_NODATA = 42113;
const TAG_COLOR_MAP = 320;
const TYPE_SHORT = 3;
const TYPE_ASCII = 2;
const PHOTOMETRIC_PALETTE = 3;
const PHOTOMETRIC_BLACK_IS_ZERO = 1;

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// GDALRATFieldType / GDALRATFieldUsage — verified against gcore/gdal.h.
const GFT_INTEGER = 0;
const GFT_STRING = 2;
const GFU_GENERIC = 0;
const GFU_NAME = 2;
const GFU_RED = 6;
const GFU_GREEN = 7;
const GFU_BLUE = 8;

const fieldDefn = (
  index: number,
  name: string,
  type: number,
  typeName: string,
  usage: number,
  usageName: string,
): string =>
  `<FieldDefn index="${index}"><Name>${name}</Name>` +
  `<Type typeAsString="${typeName}">${type}</Type>` +
  `<Usage usageAsString="${usageName}">${usage}</Usage></FieldDefn>`;

/**
 * A real GDAL Raster Attribute Table — byte-for-byte the same node shape
 * GDALRasterAttributeTable::Serialize() produces (gcore/gdal_rat.cpp),
 * wrapped the same way frmts/gtiff/gtiffdataset_write.cpp embeds one in
 * GDAL_METADATA. "Value"/"Class_Name" columns always; "Red"/"Green"/"Blue"
 * (0-255 ints, GDAL's own convention for per-row color — not a hex string
 * column, which isn't a thing GDAL recognizes) for both nominal and
 * ordinal rows that actually have a color set — nominal's colors are
 * user-picked, ordinal's are the sequential-colormap default (see
 * rasterEditableMeta.ts's classColorFor), but either way they're the real
 * colors this app renders, worth passing through either way.
 */
const buildRatXml = (classes: RasterEditableMeta['classes']): string => {
  const hasColor = classes.some((c) => c.color);
  const fields = [
    fieldDefn(0, 'Value', GFT_INTEGER, 'Integer', GFU_GENERIC, 'Generic'),
    fieldDefn(1, 'Class_Name', GFT_STRING, 'String', GFU_NAME, 'Name'),
  ];
  if (hasColor) {
    fields.push(
      fieldDefn(2, 'Red', GFT_INTEGER, 'Integer', GFU_RED, 'Red'),
      fieldDefn(3, 'Green', GFT_INTEGER, 'Integer', GFU_GREEN, 'Green'),
      fieldDefn(4, 'Blue', GFT_INTEGER, 'Integer', GFU_BLUE, 'Blue'),
    );
  }
  const rows = classes.map((c, i) => {
    const rgb = hasColor ? (hexToRgb(c.color ?? '') ?? [0, 0, 0]) : null;
    const cells = [
      `<F>${c.value}</F>`,
      `<F>${xmlEscape(c.name)}</F>`,
      ...(rgb
        ? [`<F>${rgb[0]}</F>`, `<F>${rgb[1]}</F>`, `<F>${rgb[2]}</F>`]
        : []),
    ];
    return `<Row index="${i}">${cells.join('')}</Row>`;
  });
  return (
    `<GDALRasterAttributeTable tableType="thematic">` +
    fields.join('') +
    rows.join('') +
    `</GDALRasterAttributeTable>`
  );
};

/**
 * The GDAL_METADATA tag's content. Always includes WHEREWILD_VALUE_TYPE (so
 * re-opening a saved file can always tell it was saved by this tool, even
 * one where scale/offset/units/legend are all still defaults) — Scale/
 * Offset/UnitType/the RAT/WHEREWILD_LEGEND are added only when actually
 * configured.
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
  const displayName = editable.displayName.trim();
  if (displayName) {
    items.push(`<Item name="WHEREWILD_NAME">${xmlEscape(displayName)}</Item>`);
  }
  if (isCategorical && editable.classes.length > 0) {
    items.push(
      `<Item name="DEFAULT_RASTER_ATTRIBUTE_TABLE" sample="0" role="rat">` +
        buildRatXml(editable.classes) +
        `</Item>`,
    );
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
  /** The raw value/offset field (4 bytes classic, 8 bytes BigTIFF), reused
   * verbatim for any tag we aren't touching — still correct whether it
   * holds an inline value or an offset into file data, since neither ever
   * moves. */
  value: Uint8Array;
};

/** Byte widths that differ between classic TIFF and BigTIFF; everything
 * else in embedMetadataIntoTiff is written generically against these. */
type TiffFormat = {
  big: boolean;
  littleEndian: boolean;
  ifd0Offset: number;
  /** 8 for classic, 16 for BigTIFF. */
  headerSize: number;
  /** 4 for classic, 8 for BigTIFF — width of the value/offset field and of
   * the "offset to IFD" fields (header + next-IFD). */
  offsetWidth: 4 | 8;
  /** 12 for classic (tag2+type2+count4+value4), 20 for BigTIFF
   * (tag2+type2+count8+value8). */
  entrySize: 12 | 20;
};

const readUint = (
  view: DataView,
  offset: number,
  width: 4 | 8,
  littleEndian: boolean,
): number =>
  width === 4
    ? view.getUint32(offset, littleEndian)
    : Number(view.getBigUint64(offset, littleEndian));

const writeUint = (
  view: DataView,
  offset: number,
  width: 4 | 8,
  value: number,
  littleEndian: boolean,
): void => {
  if (width === 4) view.setUint32(offset, value, littleEndian);
  else view.setBigUint64(offset, BigInt(value), littleEndian);
};

const readHeader = async (blob: Blob): Promise<TiffFormat> => {
  const buf = await blob.slice(0, 16).arrayBuffer();
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
    if (buf.byteLength < 16) {
      throw new UnsupportedTiffWriteError(
        'File is too small to be a valid BigTIFF.',
      );
    }
    return {
      big: true,
      littleEndian,
      headerSize: 16,
      offsetWidth: 8,
      entrySize: 20,
      ifd0Offset: readUint(view, 8, 8, littleEndian),
    };
  }
  if (magic !== 42) {
    throw new UnsupportedTiffWriteError('Not a recognizable TIFF file.');
  }
  return {
    big: false,
    littleEndian,
    headerSize: 8,
    offsetWidth: 4,
    entrySize: 12,
    ifd0Offset: readUint(view, 4, 4, littleEndian),
  };
};

/**
 * The byte offset where the new header ends and the untouched original
 * body begins — everything embedMetadataIntoTiff() writes lands either
 * before this point (the header, patched to point at the new IFD0) or
 * after `originalBlob.size` (newly appended tag values + the new IFD
 * itself); the body in between is always byte-identical to the original.
 * Exposes this so a caller with real filesystem write access (the File
 * System Access API) can patch a multi-gigabyte file in place — two small
 * writes, header + appended tail — instead of transferring the whole file
 * through a browser download. Only reads the file's first 16 bytes.
 */
export const getTiffHeaderSize = async (blob: Blob): Promise<number> =>
  (await readHeader(blob)).headerSize;

const readIfd0 = async (
  blob: Blob,
  format: TiffFormat,
): Promise<{ entries: RawIfdEntry[]; nextIfdOffset: number }> => {
  const { ifd0Offset, littleEndian, offsetWidth, entrySize } = format;
  const countWidth = format.big ? 8 : 2;
  const countBuf = await blob
    .slice(ifd0Offset, ifd0Offset + countWidth)
    .arrayBuffer();
  const entryCount = format.big
    ? Number(new DataView(countBuf).getBigUint64(0, littleEndian))
    : new DataView(countBuf).getUint16(0, littleEndian);
  const ifdLen = countWidth + entryCount * entrySize + offsetWidth;
  const ifdBuf = await blob
    .slice(ifd0Offset, ifd0Offset + ifdLen)
    .arrayBuffer();
  const view = new DataView(ifdBuf);
  const entries: RawIfdEntry[] = [];
  const valueOffsetInEntry = entrySize - offsetWidth; // 8 or 12
  for (let i = 0; i < entryCount; i += 1) {
    const base = countWidth + i * entrySize;
    entries.push({
      tag: view.getUint16(base, littleEndian),
      type: view.getUint16(base + 2, littleEndian),
      count: readUint(view, base + 4, format.big ? 8 : 4, littleEndian),
      value: new Uint8Array(
        ifdBuf.slice(
          base + valueOffsetInEntry,
          base + valueOffsetInEntry + offsetWidth,
        ),
      ),
    });
  }
  const nextIfdOffset = readUint(
    view,
    countWidth + entryCount * entrySize,
    offsetWidth,
    littleEndian,
  );
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
  const format = await readHeader(blob);
  const { littleEndian, offsetWidth, entrySize, headerSize } = format;
  const { entries, nextIfdOffset } = await readIfd0(blob, format);

  const gdalMetadataXml = buildGdalMetadataXml(editable);
  const noDataStr = metadata.noData != null ? String(metadata.noData) : null;

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
    const value = new Uint8Array(offsetWidth);
    if (bytes.length <= offsetWidth) {
      value.set(bytes);
    } else {
      padToEven();
      writeUint(
        new DataView(value.buffer),
        0,
        offsetWidth,
        cursor,
        littleEndian,
      );
      appended.push(bytes);
      cursor += bytes.length;
    }
    return { tag, type: TYPE_ASCII, count: bytes.length, value };
  };

  const shortEntry = (
    tag: number,
    v: number,
  ): { tag: number; type: number; count: number; value: Uint8Array } => {
    const value = new Uint8Array(offsetWidth);
    new DataView(value.buffer).setUint16(0, v, littleEndian);
    return { tag, type: TYPE_SHORT, count: 1, value };
  };

  const shortArrayEntry = (
    tag: number,
    values: number[],
  ): { tag: number; type: number; count: number; value: Uint8Array } => {
    const bytes = new Uint8Array(values.length * 2);
    const bytesView = new DataView(bytes.buffer);
    values.forEach((v, i) => bytesView.setUint16(i * 2, v, littleEndian));
    const value = new Uint8Array(offsetWidth);
    if (bytes.length <= offsetWidth) {
      value.set(bytes);
    } else {
      padToEven();
      writeUint(
        new DataView(value.buffer),
        0,
        offsetWidth,
        cursor,
        littleEndian,
      );
      appended.push(bytes);
      cursor += bytes.length;
    }
    return { tag, type: TYPE_SHORT, count: values.length, value };
  };

  /**
   * A native TIFF ColorMap (see the module doc comment for why this exists
   * alongside the RAT) — only when the raw pixel values can actually work
   * as palette indices: nominal or ordinal only (interval/ratio/circular
   * pixel values aren't category codes), a single band (Palette is a
   * whole-band interpretation, not per-band), an unsigned integer dtype
   * TIFF's ColorMap can size a table for at all, and every class value
   * within that table's range (0..2**bits-1) — a class value outside that
   * range (e.g. a `uint8` file where the app-side "class value" doesn't
   * actually match the raw stored byte) just gets skipped from the table
   * rather than aborting the whole thing.
   */
  const buildPaletteEntries = (): {
    tag: number;
    type: number;
    count: number;
    value: Uint8Array;
  }[] => {
    if (editable.valueType !== 'nominal' && editable.valueType !== 'ordinal')
      return [];
    if (metadata.bandCount !== 1) return [];
    if (!editable.classes.some((c) => c.color)) return [];
    const bitsMatch = /^uint(8|16)$/.exec(metadata.dtype);
    if (!bitsMatch) return [];
    const bits = Number(bitsMatch[1]);
    const size = 1 << bits;
    const red = new Array<number>(size).fill(0);
    const green = new Array<number>(size).fill(0);
    const blue = new Array<number>(size).fill(0);
    for (const c of editable.classes) {
      if (c.value < 0 || c.value >= size) continue;
      const rgb = c.color ? hexToRgb(c.color) : null;
      if (!rgb) continue;
      // TIFF ColorMap entries are always 16-bit regardless of the source
      // bit depth; 257 = 65535 / 255, the standard 8-bit -> 16-bit scale.
      red[c.value] = rgb[0] * 257;
      green[c.value] = rgb[1] * 257;
      blue[c.value] = rgb[2] * 257;
    }
    return [
      shortEntry(TAG_PHOTOMETRIC_INTERPRETATION, PHOTOMETRIC_PALETTE),
      // Layout per TIFF6 spec: all Red values, then all Green, then all
      // Blue — three concatenated blocks, not interleaved per-pixel.
      shortArrayEntry(TAG_COLOR_MAP, [...red, ...green, ...blue]),
    ];
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
  const paletteEntries = buildPaletteEntries();
  newEntries.push(...paletteEntries);

  // If an earlier save (or the file's own source) left it Palette-encoded
  // but the *current* configuration no longer wants a fixed palette (the
  // user switched away from nominal/ordinal, dropped all the colors, etc.
  // — buildPaletteEntries() returned nothing this time), revert
  // PhotometricInterpretation so readers stop treating raw pixel values as
  // color indices, and drop the now-stale ColorMap outright rather than
  // silently carrying it forward unrelated to the data it once described.
  const existingPhotometric = entries.find(
    (e) => e.tag === TAG_PHOTOMETRIC_INTERPRETATION,
  );
  const wasPalette =
    existingPhotometric != null &&
    new DataView(
      existingPhotometric.value.buffer,
      existingPhotometric.value.byteOffset,
    ).getUint16(0, littleEndian) === PHOTOMETRIC_PALETTE;
  const droppedTags = new Set<number>();
  if (paletteEntries.length === 0 && wasPalette) {
    newEntries.push(
      shortEntry(TAG_PHOTOMETRIC_INTERPRETATION, PHOTOMETRIC_BLACK_IS_ZERO),
    );
    droppedTags.add(TAG_COLOR_MAP);
  }

  // Never leave a stale duplicate of a tag we're rewriting — TIFF readers
  // expect at most one entry per tag.
  const newTags = new Set(newEntries.map((e) => e.tag));
  const kept = entries.filter(
    (e) => !newTags.has(e.tag) && !droppedTags.has(e.tag),
  );
  const allEntries = [...kept, ...newEntries].sort((a, b) => a.tag - b.tag);

  padToEven(); // IFDs must start at an even file offset.
  const newIfd0Offset = cursor;
  const countWidth = format.big ? 8 : 2;
  const valueOffsetInEntry = entrySize - offsetWidth;
  const ifdBuf = new ArrayBuffer(
    countWidth + allEntries.length * entrySize + offsetWidth,
  );
  const ifdView = new DataView(ifdBuf);
  if (format.big) {
    ifdView.setBigUint64(0, BigInt(allEntries.length), littleEndian);
  } else {
    ifdView.setUint16(0, allEntries.length, littleEndian);
  }
  allEntries.forEach((e, i) => {
    const base = countWidth + i * entrySize;
    ifdView.setUint16(base, e.tag, littleEndian);
    ifdView.setUint16(base + 2, e.type, littleEndian);
    writeUint(ifdView, base + 4, format.big ? 8 : 4, e.count, littleEndian);
    new Uint8Array(ifdBuf, base + valueOffsetInEntry, offsetWidth).set(e.value);
  });
  // Preserves the existing chain to any overview sub-IFDs — they, and
  // everything else in the file, are untouched.
  writeUint(
    ifdView,
    countWidth + allEntries.length * entrySize,
    offsetWidth,
    nextIfdOffset,
    littleEndian,
  );
  appended.push(new Uint8Array(ifdBuf));

  const headerBuf = await blob.slice(0, headerSize).arrayBuffer();
  const newHeader = new Uint8Array(headerBuf);
  writeUint(
    new DataView(newHeader.buffer),
    headerSize - offsetWidth,
    offsetWidth,
    newIfd0Offset,
    littleEndian,
  );

  return new Blob([newHeader, blob.slice(headerSize), ...appended], {
    type: 'image/tiff',
  });
};
