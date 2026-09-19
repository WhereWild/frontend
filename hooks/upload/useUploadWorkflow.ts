// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import type * as DocumentPicker from 'expo-document-picker';
import { uploadRawObservations } from '@/data/api';
import { parseUploadedParquetZipToRawBundle } from '@/data/uploadZipParquetParser';
import {
  buildUploadLocalSpeciesDataSource,
  normalizeRawUploadedParquetBundle,
  type UploadedParquetBundle,
} from '@/data/uploadLocalSpeciesDataSource';
import type { SpeciesDataSource } from '@/data/speciesDataSource';
import { augmentRawTextWithCustomLayers } from './customLayerAugmentation';
import {
  createFilePayload,
  DEFAULT_PROCESSED_ZIP_FILENAME,
  deliverProcessedZip,
  type DownloadableProcessedZip,
  getProcessedZipDeliveryStatusMessage,
  getUploadedZipErrorMessage,
  isExpectedUploadedZipError,
  RAW_UPLOAD_ACCEPTED_EXTENSIONS,
  resolveAssetBlob,
  selectFileFromPicker,
  ZIP_UPLOAD_ACCEPTED_EXTENSIONS,
} from './uploadWorkflowHelpers.ts';
import { seedDataSourcesCache } from '@/hooks/useDataSources';
import { triggerErrorHaptic, triggerSuccessHaptic } from '@/utils/haptics';

export const UPLOAD_PREVIEW_TAXON_ID = 1;

/** The upload page's "extra options" panel -- all optional, see main.py's
 * upload_raw_observations. image and imageUrl are alternatives (image wins
 * if both are given): an uploaded image's bytes get embedded straight into
 * the processed ZIP (works fully offline once downloaded); imageUrl is
 * stored as a plain string instead (no re-upload needed, but needs network
 * access to actually display). */
export type RawUploadExtraOptions = {
  generateDescription?: boolean;
  image?: DocumentPicker.DocumentPickerAsset | null;
  imageUrl?: string;
  /** Ranks this upload's own computed stats against this taxon's real
   * precomputed sibling index -- see main.py's upload_raw_observations. */
  parentTaxonId?: string;
  /** Raster/vector file(s) authored or edited via /gis-editor -- sampled
   * entirely client-side (see components/upload/customLayers.ts) and sent
   * to the backend only as already-sampled value column(s) plus a small
   * JSON description; the raw file itself is never uploaded. CSV/TSV raw
   * uploads only in this phase (see customLayerAugmentation.ts). */
  customLayers?: DocumentPicker.DocumentPickerAsset[];
};

export type UseUploadWorkflowResult = {
  canDownloadProcessedZip: boolean;
  downloadProcessedZip: () => Promise<void>;
  highlightedCatalogs: (number | string)[];
  isDeliveringProcessedZip: boolean;
  isProcessingRaw: boolean;
  isProcessingZipped: boolean;
  rawUploadStatusMessage: string | null;
  uploadedBundle: UploadedParquetBundle | null;
  uploadedDataSource: SpeciesDataSource | null;
  customLayerAssets: Map<string, DocumentPicker.DocumentPickerAsset>;
  zipUploadError: string | null;
  zipUploadWarning: string | null;
  setHighlightedCatalogs: React.Dispatch<
    React.SetStateAction<(number | string)[]>
  >;
  processRawObservations: (options?: RawUploadExtraOptions) => Promise<void>;
  processZippedObservations: () => Promise<void>;
};

