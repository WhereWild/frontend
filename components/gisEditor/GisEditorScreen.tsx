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
import { MetadataEditor } from './MetadataEditor';
import { MetadataPanel } from './MetadataPanel';
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

const isBrowser = () =>
  Platform.OS === 'web' && typeof document !== 'undefined';

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
            color: c.color,
          })),
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
        const initialEditable = buildInitialEditableMeta(detectedType, bounds);
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
    const blob = await resolveAssetBlob(file);
    await ingest(blob, file.name, blob.size);
  }, [ingest]);

  const clear = React.useCallback(() => {
    requestIdRef.current += 1;
    rendererRef.current?.dispose();
    rendererRef.current = null;
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
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const name = file.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
        setStatus('error');
        setErrorMessage('Drop a GeoTIFF (.tif or .tiff).');
        return;
      }
      void ingest(file, file.name, file.size);
    };
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('drop', onDrop);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('drop', onDrop);
    };
  }, [ingest]);

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
                the map. The file never leaves your browser.
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
                      : status === 'parsing'
                        ? 'Reading file…'
                        : 'No file loaded'}
                  </ThemedText>
                  <View style={styles.actionsRow}>
                    <Button
                      variant='primary'
                      label={
                        loaded ? 'Load a different file' : 'Choose GeoTIFF'
                      }
                      disabled={status === 'parsing'}
                      onPress={pickFile}
                    />
                    {loaded ? (
                      <Button variant='subtle' label='Clear' onPress={clear} />
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
                        onChange={setEditableMeta}
                      />
                    ) : null}
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
  resultsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resultsColumn: { flexDirection: 'column' },
  metaColumn: { flex: 1, minWidth: 280, gap: Size.space['300'] },
  previewColumn: { flex: 1, minWidth: 320 },
});
