// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a GeoTIFF's header/directory metadata in the browser via `geotiff`
// (require()d at call time so it never loads during SSR and rides the
// /gis-editor route chunk). The only pixel reads are deriveRenderBounds()
// and deriveDetectedValueType(), which share one bounded, cached decode of
// the smallest overview (see readSmallestOverviewBand below).

import {
  deriveCogDiagnostics,
  type CogDiagnostics,
  type IfdSummary,
} from './cogDiagnostics';
import {
  detectValueType,
  type DetectedValueType,
  type ValueTypeGuess,
} from './dataTypeDetection';

export type RasterOverview = { width: number; height: number };

export type RasterMetadata = {
  width: number;
  height: number;
  tiled: boolean;
  tileWidth: number | null;
  tileHeight: number | null;
  bandCount: number;
  dtype: string;
  compression: string;
  noData: number | null;
  epsg: number | null;
  crsLabel: string;
  geoKeys: Record<string, unknown> | null;
  resolution: [number, number] | null;
  bbox: [number, number, number, number] | null;
  bigTiff: boolean;
  overviews: RasterOverview[];
  cog: CogDiagnostics;
  /** Whether the file has an embedded palette (Photometric=Palette + a
   * ColorMap tag) — a definitive signal for a categorical/nominal raster,
   * used by deriveDetectedValueType(). */
  hasColorMap: boolean;
  /** Band 0's GDAL Scale/Offset metadata (display = raw * scale + offset),
   * when the file embeds one — e.g. a raw int16 stored as tenths of a
   * degree would carry scale=0.1. Null when not present; the metadata
   * editor seeds its editable scale/offset from these but lets them be
   * overridden, same as every other auto-detected field. */
  scale: number | null;
  offset: number | null;
  /** Band 0's GDAL UnitType item, when present (e.g. "mm", "°C"). */
  units: string | null;
  /** This tool's own previously-saved configuration, when re-opening a file
   * saved via tiffMetadataWriter.ts's embedMetadataIntoTiff() — read from
   * the WHEREWILD_VALUE_TYPE/WHEREWILD_LEGEND items in the same
   * GDAL_METADATA tag Scale/Offset come from. When present,
   * deriveDetectedValueType() returns it directly (confidence "high",
   * skipping the sampled-pixel heuristic entirely) so a save/reopen
   * round-trips the exact configuration instead of re-guessing it. */
  savedConfig: {
    valueType: ValueTypeGuess;
    classes: { id: number; name: string; color: string | null }[];
  } | null;
};

export type RenderBounds = { min: number; max: number; approximate: boolean };

const COMPRESSION_NAMES: Record<number, string> = {
  1: 'None',
  5: 'LZW',
  7: 'JPEG',
  8: 'Deflate',
  32773: 'PackBits',
  32946: 'Deflate (old)',
  34887: 'LERC',
  34925: 'LZMA',
  50000: 'ZSTD',
  50001: 'WebP',
};

const EPSG_LABELS: Record<number, string> = {
  4326: 'WGS 84 (geographic)',
  4269: 'NAD83 (geographic)',
  3857: 'Web Mercator',
  3395: 'World Mercator',
  5070: 'NAD83 / Conus Albers',
  6933: 'WGS 84 / NSIDC EASE-Grid 2.0 Global',
};

const dtypeFromFormat = (sampleFormat: number, bits: number): string => {
  if (sampleFormat === 3) return `float${bits}`;
  if (sampleFormat === 2) return `int${bits}`;
  return `uint${bits}`;
};

const nominalRangeForDtype = (dtype: string): { min: number; max: number } => {
  switch (dtype) {
    case 'uint8':
      return { min: 0, max: 255 };
    case 'int8':
      return { min: -128, max: 127 };
    case 'uint16':
      return { min: 0, max: 65535 };
    case 'int16':
      return { min: -32768, max: 32767 };
    case 'uint32':
      return { min: 0, max: 4294967295 };
    case 'int32':
      return { min: -2147483648, max: 2147483647 };
    default:
      return { min: 0, max: 1 };
  }
};

// GDAL writes per-band scale/offset into the free-form GDAL_METADATA TIFF
// tag (an XML blob of <Item name="...">value</Item> entries) rather than a
// dedicated GeoTIFF tag — geotiff.js's getGDALMetadata() parses that blob
// into a plain name->value object, keyed however the writer capitalized it
// ("Scale"/"SCALE"/"scale" all show up in the wild), hence the
// case-insensitive lookup here.
export const readGdalScaleOffset = (
  gdalMetadata: Record<string, string> | null | undefined,
): { scale: number | null; offset: number | null } => {
  if (!gdalMetadata) return { scale: null, offset: null };
  let scale: number | null = null;
  let offset: number | null = null;
  for (const [key, value] of Object.entries(gdalMetadata)) {
    const lower = key.toLowerCase();
    const num = Number(value);
    if (!Number.isFinite(num)) continue;
    if (lower === 'scale') scale = num;
    else if (lower === 'offset') offset = num;
  }
  return { scale, offset };
};

