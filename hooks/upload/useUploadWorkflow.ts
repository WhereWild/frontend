import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { Platform } from 'react-native';
import { uploadRawObservations, type UploadFileValue } from '@/data/api';
import {
  parseUploadedParquetZipToRawBundle,
  UploadZipParseError,
} from '@/data/uploadZipParquetParser';
import {
  buildUploadLocalSpeciesDataSource,
  normalizeRawUploadedParquetBundle,
  type UploadedParquetBundle,
  UploadedParquetBundleValidationError,
} from '@/data/uploadLocalSpeciesDataSource';
import type { SpeciesDataSource } from '@/data/speciesDataSource';

export const UPLOAD_PREVIEW_TAXON_ID = 1;
const DEFAULT_PROCESSED_ZIP_FILENAME = 'processed_observations.zip';
const DEFAULT_PROCESSED_ZIP_MIME_TYPE = 'application/zip';

export type UseUploadWorkflowResult = {
  highlightedCatalogs: (number | string)[];
  isProcessingRaw: boolean;
  isProcessingZipped: boolean;
  rawUploadStatusMessage: string | null;
  uploadedBundle: UploadedParquetBundle | null;
  uploadedDataSource: SpeciesDataSource | null;
  zipUploadError: string | null;
  zipUploadWarning: string | null;
  setHighlightedCatalogs: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  processRawObservations: () => Promise<void>;
  processZippedObservations: () => Promise<void>;
};

const blobFromUriWithXhr = async (uri: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.onerror = () => {
      reject(new Error(`Failed to read selected file from URI: ${uri}`));
    };
    request.onload = () => {
      if (request.response instanceof Blob) {
        resolve(request.response);
        return;
      }
      reject(new Error(`Selected file URI did not resolve to a Blob: ${uri}`));
    };
    request.open('GET', uri, true);
    request.responseType = 'blob';
    request.send();
  });
};

const resolveAssetBlob = async (file: DocumentPicker.DocumentPickerAsset): Promise<Blob> => {
  if (typeof Blob !== 'undefined' && file.file instanceof Blob) {
    return file.file;
  }

  try {
    const response = await fetch(file.uri);
    return await response.blob();
  } catch {
    return blobFromUriWithXhr(file.uri);
  }
};

const createFilePayload = (file: DocumentPicker.DocumentPickerAsset): UploadFileValue => {
  if (typeof Blob !== 'undefined' && file.file instanceof Blob) {
    return file.file;
  }

  return {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  };
};

const sanitizeFilename = (filename: string) => {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
};

const persistProcessedZipBlob = async (
  blob: Blob,
  filename: string,
  directory: Directory | string,
) => {
  const targetFile = new File(directory, sanitizeFilename(filename));
  targetFile.create({ intermediates: true, overwrite: true });
  targetFile.write(new Uint8Array(await blob.arrayBuffer()));
  return targetFile.uri;
};

type ProcessedZipDeliveryResult =
  | { kind: 'downloaded'; filename: string }
  | { kind: 'shared'; filename: string; fileUri: string }
  | { kind: 'saved'; filename: string; fileUri: string };

const deliverProcessedZip = async (
  response: Awaited<ReturnType<typeof uploadRawObservations>>,
): Promise<ProcessedZipDeliveryResult> => {
  const downloadFilename = response.filename ?? DEFAULT_PROCESSED_ZIP_FILENAME;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const downloadUrl = URL.createObjectURL(response.blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = downloadFilename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(downloadUrl);
    return { kind: 'downloaded', filename: downloadFilename };
  }

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (sharingAvailable) {
    const fileUri = await persistProcessedZipBlob(response.blob, downloadFilename, Paths.cache);
    await Sharing.shareAsync(fileUri, {
      dialogTitle: 'Share processed observations ZIP',
      mimeType: response.contentType ?? DEFAULT_PROCESSED_ZIP_MIME_TYPE,
      UTI: 'public.zip-archive',
    });
    return { kind: 'shared', filename: downloadFilename, fileUri };
  }

  const exportDirectory = await Directory.pickDirectoryAsync();
  const fileUri = await persistProcessedZipBlob(response.blob, downloadFilename, exportDirectory.uri);
  return { kind: 'saved', filename: downloadFilename, fileUri };
};