export function useUploadWorkflow(): UseUploadWorkflowResult {
  const processedZipDeliveryRequestIdRef = React.useRef(0);
  const [downloadableProcessedZip, setDownloadableProcessedZip] =
    React.useState<DownloadableProcessedZip | null>(null);
  const [highlightedCatalogs, setHighlightedCatalogs] = React.useState<
    (number | string)[]
  >([]);
  const [isDeliveringProcessedZip, setIsDeliveringProcessedZip] =
    React.useState(false);
  const [isProcessingRaw, setIsProcessingRaw] = React.useState(false);
  const [isProcessingZipped, setIsProcessingZipped] = React.useState(false);
  const [rawUploadStatusMessage, setRawUploadStatusMessage] = React.useState<
    string | null
  >(null);
  const [uploadedBundle, setUploadedBundle] =
    React.useState<UploadedParquetBundle | null>(null);
  const [uploadedDataSource, setUploadedDataSource] =
    React.useState<SpeciesDataSource | null>(null);
  // The raw file each currently-uploaded custom layer variable was sampled
  // from, keyed by variable id -- kept around only for the lifetime of this
  // preview so the map's background-point clicks and "variable" basemap
  // mode can render/query it locally (see customLayerLocalRenderer.ts)
  // instead of always hitting the backend, which never received the file.
  // Empty for a re-imported ZIP (see importProcessedZipBlob), since that
  // path never has the original file to begin with.
  const [customLayerAssets, setCustomLayerAssets] = React.useState<
    Map<string, DocumentPicker.DocumentPickerAsset>
  >(new Map());
  const [zipUploadError, setZipUploadError] = React.useState<string | null>(
    null,
  );
  const [zipUploadWarning, setZipUploadWarning] = React.useState<string | null>(
    null,
  );

  const clearUploadedPreview = React.useCallback(() => {
    setUploadedBundle(null);
    setUploadedDataSource(null);
    setZipUploadWarning(null);
    setCustomLayerAssets(new Map());
  }, []);

  const invalidateProcessedZipDelivery = React.useCallback(() => {
    processedZipDeliveryRequestIdRef.current += 1;
  }, []);

  const beginProcessedZipDeliveryRequest = React.useCallback(() => {
    processedZipDeliveryRequestIdRef.current += 1;
    return processedZipDeliveryRequestIdRef.current;
  }, []);

  const isLatestProcessedZipDeliveryRequest = React.useCallback(
    (requestId: number) => {
      return processedZipDeliveryRequestIdRef.current === requestId;
    },
    [],
  );

  const handleZipImportError = React.useCallback(
    (error: unknown, options?: { triggerHaptic?: boolean }) => {
      if (!isExpectedUploadedZipError(error)) {
        console.error('Failed to parse zipped observations files:', error);
      }
      clearUploadedPreview();
      setZipUploadError(getUploadedZipErrorMessage(error));

      if (options?.triggerHaptic) {
        triggerErrorHaptic();
      }
    },
    [clearUploadedPreview],
  );

  const importProcessedZipBlob = React.useCallback(async (zipBlob: Blob) => {
    const rawBundle = await parseUploadedParquetZipToRawBundle(zipBlob);
    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    if (normalizedBundle.dataSources) {
      seedDataSourcesCache(normalizedBundle.dataSources);
    }
    const dataSource = buildUploadLocalSpeciesDataSource({
      bundle: normalizedBundle,
      speciesId: UPLOAD_PREVIEW_TAXON_ID,
    });

    setUploadedBundle(normalizedBundle);
    setUploadedDataSource(dataSource);
    setZipUploadError(null);
    setZipUploadWarning(normalizedBundle.meta?.warnings?.join('\n') ?? null);
    triggerSuccessHaptic();
  }, []);

  const downloadProcessedZip = React.useCallback(async () => {
    if (!downloadableProcessedZip || isDeliveringProcessedZip) {
      return;
    }

    const requestId = beginProcessedZipDeliveryRequest();
    setIsDeliveringProcessedZip(true);
    try {
      const delivery = await deliverProcessedZip({
        blob: downloadableProcessedZip.blob,
        contentType: downloadableProcessedZip.contentType,
        filename: downloadableProcessedZip.filename,
      });

      if (!isLatestProcessedZipDeliveryRequest(requestId)) {
        return;
      }

      setRawUploadStatusMessage(getProcessedZipDeliveryStatusMessage(delivery));
      triggerSuccessHaptic();
    } catch (error) {
      if (!isLatestProcessedZipDeliveryRequest(requestId)) {
        return;
      }

      console.error('Failed to deliver processed ZIP:', error);
      setRawUploadStatusMessage(
        error instanceof Error
          ? error.message
          : 'Failed to download processed ZIP.',
      );
      triggerErrorHaptic();
    } finally {
      if (isLatestProcessedZipDeliveryRequest(requestId)) {
        setIsDeliveringProcessedZip(false);
      }
    }
  }, [
    beginProcessedZipDeliveryRequest,
    downloadableProcessedZip,
    isDeliveringProcessedZip,
    isLatestProcessedZipDeliveryRequest,
  ]);

  const processRawObservations = React.useCallback(
    async (options?: RawUploadExtraOptions) => {
      const { file, errorMessage } = await selectFileFromPicker({
        pickerType: '*/*',
        allowedExtensions: RAW_UPLOAD_ACCEPTED_EXTENSIONS,
        invalidSelectionMessage:
          'Unsupported file type. Please select a CSV, TSV, or parquet file.',
      });
      if (errorMessage) {
        setRawUploadStatusMessage(errorMessage);
        triggerErrorHaptic();
        return;
      }

      if (!file) {
        return;
      }

      setIsProcessingRaw(true);
      invalidateProcessedZipDelivery();
      setIsDeliveringProcessedZip(false);
      setDownloadableProcessedZip(null);
      setRawUploadStatusMessage(null);
      setZipUploadError(null);
      setZipUploadWarning(null);
      try {
        let uploadFile = createFilePayload(file);
        let customLayerMetadata: string | undefined;
        let sampledCustomLayerAssets = new Map<
          string,
          DocumentPicker.DocumentPickerAsset
        >();
        const customLayers = options?.customLayers ?? [];
        const extension = file.name
          .slice(file.name.lastIndexOf('.'))
          .toLowerCase();
        // Custom layers are sampled entirely client-side and merged into
        // the raw file as ordinary extra column(s) before it's ever sent
        // -- the backend never receives the raster/vector file itself.
        // CSV/TSV only in this phase; a Parquet raw upload skips this step
        // (its columns go through unaugmented, same as before).
        if (
          customLayers.length > 0 &&
          (extension === '.csv' || extension === '.tsv')
        ) {
          setRawUploadStatusMessage('Sampling custom layers locally…');
          const blob = await resolveAssetBlob(file);
          const text = await blob.text();
          const { augmentedText, descriptors, assetsById } =
            await augmentRawTextWithCustomLayers(
              text,
              extension === '.tsv' ? '\t' : ',',
              customLayers,
            );
          if (descriptors.length > 0) {
            uploadFile = new Blob([augmentedText], { type: 'text/csv' });
            customLayerMetadata = JSON.stringify(descriptors);
            sampledCustomLayerAssets = assetsById;
          }
          setRawUploadStatusMessage(null);
        }

        const response = await uploadRawObservations(
          {
            file: uploadFile,
            filename: file.name,
            generateDescription: options?.generateDescription,
            image: options?.image
              ? createFilePayload(options.image)
              : undefined,
            imageFilename: options?.image?.name,
            imageUrl: options?.imageUrl,
            parentTaxonId: options?.parentTaxonId,
            customLayerMetadata,
          },
          ({ status, position, stage }) => {
            if (status === 'queued') {
              setRawUploadStatusMessage(
                position > 1
                  ? `Position ${position} in queue…`
                  : 'Queued for processing…',
              );
            } else {
              setRawUploadStatusMessage(stage ? `${stage}…` : 'Processing…');
            }
          },
        );

        const filename = response.filename ?? DEFAULT_PROCESSED_ZIP_FILENAME;
        setDownloadableProcessedZip({
          blob: response.blob,
          contentType: response.contentType ?? null,
          filename,
        });
        setRawUploadStatusMessage(
          `Processed ZIP ready to download: ${filename}`,
        );

        try {
          await importProcessedZipBlob(response.blob);
          setCustomLayerAssets(sampledCustomLayerAssets);
        } catch (error) {
          if (!isExpectedUploadedZipError(error)) {
            console.error(
              'Failed to auto-import processed ZIP after raw upload:',
              error,
            );
          }
          clearUploadedPreview();
          setZipUploadError(
            error instanceof Error
              ? getUploadedZipErrorMessage(error)
              : 'Processed ZIP was generated but could not be imported automatically.',
          );
          triggerErrorHaptic();
        }
      } catch (error) {
        console.error('Failed to upload raw observations file:', error);
        setRawUploadStatusMessage(
          error instanceof Error
            ? error.message
            : 'Failed to process raw observations.',
        );
        triggerErrorHaptic();
      } finally {
        setIsProcessingRaw(false);
      }
    },
    [
      clearUploadedPreview,
      importProcessedZipBlob,
      invalidateProcessedZipDelivery,
    ],
  );

  const processZippedObservations = React.useCallback(async () => {
    const { file, errorMessage } = await selectFileFromPicker({
      pickerType: '*/*',
      allowedExtensions: ZIP_UPLOAD_ACCEPTED_EXTENSIONS,
      invalidSelectionMessage:
        'Unsupported file type. Please select a processed ZIP file.',
    });
    if (errorMessage) {
      clearUploadedPreview();
      setZipUploadError(errorMessage);
      triggerErrorHaptic();
      return;
    }

    if (!file) {
      return;
    }

    setIsProcessingZipped(true);
    invalidateProcessedZipDelivery();
    setIsDeliveringProcessedZip(false);
    // Step 2 imports a separate processed ZIP for preview only; keep the
    // Step 1 generated artifact available for download until raw upload state
    // is replaced by another Step 1 run.
    setZipUploadError(null);
    setZipUploadWarning(null);
    try {
      const zipBlob = await resolveAssetBlob(file);
      await importProcessedZipBlob(zipBlob);
    } catch (error) {
      handleZipImportError(error, { triggerHaptic: true });
    } finally {
      setIsProcessingZipped(false);
    }
  }, [
    clearUploadedPreview,
    handleZipImportError,
    importProcessedZipBlob,
    invalidateProcessedZipDelivery,
  ]);

  return {
    canDownloadProcessedZip: downloadableProcessedZip !== null,
    downloadProcessedZip,
    highlightedCatalogs,
    isDeliveringProcessedZip,
    isProcessingRaw,
    isProcessingZipped,
    rawUploadStatusMessage,
    uploadedBundle,
    uploadedDataSource,
    customLayerAssets,
    zipUploadError,
    zipUploadWarning,
    setHighlightedCatalogs,
    processRawObservations,
    processZippedObservations,
  };
}
