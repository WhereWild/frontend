// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  PageScrollContainer,
  PageTitle,
  ThemedText,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { VariableHeatmapMap } from '@/components/sections/VariableHeatmapMap';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import {
  resolveAssetBlob,
  selectFileFromPicker,
} from '@/hooks/upload/uploadWorkflowHelpers';
import { WebMetadata } from '@/utils/webMetadata';
import { buildCogFixCommand } from './cogFixCommand';
import { buildOverviewLevels } from './douglasPeucker';
import { MetadataEditor } from './MetadataEditor';
import { MetadataPanel } from './MetadataPanel';
import { VectorEditor } from './VectorEditor';
import { createCogTileRenderer, type CogTileRenderer } from './cogTileRenderer';
import type { DetectedValueType } from './dataTypeDetection';
import {
  buildInitialEditableMeta,
  editableMetaToDetectedType,
  toEnvironmentVariableOption,
  type RasterEditableMeta,
} from './rasterEditableMeta';
import {
  deriveDetectedValueType,
  deriveRenderBounds,
  inspectRaster,
  type RasterMetadata,
  type RenderBounds,
} from './rasterMetadata';
import { buildStyledGeoJson } from './geoJsonWriter';
import {
  inspectGeoJson,
  inspectShapefile,
  type GeoJsonFeatureCollection,
  type ShapefileInputFiles,
  type VectorMetadata,
} from './shapefileMetadata';
import {
  buildStyledShapefileZip,
  type OriginalShapefileFiles,
} from './shapefileWriter';
import {
  buildInitialVectorEditableMeta,
  type VectorEditableMeta,
} from './vectorEditableMeta';
import {
  canWriteInPlace,
  writeTiffInPlace,
  type WritableFileHandle,
} from './inPlaceFileWriter';
import {
  embedMetadataIntoTiff,
  UnsupportedTiffWriteError,
} from './tiffMetadataWriter';

const ACCEPTED_EXTENSIONS = ['.tif', '.tiff'] as const;
const MAP_HEIGHT = 520;

// The vector equivalent of the raster COG-checklist warning: past this many
// total vertices across every feature, a plain "load it all as one GeoJSON
// layer" render risks a slow/locked-up tab — see douglasPeucker.ts's doc
// comment for why this is a load-time-only cost, unlike a raster's
// per-zoomed-tile decode cost, and why a single simplification pass (not a
// zoom-swapped pyramid) is the right fix here.
const VECTOR_VERTEX_WARNING_THRESHOLD = 50000;
const VECTOR_VERTEX_SIMPLIFY_TARGET = 20000;

// 'confirm' = metadata parsed but the file fails the COG checklist — the
// tile renderer isn't built (and the map doesn't mount) until the user
// clicks through a warning, since rendering an un-optimized raster can be
// slow or lock up the tab (e.g. a huge single-level raster with no
// overviews forces every zoomed-out tile to decode a large chunk of the
// full-resolution data).
type Status = 'idle' | 'parsing' | 'confirm' | 'ready' | 'error';

type Loaded = {
  blob: Blob;
  fileName: string;
  fileSize: number;
  metadata: RasterMetadata;
  bounds: RenderBounds;
  detectedType: DetectedValueType | null;
};

// Which writer Save uses on this file — a shapefile bundle needs the
// original .shp/.shx/.prj/.cpg bytes to pass through unchanged (see
// shapefileWriter.ts); a native GeoJSON file needs nothing extra at all,
// since styling is just new JSON properties on the same one file (see
// geoJsonWriter.ts).
type VectorSource =
  | { kind: 'shapefile'; originalFiles: OriginalShapefileFiles }
  | { kind: 'geojson' };

type LoadedVector = {
  fileNameBase: string;
  source: VectorSource;
  metadata: VectorMetadata;
  /** The real, full-resolution parsed data — what Save always writes back,
   * regardless of what's currently on the map (simplification is a
   * rendering concern only, never something that should silently degrade
   * the user's actual data). */
  geojson: GeoJsonFeatureCollection;
  /** What's actually bound to the map — either geojson itself, or a
   * Douglas-Peucker-simplified copy the user opted into past the vertex
   * warning threshold. */
  displayGeojson: GeoJsonFeatureCollection;
};

const isBrowser = () =>
  Platform.OS === 'web' && typeof document !== 'undefined';