/** Same GDAL_METADATA blob, same case-insensitive-key convention, for the
 * UnitType item (see tiffMetadataWriter.ts's buildGdalMetadataXml — this is
 * the same standard GDAL item that writes it). */
export const readGdalUnitType = (
  gdalMetadata: Record<string, string> | null | undefined,
): string | null => {
  if (!gdalMetadata) return null;
  for (const [key, value] of Object.entries(gdalMetadata)) {
    if (key.toLowerCase() === 'unittype' && value.trim()) {
      // See readWherewildConfig's comment: geotiff.js doesn't XML-unescape
      // an Item's inner text, and buildGdalMetadataXml() escaped it.
      return value
        .trim()
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    }
  }
  return null;
};

const VALUE_TYPE_GUESSES: ReadonlySet<string> = new Set([
  'nominal',
  'ordinal',
  'interval',
  'ratio',
  'circular',
]);

/** Reads this tool's own previously-saved WHEREWILD_VALUE_TYPE/
 * WHEREWILD_LEGEND items back out of the same GDAL_METADATA object
 * readGdalScaleOffset() reads Scale/Offset from — see
 * tiffMetadataWriter.ts's buildGdalMetadataXml() for what writes them.
 * Defensive about malformed/foreign content (a WHEREWILD_LEGEND item that
 * isn't valid JSON, or one some other tool happened to write) — falls back
 * to null rather than throwing, so a corrupt item just means "nothing
 * saved," not a broken file load. */
export const readWherewildConfig = (
  gdalMetadata: Record<string, string> | null | undefined,
): RasterMetadata['savedConfig'] => {
  const rawValueType = gdalMetadata?.WHEREWILD_VALUE_TYPE;
  if (!rawValueType || !VALUE_TYPE_GUESSES.has(rawValueType)) return null;
  const valueType = rawValueType as ValueTypeGuess;

  let classes: { id: number; name: string; color: string | null }[] = [];
  const rawLegend = gdalMetadata?.WHEREWILD_LEGEND;
  if (rawLegend) {
    try {
      // geotiff.js's getGDALMetadata() hands back each Item's raw inner
      // text verbatim — it does not XML-unescape it — and
      // buildGdalMetadataXml() ran the JSON through xmlEscape() before
      // embedding it (so a literal `"` in the XML wouldn't break the
      // Item's own markup). `&amp;` must be unescaped last, or a legend
      // entry whose escaped text happens to contain a literal "&quot;"
      // sequence (from a class name with a literal `&` immediately
      // followed by the text "quot;") would get double-unescaped.
      const unescaped = rawLegend
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      const parsed: unknown = JSON.parse(unescaped);
      if (Array.isArray(parsed)) {
        classes = parsed.filter(
          (c): c is { id: number; name: string; color: string | null } =>
            !!c &&
            typeof c === 'object' &&
            typeof (c as Record<string, unknown>).id === 'number' &&
            typeof (c as Record<string, unknown>).name === 'string',
        );
      }
    } catch {
      classes = [];
    }
  }
  return { valueType, classes };
};

const firstNumber = (value: unknown): number | undefined => {
  if (Array.isArray(value))
    return typeof value[0] === 'number' ? value[0] : undefined;
  return typeof value === 'number' ? value : undefined;
};

const resolveCrs = (
  geoKeys: Record<string, unknown> | null | undefined,
): { epsg: number | null; crsLabel: string } => {
  if (!geoKeys) return { epsg: null, crsLabel: 'Unknown / not georeferenced' };
  const projected = firstNumber(geoKeys.ProjectedCSTypeGeoKey);
  const geographic = firstNumber(geoKeys.GeographicTypeGeoKey);
  const epsg =
    projected && projected !== 32767
      ? projected
      : geographic && geographic !== 32767
        ? geographic
        : null;
  const citation =
    (typeof geoKeys.ProjectedCitationGeoKey === 'string' &&
      geoKeys.ProjectedCitationGeoKey) ||
    (typeof geoKeys.GeogCitationGeoKey === 'string' &&
      geoKeys.GeogCitationGeoKey) ||
    '';
  if (epsg) {
    const label = EPSG_LABELS[epsg] ?? citation.trim();
    return {
      epsg,
      crsLabel: label ? `EPSG:${epsg} - ${label}` : `EPSG:${epsg}`,
    };
  }
  return {
    epsg: null,
    crsLabel: citation.trim() || 'Unknown / not georeferenced',
  };
};

