import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import {
  DEFAULT_PROCESSED_ZIP_FILENAME,
  createFilePayload,
  deliverProcessedZip,
  getProcessedZipDeliveryStatusMessage,
  getUploadedZipErrorMessage,
  isExpectedUploadedZipError,
  resolveAssetBlob,
  selectFileFromPicker,
} from '../uploadWorkflowHelpers';
import { UploadZipParseError } from '@/data/uploadZipParquetParser';
import { UploadedParquetBundleValidationError } from '@/data/uploadLocalSpeciesDataSource';

const mockFileCreate = jest.fn();
const mockFileWrite = jest.fn();
const mockPickDirectoryAsync = jest.fn();

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;

    constructor(...uris: (string | { uri: string })[]) {
      const first = uris[0];
      this.uri =
        typeof first === 'string' ? first : (first?.uri ?? 'file://unknown/');
    }

    static pickDirectoryAsync(...args: unknown[]) {
      return mockPickDirectoryAsync(...args);
    }
  }

  class MockFile {
    uri: string;

    constructor(...uris: (string | { uri: string })[]) {
      const parent = uris[0];
      const name = String(uris[1] ?? 'file.bin');
      const parentUri =
        typeof parent === 'string'
          ? parent
          : (parent?.uri ?? 'file://unknown/');
      const normalizedParentUri = parentUri.endsWith('/')
        ? parentUri
        : `${parentUri}/`;
      this.uri = `${normalizedParentUri}${name}`;
    }

    create(...args: unknown[]) {
      return mockFileCreate(...args);
    }

    write(...args: unknown[]) {
      return mockFileWrite(...args);
    }
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: {
      cache: { uri: 'file://cache/' },
    },
  };
});

