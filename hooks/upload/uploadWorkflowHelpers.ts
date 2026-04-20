import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { UploadFileValue } from '@/data/api';
import { UploadZipParseError } from '@/data/uploadZipParquetParser';
import { UploadedParquetBundleValidationError } from '@/data/uploadLocalSpeciesDataSource';
import { readBlobAsUint8Array } from '@/utils/blob';

export const DEFAULT_PROCESSED_ZIP_FILENAME = 'processed_observations.zip';
const DEFAULT_PROCESSED_ZIP_MIME_TYPE = 'application/zip';
const DEFAULT_PICKER_ERROR_MESSAGE =
  'Failed to open file picker. Please try again.';

export const RAW_UPLOAD_ACCEPTED_EXTENSIONS = [
  '.csv',
  '.tsv',
  '.parquet',
] as const;

export const RAW_UPLOAD_PICKER_MIME_TYPES = [
  'text/csv',
  'text/tab-separated-values',
  'application/parquet',
  'application/vnd.apache.parquet',
] as const;

export const ZIP_UPLOAD_ACCEPTED_EXTENSIONS = ['.zip'] as const;

export const ZIP_UPLOAD_PICKER_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
] as const;

export type PickerSelectionConfig = {
  pickerType: string | string[];
  allowedExtensions: readonly string[];
  invalidSelectionMessage: string;
};

export type PickerSelectionResult = {
  file?: DocumentPicker.DocumentPickerAsset;
  errorMessage?: string;
};

export type DownloadableProcessedZip = {
  blob: Blob;
  contentType: string | null;
  filename: string;
};

export type ProcessedZipDeliveryResult =
  | { kind: 'downloaded'; filename: string }
  | { kind: 'shared'; filename: string; fileUri: string }
  | { kind: 'saved'; filename: string; fileUri: string };

export type ProcessedZipPayload = {
  blob: Blob;
  contentType: string | null;
  filename?: string | null;
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

const sanitizeFilename = (filename: string) => {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
};

const matchesAllowedExtension = (
  file: DocumentPicker.DocumentPickerAsset,
  allowedExtensions: readonly string[],
) => {
  const normalizedName = file.name.toLowerCase();
  return allowedExtensions.some((extension) =>
    normalizedName.endsWith(extension),
  );
};

const persistProcessedZipBlob = async (
  blob: Blob,
  filename: string,
  directory: Directory | string,
) => {
  const targetFile = new File(directory, sanitizeFilename(filename));
  targetFile.create({ intermediates: true, overwrite: true });
  targetFile.write(
    await readBlobAsUint8Array(blob, {
      unavailableMessage: 'Processed ZIP could not be read on this device.',
      readErrorMessage: 'Failed to read processed ZIP blob.',
      invalidResultMessage:
        'Processed ZIP blob did not resolve to binary data.',
    }),
  );
  return targetFile.uri;
};

export const resolveAssetBlob = async (
  file: DocumentPicker.DocumentPickerAsset,
): Promise<Blob> => {
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

export const createFilePayload = (
  file: DocumentPicker.DocumentPickerAsset,
): UploadFileValue => {
  if (typeof Blob !== 'undefined' && file.file instanceof Blob) {
    return file.file;
  }

  return {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  };
};

export const selectFileFromPicker = async ({
  pickerType,
  allowedExtensions,
  invalidSelectionMessage,
}: PickerSelectionConfig): Promise<PickerSelectionResult> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: pickerType,
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) {
      return {};
    }

    const file = result.assets[0];
    if (!matchesAllowedExtension(file, allowedExtensions)) {
      return { errorMessage: invalidSelectionMessage };
    }

    return { file };
  } catch (error) {
    console.error('Error opening file picker or reading file:', error);
    return {
      errorMessage:
        error instanceof Error && error.message
          ? error.message
          : DEFAULT_PICKER_ERROR_MESSAGE,
    };
  }
};

export const getProcessedZipDeliveryStatusMessage = (
  delivery: ProcessedZipDeliveryResult,
) => {
  if (delivery.kind === 'downloaded') {
    return `Processed ZIP downloaded: ${delivery.filename}`;
  }

  if (delivery.kind === 'shared') {
    return `Processed ZIP ready to share: ${delivery.filename}`;
  }

  return `Processed ZIP saved to selected folder: ${delivery.filename}`;
};

export const getUploadedZipErrorMessage = (error: unknown) => {
  if (error instanceof UploadZipParseError) {
    return error.message;
  }

  if (error instanceof UploadedParquetBundleValidationError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Failed to parse uploaded zip file.';
};

export const isExpectedUploadedZipError = (error: unknown) => {
  return (
    error instanceof UploadZipParseError ||
    error instanceof UploadedParquetBundleValidationError
  );
};

export const deliverProcessedZip = async (
  response: ProcessedZipPayload,
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
    const fileUri = await persistProcessedZipBlob(
      response.blob,
      downloadFilename,
      Paths.cache,
    );
    await Sharing.shareAsync(fileUri, {
      dialogTitle: 'Share processed observations ZIP',
      mimeType: response.contentType ?? DEFAULT_PROCESSED_ZIP_MIME_TYPE,
      UTI: 'public.zip-archive',
    });
    return { kind: 'shared', filename: downloadFilename, fileUri };
  }

  const exportDirectory = await Directory.pickDirectoryAsync();
  const fileUri = await persistProcessedZipBlob(
    response.blob,
    downloadFilename,
    exportDirectory.uri,
  );
  return { kind: 'saved', filename: downloadFilename, fileUri };
};
