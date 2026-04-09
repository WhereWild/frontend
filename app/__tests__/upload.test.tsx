import { useColorScheme } from '@/hooks/useColorScheme';
import { uploadRawObservations } from '@/data/api';
import { parseUploadedParquetZipToRawBundle } from '@/data/uploadZipParquetParser';
import {
  normalizeRawUploadedParquetBundle,
  buildUploadLocalSpeciesDataSource,
  type RawUploadedParquetBundle,
} from '@/data/uploadLocalSpeciesDataSource';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import Upload from '../upload';

const mockFileCreate = jest.fn();
const mockFileWrite = jest.fn();
const mockPickDirectoryAsync = jest.fn();

jest.mock('@/components', () => {
  const ReactLocal = jest.requireActual('react');
  const actual = jest.requireActual('@/components');
  const { Pressable, Text } = jest.requireActual('react-native');

  return {
    ...actual,
    SpeciesEnvironmentSection: ({
      pinnedObservation,
    }: {
      pinnedObservation?: {
        catalogNumber: string;
        lat: number;
        lon: number;
      } | null;
    }) =>
      ReactLocal.createElement(
        ReactLocal.Fragment,
        null,
        ReactLocal.createElement(
          actual.ThemedText,
          { variant: 'heading' },
          'Species Environment',
        ),
        ReactLocal.createElement(
          Text,
          { testID: 'mock-pinned-observation' },
          pinnedObservation?.catalogNumber ?? 'none',
        ),
      ),
    SpeciesOccurrenceMap: ({
      linkObservations,
      onPinObservation,
    }: {
      linkObservations?: boolean;
      onPinObservation?: (
        catalogNumber: string,
        lat: number,
        lon: number,
      ) => void;
    }) =>
      ReactLocal.createElement(
        ReactLocal.Fragment,
        null,
        ReactLocal.createElement(
          actual.ThemedText,
          { variant: 'body' },
          `Map links ${String(linkObservations)}`,
        ),
        ReactLocal.createElement(
          Pressable,
          {
            testID: 'mock-pin-observation',
            onPress: () => onPinObservation?.('obs_1', 10, 20),
          },
          ReactLocal.createElement(Text, null, 'Pin observation'),
        ),
      ),
  };
});

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    breakpoint: 'desktop',
    contentWidth: 1200,
    gap: 32,
    marginHorizontal: 32,
  }),
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockGetDocumentAsync = jest.fn();

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
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

const mockShareAsync = jest.fn();
const mockIsShareAvailableAsync = jest.fn();

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsShareAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock('@/data/api', () => ({
  uploadRawObservations: jest.fn(),
}));

jest.mock('@/data/uploadZipParquetParser', () => ({
  parseUploadedParquetZipToRawBundle: jest.fn(),
  UploadZipParseError: Error,
}));