describe('uploadWorkflowHelpers', () => {
  type MockDocumentAssetInput = {
    uri: string;
    name: string;
    mimeType: string;
    file?: File;
    lastModified?: number;
  };

  const mockGetDocumentAsync = jest.mocked(DocumentPicker.getDocumentAsync);
  const mockIsAvailableAsync = jest.mocked(Sharing.isAvailableAsync);
  const mockShareAsync = jest.mocked(Sharing.shareAsync);
  const originalPlatformOS = Platform.OS;
  const originalFetch = global.fetch;
  const originalXMLHttpRequest = global.XMLHttpRequest;
  const originalDocument = global.document;
  const originalUrl = global.URL;
  const originalFileReader = global.FileReader;
  const originalFile = global.File;
  let consoleErrorSpy: jest.SpyInstance;

  const setPlatformOS = (os: typeof Platform.OS) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  const makeDocumentAsset = ({
    uri,
    name,
    mimeType,
    file,
    lastModified = 1,
  }: MockDocumentAssetInput): DocumentPicker.DocumentPickerAsset => ({
    uri,
    name,
    mimeType,
    size: 1,
    lastModified,
    ...(file ? { file } : {}),
  });

  beforeAll(() => {
    if (typeof global.File === 'undefined') {
      global.File = class MockFile {} as unknown as typeof File;
    }
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      value: originalPlatformOS,
      configurable: true,
    });
    global.fetch = originalFetch;
    global.XMLHttpRequest = originalXMLHttpRequest;
    global.document = originalDocument;
    global.URL = originalUrl;
    global.FileReader = originalFileReader;
    global.File = originalFile;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOS(originalPlatformOS);
    global.fetch = originalFetch;
    global.XMLHttpRequest = originalXMLHttpRequest;
    global.document = originalDocument;
    global.URL = originalUrl;
    global.FileReader = originalFileReader;
    mockPickDirectoryAsync.mockResolvedValue({ uri: 'file://picked-dir/' });
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns a selected blob asset directly when resolving an asset blob', async () => {
    const file = new Blob(['zip-data'], { type: 'application/zip' }) as Blob &
      File;

    const result = await resolveAssetBlob(
      makeDocumentAsset({
        uri: 'file://data.zip',
        name: 'data.zip',
        mimeType: 'application/zip',
        file,
      }),
    );

    expect(result).toBe(file);
  });

  it('fetches a URI-backed asset blob and falls back to XMLHttpRequest on fetch failure', async () => {
    const fetchedBlob = new Blob(['fetch-data'], { type: 'application/zip' });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ blob: jest.fn().mockResolvedValue(fetchedBlob) })
      .mockRejectedValueOnce(new Error('fetch failed')) as typeof fetch;

    const xhrBlob = new Blob(['xhr-data'], { type: 'application/zip' });
    const open = jest.fn();
    const send = jest.fn(function send(this: {
      onload?: () => void;
      response?: Blob;
    }) {
      this.response = xhrBlob;
      this.onload?.();
    });

    class MockXMLHttpRequest {
      onerror?: () => void;
      onload?: () => void;
      responseType = '';
      response?: Blob;

      open = open;
      send = send;
    }

    global.XMLHttpRequest =
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest;

    const fetchedResult = await resolveAssetBlob(
      makeDocumentAsset({
        uri: 'file://fetch.zip',
        name: 'fetch.zip',
        mimeType: 'application/zip',
      }),
    );
    const xhrResult = await resolveAssetBlob(
      makeDocumentAsset({
        uri: 'file://xhr.zip',
        name: 'xhr.zip',
        mimeType: 'application/zip',
      }),
    );

    expect(fetchedResult).toBe(fetchedBlob);
    expect(xhrResult).toBe(xhrBlob);
    expect(open).toHaveBeenCalledWith('GET', 'file://xhr.zip', true);
  });

  it('returns a blob upload payload when the document asset already has a file', () => {
    const file = new Blob(['csv-data'], { type: 'text/csv' }) as Blob & File;

    expect(
      createFilePayload(
        makeDocumentAsset({
          uri: 'file://observations.csv',
          name: 'observations.csv',
          mimeType: 'text/csv',
          file,
        }),
      ),
    ).toBe(file);
  });

  it('returns a URI payload when the document asset does not expose a blob file', () => {
    expect(
      createFilePayload(
        makeDocumentAsset({
          uri: 'file://observations.csv',
          name: 'observations.csv',
          mimeType: 'text/csv',
        }),
      ),
    ).toEqual({
      uri: 'file://observations.csv',
      name: 'observations.csv',
      type: 'text/csv',
    });
  });

  it('handles canceled, invalid, valid, and thrown picker outcomes', async () => {
    mockGetDocumentAsync
      .mockResolvedValueOnce({ canceled: true, assets: null })
      .mockResolvedValueOnce({
        canceled: false,
        assets: [
          makeDocumentAsset({
            uri: 'file://notes.txt',
            name: 'notes.txt',
            mimeType: 'text/plain',
          }),
        ],
      })
      .mockResolvedValueOnce({
        canceled: false,
        assets: [
          makeDocumentAsset({
            uri: 'file://data.zip',
            name: 'data.zip',
            mimeType: 'application/zip',
          }),
        ],
      })
      .mockRejectedValueOnce(new Error('picker failed'));

    await expect(
      selectFileFromPicker({
        pickerType: ['application/zip'],
        allowedExtensions: ['.zip'],
        invalidSelectionMessage: 'invalid',
      }),
    ).resolves.toEqual({});

    await expect(
      selectFileFromPicker({
        pickerType: ['application/zip'],
        allowedExtensions: ['.zip'],
        invalidSelectionMessage: 'invalid',
      }),
    ).resolves.toEqual({ errorMessage: 'invalid' });

    await expect(
      selectFileFromPicker({
        pickerType: ['application/zip'],
        allowedExtensions: ['.zip'],
        invalidSelectionMessage: 'invalid',
      }),
    ).resolves.toEqual({
      file: expect.objectContaining({ name: 'data.zip' }),
    });

    await expect(
      selectFileFromPicker({
        pickerType: ['application/zip'],
        allowedExtensions: ['.zip'],
        invalidSelectionMessage: 'invalid',
      }),
    ).resolves.toEqual({ errorMessage: 'picker failed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error opening file picker or reading file:',
      expect.any(Error),
    );
  });

  it('formats processed zip delivery status messages for each delivery mode', () => {
    expect(
      getProcessedZipDeliveryStatusMessage({
        kind: 'downloaded',
        filename: 'download.zip',
      }),
    ).toBe('Processed ZIP downloaded: download.zip');
    expect(
      getProcessedZipDeliveryStatusMessage({
        kind: 'shared',
        filename: 'share.zip',
        fileUri: 'file://cache/share.zip',
      }),
    ).toBe('Processed ZIP ready to share: share.zip');
    expect(
      getProcessedZipDeliveryStatusMessage({
        kind: 'saved',
        filename: 'saved.zip',
        fileUri: 'file://picked-dir/saved.zip',
      }),
    ).toBe('Processed ZIP saved to selected folder: saved.zip');
  });

  it('classifies uploaded zip errors and falls back to default messages', () => {
    const parseError = new UploadZipParseError([
      'missing summary_stats.parquet',
    ]);
    const validationError = new UploadedParquetBundleValidationError([
      'occurrence did not produce any valid rows',
    ]);

    expect(getUploadedZipErrorMessage(parseError)).toBe(parseError.message);
    expect(getUploadedZipErrorMessage(validationError)).toBe(
      validationError.message,
    );
    expect(getUploadedZipErrorMessage(new Error('plain error'))).toBe(
      'plain error',
    );
    expect(getUploadedZipErrorMessage('unknown')).toBe(
      'Failed to parse uploaded zip file.',
    );

    expect(isExpectedUploadedZipError(parseError)).toBe(true);
    expect(isExpectedUploadedZipError(validationError)).toBe(true);
    expect(isExpectedUploadedZipError(new Error('plain error'))).toBe(false);
  });

  it('downloads directly on web using the DOM and object URLs', async () => {
    setPlatformOS('web');
    const click = jest.fn();
    const appendChild = jest.fn();
    const removeChild = jest.fn();
    const createElement = jest.fn(() => ({ click }));
    const createObjectURL = jest.fn(() => 'blob:web-url');
    const revokeObjectURL = jest.fn();

    global.document = {
      body: { appendChild, removeChild },
      createElement,
    } as unknown as Document;
    global.URL = {
      createObjectURL,
      revokeObjectURL,
    } as unknown as typeof URL;

    await expect(
      deliverProcessedZip({
        blob: new Blob(['zip-data']),
        contentType: 'application/zip',
        filename: null,
      }),
    ).resolves.toEqual({
      kind: 'downloaded',
      filename: DEFAULT_PROCESSED_ZIP_FILENAME,
    });

    expect(createElement).toHaveBeenCalledWith('a');
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:web-url');
  });

  it('shares on native when sharing is available and saves when it is not', async () => {
    setPlatformOS('ios');
    mockIsAvailableAsync
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mockShareAsync.mockResolvedValue(undefined);

    const bytesBlob = {
      bytes: jest.fn().mockResolvedValue(new Uint8Array([80, 75, 3, 4])),
    } as unknown as Blob;
    const arrayBufferBlob = {
      arrayBuffer: jest
        .fn()
        .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    } as unknown as Blob;

    await expect(
      deliverProcessedZip({
        blob: bytesBlob,
        contentType: 'application/zip',
        filename: 'shared file.zip',
      }),
    ).resolves.toEqual({
      kind: 'shared',
      filename: 'shared file.zip',
      fileUri: 'file://cache/shared_file.zip',
    });

    await expect(
      deliverProcessedZip({
        blob: arrayBufferBlob,
        contentType: 'application/zip',
        filename: 'saved file.zip',
      }),
    ).resolves.toEqual({
      kind: 'saved',
      filename: 'saved file.zip',
      fileUri: 'file://picked-dir/saved_file.zip',
    });

    expect(mockShareAsync).toHaveBeenCalledWith(
      'file://cache/shared_file.zip',
      expect.objectContaining({
        dialogTitle: 'Share processed observations ZIP',
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
      }),
    );
    expect(mockFileWrite).toHaveBeenNthCalledWith(
      1,
      new Uint8Array([80, 75, 3, 4]),
    );
    expect(mockFileWrite).toHaveBeenNthCalledWith(2, new Uint8Array([1, 2, 3]));
  });

  it('falls back to FileReader when persisting a blob without native helpers', async () => {
    setPlatformOS('android');
    mockIsAvailableAsync.mockResolvedValue(false);

    class MockFileReader {
      result: ArrayBuffer | null = null;
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      readAsArrayBuffer(_blob: Blob) {
        this.result = new Uint8Array([9, 8, 7]).buffer;
        this.onload?.();
      }
    }

    global.FileReader = MockFileReader as unknown as typeof FileReader;

    await expect(
      deliverProcessedZip({
        blob: { size: 3, type: 'application/zip' } as Blob,
        contentType: null,
        filename: 'reader.zip',
      }),
    ).resolves.toEqual({
      kind: 'saved',
      filename: 'reader.zip',
      fileUri: 'file://picked-dir/reader.zip',
    });

    expect(mockFileWrite).toHaveBeenCalledWith(new Uint8Array([9, 8, 7]));
  });

  it('throws a readable error when FileReader is unavailable for blob persistence', async () => {
    setPlatformOS('android');
    mockIsAvailableAsync.mockResolvedValue(false);
    global.FileReader = undefined as unknown as typeof FileReader;

    await expect(
      deliverProcessedZip({
        blob: { size: 3, type: 'application/zip' } as Blob,
        contentType: null,
        filename: 'broken.zip',
      }),
    ).rejects.toThrow('Processed ZIP could not be read on this device.');
  });
});