type GeoImageLike = {
  getWidth(): number;
  getHeight(): number;
  getTileWidth(): number;
  getTileHeight(): number;
  isTiled: boolean;
  getSamplesPerPixel(): number;
  getSampleFormat(sampleIndex?: number): number;
  getBitsPerSample(sampleIndex?: number): number;
  getGeoKeys(): Record<string, unknown>;
  getFileDirectory(): Record<string, unknown>;
  getGDALNoData(): number | null;
  getGDALMetadata?(sample?: number | null): Record<string, string> | null;
  getResolution(): number[];
  getBoundingBox(): number[];
  readRasters(options?: Record<string, unknown>): Promise<unknown>;
};

const loadGeoTiff = (): {
  fromBlob: (b: Blob) => Promise<{
    getImageCount(): Promise<number>;
    getImage(i: number): Promise<GeoImageLike>;
  }>;
} =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('geotiff');

const ifdSummary = (image: GeoImageLike): IfdSummary => ({
  width: image.getWidth(),
  height: image.getHeight(),
  tiled: image.isTiled,
  tileWidth: image.isTiled ? image.getTileWidth() : undefined,
  tileHeight: image.isTiled ? image.getTileHeight() : undefined,
});

export const inspectRaster = async (blob: Blob): Promise<RasterMetadata> => {
  const tiff = await loadGeoTiff().fromBlob(blob);
  const count = await tiff.getImageCount();

  const full = await tiff.getImage(0);
  const fileDirectory = full.getFileDirectory() ?? {};

  const ifds: IfdSummary[] = [ifdSummary(full)];
  const overviews: RasterOverview[] = [];
  for (let i = 1; i < count; i += 1) {
    const ov = await tiff.getImage(i);
    if (((ov.getFileDirectory().NewSubfileType as number) ?? 0) & 4) continue;
    ifds.push(ifdSummary(ov));
    overviews.push({ width: ov.getWidth(), height: ov.getHeight() });
  }
  overviews.sort((a, b) => b.width * b.height - a.width * a.height);

  const sampleFormat = Number(full.getSampleFormat?.(0) ?? 1) || 1;
  const bits = Number(full.getBitsPerSample?.(0) ?? 8) || 8;
  const dtype = dtypeFromFormat(sampleFormat, bits);
  const compressionCode = Number(fileDirectory.Compression ?? 1);
  const resolution = full.getResolution?.();
  const geoKeys = full.getGeoKeys?.() ?? null;
  const { epsg, crsLabel } = resolveCrs(geoKeys);

  let bbox: number[] | undefined;
  try {
    bbox = full.getBoundingBox?.();
  } catch {
    bbox = undefined;
  }

  // geotiff.js's getGDALMetadata(sample) filters strictly on the Item's
  // `sample` attribute: sample=0 keeps only per-band items (where
  // buildGdalMetadataXml puts Scale/Offset/UnitType/the RAT, sample="0",
  // matching GDAL's own per-band convention) and drops anything with no
  // `sample` attribute at all; sample=null is the opposite. WHEREWILD_
  // VALUE_TYPE/WHEREWILD_LEGEND are deliberately dataset-level (no sample
  // attribute), so they only show up in the sample=null call — a single
  // sample=0 call, as this used to be, can never see them.
  let gdalMetadata: Record<string, string> | null = null;
  let gdalMetadataDatasetLevel: Record<string, string> | null = null;
  try {
    gdalMetadata = full.getGDALMetadata?.(0) ?? null;
  } catch {
    gdalMetadata = null;
  }
  try {
    gdalMetadataDatasetLevel = full.getGDALMetadata?.(null) ?? null;
  } catch {
    gdalMetadataDatasetLevel = null;
  }
  const { scale, offset } = readGdalScaleOffset(gdalMetadata);
  const units = readGdalUnitType(gdalMetadata);
  const savedConfig = readWherewildConfig(gdalMetadataDatasetLevel);

  return {
    width: full.getWidth(),
    height: full.getHeight(),
    tiled: full.isTiled,
    tileWidth: full.isTiled ? full.getTileWidth() : null,
    tileHeight: full.isTiled ? full.getTileHeight() : null,
    bandCount: full.getSamplesPerPixel(),
    dtype,
    compression:
      COMPRESSION_NAMES[compressionCode] ?? `Code ${compressionCode}`,
    noData: full.getGDALNoData?.() ?? null,
    epsg,
    crsLabel,
    geoKeys,
    resolution:
      Array.isArray(resolution) && resolution.length >= 2
        ? [Math.abs(resolution[0]), Math.abs(resolution[1])]
        : null,
    bbox:
      Array.isArray(bbox) && bbox.length >= 4
        ? [bbox[0], bbox[1], bbox[2], bbox[3]]
        : null,
    bigTiff: Boolean((tiff as unknown as { bigTiff?: boolean }).bigTiff),
    overviews,
    cog: deriveCogDiagnostics(ifds),
    hasColorMap:
      Number(fileDirectory.PhotometricInterpretation ?? -1) === 3 &&
      fileDirectory.ColorMap != null,
    scale,
    offset,
    units,
    savedConfig,
  };
};

