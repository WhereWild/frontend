import JSZip from 'jszip';
import {
  parseUploadedParquetZipToRawBundle,
  resolveParquetEntryPaths,
} from '@/data/uploadZipParquetParser';

describe('resolveParquetEntryPaths', () => {
  it('accepts zip bundles that omit variable_metadata.parquet', () => {
    const zip = {
      files: {
        'categorical_stats.parquet': { dir: false },
        'categorical_value_lookup.parquet': { dir: false },
        'density_graph.parquet': { dir: false },
        'occurrence.parquet': { dir: false },
        'occurrence_index.parquet': { dir: false },
        'summary_stats.parquet': { dir: false },
      },
    } as unknown as JSZip;

    const entryPaths = resolveParquetEntryPaths(zip);

    expect(entryPaths).toEqual(
      expect.objectContaining({
        categoricalStats: 'categorical_stats.parquet',
        categoricalValueLookup: 'categorical_value_lookup.parquet',
        densityGraph: 'density_graph.parquet',
        occurrences: 'occurrence.parquet',
        occurrenceIndex: 'occurrence_index.parquet',
        summaryStats: 'summary_stats.parquet',
      }),
    );
    expect(entryPaths.variableMetadata).toBeUndefined();
  });

  it('accepts categorical_value_lookup.csv as the bridge table entry', () => {
    const zip = {
      files: {
        'categorical_stats.parquet': { dir: false },
        'categorical_value_lookup.csv': { dir: false },
        'density_graph.parquet': { dir: false },
        'occurrence.parquet': { dir: false },
        'occurrence_index.parquet': { dir: false },
        'summary_stats.parquet': { dir: false },
      },
    } as unknown as JSZip;

    expect(resolveParquetEntryPaths(zip)).toEqual(
      expect.objectContaining({
        categoricalValueLookup: 'categorical_value_lookup.csv',
      }),
    );
  });
});

describe('parseUploadedParquetZipToRawBundle', () => {
  const originalFileReader = global.FileReader;

  afterEach(() => {
    global.FileReader = originalFileReader;
    jest.restoreAllMocks();
  });

  it('falls back to FileReader when the zip blob lacks arrayBuffer', async () => {
    const zipBuffer = new Uint8Array([80, 75, 3, 4]).buffer;
    class MockFileReader {
      result: ArrayBuffer | null = null;
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      readAsArrayBuffer(_blob: Blob) {
        this.result = zipBuffer.slice(0);
        this.onload?.();
      }
    }
    global.FileReader = MockFileReader as unknown as typeof FileReader;

    const zipMock = {
      files: {
        'categorical_stats.csv': { dir: false },
        'density_graph.csv': { dir: false },
        'occurrence.csv': { dir: false },
        'occurrence_index.csv': { dir: false },
        'summary_stats.csv': { dir: false },
      },
      file: jest.fn((path: string) => ({
        async: jest.fn(async (type: string) => {
          if (type === 'arraybuffer') {
            return new TextEncoder().encode('column\n').buffer;
          }
          if (type === 'string') {
            return '{}';
          }
          throw new Error(`Unsupported async type: ${type}`);
        }),
        name: path,
      })),
    } as unknown as JSZip;

    const loadAsyncSpy = jest
      .spyOn(JSZip, 'loadAsync')
      .mockResolvedValue(zipMock);

    const result = await parseUploadedParquetZipToRawBundle({
      size: 4,
      type: 'application/zip',
    } as Blob);

    expect(loadAsyncSpy).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    expect(result).toEqual(
      expect.objectContaining({
        categoricalStats: [],
        densityGraph: [],
        occurrences: [],
        occurrenceIndex: [],
        summaryStats: [],
      }),
    );
  });
});
