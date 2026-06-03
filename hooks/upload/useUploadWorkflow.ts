// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { uploadRawObservations } from '@/data/api';
import { parseUploadedParquetZipToRawBundle } from '@/data/uploadZipParquetParser';
import {
  buildUploadLocalSpeciesDataSource,
  normalizeRawUploadedParquetBundle,
  type UploadedParquetBundle,
} from '@/data/uploadLocalSpeciesDataSource';
import type { SpeciesDataSource } from '@/data/speciesDataSource';
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
  zipUploadError: string | null;
  zipUploadWarning: string | null;
  setHighlightedCatalogs: React.Dispatch<
    React.SetStateAction<(number | string)[]>
  >;
  processRawObservations: () => Promise<void>;
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

  const processRawObservations = React.useCallback(async () => {
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
      const response = await uploadRawObservations(
        { file: createFilePayload(file), filename: file.name },
        ({ status, position }) => {
          if (status === 'queued') {
            setRawUploadStatusMessage(
              position > 1
                ? `Position ${position} in queue…`
                : 'Queued for processing…',
            );
          } else {
            setRawUploadStatusMessage('Processing…');
          }
        },
      );

      const filename = response.filename ?? DEFAULT_PROCESSED_ZIP_FILENAME;
      setDownloadableProcessedZip({
        blob: response.blob,
        contentType: response.contentType ?? null,
        filename,
      });
      setRawUploadStatusMessage(`Processed ZIP ready to download: ${filename}`);

      try {
        await importProcessedZipBlob(response.blob);
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
  }, [
    clearUploadedPreview,
    importProcessedZipBlob,
    invalidateProcessedZipDelivery,
  ]);

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
    zipUploadError,
    zipUploadWarning,
    setHighlightedCatalogs,
    processRawObservations,
    processZippedObservations,
  };
}