export function useUploadWorkflow(): UseUploadWorkflowResult {
  const [highlightedCatalogs, setHighlightedCatalogs] = React.useState<(number | string)[]>([]);
  const [isProcessingRaw, setIsProcessingRaw] = React.useState(false);
  const [isProcessingZipped, setIsProcessingZipped] = React.useState(false);
  const [rawUploadStatusMessage, setRawUploadStatusMessage] = React.useState<string | null>(null);
  const [uploadedBundle, setUploadedBundle] = React.useState<UploadedParquetBundle | null>(null);
  const [uploadedDataSource, setUploadedDataSource] = React.useState<SpeciesDataSource | null>(null);
  const [zipUploadError, setZipUploadError] = React.useState<string | null>(null);
  const [zipUploadWarning, setZipUploadWarning] = React.useState<string | null>(null);

  const selectFileFromPicker = React.useCallback(
    async (acceptedExtensions: string): Promise<DocumentPicker.DocumentPickerAsset | undefined> => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: acceptedExtensions,
          copyToCacheDirectory: true,
          multiple: false,
        });

        if (result.canceled) {
          return undefined;
        }

        return result.assets[0];
      } catch (error) {
        console.error('Error opening file picker or reading file:', error);
        return undefined;
      }
    },
    [],
  );

  const processRawObservations = React.useCallback(async () => {
    const file = await selectFileFromPicker('.csv, .tsv, .parquet');
    if (!file) {
      return;
    }

    setIsProcessingRaw(true);
    setRawUploadStatusMessage(null);
    try {
      const response = await uploadRawObservations({
        file: createFilePayload(file),
        filename: file.name,
      });

      const delivery = await deliverProcessedZip(response);
      if (delivery.kind === 'downloaded') {
        setRawUploadStatusMessage(`Processed ZIP downloaded: ${delivery.filename}`);
      } else if (delivery.kind === 'shared') {
        setRawUploadStatusMessage(`Processed ZIP ready to share: ${delivery.filename}`);
      } else {
        setRawUploadStatusMessage(`Processed ZIP saved to selected folder: ${delivery.filename}`);
      }
    } catch (error) {
      console.error('Failed to upload raw observations file:', error);
      setRawUploadStatusMessage(
        error instanceof Error ? error.message : 'Failed to process raw observations.',
      );
    } finally {
      setIsProcessingRaw(false);
    }
  }, [selectFileFromPicker]);

  const processZippedObservations = React.useCallback(async () => {
    const file = await selectFileFromPicker('.zip');
    if (!file) {
      return;
    }

    setIsProcessingZipped(true);
    setZipUploadError(null);
    setZipUploadWarning(null);
    try {
      const zipBlob = await resolveAssetBlob(file);
      const rawBundle = await parseUploadedParquetZipToRawBundle(zipBlob);
      const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
      const dataSource = buildUploadLocalSpeciesDataSource({
        bundle: normalizedBundle,
        speciesId: UPLOAD_PREVIEW_TAXON_ID,
      });

      setUploadedBundle(normalizedBundle);
      setUploadedDataSource(dataSource);
      setZipUploadWarning(normalizedBundle.meta?.warnings?.join('\n') ?? null);
    } catch (error) {
      const message =
        error instanceof UploadZipParseError
          ? error.message
          : error instanceof UploadedParquetBundleValidationError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Failed to parse uploaded zip file.';

      console.error('Failed to parse zipped observations files:', error);
      setUploadedBundle(null);
      setUploadedDataSource(null);
      setZipUploadError(message);
      setZipUploadWarning(null);
    } finally {
      setIsProcessingZipped(false);
    }
  }, [selectFileFromPicker]);

  return {
    highlightedCatalogs,
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