// "Smallest overview" isn't a fixed size — a file with only one or two
// overview levels can still have a multi-megapixel smallest level, and
// decoding that fully (readRasters decompresses every source tile the
// window touches) was the actual cost of "sampling," not the JS-side loop
// over the result. Capping the read to a bounded center window makes the
// decode cost — not just the array-scan cost — independent of how well the
// file's overviews were built.
const MAX_SAMPLE_DIM = 1024;

// Reads (a bounded window of) the smallest overview's single band, raw (no
// filtering/copying — noData and non-finite pixels are skipped inline by
// each consumer, see below). Cached per-blob since deriveRenderBounds() and
// deriveDetectedValueType() both need it and are normally called back to
// back on the same file in GisEditorScreen's ingest() — without this, that
// decoded the sample window *twice* in a row, doubling an already-visible
// stall on a large nominal/categorical file. Keyed by the Blob so a new
// file never sees a stale entry.
const smallestBandCache = new WeakMap<
  Blob,
  Promise<ArrayLike<number> | null>
>();

const readSmallestOverviewBand = (
  blob: Blob,
  metadata: RasterMetadata,
): Promise<ArrayLike<number> | null> => {
  const cached = smallestBandCache.get(blob);
  if (cached) return cached;
  const promise = (async (): Promise<ArrayLike<number> | null> => {
    if (metadata.overviews.length === 0) return null;
    const tiff = await loadGeoTiff().fromBlob(blob);
    const count = await tiff.getImageCount();
    const smallest = await tiff.getImage(count - 1);
    const width = smallest.getWidth();
    const height = smallest.getHeight();
    const window: [number, number, number, number] | undefined =
      width > MAX_SAMPLE_DIM || height > MAX_SAMPLE_DIM
        ? (() => {
            const cw = Math.min(width, MAX_SAMPLE_DIM);
            const ch = Math.min(height, MAX_SAMPLE_DIM);
            const x0 = Math.floor((width - cw) / 2);
            const y0 = Math.floor((height - ch) / 2);
            return [x0, y0, x0 + cw, y0 + ch];
          })()
        : undefined;
    const rasters = (await smallest.readRasters({
      samples: [0],
      ...(window ? { window } : {}),
    })) as ArrayLike<number>[] | ArrayLike<number>;
    return Array.isArray(rasters) ? rasters[0] : rasters;
  })();
  smallestBandCache.set(blob, promise);
  return promise;
};

/**
 * Min/max for the preview colour stretch. Reads the smallest overview only
 * (bounded); falls back to the dtype's nominal range when there are no
 * overviews.
 */
export const deriveRenderBounds = async (
  blob: Blob,
  metadata: RasterMetadata,
): Promise<RenderBounds> => {
  const band = await readSmallestOverviewBand(blob, metadata);
  if (band == null) {
    return { ...nominalRangeForDtype(metadata.dtype), approximate: true };
  }
  const noData = metadata.noData;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < band.length; i += 1) {
    const v = band[i];
    if (!Number.isFinite(v) || (noData != null && v === noData)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { ...nominalRangeForDtype(metadata.dtype), approximate: true };
  }
  return { min, max, approximate: false };
};

/**
 * Guesses the raster's measurement level from the same downsampled sample
 * used for deriveRenderBounds(). Null when there's nothing to sample (no
 * overviews) — the caller should treat that as "unknown", not "continuous".
 */
export const deriveDetectedValueType = async (
  blob: Blob,
  metadata: RasterMetadata,
): Promise<DetectedValueType | null> => {
  if (metadata.savedConfig) {
    const { valueType, classes } = metadata.savedConfig;
    return {
      guess: valueType,
      confidence: 'high',
      reason:
        'Read from this file’s previously saved WhereWild metadata — not re-detected.',
      distinctCount: classes.length > 0 ? classes.length : null,
      distinctValues:
        classes.length > 0
          ? classes.map((c) => c.id).sort((a, b) => a - b)
          : null,
    };
  }
  const band = await readSmallestOverviewBand(blob, metadata);
  if (band == null) {
    // No overviews to sample — but an embedded palette is still a
    // definitive signal on its own, just without a real class list.
    return metadata.hasColorMap
      ? detectValueType([], null, { hasColorMap: true })
      : null;
  }
  return detectValueType(band, metadata.noData, {
    hasColorMap: metadata.hasColorMap,
  });
};
