// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds a client-side tile/point-value renderer for a custom layer that's
// still attached in the current upload session -- the same "browser-parsed
// raster/vector, never sent to the backend" renderers /gis-editor already
// built (cogTileRenderer.ts, vectorTileRenderer.ts), reused here so the
// upload page's background-point clicks and "variable" basemap mode work
// for a custom layer exactly like they do for a real catalog variable,
// instead of always calling the backend (which never has this file -- see
// customLayers.ts's own doc comment on why the raw file is never uploaded).

import type * as DocumentPicker from 'expo-document-picker';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import { inspectRaster } from '@/components/gisEditor/rasterMetadata';
import {
  createCogTileRenderer,
  UnsupportedCrsError,
  type PointValue,
  type RenderedTile,
} from '@/components/gisEditor/cogTileRenderer';
import {
  inspectGeoJson,
  type GeoJsonFeatureCollection,
} from '@/components/gisEditor/shapefileMetadata';
import { createVectorTileRenderer } from '@/components/gisEditor/vectorTileRenderer';
import {
  buildOverviewLevels,
  DEFAULT_TARGET_VERTEX_COUNT,
} from '@/components/gisEditor/douglasPeucker';
import { resolveAssetBlob } from '@/hooks/upload/uploadWorkflowHelpers';

export type LocalCustomLayerRenderer = {
  renderTile: (
    z: number,
    x: number,
    y: number,
    url: string,
  ) => Promise<RenderedTile | null>;
  readPointValue: (lat: number, lon: number) => Promise<PointValue | null>;
  dispose: () => void;
};

const RASTER_EXTENSIONS = ['.tif', '.tiff'];
const VECTOR_EXTENSIONS = ['.geojson', '.json'];

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
};

const createLocalRasterRenderer = async (
  asset: DocumentPicker.DocumentPickerAsset,
  variableMeta: EnvironmentVariableOption,
): Promise<LocalCustomLayerRenderer | null> => {
  const blob = await resolveAssetBlob(asset);
  const metadata = await inspectRaster(blob);
  if (!metadata.savedConfig) return null;

  try {
    // renderMin/renderMax come from the already-fetched variable meta (the
    // same numbers a real backend-rendered tile would use — see
    // util/upload.py's parse_custom_layer_metadata), not re-derived from
    // the file, so tiles/points match whatever the legend is currently
    // showing.
    const renderer = await createCogTileRenderer({
      blob,
      metadata,
      renderMin: variableMeta.renderMin ?? 0,
      renderMax: variableMeta.renderMax ?? 1,
      valueType: metadata.savedConfig.valueType,
      legendClasses:
        variableMeta.legendClasses?.map((cls) => ({
          id: Number(cls.id),
          name: cls.name,
          color: cls.color ?? null,
        })) ?? null,
      scale: metadata.scale ?? 1,
      offset: metadata.offset ?? 0,
    });
    return {
      renderTile: renderer.renderTile,
      readPointValue: renderer.readPointValue,
      dispose: renderer.dispose,
    };
  } catch (error) {
    if (error instanceof UnsupportedCrsError) return null;
    throw error;
  }
};

const createLocalVectorRenderer = async (
  asset: DocumentPicker.DocumentPickerAsset,
  variableMeta: EnvironmentVariableOption,
): Promise<LocalCustomLayerRenderer | null> => {
  const blob = await resolveAssetBlob(asset);
  const { geojson, metadata } = await inspectGeoJson(blob);
  const savedConfig = metadata.savedConfig;
  if (
    !savedConfig ||
    savedConfig.mode !== 'categorical' ||
    !savedConfig.field
  ) {
    return null;
  }

  // Same value->classId assignment sampleVector() used at upload time (see
  // customLayers.ts) — re-derived from the file's own saved class order
  // rather than passed in, but deterministic from the same savedConfig, so
  // it lines up with the class ids already baked into variableMeta.
  const classIndexByValue = new Map(
    savedConfig.classes.map((cls, index) => [cls.value, index]),
  );
  const classColorsById = new Map<number, string>(
    (variableMeta.legendClasses ?? []).map((cls) => [
      Number(cls.id),
      cls.color ?? '#3388ff',
    ]),
  );
  const classNamesById = new Map<number, string>(
    (variableMeta.legendClasses ?? []).map((cls) => [Number(cls.id), cls.name]),
  );
  const overviewLevels =
    metadata.cachedOverviewLevels ??
    buildOverviewLevels(
      geojson as GeoJsonFeatureCollection,
      DEFAULT_TARGET_VERTEX_COUNT,
    );

  const renderer = createVectorTileRenderer({
    overviewLevels,
    field: savedConfig.field,
    classIndexByValue,
    getStyle: () => ({ classColorsById, classNamesById }),
    bbox: metadata.bbox,
  });
  return {
    renderTile: renderer.renderTile,
    readPointValue: renderer.readPointValue,
    // No open decoder/handle to release — everything's held by plain JS
    // objects the renderer closure owns, unlike the raster renderer's open
    // GeoTIFF source.
    dispose: () => {},
  };
};

/** Builds a local renderer for one custom layer still attached in this
 * upload session, or null when the file isn't usable as one (unsupported
 * CRS, no saved metadata, a "single color" vector with no category field
 * to key a class id off of) — callers should fall back to the normal
 * remote path in that case. */
export const createLocalCustomLayerRenderer = async (
  asset: DocumentPicker.DocumentPickerAsset,
  variableMeta: EnvironmentVariableOption,
): Promise<LocalCustomLayerRenderer | null> => {
  const ext = extensionOf(asset.name);
  if (RASTER_EXTENSIONS.includes(ext)) {
    return createLocalRasterRenderer(asset, variableMeta);
  }
  if (VECTOR_EXTENSIONS.includes(ext)) {
    return createLocalVectorRenderer(asset, variableMeta);
  }
  return null;
};