// Downloads a Blob straight from the browser under the given name — there's
// no writable handle back to the dropped File to save into directly, so
// "save" means "download the file with the metadata embedded in it,"
// same name as the original by default so it's a natural drop-in
// replacement.
const downloadBlob = (fileName: string, blob: Blob) => {
  if (!isBrowser()) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Debounce for rebuilding the tile renderer after a metadata edit (color
// swatch drags in particular can fire many onChange calls in a row) — the
// initial render (new file load / "Render anyway") always happens
// immediately, this only smooths out live edits to an already-open preview.
const EDIT_REBUILD_DEBOUNCE_MS = 300;

export function GisEditorScreen() {
  const responsive = useResponsive();
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const isStacked = responsive.breakpoint !== 'desktop';

  const [status, setStatus] = React.useState<Status>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [editableMeta, setEditableMeta] =
    React.useState<RasterEditableMeta | null>(null);
  const [renderer, setRenderer] = React.useState<CogTileRenderer | null>(null);
  const [loadSeq, setLoadSeq] = React.useState(0);
  // Cache-busts the tile URLs the map requests — bumped on every renderer
  // (re)build so an edited raster's tiles actually get re-fetched instead of
  // reusing what the map already has cached under the old URL.
  const [renderVersion, setRenderVersion] = React.useState(0);

  const requestIdRef = React.useRef(0);
  const rendererRef = React.useRef<CogTileRenderer | null>(null);

  // A parallel, independent state tree for the shapefile path — kept
  // entirely separate from the raster state above rather than unified into
  // one "file kind" union, since so little is actually shared (a raster and
  // a vector file have almost nothing in common beyond both ending up on a
  // map) that merging them would mean threading a lot of "which kind is
  // this" branching through code that's otherwise simple.
  const [vectorStatus, setVectorStatus] = React.useState<
    'idle' | 'parsing' | 'confirm' | 'ready' | 'error'
  >('idle');
  const [vectorErrorMessage, setVectorErrorMessage] = React.useState<
    string | null
  >(null);
  const [loadedVector, setLoadedVector] = React.useState<LoadedVector | null>(
    null,
  );
  const [vectorEditable, setVectorEditable] =
    React.useState<VectorEditableMeta | null>(null);
  const vectorRequestIdRef = React.useRef(0);

  const clearVector = React.useCallback(() => {
    vectorRequestIdRef.current += 1;
    setLoadedVector(null);
    setVectorEditable(null);
    setVectorErrorMessage(null);
    setVectorStatus('idle');
  }, []);

  const ingestVector = React.useCallback(
    async (input: ShapefileInputFiles & { shx?: Blob | null }) => {
      const requestId = vectorRequestIdRef.current + 1;
      vectorRequestIdRef.current = requestId;
      setLoadedVector(null);
      setVectorEditable(null);
      setVectorErrorMessage(null);
      setVectorStatus('parsing');
      try {
        const { geojson, metadata } = await inspectShapefile(input);
        if (vectorRequestIdRef.current !== requestId) return;
        const fileName =
          'name' in input.shp && typeof input.shp.name === 'string'
            ? input.shp.name
            : 'shapefile.shp';
        const originalFiles: OriginalShapefileFiles = {
          shpName: fileName,
          shp: await input.shp.arrayBuffer(),
          shx: input.shx ? await input.shx.arrayBuffer() : null,
          prj: input.prj ? await input.prj.arrayBuffer() : null,
          cpg: input.cpg ? await input.cpg.arrayBuffer() : null,
        };
        const next: LoadedVector = {
          fileNameBase: fileName.replace(/\.shp$/i, ''),
          source: { kind: 'shapefile', originalFiles },
          metadata,
          geojson,
          displayGeojson: geojson,
        };
        setLoadedVector(next);
        setVectorEditable(
          buildInitialVectorEditableMeta(metadata.fields, metadata.savedConfig),
        );
        setVectorStatus(
          metadata.vertexCount > VECTOR_VERTEX_WARNING_THRESHOLD
            ? 'confirm'
            : 'ready',
        );
      } catch (error) {
        if (vectorRequestIdRef.current !== requestId) return;
        console.error('Failed to prepare shapefile:', error);
        setVectorErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not read that as a shapefile.',
        );
        setVectorStatus('error');
      }
    },
    [],
  );

  const ingestGeoJson = React.useCallback(
    async (file: Blob & { name?: string }) => {
      const requestId = vectorRequestIdRef.current + 1;
      vectorRequestIdRef.current = requestId;
      setLoadedVector(null);
      setVectorEditable(null);
      setVectorErrorMessage(null);
      setVectorStatus('parsing');
      try {
        const { geojson, metadata } = await inspectGeoJson(file);
        if (vectorRequestIdRef.current !== requestId) return;
        const fileName =
          typeof file.name === 'string' ? file.name : 'layer.geojson';
        const next: LoadedVector = {
          fileNameBase: fileName.replace(/\.(geo)?json$/i, ''),
          source: { kind: 'geojson' },
          metadata,
          geojson,
          displayGeojson: geojson,
        };
        setLoadedVector(next);
        setVectorEditable(
          buildInitialVectorEditableMeta(metadata.fields, metadata.savedConfig),
        );
        setVectorStatus(
          metadata.vertexCount > VECTOR_VERTEX_WARNING_THRESHOLD
            ? 'confirm'
            : 'ready',
        );
      } catch (error) {
        if (vectorRequestIdRef.current !== requestId) return;
        console.error('Failed to prepare GeoJSON:', error);
        setVectorErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not read that as a GeoJSON file.',
        );
        setVectorStatus('error');
      }
    },
    [],
  );

  // From the vertex-count warning: either simplify (Douglas-Peucker, same
  // technique as a raster overview — see douglasPeucker.ts) before binding
  // to the map, or render the untouched original anyway. Never touches
  // `loadedVector.geojson` itself — Save always writes that back
  // regardless of what's currently displayed.
  const confirmVectorRender = React.useCallback((simplify: boolean) => {
    setLoadedVector((prev) => {
      if (!prev) return prev;
      const displayGeojson = simplify
        ? buildOverviewLevels(prev.geojson, VECTOR_VERTEX_SIMPLIFY_TARGET).at(
            -1,
          )!.data
        : prev.geojson;
      return { ...prev, displayGeojson };
    });
    setVectorStatus('ready');
  }, []);

  const [vectorSaveState, setVectorSaveState] = React.useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [vectorSaveError, setVectorSaveError] = React.useState<string | null>(
    null,
  );
  const saveVectorToFile = React.useCallback(async () => {
    if (!loadedVector || !vectorEditable) return;
    setVectorSaveState('saving');
    setVectorSaveError(null);
    try {
      if (loadedVector.source.kind === 'shapefile') {
        const zip = buildStyledShapefileZip(
          loadedVector.source.originalFiles,
          loadedVector.geojson.features,
          loadedVector.metadata.fields.map((f) => f.name),
          vectorEditable,
        );
        downloadBlob(`${loadedVector.fileNameBase}.zip`, zip);
      } else {
        const blob = buildStyledGeoJson(loadedVector.geojson, vectorEditable);
        downloadBlob(`${loadedVector.fileNameBase}.geojson`, blob);
      }
      setVectorSaveState('saved');
      setTimeout(() => setVectorSaveState('idle'), 2500);
    } catch (error) {
      setVectorSaveState('error');
      setVectorSaveError(
        error instanceof Error ? error.message : 'Could not save this file.',
      );
    }
  }, [loadedVector, vectorEditable]);

  const vectorInitialView = React.useMemo(() => {
    const bbox = loadedVector?.metadata.bbox;
    if (!bbox) return { lat: 0, lon: 0, zoom: 1 };
    const lonSpan = Math.max(1e-4, bbox[2] - bbox[0]);
    return {
      lat: (bbox[1] + bbox[3]) / 2,
      lon: (bbox[0] + bbox[2]) / 2,
      zoom: Math.max(1, Math.min(14, Math.log2(360 / lonSpan))),
    };
  }, [loadedVector]);

  const vectorLayerForMap = React.useMemo(() => {
    if (!loadedVector || !vectorEditable || vectorStatus !== 'ready') {
      return null;
    }
    const classColors = Object.fromEntries(
      vectorEditable.classes.map((c) => [c.value, c.color]),
    );
    return {
      geojson: loadedVector.displayGeojson,
      style: {
        mode: vectorEditable.mode,
        color: vectorEditable.color,
        field: vectorEditable.field,
        classColors,
      },
    };
  }, [loadedVector, vectorEditable, vectorStatus]);

  const buildRenderer = React.useCallback(
    async (
      next: Loaded,
      requestId: number,
      editable: RasterEditableMeta,
      isInitialLoad: boolean,
    ) => {
      try {
        const tileRenderer = await createCogTileRenderer({
          blob: next.blob,
          metadata: next.metadata,
          renderMin: editable.renderMin,
          renderMax: editable.renderMax,
          valueType: editable.valueType,
          legendClasses: editable.classes.map((c) => ({
            id: c.value,
            name: c.name,
            color: c.color,
          })),
          scale: editable.scale,
          offset: editable.offset,
        });
        if (requestIdRef.current !== requestId) {
          tileRenderer.dispose();
          return;
        }
        rendererRef.current?.dispose();
        rendererRef.current = tileRenderer;
        setRenderer(tileRenderer);
        setRenderVersion((v) => v + 1);
        if (isInitialLoad) setLoadSeq((n) => n + 1);
        setStatus('ready');
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        console.error('Failed to prepare GeoTIFF:', error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not read that file as a GeoTIFF.',
        );
        setStatus('error');
      }
    },
    [],
  );

  const ingest = React.useCallback(
    async (blob: Blob, fileName: string, fileSize: number) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      rendererRef.current?.dispose();
      rendererRef.current = null;
      setRenderer(null);
      setLoaded(null);
      setEditableMeta(null);
      setErrorMessage(null);
      setStatus('parsing');
      try {
        const metadata = await inspectRaster(blob);
        const bounds = await deriveRenderBounds(blob, metadata);
        const detectedType = await deriveDetectedValueType(blob, metadata);
        const next: Loaded = {
          blob,
          fileName,
          fileSize,
          metadata,
          bounds,
          detectedType,
        };
        if (requestIdRef.current !== requestId) return;
        const initialEditable = buildInitialEditableMeta(
          detectedType,
          bounds,
          metadata.scale,
          metadata.offset,
          metadata.units,
          metadata.savedConfig?.classes ?? null,
        );
        setLoaded(next);
        setEditableMeta(initialEditable);
        if (metadata.cog.isCog) {
          await buildRenderer(next, requestId, initialEditable, true);
        } else {
          setStatus('confirm');
        }
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        console.error('Failed to prepare GeoTIFF:', error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not read that file as a GeoTIFF.',
        );
        setStatus('error');
      }
    },
    [buildRenderer],
  );

  const confirmRender = React.useCallback(() => {
    if (!loaded || !editableMeta) return;
    setStatus('parsing');
    void buildRenderer(loaded, requestIdRef.current, editableMeta, true);
  }, [loaded, editableMeta, buildRenderer]);

  // Live-updates the map preview as the user edits data type / bounds /
  // units / legend — skipped on the very first editableMeta for a file
  // (that build already happened above, via ingest()/confirmRender()) by
  // only firing once a renderer is already showing.
  React.useEffect(() => {
    if (!loaded || !editableMeta || status !== 'ready') return;
    const requestId = requestIdRef.current;
    const timer = setTimeout(() => {
      void buildRenderer(loaded, requestId, editableMeta, false);
    }, EDIT_REBUILD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // Only re-run when the edited metadata itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableMeta]);

  const effectiveDetectedType = React.useMemo(
    () =>
      editableMeta
        ? editableMetaToDetectedType(editableMeta)
        : (loaded?.detectedType ?? null),
    [editableMeta, loaded],
  );

  const fixCommand = React.useMemo(
    () =>
      loaded
        ? buildCogFixCommand(
            loaded.fileName,
            loaded.metadata,
            effectiveDetectedType,
          )
        : '',
    [loaded, effectiveDetectedType],
  );
  const [copied, setCopied] = React.useState(false);
  const copyFixCommand = React.useCallback(() => {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      navigator.clipboard
    ) {
      void navigator.clipboard.writeText(fixCommand).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [fixCommand]);

  const [saveState, setSaveState] = React.useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [saveError, setSaveError] = React.useState<string | null>(null);
  // Set once a save actually lands, so the UI can say what really happened
  // (patched the dropped file directly vs. downloaded a modified copy) —
  // see inPlaceFileWriter.ts for why "in place" is worth distinguishing
  // for a large raster.
  const [lastSaveMode, setLastSaveMode] = React.useState<
    'in-place' | 'download' | null
  >(null);
  // Only ever set for a file that arrived via drag-and-drop in a browser
  // that exposes DataTransferItem.getAsFileSystemHandle() (Chromium) — null
  // otherwise, which just means "save" falls back to a download.
  const fileHandleRef = React.useRef<WritableFileHandle | null>(null);
  const saveToFile = React.useCallback(async () => {
    if (!loaded || !editableMeta) return;
    setSaveState('saving');
    setSaveError(null);
    try {
      const saved = await embedMetadataIntoTiff(
        loaded.blob,
        loaded.metadata,
        editableMeta,
      );
      const handle = fileHandleRef.current;
      let savedInPlace = false;
      if (handle && (await canWriteInPlace(handle))) {
        try {
          await writeTiffInPlace(handle, loaded.blob, saved);
          savedInPlace = true;
        } catch (inPlaceError) {
          // Falls through to the full-copy download below — e.g. the
          // handle's underlying file moved/was deleted since it was
          // dropped, or the browser revoked permission mid-save.
          console.error(
            'In-place save failed, falling back to a download:',
            inPlaceError,
          );
        }
      }
      if (!savedInPlace) {
        downloadBlob(loaded.fileName, saved);
      }
      setLastSaveMode(savedInPlace ? 'in-place' : 'download');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch (error) {
      setSaveState('error');
      setSaveError(
        error instanceof UnsupportedTiffWriteError
          ? error.message
          : 'Could not save this file.',
      );
    }
  }, [loaded, editableMeta]);

  const pickFile = React.useCallback(async () => {
    const { file, errorMessage: pickError } = await selectFileFromPicker({
      pickerType: ['image/tiff', 'image/geo+tiff'],
      allowedExtensions: ACCEPTED_EXTENSIONS,
      invalidSelectionMessage:
        'Unsupported file type. Choose a GeoTIFF (.tif or .tiff).',
    });
    if (pickError) {
      setStatus('error');
      setErrorMessage(pickError);
      return;
    }
    if (!file) return;
    // The document picker never hands back a real filesystem handle, so a
    // file selected this way always saves as a download.
    fileHandleRef.current = null;
    clearVector();
    const blob = await resolveAssetBlob(file);
    await ingest(blob, file.name, blob.size);
  }, [ingest, clearVector]);

  const clear = React.useCallback(() => {
    requestIdRef.current += 1;
    rendererRef.current?.dispose();
    rendererRef.current = null;
    fileHandleRef.current = null;
    setRenderer(null);
    setLoaded(null);
    setEditableMeta(null);
    setErrorMessage(null);
    setStatus('idle');
  }, []);

  // Web drag-and-drop.
  const dropRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!isBrowser()) return;
    const node = dropRef.current;
    if (!node) return;
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;

      // A shapefile is a bundle, not a single file — dragging its
      // extracted .shp alongside its .dbf/.prj/.shx/.cpg siblings is the
      // normal gesture (see shapefileMetadata.ts's doc comment for why a
      // .zip isn't accepted here yet: shpjs unzips internally without
      // handing the raw component bytes back out, which Save needs to
      // pass .shp/.shx/.prj/.cpg through unchanged).
      const byExt = (re: RegExp) => files.find((f) => re.test(f.name)) ?? null;
      const shpFile = byExt(/\.shp$/i);
      if (shpFile) {
        clear();
        fileHandleRef.current = null;
        void ingestVector({
          shp: shpFile,
          shx: byExt(/\.shx$/i),
          dbf: byExt(/\.dbf$/i),
          prj: byExt(/\.prj$/i),
          cpg: byExt(/\.cpg$/i),
        });
        return;
      }
      if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
        clearVector();
        setVectorStatus('error');
        setVectorErrorMessage(
          'Zipped shapefiles aren’t supported yet — unzip it and drop the .shp/.dbf/.prj files together.',
        );
        return;
      }
      if (files.length === 1 && /\.(geo)?json$/i.test(files[0].name)) {
        clear();
        fileHandleRef.current = null;
        void ingestGeoJson(files[0]);
        return;
      }

      const file = files[0];
      const name = file.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
        setStatus('error');
        setErrorMessage(
          'Drop a GeoTIFF (.tif or .tiff), a shapefile (.shp + .dbf, optionally + .prj/.shx/.cpg), or a .geojson file.',
        );
        return;
      }
      clearVector();
      // Chromium exposes a real writable handle to a dropped file via this
      // (non-standard, feature-detected) API — captured here, synchronously
      // in the drop handler, per the API's own usage pattern; the promise
      // itself resolves later. Absent elsewhere (Firefox/Safari), so
      // "save" there always falls back to a download.
      fileHandleRef.current = null;
      const item = e.dataTransfer?.items?.[0] as
        | (DataTransferItem & {
            getAsFileSystemHandle?: () => Promise<WritableFileHandle>;
          })
        | undefined;
      if (item?.getAsFileSystemHandle) {
        item
          .getAsFileSystemHandle()
          .then((handle) => {
            if (handle && (handle as { kind?: string }).kind !== 'directory') {
              fileHandleRef.current = handle;
            }
          })
          .catch(() => {});
      }
      void ingest(file, file.name, file.size);
    };
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('drop', onDrop);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('drop', onDrop);
    };
  }, [ingest, ingestVector, ingestGeoJson, clear, clearVector]);

  React.useEffect(
    () => () => {
      rendererRef.current?.dispose();
    },
    [],
  );

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | GIS Editor'
          description='Inspect a GeoTIFF / Cloud-Optimized GeoTIFF in your browser and preview it on the WhereWild map.'
          path='/gis-editor'
        />
      ) : null}
      <PageSurface testID='gis-editor-screen'>
        <PageScrollContainer
          contentContainerStyle={getResponsiveContentContainerStyle(
            responsive,
            {
              includeHorizontalPadding: false,
              includeBottomPadding: true,
              includeGap: true,
            },
          )}
          bounces={false}
        >
          {Platform.OS === 'web' ? <PageTitle title='GIS Editor' /> : null}

          <View
            style={[
              styles.contentShell,
              getResponsiveContentContainerStyle(responsive, {
                includeWidth: false,
                includeTopPadding: false,
              }),
            ]}
          >
            <View
              style={[
                styles.content,
                { maxWidth: responsive.contentWidth, gap: responsive.gap },
              ]}
            >
              <ThemedText variant='body'>
                Drop a GeoTIFF below to inspect its metadata and preview it on
                the map, drag a shapefile’s .shp together with its .dbf (and
                .prj/.shx/.cpg, if you have them), or drop a .geojson file. The
                file never leaves your browser.
              </ThemedText>

              {React.createElement(
                'div',
                { ref: dropRef, style: { width: '100%' } },
                <View
                  style={[
                    styles.dropZone,
                    {
                      borderColor: palette.border.default.secondary,
                      backgroundColor: palette.background.default.secondary,
                    },
                  ]}
                >
                  <ThemedText variant='bodyEmphasis'>
                    {loaded
                      ? loaded.fileName
                      : loadedVector
                        ? `${loadedVector.fileNameBase}.shp`
                        : status === 'parsing' || vectorStatus === 'parsing'
                          ? 'Reading file…'
                          : 'No file loaded'}
                  </ThemedText>
                  <View style={styles.actionsRow}>
                    <Button
                      variant='primary'
                      label={
                        loaded || loadedVector
                          ? 'Load a different file'
                          : 'Choose GeoTIFF'
                      }
                      disabled={status === 'parsing'}
                      onPress={pickFile}
                    />
                    {loaded || loadedVector ? (
                      <Button
                        variant='subtle'
                        label='Clear'
                        onPress={() => {
                          clear();
                          clearVector();
                        }}
                      />
                    ) : null}
                  </View>
                </View>,
              )}

              {status === 'error' && errorMessage ? (
                <View
                  style={[
                    styles.errorBox,
                    {
                      backgroundColor: palette.background.warning.secondary,
                      borderColor: palette.border.warning.default,
                    },
                  ]}
                >
                  <ThemedText
                    variant='bodySmall'
                    style={{ color: palette.text.warning.default }}
                  >
                    {errorMessage}
                  </ThemedText>
                </View>
              ) : null}

              {vectorStatus === 'error' && vectorErrorMessage ? (
                <View
                  style={[
                    styles.errorBox,
                    {
                      backgroundColor: palette.background.warning.secondary,
                      borderColor: palette.border.warning.default,
                    },
                  ]}
                >
                  <ThemedText
                    variant='bodySmall'
                    style={{ color: palette.text.warning.default }}
                  >
                    {vectorErrorMessage}
                  </ThemedText>
                </View>
              ) : null}

              {loaded && status === 'confirm' ? (
                <View
                  style={[
                    styles.resultsRow,
                    isStacked && styles.resultsColumn,
                    { gap: responsive.gap },
                  ]}
                >
                  <View style={styles.metaColumn}>
                    <MetadataPanel
                      metadata={loaded.metadata}
                      detectedType={loaded.detectedType}
                    />
                    {editableMeta ? (
                      <MetadataEditor
                        editable={editableMeta}
                        detectedType={loaded.detectedType}
                        rawBounds={loaded.bounds}
                        onChange={setEditableMeta}
                      />
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.confirmBox,
                      {
                        backgroundColor: palette.background.warning.secondary,
                        borderColor: palette.border.warning.default,
                      },
                    ]}
                  >
                    <ThemedText
                      variant='bodyEmphasis'
                      style={{ color: palette.text.warning.default }}
                    >
                      This file fails the Cloud-Optimized GeoTIFF checklist
                      above.
                    </ThemedText>
                    <ThemedText
                      variant='bodySmall'
                      style={{ color: palette.text.warning.default }}
                    >
                      Rendering it on the map can be slow or lock up your
                      browser tab — especially with no overviews, since every
                      zoomed-out tile has to decode a large chunk of the
                      full-resolution data.
                    </ThemedText>

                    <View style={styles.fixItBox}>
                      <ThemedText variant='bodyEmphasis'>
                        Fix it with desktop GDAL
                      </ThemedText>
                      <ThemedText
                        variant='bodySmall'
                        style={{ color: palette.text.default.secondary }}
                      >
                        Re-encoding as a Cloud-Optimized GeoTIFF isn’t something
                        this tool can do in the browser without a size ceiling
                        (a few GB at most) — GDAL itself has no such limit on
                        your machine. Install it via QGIS,{' '}
                        <ThemedText
                          variant='bodySmallLink'
                          onPress={() =>
                            Linking.openURL('https://gdal.org/download.html')
                          }
                        >
                          gdal.org
                        </ThemedText>
                        , or your package manager (
                        <ThemedText variant='code'>
                          brew install gdal
                        </ThemedText>{' '}
                        /{' '}
                        <ThemedText variant='code'>
                          conda install -c conda-forge gdal
                        </ThemedText>
                        ), then run:
                      </ThemedText>
                      <View
                        style={[
                          styles.commandBox,
                          {
                            backgroundColor:
                              palette.background.default.tertiary,
                          },
                        ]}
                      >
                        <ThemedText variant='code' selectable>
                          {fixCommand}
                        </ThemedText>
                      </View>
                      <View style={styles.actionsRow}>
                        <Button
                          variant='subtle'
                          label={copied ? 'Copied!' : 'Copy command'}
                          onPress={copyFixCommand}
                        />
                      </View>
                      <ThemedText
                        variant='bodyTiny'
                        style={{ color: palette.text.default.secondary }}
                      >
                        Then drop {loaded.fileName.replace(/\.tiff?$/i, '')}
                        _cog.tif back in here.
                      </ThemedText>
                    </View>

                    <View style={styles.actionsRow}>
                      <Button
                        variant='primary'
                        label='Render anyway'
                        onPress={confirmRender}
                      />
                      <Button
                        variant='subtle'
                        label='Choose a different file'
                        onPress={clear}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              {loaded && renderer && status === 'ready' ? (
                <View
                  style={[
                    styles.resultsRow,
                    isStacked && styles.resultsColumn,
                    { gap: responsive.gap },
                  ]}
                >
                  <View style={styles.metaColumn}>
                    <MetadataPanel
                      metadata={loaded.metadata}
                      detectedType={loaded.detectedType}
                    />
                    {loaded.bounds.approximate ? (
                      <ThemedText
                        variant='bodyTiny'
                        style={{ color: palette.text.default.secondary }}
                      >
                        {`Colour range ${loaded.bounds.min}–${loaded.bounds.max} is a data-type estimate (no overviews to sample).`}
                      </ThemedText>
                    ) : null}
                    {editableMeta ? (
                      <MetadataEditor
                        editable={editableMeta}
                        detectedType={loaded.detectedType}
                        rawBounds={loaded.bounds}
                        onChange={setEditableMeta}
                      />
                    ) : null}

                    <View style={styles.saveBox}>
                      <ThemedText variant='bodyEmphasis'>Save</ThemedText>
                      <ThemedText
                        variant='bodyTiny'
                        style={{ color: palette.text.default.secondary }}
                      >
                        Embeds this configuration directly into the file’s own
                        tags — the standard GDAL_METADATA tag (scale, offset,
                        units, and for nominal/ordinal a real GDAL Raster
                        Attribute Table QGIS can render) and GDAL_NODATA — not a
                        separate sidecar file. Nothing else in the file is
                        touched; re-opening the saved file here restores this
                        exact configuration instead of re-detecting it. If your
                        browser supports it, saving patches the dropped file in
                        place (no re-download of the whole raster); otherwise it
                        downloads a modified copy.
                      </ThemedText>
                      <View style={styles.actionsRow}>
                        <Button
                          variant='primary'
                          label={
                            saveState === 'saving'
                              ? 'Saving…'
                              : saveState === 'saved'
                                ? lastSaveMode === 'in-place'
                                  ? 'Saved in place!'
                                  : 'Saved (downloaded copy)!'
                                : 'Save to file'
                          }
                          disabled={saveState === 'saving'}
                          onPress={() => void saveToFile()}
                        />
                      </View>
                      {saveState === 'error' && saveError ? (
                        <ThemedText
                          variant='bodySmall'
                          style={{ color: palette.text.warning.default }}
                        >
                          {saveError}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.previewColumn}>
                    {editableMeta ? (
                      <VariableHeatmapMap
                        key={loadSeq}
                        variableMeta={toEnvironmentVariableOption(
                          loaded.fileName,
                          renderVersion,
                          editableMeta,
                        )}
                        tileSource={{
                          kind: 'local',
                          renderTile: renderer.renderTile,
                          readPointValue: renderer.readPointValue,
                        }}
                        height={MAP_HEIGHT}
                        initialLat={renderer.view.lat}
                        initialLon={renderer.view.lon}
                        initialZoom={renderer.view.zoom}
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}

              {loadedVector && vectorEditable && vectorStatus === 'confirm' ? (
                <View
                  style={[
                    styles.resultsRow,
                    isStacked && styles.resultsColumn,
                    { gap: responsive.gap },
                  ]}
                >
                  <View style={styles.metaColumn}>
                    <VectorEditor
                      metadata={loadedVector.metadata}
                      editable={vectorEditable}
                      geojson={loadedVector.geojson}
                      onChange={setVectorEditable}
                    />
                  </View>
                  <View
                    style={[
                      styles.confirmBox,
                      {
                        backgroundColor: palette.background.warning.secondary,
                        borderColor: palette.border.warning.default,
                      },
                    ]}
                  >
                    <ThemedText
                      variant='bodyEmphasis'
                      style={{ color: palette.text.warning.default }}
                    >
                      {`This file has ${loadedVector.metadata.vertexCount.toLocaleString()} vertices.`}
                    </ThemedText>
                    <ThemedText
                      variant='bodySmall'
                      style={{ color: palette.text.warning.default }}
                    >
                      Rendering that many at once can be slow or lock up your
                      browser tab. Simplifying reduces vertex count (the same
                      idea as a raster overview) while keeping the shape
                      recognizable — it only affects this preview, never what
                      gets saved.
                    </ThemedText>
                    <View style={styles.actionsRow}>
                      <Button
                        variant='primary'
                        label='Simplify and render'
                        onPress={() => confirmVectorRender(true)}
                      />
                      <Button
                        variant='subtle'
                        label='Render full detail anyway'
                        onPress={() => confirmVectorRender(false)}
                      />
                      <Button
                        variant='subtle'
                        label='Choose a different file'
                        onPress={clearVector}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              {loadedVector && vectorEditable && vectorStatus === 'ready' ? (
                <View
                  style={[
                    styles.resultsRow,
                    isStacked && styles.resultsColumn,
                    { gap: responsive.gap },
                  ]}
                >
                  <View style={styles.metaColumn}>
                    <VectorEditor
                      metadata={loadedVector.metadata}
                      editable={vectorEditable}
                      geojson={loadedVector.geojson}
                      onChange={setVectorEditable}
                    />

                    <View style={styles.saveBox}>
                      <ThemedText variant='bodyEmphasis'>Save</ThemedText>
                      <ThemedText
                        variant='bodyTiny'
                        style={{ color: palette.text.default.secondary }}
                      >
                        Downloads a .zip with your original .shp/.shx/.prj/ .cpg
                        untouched (styling never touches geometry) plus a
                        rebuilt .dbf carrying your original attributes and this
                        tool’s own WW_MODE/WW_FIELD/WW_COLOR fields — real
                        columns in the shapefile’s own attribute table, not a
                        sidecar file. Re-opening the saved file here restores
                        this exact styling.
                      </ThemedText>
                      <View style={styles.actionsRow}>
                        <Button
                          variant='primary'
                          label={
                            vectorSaveState === 'saving'
                              ? 'Saving…'
                              : vectorSaveState === 'saved'
                                ? 'Saved!'
                                : 'Save to file'
                          }
                          disabled={vectorSaveState === 'saving'}
                          onPress={() => void saveVectorToFile()}
                        />
                      </View>
                      {vectorSaveState === 'error' && vectorSaveError ? (
                        <ThemedText
                          variant='bodySmall'
                          style={{ color: palette.text.warning.default }}
                        >
                          {vectorSaveError}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.previewColumn}>
                    <SpeciesOccurrenceMap
                      key={loadedVector.fileNameBase}
                      occurrences={[]}
                      showMarkers={false}
                      height={MAP_HEIGHT}
                      allowPinObservations={false}
                      initialLat={vectorInitialView.lat}
                      initialLon={vectorInitialView.lon}
                      initialZoom={vectorInitialView.zoom}
                      localVectorLayer={vectorLayerForMap}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  contentShell: { width: '100%', alignItems: 'center' },
  content: { width: '100%' },
  dropZone: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Size.radius['400'],
    padding: Size.space['400'],
    gap: Size.space['300'],
    alignItems: 'flex-start',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Size.space['200'],
    flexWrap: 'wrap',
  },
  errorBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    padding: Size.space['300'],
  },
  confirmBox: {
    flex: 1,
    minWidth: 280,
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    padding: Size.space['300'],
    gap: Size.space['200'],
    alignItems: 'flex-start',
  },
  fixItBox: {
    width: '100%',
    gap: Size.space['200'],
  },
  commandBox: {
    width: '100%',
    borderRadius: Size.radius['200'],
    padding: Size.space['200'],
  },
  saveBox: {
    width: '100%',
    gap: Size.space['200'],
  },
  resultsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resultsColumn: { flexDirection: 'column' },
  metaColumn: { flex: 1, minWidth: 280, gap: Size.space['300'] },
  previewColumn: { flex: 1, minWidth: 320 },
});
