// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Custom layers (raster/vector files authored or edited via /gis-editor)
// attached on the upload page. Everything here runs entirely client-side --
// this backend NEVER receives the raw raster/vector file, only the already-
// sampled per-observation values (as an ordinary extra CSV column) plus a
// small JSON description of what that column means (see
// wherewild's util.upload.parse_custom_layer_metadata). Reuses /gis-editor's
// own inspection (inspectRaster/inspectGeoJson) and point-sampling
// (createCogTileRenderer) code directly, so "does this layer have usable
// metadata" always means the same thing there and here.

import type * as DocumentPicker from 'expo-document-picker';
import { inspectRaster } from '@/components/gisEditor/rasterMetadata';
import {
  createCogTileRenderer,
  UnsupportedCrsError,
} from '@/components/gisEditor/cogTileRenderer';
import {
  inspectGeoJson,
  type VectorSavedConfig,
} from '@/components/gisEditor/shapefileMetadata';
import { createVectorPointSampler } from '@/components/gisEditor/vectorPointSampler';
import { resolveAssetBlob } from '@/hooks/upload/uploadWorkflowHelpers';

/** The category string wherewild's util.upload.parse_custom_layer_metadata
 * always stamps a custom layer's variable_metadata row with, server-side --
 * the one signal a downloaded/re-imported dataset carries for "this
 * variable used to be a custom layer" (there's no separate boolean field).
 * A real catalog variable always has its own real category instead, so
 * this string never collides with one. */
export const CUSTOM_LAYER_VARIABLE_CATEGORY = 'Custom Layers';

export type CustomLayerLegendClass = {
  id: number;
  name: string;
  color: string | null;
};

/** The small description sent to the backend alongside the already-sampled
 * value column -- matches util.upload.parse_custom_layer_metadata's
 * expected shape exactly. */
export type CustomLayerDescriptor = {
  id: string;
  name: string;
  valueType: 'ratio' | 'interval' | 'nominal' | 'ordinal';
  units?: string | null;
  legendClasses?: CustomLayerLegendClass[] | null;
};

export type CustomLayerSampleResult = {
  descriptor: CustomLayerDescriptor;
  /** One entry per input point, in the same order -- null where the point
   * fell outside the layer's coverage, on noData, or (vector) inside no
   * feature. */
  values: (number | null)[];
};

const RASTER_EXTENSIONS = ['.tif', '.tiff'];
const VECTOR_EXTENSIONS = ['.geojson', '.json'];

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
};

/** A slug-safe variable id derived from the filename, so a layer named
 * "Local Wetlands.tif" becomes the column/variable id "local_wetlands" --
 * mirrors util/upload.py's own slugging convention for archive filenames. */
export const customLayerIdFromFilename = (filename: string): string => {
  const base = filename.slice(
    0,
    filename.length - extensionOf(filename).length,
  );
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'custom_layer';
};

/** A vector layer only has something meaningful to sample when it's been
 * styled by category (a chosen field + a class list) -- a "single" mode
 * vector (uniform color, no per-feature category) carries no analyzable
 * value, so it's treated the same as "metadata not detected" even though
 * WW_MODE is technically present. */
const isUsableVectorConfig = (
  config: VectorSavedConfig | null,
): config is VectorSavedConfig & { field: string } =>
  !!config && config.mode === 'categorical' && !!config.field;

export type CustomLayerKind = 'raster' | 'vector' | 'unsupported';

export type CustomLayerInspection = {
  kind: CustomLayerKind;
  /** True if this file carries usable WhereWild-embedded metadata (raster:
   * WHEREWILD_VALUE_TYPE; vector: WW_MODE=categorical with a field) -- the
   * marker /gis-editor itself uses to mean "configured there". */
  hasMetadata: boolean;
};