jest.mock('@/data/uploadLocalSpeciesDataSource', () => ({
  normalizeRawUploadedParquetBundle: jest.fn(),
  buildUploadLocalSpeciesDataSource: jest.fn(),
  UploadedParquetBundleValidationError: Error,
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;
const mockUploadRawObservations = uploadRawObservations as jest.MockedFunction<
  typeof uploadRawObservations
>;
const mockParseZip = parseUploadedParquetZipToRawBundle as jest.MockedFunction<
  typeof parseUploadedParquetZipToRawBundle
>;
const mockNormalize = normalizeRawUploadedParquetBundle as jest.MockedFunction<
  typeof normalizeRawUploadedParquetBundle
>;
const mockBuildDataSource =
  buildUploadLocalSpeciesDataSource as jest.MockedFunction<
    typeof buildUploadLocalSpeciesDataSource
  >;

const originalFile = (global as { File?: unknown }).File;
const originalFetch = global.fetch;
const originalXMLHttpRequest = global.XMLHttpRequest;
const originalPlatformOS = Platform.OS;
let consoleErrorSpy: jest.SpyInstance;

const setPlatformOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

const makePickerSelection = (assets: Record<string, unknown>[]) => ({
  canceled: false,
  assets,
});

const makeDocumentAsset = ({
  uri,
  name,
  mimeType,
  file,
}: {
  uri: string;
  name: string;
  mimeType: string;
  file?: File;
}) => ({
  uri,
  name,
  mimeType,
  ...(file ? { file } : {}),
});

const makeFile = (content: string, name: string, type: string) =>
  new File([content], name, { type });

const mockPickerWithCsvFile = () => {
  const file = makeFile('lat,lon\n1,2', 'observations.csv', 'text/csv');
  mockGetDocumentAsync.mockResolvedValue(
    makePickerSelection([
      makeDocumentAsset({
        uri: 'file://observations.csv',
        name: 'observations.csv',
        mimeType: 'text/csv',
        file,
      }),
    ]),
  );
  return file;
};

const mockPickerWithZipFile = (overrides?: {
  uri?: string;
  name?: string;
  file?: File;
}) => {
  const name = overrides?.name ?? 'data.zip';
  const uri = overrides?.uri ?? `file://${name}`;
  const file = overrides?.file;
  mockGetDocumentAsync.mockResolvedValue(
    makePickerSelection([
      makeDocumentAsset({
        uri,
        name,
        mimeType: 'application/zip',
        ...(file ? { file } : {}),
      }),
    ]),
  );
  return file;
};

const pressUploadButton = (index: number) => {
  fireEvent.press(screen.getAllByLabelText('Upload')[index]);
};

const makeUploadPreviewDataSource = () => ({
  fetchEnvironmentVariables: jest.fn().mockResolvedValue([
    {
      id: 'bio_1',
      name: 'Mean Annual Temperature',
      variableCategory: null,
      units: '°C',
      valueType: 'continuous',
    },
  ]),
  fetchSpeciesEnvironment: jest.fn().mockResolvedValue({
    histogram: [{ bin: 0, value: 1 }],
    density: [{ x: 0, y: 0.5 }],
    stats: { mean: 15, min: 10, max: 20, median: 15, q25: 12, q75: 18 },
  }),
  fetchEnvironmentRangeSlice: jest.fn().mockResolvedValue([]),
  fetchSpeciesEnvironmentCategorySamples: jest.fn().mockResolvedValue(null),
  fetchSpeciesOccurrences: jest.fn().mockResolvedValue([]),
  fetchSpeciesLocations: jest.fn().mockResolvedValue([]),
});

describe('Upload screen', () => {
  beforeAll(() => {
    if (typeof (global as { File?: unknown }).File === 'undefined') {
      (global as { File?: unknown }).File = class MockFile {};
    }
  });

  afterAll(() => {
    (global as { File?: unknown }).File = originalFile;
    global.fetch = originalFetch;
    global.XMLHttpRequest = originalXMLHttpRequest;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('dark');
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
    mockFileCreate.mockReturnValue(undefined);
    mockFileWrite.mockReturnValue(undefined);
    mockPickDirectoryAsync.mockResolvedValue({ uri: 'file://picked-dir/' });
    mockIsShareAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    global.fetch = originalFetch;
    global.XMLHttpRequest = originalXMLHttpRequest;
    setPlatformOS(originalPlatformOS);
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders core content and accessible upload actions', () => {
    render(<Upload />);

    expect(screen.getByTestId('upload-screen')).toBeTruthy();
    expect(screen.getByText('Upload Custom Data')).toBeTruthy();
    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(screen.getByText('Step 2')).toBeTruthy();
    expect(screen.getAllByLabelText('Upload')).toHaveLength(2);
  });

  it('opens the file picker from both upload buttons', async () => {
    render(<Upload />);

    const [stepOneUploadButton, stepTwoUploadButton] =
      screen.getAllByLabelText('Upload');

    fireEvent.press(stepOneUploadButton);
    await waitFor(() =>
      expect(mockGetDocumentAsync).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ type: '.csv, .tsv, .parquet' }),
      ),
    );

    fireEvent.press(stepTwoUploadButton);
    await waitFor(() =>
      expect(mockGetDocumentAsync).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ type: '.zip' }),
      ),
    );
  });

  it('replaces step 1 upload button with loading state while upload is in progress', async () => {
    setPlatformOS('web');
    let resolveUpload:
      | ((value: Awaited<ReturnType<typeof uploadRawObservations>>) => void)
      | undefined;
    const stalledUploadPromise = new Promise<
      Awaited<ReturnType<typeof uploadRawObservations>>
    >((resolve) => {
      resolveUpload = resolve;
    });
    mockUploadRawObservations.mockReturnValue(stalledUploadPromise);

    mockPickerWithCsvFile();

    render(<Upload />);

    pressUploadButton(0);

    await waitFor(() => {
      expect(screen.getByText('Generating zip...')).toBeTruthy();
    });
    expect(screen.getAllByLabelText('Upload')).toHaveLength(1);
    expect(mockUploadRawObservations).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveUpload?.({
        blob: new Blob(['zip-data']),
        status: 200,
        contentType: 'application/zip',
        filename: 'processed_observations.zip',
      });
      await stalledUploadPromise;
    });

    await waitFor(() => {
      expect(screen.getAllByLabelText('Upload')).toHaveLength(2);
    });
    expect(
      screen.getByText(/Processed ZIP .*processed_observations\.zip/),
    ).toBeTruthy();
  });

  it('step 1: saves and shares the generated zip on native platforms', async () => {
    setPlatformOS('ios');
    mockUploadRawObservations.mockResolvedValue({
      blob: new Blob(['zip-data']),
      status: 200,
      contentType: 'application/zip',
      filename: 'processed observations.zip',
    });

    mockPickerWithCsvFile();

    render(<Upload />);

    pressUploadButton(0);

    await waitFor(() => {
      expect(mockFileCreate).toHaveBeenCalledWith({
        intermediates: true,
        overwrite: true,
      });
    });
    expect(mockFileWrite).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file://cache/processed_observations.zip',
      expect.objectContaining({
        dialogTitle: 'Share processed observations ZIP',
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
      }),
    );
    expect(
      screen.getByText(
        'Processed ZIP ready to share: processed observations.zip',
      ),
    ).toBeTruthy();
  });

  it('step 1: reports a saved-local message when native sharing is unavailable', async () => {
    setPlatformOS('android');
    mockIsShareAvailableAsync.mockResolvedValue(false);
    mockUploadRawObservations.mockResolvedValue({
      blob: new Blob(['zip-data']),
      status: 200,
      contentType: 'application/zip',
      filename: 'processed observations.zip',
    });

    mockPickerWithCsvFile();

    render(<Upload />);

    pressUploadButton(0);

    await waitFor(() => {
      expect(mockPickDirectoryAsync).toHaveBeenCalled();
    });
    expect(mockFileWrite).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Processed ZIP saved to selected folder: processed observations.zip',
      ),
    ).toBeTruthy();
  });

  it('step 2: processes zip file and displays preview on success', async () => {
    const mockRawBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [],
      summaryStats: [],
      variableMetadata: [],
    };

    const mockNormalizedBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [{ catalogNumber: 'obs_1', latitude: 10, longitude: 20 }],
      occurrenceIndex: [],
      summaryStats: [],
      variableDefinitions: [],
    };

    const mockDataSource = makeUploadPreviewDataSource();

    mockParseZip.mockResolvedValue(mockRawBundle);
    mockNormalize.mockReturnValue(mockNormalizedBundle);
    mockBuildDataSource.mockReturnValue(mockDataSource);

    const zipFile = makeFile('PK...', 'data.zip', 'application/zip');
    mockPickerWithZipFile({ file: zipFile });

    render(<Upload />);

    pressUploadButton(1);

    await waitFor(() => {
      expect(mockParseZip).toHaveBeenCalledWith(zipFile);
    });

    await waitFor(() => {
      expect(screen.getByText('Species Environment')).toBeTruthy();
    });
    expect(screen.getByText('Map links false')).toBeTruthy();

    expect(mockNormalize).toHaveBeenCalledWith(mockRawBundle);
    expect(mockBuildDataSource).toHaveBeenCalled();
  });

  it('step 2: forwards uploaded map pin selections into environment highlighting', async () => {
    const mockRawBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [],
      summaryStats: [],
      variableMetadata: [],
    };

    const mockNormalizedBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [{ catalogNumber: 'obs_1', latitude: 10, longitude: 20 }],
      occurrenceIndex: [],
      summaryStats: [],
      variableDefinitions: [],
    };

    mockParseZip.mockResolvedValue(mockRawBundle);
    mockNormalize.mockReturnValue(mockNormalizedBundle);
    mockBuildDataSource.mockReturnValue(makeUploadPreviewDataSource());

    const zipFile = makeFile('PK...', 'data.zip', 'application/zip');
    mockPickerWithZipFile({ file: zipFile });

    render(<Upload />);

    pressUploadButton(1);

    await waitFor(() => {
      expect(screen.getByText('Species Environment')).toBeTruthy();
    });

    expect(screen.getByTestId('mock-pinned-observation').props.children).toBe(
      'none',
    );

    fireEvent.press(screen.getByTestId('mock-pin-observation'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-pinned-observation').props.children).toBe(
        'obs_1',
      );
    });
  });

  it('step 2: shows a non-fatal warning when uploaded categorical keys cannot support highlighting', async () => {
    const mockRawBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [],
      summaryStats: [],
      variableMetadata: [],
    };

    const mockNormalizedBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [{ catalogNumber: 'obs_1', latitude: 10, longitude: 20 }],
      occurrenceIndex: [],
      summaryStats: [],
      variableDefinitions: [],
      meta: {
        source: 'upload-local' as const,
        uploadedAt: '2026-04-09T00:00:00.000Z',
        warnings: [
          'Uploaded categorical variable "Land Cover Classes" has occurrence_index codes that do not resolve through categorical_value_lookup, so categorical highlighting may be unavailable.',
        ],
      },
    };

    mockParseZip.mockResolvedValue(mockRawBundle);
    mockNormalize.mockReturnValue(mockNormalizedBundle);
    mockBuildDataSource.mockReturnValue(makeUploadPreviewDataSource());

    const zipFile = makeFile('PK...', 'data.zip', 'application/zip');
    mockPickerWithZipFile({ file: zipFile });

    render(<Upload />);

    pressUploadButton(1);

    await waitFor(() => {
      expect(
        screen.getByText(/categorical highlighting may be unavailable/i),
      ).toBeTruthy();
    });
  });

  it('step 2: processes a URI-backed zip asset on native platforms', async () => {
    const zipBlob = new Blob(['PK...'], { type: 'application/zip' });
    const mockRawBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [],
      summaryStats: [],
      variableMetadata: [],
    };
    const mockNormalizedBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [{ catalogNumber: 'obs_1', latitude: 10, longitude: 20 }],
      occurrenceIndex: [],
      summaryStats: [],
      variableDefinitions: [],
    };

    global.fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue(zipBlob),
    }) as unknown as typeof fetch;
    mockParseZip.mockResolvedValue(mockRawBundle);
    mockNormalize.mockReturnValue(mockNormalizedBundle);
    mockBuildDataSource.mockReturnValue(makeUploadPreviewDataSource());

    mockPickerWithZipFile({
      uri: 'file://native-data.zip',
      name: 'native-data.zip',
    });

    render(<Upload />);

    pressUploadButton(1);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('file://native-data.zip');
    });
    await waitFor(() => {
      expect(mockParseZip).toHaveBeenCalledWith(zipBlob);
    });
  });

  it('step 2: falls back to XMLHttpRequest when fetching a URI-backed zip fails', async () => {
    const zipBlob = new Blob(['PK...'], { type: 'application/zip' });
    const mockRawBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [],
      summaryStats: [],
      variableMetadata: [],
    };
    const mockNormalizedBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [{ catalogNumber: 'obs_1', latitude: 10, longitude: 20 }],
      occurrenceIndex: [],
      summaryStats: [],
      variableDefinitions: [],
    };

    const open = jest.fn();
    const send = jest.fn(function send(this: {
      onload?: () => void;
      response?: Blob;
    }) {
      this.response = zipBlob;
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

    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('fetch failed')) as unknown as typeof fetch;
    global.XMLHttpRequest =
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    mockParseZip.mockResolvedValue(mockRawBundle);
    mockNormalize.mockReturnValue(mockNormalizedBundle);
    mockBuildDataSource.mockReturnValue(makeUploadPreviewDataSource());

    mockPickerWithZipFile({
      uri: 'file://native-fallback.zip',
      name: 'native-fallback.zip',
    });

    render(<Upload />);

    pressUploadButton(1);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('file://native-fallback.zip');
    });
    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        'GET',
        'file://native-fallback.zip',
        true,
      );
      expect(send).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockParseZip).toHaveBeenCalledWith(zipBlob);
    });
  });

  it('step 2: shows loading state while processing zip file', async () => {
    const stalledParsePromise: Promise<RawUploadedParquetBundle> = new Promise(
      () => undefined,
    );
    mockParseZip.mockReturnValue(stalledParsePromise);

    const zipFile = makeFile('PK...', 'data.zip', 'application/zip');
    mockPickerWithZipFile({ file: zipFile });

    render(<Upload />);

    pressUploadButton(1);

    await waitFor(() => {
      expect(screen.getByText('Generating zip...')).toBeTruthy();
    });

    expect(screen.getAllByLabelText('Upload')).toHaveLength(1);
  });

  it('step 2: displays error message when zip parsing fails', async () => {
    mockParseZip.mockRejectedValue(
      new Error(
        'Failed to parse upload zip: Missing required parquet file: summary_stats.parquet',
      ),
    );

    const zipFile = makeFile('invalid', 'bad.zip', 'application/zip');
    mockPickerWithZipFile({
      uri: 'file://bad.zip',
      name: 'bad.zip',
      file: zipFile,
    });

    render(<Upload />);

    pressUploadButton(1);

    await waitFor(() => {
      expect(screen.getByText(/Failed to parse upload zip/)).toBeTruthy();
    });

    expect(mockNormalize).not.toHaveBeenCalled();
    expect(mockBuildDataSource).not.toHaveBeenCalled();
  });

  it('step 2: displays validation error when bundle is invalid', async () => {
    const mockRawBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [],
      occurrenceIndex: [],
      summaryStats: [],
    };

    mockParseZip.mockResolvedValue(mockRawBundle);
    mockNormalize.mockImplementation(() => {
      throw new Error(
        'Uploaded parquet bundle is invalid: occurrence did not produce any valid rows',
      );
    });

    const zipFile = makeFile('PK...', 'data.zip', 'application/zip');
    mockPickerWithZipFile({ file: zipFile });

    render(<Upload />);

    pressUploadButton(1);

    await waitFor(() => {
      expect(
        screen.getByText(/Uploaded parquet bundle is invalid/),
      ).toBeTruthy();
    });

    expect(mockBuildDataSource).not.toHaveBeenCalled();
  });
});
