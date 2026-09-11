// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads a GeoTIFF's header/directory metadata in the browser via `geotiff`
// (require()d at call time so it never loads during SSR and rides the
// /gis-editor route chunk). The only pixel read is deriveRenderBounds().

import {
  deriveCogDiagnostics,
  type CogDiagnostics,
  type IfdSummary,
} from './cogDiagnostics';
import { detectValueType, type DetectedValueType } from './dataTypeDetection';

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
  };
};

/**
 * Reads the smallest overview's single band and strips out non-finite /
 * no-data pixels, for both deriveRenderBounds() and
 * deriveDetectedValueType(). Null when there are no overviews to sample
 * (reading the full-resolution band isn't bounded, so we don't).
 */
const readSmallestOverviewSamples = async (
  blob: Blob,
  metadata: RasterMetadata,
): Promise<number[] | null> => {
  if (metadata.overviews.length === 0) return null;
  const tiff = await loadGeoTiff().fromBlob(blob);
  const count = await tiff.getImageCount();
  const smallest = await tiff.getImage(count - 1);
  const rasters = (await smallest.readRasters({ samples: [0] })) as
    | ArrayLike<number>[]
    | ArrayLike<number>;
  const band: ArrayLike<number> = Array.isArray(rasters) ? rasters[0] : rasters;

  const noData = metadata.noData;
  const values: number[] = [];
  for (let i = 0; i < band.length; i += 1) {
    const v = band[i];
    if (!Number.isFinite(v) || (noData != null && v === noData)) continue;
    values.push(v);
  }
  return values;
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
  const values = await readSmallestOverviewSamples(blob, metadata);
  if (values == null) {
    return { ...nominalRangeForDtype(metadata.dtype), approximate: true };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
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
  const values = await readSmallestOverviewSamples(blob, metadata);
  if (values == null) {
    // No overviews to sample — but an embedded palette is still a
    // definitive signal on its own, just without a real class list.
    return metadata.hasColorMap
      ? detectValueType([], { hasColorMap: true })
      : null;
  }
  return detectValueType(values, { hasColorMap: metadata.hasColorMap });
};
