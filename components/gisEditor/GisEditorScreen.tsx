// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  PageScrollContainer,
  PageTitle,
  ThemedText,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import {
  VariableHeatmapMap,
  type HeatmapSelection,
} from '@/components/sections/VariableHeatmapMap';
import {
  formatValue,
  isVariableCategorical,
  isVariableCircular,
  joinClassNamesWithAnd,
} from '@/components/sections/speciesEnvironment/model';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import {
  circularRangeSpan,
  FULL_CIRCLE_SPAN_THRESHOLD,
} from '@/hooks/useCircularDragSelection';
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
import {
  buildOverviewLevels,
  DEFAULT_TARGET_VERTEX_COUNT,
} from './douglasPeucker';
import { MetadataEditor } from './MetadataEditor';
import { MetadataPanel } from './MetadataPanel';
import { VectorEditor } from './VectorEditor';
import { createCogTileRenderer, type CogTileRenderer } from './cogTileRenderer';
import { createVectorTileRenderer } from './vectorTileRenderer';
import type { DetectedValueType, ValueTypeGuess } from './dataTypeDetection';
import {
  addDiscoveredClasses,
  buildInitialEditableMeta,
  editableMetaToDetectedType,
  toEnvironmentVariableOption,
  withValueType,
  type RasterEditableMeta,
} from './rasterEditableMeta';
import {
  deriveDetectedValueType,
  deriveRenderBounds,
  inspectRaster,
  scanForCategoricalClasses,
  type RasterMetadata,
  type RenderBounds,
} from './rasterMetadata';
import { buildStyledGeoJson } from './geoJsonWriter';
import {
  inspectGeoJson,
  type GeoJsonFeatureCollection,
  type VectorMetadata,
} from './shapefileMetadata';
import {
  buildInitialVectorEditableMeta,
  toVectorVariableMeta,
  vectorClassIndex,
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

type LoadedVector = {
  fileNameBase: string;
  metadata: VectorMetadata;
  geojson: GeoJsonFeatureCollection;
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
  // A short, human-readable label for whatever the 'parsing' status is
  // doing right now (see ingest()/buildRenderer()) -- shown next to the
  // spinner so a slow step (the file's own size, or a categorical scan,
  // see rasterMetadata.ts's readCategoricalScanBand) doesn't read as a
  // stuck/frozen UI.
  const [loadStage, setLoadStage] = React.useState<string | null>(null);
  // True while a manual switch to nominal/ordinal (from a continuous
  // auto-guess, whose own distinctValues is always null) is running the
  // on-demand class scan -- see handleValueTypeChange and
  // rasterMetadata.ts's scanForCategoricalClasses.
  const [isScanningClasses, setIsScanningClasses] = React.useState(false);
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
  // Live class/range selection surfaced from VariableHeatmapMap, same as
  // /maps' "Selected range: …" header text — reset per load via `key` on
  // the map itself, so a stale selection from a previous file never lingers.
  const [rasterSelection, setRasterSelection] =
    React.useState<HeatmapSelection>({
      classIds: [],
      valueRanges: [],
      angleRanges: [],
    });

  const requestIdRef = React.useRef(0);
  const rendererRef = React.useRef<CogTileRenderer | null>(null);

  // A parallel, independent state tree for the vector (GeoJSON) path — kept
  // entirely separate from the raster state above rather than unified into
  // one "file kind" union, since so little is actually shared (a raster and
  // a vector file have almost nothing in common beyond both ending up on a
  // map) that merging them would mean threading a lot of "which kind is
  // this" branching through code that's otherwise simple.
  const [vectorStatus, setVectorStatus] = React.useState<
    'idle' | 'parsing' | 'ready' | 'error'
  >('idle');
  const [vectorErrorMessage, setVectorErrorMessage] = React.useState<
    string | null
  >(null);
  const [loadedVector, setLoadedVector] = React.useState<LoadedVector | null>(
    null,
  );
  const [vectorEditable, setVectorEditable] =
    React.useState<VectorEditableMeta | null>(null);
  // Cache-busts vectorTileRenderer's tile URLs (mirrors renderVersion for
  // the raster path) — bumped whenever styling changes, so a re-color/
  // rename actually gets new tiles instead of reusing what the map already
  // cached under the old URL.
  const [vectorRenderVersion, setVectorRenderVersion] = React.useState(0);
  React.useEffect(() => {
    if (vectorEditable) setVectorRenderVersion((v) => v + 1);
  }, [vectorEditable]);
  const vectorRequestIdRef = React.useRef(0);
  const [vectorSelection, setVectorSelection] =
    React.useState<HeatmapSelection>({
      classIds: [],
      valueRanges: [],
      angleRanges: [],
    });

  const clearVector = React.useCallback(() => {
    vectorRequestIdRef.current += 1;
    setLoadedVector(null);
    setVectorEditable(null);
    setVectorErrorMessage(null);
    setVectorStatus('idle');
  }, []);

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
          metadata,
          geojson,
        };
        setLoadedVector(next);
        setVectorEditable(
          buildInitialVectorEditableMeta(
            metadata.fields,
            metadata.savedConfig,
            geojson.features,
          ),
        );
        // No vertex-count warning/confirm step: vectorTileRenderer.ts
        // renders on demand, per tile, from its own Douglas-Peucker
        // overview pyramid (see its doc comment) — unlike the old "load the
        // whole thing as one Leaflet/MapLibre vector layer" approach, an
        // arbitrarily large file can't lock up the tab here.
        setVectorStatus('ready');
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

  const [vectorSaveState, setVectorSaveState] = React.useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [vectorSaveError, setVectorSaveError] = React.useState<string | null>(
    null,
  );
  // Built once per file load, either from a cache this tool already saved
  // alongside the file last time (shapefileMetadata.ts's
  // cachedOverviewLevels) or fresh (douglasPeucker.ts's buildOverviewLevels)
  // if there's no valid cache — geometry simplification never depends on
  // styling, so this is deliberately its own memo, independent of
  // vectorEditable, rather than something the renderer/save callback each
  // rebuild on their own.
  const vectorOverviewLevels = React.useMemo(() => {
    if (!loadedVector) return null;
    return (
      loadedVector.metadata.cachedOverviewLevels ??
      buildOverviewLevels(loadedVector.geojson, DEFAULT_TARGET_VERTEX_COUNT)
    );
  }, [loadedVector]);

  const saveVectorToFile = React.useCallback(async () => {
    if (!loadedVector || !vectorEditable) return;
    setVectorSaveState('saving');
    setVectorSaveError(null);
    try {
      const blob = buildStyledGeoJson(
        loadedVector.geojson,
        vectorEditable,
        vectorOverviewLevels ?? undefined,
      );
      downloadBlob(`${loadedVector.fileNameBase}.geojson`, blob);
      setVectorSaveState('saved');
      setTimeout(() => setVectorSaveState('idle'), 2500);
    } catch (error) {
      setVectorSaveState('error');
      setVectorSaveError(
        error instanceof Error ? error.message : 'Could not save this file.',
      );
    }
  }, [loadedVector, vectorEditable, vectorOverviewLevels]);

  // Read fresh by vectorTileRenderer on every tile/point-value request
  // rather than baked in at creation — see vectorTileRenderer.ts's
  // CreateArgs.getStyle doc comment for why a recolor/rename must never
  // force it to rebuild the (expensive) simplification pyramid + per-
  // feature geometry index. Assigning a ref during render like this is the
  // standard "always read the latest value from later async code" pattern;
  // it's idempotent and doesn't affect this render's own output.
  const vectorStyleRef = React.useRef<{
    classColorsById: Map<number, string>;
    classNamesById: Map<number, string>;
  }>({ classColorsById: new Map(), classNamesById: new Map() });
  vectorStyleRef.current =
    vectorEditable?.mode === 'categorical'
      ? {
          classColorsById: new Map(
            vectorEditable.classes.map((c, i) => [i, c.color]),
          ),
          classNamesById: new Map(
            vectorEditable.classes.map((c, i) => [i, c.name]),
          ),
        }
      : {
          classColorsById: new Map([[0, vectorEditable?.color ?? '#3388ff']]),
          classNamesById: new Map([[0, 'All features']]),
        };

  // classIndexByValue only actually changes when the field/mode changes
  // (see vectorClassIndex's doc comment: renaming/recoloring a class never
  // changes which id a feature maps to) — deliberately NOT depending on
  // the rest of vectorEditable, so a recolor/rename doesn't rebuild the
  // renderer's simplification pyramid + per-feature geometry index.
  const vectorRenderer = React.useMemo(() => {
    if (!loadedVector || !vectorEditable || !vectorOverviewLevels) return null;
    return createVectorTileRenderer({
      overviewLevels: vectorOverviewLevels,
      field:
        vectorEditable.mode === 'categorical' ? vectorEditable.field : null,
      classIndexByValue: vectorClassIndex(vectorEditable),
      getStyle: () => vectorStyleRef.current,
      bbox: loadedVector.metadata.bbox,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadedVector,
    vectorOverviewLevels,
    vectorEditable?.mode,
    vectorEditable?.field,
  ]);

  const vectorVariableMeta = React.useMemo(
    () =>
      loadedVector && vectorEditable
        ? toVectorVariableMeta(
            loadedVector.fileNameBase,
            vectorRenderVersion,
            vectorEditable,
          )
        : null,
    [loadedVector, vectorEditable, vectorRenderVersion],
  );

  const buildRenderer = React.useCallback(
    async (
      next: Loaded,
      requestId: number,
      editable: RasterEditableMeta,
      isInitialLoad: boolean,
    ) => {
      try {
        setLoadStage('Preparing map preview…');
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
        setLoadStage(null);
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        console.error('Failed to prepare GeoTIFF:', error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not read that file as a GeoTIFF.',
        );
        setStatus('error');
        setLoadStage(null);
      }
    },
    [],
  );

  // A downsampled preview sample can miss a real, rare class outright (see
  // rasterMetadata.ts's deriveDetectedValueType); a class that's actually
  // been rendered on screen unambiguously exists. Growing the class list
  // here means it's guaranteed complete eventually, regardless of what the
  // initial sample happened to catch — the user just has to pan/zoom to
  // where the missed class renders once for it to show up as a real,
  // editable row. Note this triggers buildRenderer to run again (editable
  // is one of its effect's deps below) since the renderer's own
  // legendClasses need to include the newly-discovered class too — a rare,
  // bounded event (at most once per distinct class ever missed), not
  // something that fires on every tile render.
  const handleDiscoverClasses = React.useCallback((ids: number[]) => {
    setEditableMeta((prev) => (prev ? addDiscoveredClasses(prev, ids) : prev));
  }, []);

  // withValueType() alone can't fix a wrong continuous auto-guess: a
  // continuous guess's own distinctValues is always null (see
  // dataTypeDetection.ts), so switching manually into nominal/ordinal from
  // one starts with zero classes with no scan to fill them in, unlike a
  // file auto-detected as categorical from the start (which already ran
  // one — see deriveDetectedValueType). Runs the same on-demand scan here
  // instead, so a manual correction isn't stuck starting from nothing
  // until enough of the map gets panned for live discovery
  // (handleDiscoverClasses above) to fill it in one class at a time.
  const handleValueTypeChange = React.useCallback(
    (next: ValueTypeGuess) => {
      if (!editableMeta || !loaded) return;
      const wasCategorical =
        editableMeta.valueType === 'nominal' ||
        editableMeta.valueType === 'ordinal';
      const nextIsCategorical = next === 'nominal' || next === 'ordinal';
      const updated = withValueType(editableMeta, next, loaded.detectedType);
      setEditableMeta(updated);
      if (
        nextIsCategorical &&
        !wasCategorical &&
        updated.classes.length === 0
      ) {
        setIsScanningClasses(true);
        void scanForCategoricalClasses(loaded.blob, loaded.metadata)
          .then((values) => {
            if (!values || values.length === 0) return;
            setEditableMeta((prev) =>
              prev &&
              (prev.valueType === 'nominal' || prev.valueType === 'ordinal')
                ? addDiscoveredClasses(prev, values)
                : prev,
            );
          })
          .finally(() => setIsScanningClasses(false));
      }
    },
    [editableMeta, loaded],
  );

  // Same "Selected range: …" text /maps shows above its map when a legend
  // range or angle range is sliced — ported here so gis-editor's map has
  // the same feedback when dragging a slice on a local raster/vector.
  const buildSelectedRangeText = React.useCallback(
    (
      selection: HeatmapSelection,
      variableMeta: EnvironmentVariableOption | null,
    ): string | null => {
      const circular = isVariableCircular(variableMeta);
      const categorical = isVariableCategorical(variableMeta);
      if (circular && selection.angleRanges.length > 0) {
        const rangeLabel = joinClassNamesWithAnd(
          selection.angleRanges.map((range) => {
            const isFullCircle =
              circularRangeSpan({ start: range.min, end: range.max }) >=
              FULL_CIRCLE_SPAN_THRESHOLD;
            return isFullCircle
              ? 'Full circle'
              : `${Math.round(range.min)}° to ${Math.round(range.max)}°`;
          }),
        );
        return `Selected range: ${rangeLabel}`;
      }
      if (!circular && !categorical && selection.valueRanges.length > 0) {
        const unitsSuffix = variableMeta?.units ? ` ${variableMeta.units}` : '';
        const rangeLabel = joinClassNamesWithAnd(
          selection.valueRanges.map(
            (range) =>
              `${formatValue(range.min, 1)} to ${formatValue(range.max, 1)}`,
          ),
        );
        return `Selected range: ${rangeLabel}${unitsSuffix}`;
      }
      return null;
    },
    [],
  );

  const rasterVariableMeta = React.useMemo(
    () =>
      loaded && editableMeta
        ? toEnvironmentVariableOption(
            loaded.fileName,
            renderVersion,
            editableMeta,
          )
        : null,
    [loaded, editableMeta, renderVersion],
  );
  const rasterSelectedRangeText = React.useMemo(
    () => buildSelectedRangeText(rasterSelection, rasterVariableMeta),
    [buildSelectedRangeText, rasterSelection, rasterVariableMeta],
  );
  const vectorSelectedRangeText = React.useMemo(
    () => buildSelectedRangeText(vectorSelection, vectorVariableMeta),
    [buildSelectedRangeText, vectorSelection, vectorVariableMeta],
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
      setLoadStage('Reading file header…');
      try {
        const metadata = await inspectRaster(blob);
        setLoadStage('Sampling value range…');
        const bounds = await deriveRenderBounds(blob, metadata);
        setLoadStage('Detecting data type…');
        const detectedType = await deriveDetectedValueType(
          blob,
          metadata,
          setLoadStage,
        );
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
          setLoadStage(null);
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
        setLoadStage(null);
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
        setErrorMessage('Drop a GeoTIFF (.tif or .tiff) or a .geojson file.');
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
  }, [ingest, ingestGeoJson, clear, clearVector]);

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
                the map, or drop a .geojson file. The file never leaves your
                browser.
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
                  {status === 'parsing' || vectorStatus === 'parsing' ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator
                        color={palette.icon.brand.default}
                        testID='gis-editor-loading-spinner'
                      />
                      <ThemedText variant='bodyEmphasis'>
                        {status === 'parsing'
                          ? (loadStage ?? 'Reading file…')
                          : 'Reading file…'}
                      </ThemedText>
                    </View>
                  ) : (
                    <ThemedText variant='bodyEmphasis'>
                      {loaded
                        ? loaded.fileName
                        : loadedVector
                          ? `${loadedVector.fileNameBase}.geojson`
                          : 'No file loaded'}
                    </ThemedText>
                  )}
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
                        onValueTypeChange={handleValueTypeChange}
                        isScanningClasses={isScanningClasses}
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
                      Without being a COG, the browser cannot efficiently render
                      the file while zoomed out. Consider converting the COG to
                      a file using GDAL or a similar tool before coming back.
                    </ThemedText>

                    <View style={styles.fixItBox}>
                      <ThemedText variant='bodyEmphasis'>
                        Fix it with desktop GDAL
                      </ThemedText>
                      <ThemedText
                        variant='bodySmall'
                        style={{ color: palette.text.default.secondary }}
                      >
                        GDAL is a free, open-source command-line toolkit for
                        geospatial files. Install it with `brew install gdal`
                        (macOS), `apt install gdal-bin` (Debian/Ubuntu), or
                        OSGeo4W / `conda install -c conda-forge gdal` (Windows).
                        You need version 3.1 or newer for the COG format.
                        `gdalinfo --version` shows what you have. Then open a
                        terminal in the folder containing your file and run this
                        command. It writes a new Cloud-Optimized copy next to
                        the original and leaves the original untouched.
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
                        onValueTypeChange={handleValueTypeChange}
                        isScanningClasses={isScanningClasses}
                      />
                    ) : null}

                    <View style={styles.saveBox}>
                      <ThemedText variant='bodyEmphasis'>Save</ThemedText>
                      <ThemedText
                        variant='bodyTiny'
                        style={{ color: palette.text.default.secondary }}
                      >
                        Save the file with the above data written into its
                        metadata. Persists for the next time, and passes it onto
                        the custom data upload tool.
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
                    {editableMeta && rasterVariableMeta ? (
                      <>
                        {rasterSelectedRangeText ? (
                          <ThemedText
                            variant='bodySmall'
                            style={[
                              styles.selectedRangeText,
                              { color: palette.text.default.secondary },
                            ]}
                          >
                            {rasterSelectedRangeText}
                          </ThemedText>
                        ) : null}
                        <VariableHeatmapMap
                          key={loadSeq}
                          variableMeta={rasterVariableMeta}
                          tileSource={{
                            kind: 'local',
                            renderTile: renderer.renderTile,
                            readPointValue: renderer.readPointValue,
                            getVisibleRange: renderer.getVisibleRange,
                          }}
                          height={MAP_HEIGHT}
                          initialLat={renderer.view.lat}
                          initialLon={renderer.view.lon}
                          initialZoom={renderer.view.zoom}
                          onDiscoverClasses={handleDiscoverClasses}
                          onSelectionChange={setRasterSelection}
                        />
                      </>
                    ) : null}
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
                      onChange={setVectorEditable}
                    />

                    <View style={styles.saveBox}>
                      <ThemedText variant='bodyEmphasis'>Save</ThemedText>
                      <ThemedText
                        variant='bodyTiny'
                        style={{ color: palette.text.default.secondary }}
                      >
                        Save the file with the above data written into its
                        metadata. Persists for the next time, and passes it onto
                        the custom data upload tool.
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
                    {vectorRenderer && vectorVariableMeta ? (
                      <>
                        {vectorSelectedRangeText ? (
                          <ThemedText
                            variant='bodySmall'
                            style={[
                              styles.selectedRangeText,
                              { color: palette.text.default.secondary },
                            ]}
                          >
                            {vectorSelectedRangeText}
                          </ThemedText>
                        ) : null}
                        <VariableHeatmapMap
                          key={loadedVector.fileNameBase}
                          variableMeta={vectorVariableMeta}
                          tileSource={{
                            kind: 'local',
                            renderTile: vectorRenderer.renderTile,
                            readPointValue: vectorRenderer.readPointValue,
                          }}
                          height={MAP_HEIGHT}
                          initialLat={vectorRenderer.view.lat}
                          initialLon={vectorRenderer.view.lon}
                          initialZoom={vectorRenderer.view.zoom}
                          onSelectionChange={setVectorSelection}
                        />
                      </>
                    ) : null}
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
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
  selectedRangeText: { marginBottom: Size.space['100'] },
});