// One parse per attached file, shared by the attach-time metadata check, the
// sampling pass, and the local point-click/basemap renderer -- each of which
// used to parse (and, for the renderer, re-read) the same GeoJSON from
// scratch, which for a nationwide layer is several multi-hundred-MB parses.
// Keyed by the asset object itself so it's freed once the layer is removed.
const geoJsonInspectionCache = new WeakMap<
  DocumentPicker.DocumentPickerAsset,
  Promise<Awaited<ReturnType<typeof inspectGeoJson>>>
>();

export const inspectGeoJsonCached = (
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<Awaited<ReturnType<typeof inspectGeoJson>>> => {
  let pending = geoJsonInspectionCache.get(asset);
  if (!pending) {
    pending = resolveAssetBlob(asset).then(inspectGeoJson);
    geoJsonInspectionCache.set(asset, pending);
    // A failed parse shouldn't be remembered -- the file may be fixed and
    // re-attached under the same asset object.
    pending.catch(() => geoJsonInspectionCache.delete(asset));
  }
  return pending;
};

// A long synchronous loop freezes the whole tab (no repaint, no input), so
// sampling hands control back to the event loop this often -- also the
// cadence progress is reported at.
const YIELD_INTERVAL_MS = 30;
const CLOCK_CHECK_EVERY = 16;

const yieldToEventLoop = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

export type SamplingProgress = (done: number, total: number) => void;

/** Checks a single attached file for GIS-editor-embedded metadata, without
 * sampling anything yet -- used to build the "metadata not detected"
 * warning as soon as a file is attached. */
export const inspectCustomLayerAsset = async (
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<CustomLayerInspection> => {
  const ext = extensionOf(asset.name);
  if (RASTER_EXTENSIONS.includes(ext)) {
    const blob = await resolveAssetBlob(asset);
    const metadata = await inspectRaster(blob);
    // Circular (angular bearing) rasters aren't supported as a custom-
    // upload variable -- see sampleRaster's matching guard.
    const hasMetadata =
      metadata.savedConfig !== null &&
      metadata.savedConfig.valueType !== 'circular';
    return { kind: 'raster', hasMetadata };
  }
  if (VECTOR_EXTENSIONS.includes(ext)) {
    const { metadata } = await inspectGeoJsonCached(asset);
    return {
      kind: 'vector',
      hasMetadata: isUsableVectorConfig(metadata.savedConfig),
    };
  }
  return { kind: 'unsupported', hasMetadata: false };
};

/** Filenames (in the order given) that don't carry usable WhereWild-
 * embedded metadata -- either genuinely missing, an unsupported file type,
 * or (vector) styled as "single" mode with no per-feature category. Any
 * file whose inspection itself throws (corrupt/unparseable) is treated the
 * same way: something to fix in the GIS editor first. */
export const findCustomLayersMissingMetadata = async (
  assets: DocumentPicker.DocumentPickerAsset[],
): Promise<string[]> => {
  const results = await Promise.all(
    assets.map(async (asset) => {
      try {
        const { hasMetadata } = await inspectCustomLayerAsset(asset);
        return hasMetadata ? null : asset.name;
      } catch {
        return asset.name;
      }
    }),
  );
  return results.filter((name): name is string => name !== null);
};

export type ObservationPoint = { lat: number; lon: number };

const sampleRaster = async (
  asset: DocumentPicker.DocumentPickerAsset,
  points: ObservationPoint[],
  onProgress?: SamplingProgress,
): Promise<CustomLayerSampleResult | null> => {
  const blob = await resolveAssetBlob(asset);
  const metadata = await inspectRaster(blob);
  const savedConfig = metadata.savedConfig;
  // Circular (angular bearing) rasters aren't supported as a custom-upload
  // variable -- the backend's own value-type vocabulary for these
  // (util.upload.CUSTOM_LAYER_VALUE_TYPES) is ratio/interval/nominal/
  // ordinal only, matching relative-rank support's own scope.
  if (!savedConfig || savedConfig.valueType === 'circular') return null;

  let renderer;
  try {
    renderer = await createCogTileRenderer({
      blob,
      metadata,
      // renderMin/renderMax only affect tile colorization, never
      // readPointValue() -- inert here.
      renderMin: 0,
      renderMax: 1,
      valueType: savedConfig.valueType,
      legendClasses: savedConfig.classes,
      scale: metadata.scale ?? 1,
      offset: metadata.offset ?? 0,
    });
  } catch (error) {
    if (error instanceof UnsupportedCrsError) return null;
    throw error;
  }

  try {
    const values: (number | null)[] = [];
    let lastReport = Date.now();
    for (const point of points) {
      // Sequential, not Promise.all: each read opens a windowed decode
      // against the same shared GeoTIFF source -- safer than firing every
      // observation's read concurrently against one decoder instance.

      const result = await renderer.readPointValue(point.lat, point.lon);
      values.push(result?.value ?? null);
      if (onProgress && Date.now() - lastReport >= YIELD_INTERVAL_MS) {
        onProgress(values.length, points.length);
        lastReport = Date.now();
      }
    }
    const id = customLayerIdFromFilename(asset.name);
    return {
      descriptor: {
        id,
        name: id,
        valueType: savedConfig.valueType,
        units: metadata.units,
        legendClasses:
          savedConfig.valueType === 'nominal' ||
          savedConfig.valueType === 'ordinal'
            ? savedConfig.classes
            : null,
      },
      values,
    };
  } finally {
    renderer.dispose();
  }
};

const sampleVector = async (
  asset: DocumentPicker.DocumentPickerAsset,
  points: ObservationPoint[],
  onProgress?: SamplingProgress,
): Promise<CustomLayerSampleResult | null> => {
  const { geojson, metadata } = await inspectGeoJsonCached(asset);
  const savedConfig = metadata.savedConfig;
  if (!isUsableVectorConfig(savedConfig)) return null;
  const field = savedConfig.field;

  // Assign each distinct field value a stable sequential class id, in the
  // saved config's own class order -- the same "class_<id>" numeric
  // convention every other categorical variable in this pipeline uses.
  const classIdByValue = new Map<string, number>();
  const legendClasses: CustomLayerLegendClass[] = savedConfig.classes.map(
    (cls, index) => {
      classIdByValue.set(cls.value, index);
      return { id: index, name: cls.name, color: cls.color };
    },
  );

  const sampler = createVectorPointSampler(geojson, field, classIdByValue);
  const values: (number | null)[] = new Array(points.length);
  let lastYield = Date.now();
  for (let i = 0; i < points.length; i += 1) {
    values[i] = sampler.sample(points[i].lat, points[i].lon);
    if (
      i % CLOCK_CHECK_EVERY === 0 &&
      Date.now() - lastYield >= YIELD_INTERVAL_MS
    ) {
      onProgress?.(i + 1, points.length);
      await yieldToEventLoop();
      lastYield = Date.now();
    }
  }

  const id = customLayerIdFromFilename(asset.name);
  return {
    descriptor: { id, name: id, valueType: 'nominal', legendClasses },
    values,
  };
};

/** Samples one attached custom layer at every given observation point.
 * Returns null when the layer has no usable metadata, an unsupported CRS
 * (raster), or an unsupported file type -- callers should already have
 * filtered these out via findCustomLayersMissingMetadata, but this stays
 * defensive since attach and sample can race a fast re-upload. */
export const sampleCustomLayer = async (
  asset: DocumentPicker.DocumentPickerAsset,
  points: ObservationPoint[],
  onProgress?: SamplingProgress,
): Promise<CustomLayerSampleResult | null> => {
  const ext = extensionOf(asset.name);
  if (RASTER_EXTENSIONS.includes(ext)) {
    return sampleRaster(asset, points, onProgress);
  }
  if (VECTOR_EXTENSIONS.includes(ext)) {
    return sampleVector(asset, points, onProgress);
  }
  return null;
};
