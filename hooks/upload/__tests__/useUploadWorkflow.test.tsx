// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useUploadWorkflow } from '@/hooks/upload/useUploadWorkflow';
import { uploadRawObservations } from '@/data/api';
import { parseUploadedParquetZipToRawBundle } from '@/data/uploadZipParquetParser';
import {
  buildUploadLocalSpeciesDataSource,
  normalizeRawUploadedParquetBundle,
} from '@/data/uploadLocalSpeciesDataSource';
import {
  deliverProcessedZip,
  resolveAssetBlob,
  selectFileFromPicker,
} from '@/hooks/upload/uploadWorkflowHelpers.ts';
import { augmentRawTextWithCustomLayers } from '@/hooks/upload/customLayerAugmentation';
import { triggerErrorHaptic } from '@/utils/haptics';

jest.mock('@/hooks/upload/customLayerAugmentation', () => ({
  augmentRawTextWithCustomLayers: jest.fn(),
}));

jest.mock('@/data/api', () => ({
  uploadRawObservations: jest.fn(),
}));

jest.mock('@/data/uploadZipParquetParser', () => ({
  parseUploadedParquetZipToRawBundle: jest.fn(),
}));

jest.mock('@/data/uploadLocalSpeciesDataSource', () => ({
  buildUploadLocalSpeciesDataSource: jest.fn(),
  normalizeRawUploadedParquetBundle: jest.fn(),
}));

jest.mock('@/hooks/useDataSources', () => ({
  seedDataSourcesCache: jest.fn(),
}));

jest.mock('@/utils/haptics', () => ({
  triggerErrorHaptic: jest.fn(),
  triggerSuccessHaptic: jest.fn(),
}));

jest.mock('@/hooks/upload/uploadWorkflowHelpers.ts', () => ({
  createFilePayload: jest.fn((file) => file),
  DEFAULT_PROCESSED_ZIP_FILENAME: 'processed_observations.zip',
  deliverProcessedZip: jest.fn(),
  getProcessedZipDeliveryStatusMessage: jest.fn(
    (delivery) => `Processed ZIP delivered: ${delivery.filename}`,
  ),
  getUploadedZipErrorMessage: jest.fn((error) =>
    error instanceof Error ? error.message : 'zip error',
  ),
  isExpectedUploadedZipError: jest.fn(() => false),
  RAW_UPLOAD_ACCEPTED_EXTENSIONS: ['.csv'],
  RAW_UPLOAD_PICKER_MIME_TYPES: ['text/csv'],
  resolveAssetBlob: jest.fn(),
  selectFileFromPicker: jest.fn(),
  ZIP_UPLOAD_ACCEPTED_EXTENSIONS: ['.zip'],
  ZIP_UPLOAD_PICKER_MIME_TYPES: ['application/zip'],
}));

const mockUploadRawObservations = uploadRawObservations as jest.MockedFunction<
  typeof uploadRawObservations
>;
const mockParseUploadedParquetZipToRawBundle =
  parseUploadedParquetZipToRawBundle as jest.MockedFunction<
    typeof parseUploadedParquetZipToRawBundle
  >;
const mockNormalizeRawUploadedParquetBundle =
  normalizeRawUploadedParquetBundle as jest.MockedFunction<
    typeof normalizeRawUploadedParquetBundle
  >;
const mockBuildUploadLocalSpeciesDataSource =
  buildUploadLocalSpeciesDataSource as jest.MockedFunction<
    typeof buildUploadLocalSpeciesDataSource
  >;
const mockDeliverProcessedZip = deliverProcessedZip as jest.MockedFunction<
  typeof deliverProcessedZip
>;
const mockSelectFileFromPicker = selectFileFromPicker as jest.MockedFunction<
  typeof selectFileFromPicker
>;
const mockResolveAssetBlob = resolveAssetBlob as jest.MockedFunction<
  typeof resolveAssetBlob
>;
const mockAugmentRawTextWithCustomLayers =
  augmentRawTextWithCustomLayers as jest.MockedFunction<
    typeof augmentRawTextWithCustomLayers
  >;
const mockTriggerErrorHaptic = triggerErrorHaptic as jest.MockedFunction<
  typeof triggerErrorHaptic
>;

describe('useUploadWorkflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseUploadedParquetZipToRawBundle.mockResolvedValue({} as never);
    mockNormalizeRawUploadedParquetBundle.mockReturnValue({
      categoricalStats: [],
      densityGraph: [],
      meta: {},
      occurrenceIndex: [],
      occurrences: [],
      summaryStats: [],
      variableDefinitions: [],
    } as never);
    mockBuildUploadLocalSpeciesDataSource.mockReturnValue({} as never);
  });

  it('ignores stale ZIP delivery completion after a newer raw upload starts', async () => {
    let resolveDelivery:
      | ((value: Awaited<ReturnType<typeof mockDeliverProcessedZip>>) => void)
      | undefined;
    const stalledDeliveryPromise = new Promise<
      Awaited<ReturnType<typeof mockDeliverProcessedZip>>
    >((resolve) => {
      resolveDelivery = resolve;
    });

    mockSelectFileFromPicker
      .mockResolvedValueOnce({
        file: {
          name: 'first.csv',
          uri: 'file://first.csv',
          mimeType: 'text/csv',
        } as never,
      })
      .mockResolvedValueOnce({
        file: {
          name: 'second.csv',
          uri: 'file://second.csv',
          mimeType: 'text/csv',
        } as never,
      });

    mockUploadRawObservations
      .mockResolvedValueOnce({
        blob: new Blob(['first-zip']),
        contentType: 'application/zip',
        filename: 'first.zip',
        status: 200,
      })
      .mockResolvedValueOnce({
        blob: new Blob(['second-zip']),
        contentType: 'application/zip',
        filename: 'second.zip',
        status: 200,
      });
    mockDeliverProcessedZip.mockReturnValue(stalledDeliveryPromise);

    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.processRawObservations();
    });

    expect(result.current.rawUploadStatusMessage).toBe(
      'Processed ZIP ready to download: first.zip',
    );

    let deliveryPromise: Promise<void> | undefined;
    act(() => {
      deliveryPromise = result.current.downloadProcessedZip();
    });

    await waitFor(() => {
      expect(result.current.isDeliveringProcessedZip).toBe(true);
    });

    await act(async () => {
      await result.current.processRawObservations();
    });

    expect(result.current.rawUploadStatusMessage).toBe(
      'Processed ZIP ready to download: second.zip',
    );
    expect(result.current.isDeliveringProcessedZip).toBe(false);

    await act(async () => {
      resolveDelivery?.({
        fileUri: 'file://first.zip',
        filename: 'first.zip',
        kind: 'shared',
      });
      await deliveryPromise;
    });

    expect(result.current.rawUploadStatusMessage).toBe(
      'Processed ZIP ready to download: second.zip',
    );
    expect(result.current.isDeliveringProcessedZip).toBe(false);
  });

  it('passes extra options (generateDescription/image/imageUrl) through to uploadRawObservations', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      file: {
        name: 'obs.csv',
        uri: 'file://obs.csv',
        mimeType: 'text/csv',
      } as never,
    });
    mockUploadRawObservations.mockResolvedValueOnce({
      blob: new Blob(['zip']),
      contentType: 'application/zip',
      filename: 'processed.zip',
      status: 200,
    });

    const { result } = renderHook(() => useUploadWorkflow());

    const imageAsset = {
      name: 'photo.jpg',
      uri: 'file://photo.jpg',
      mimeType: 'image/jpeg',
    } as never;

    await act(async () => {
      await result.current.processRawObservations({
        generateDescription: true,
        image: imageAsset,
        imageUrl: 'https://example.com/photo.jpg',
      });
    });

    expect(mockUploadRawObservations).toHaveBeenCalledWith(
      expect.objectContaining({
        generateDescription: true,
        image: imageAsset,
        imageFilename: 'photo.jpg',
        imageUrl: 'https://example.com/photo.jpg',
      }),
      expect.any(Function),
    );
  });

  it('passes parentTaxonId through to uploadRawObservations', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      file: {
        name: 'obs.csv',
        uri: 'file://obs.csv',
        mimeType: 'text/csv',
      } as never,
    });
    mockUploadRawObservations.mockResolvedValueOnce({
      blob: new Blob(['zip']),
      contentType: 'application/zip',
      filename: 'processed.zip',
      status: 200,
    });

    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.processRawObservations({
        parentTaxonId: '42',
      });
    });

    expect(mockUploadRawObservations).toHaveBeenCalledWith(
      expect.objectContaining({ parentTaxonId: '42' }),
      expect.any(Function),
    );
  });

  it('samples attached custom layers, augments the raw file, and sends the resulting metadata', async () => {
    const csvAsset = {
      name: 'obs.csv',
      uri: 'file://obs.csv',
      mimeType: 'text/csv',
    } as never;
    mockSelectFileFromPicker.mockResolvedValueOnce({ file: csvAsset });
    mockResolveAssetBlob.mockResolvedValueOnce({
      text: () => Promise.resolve('latitude,longitude\n1,2\n'),
    } as never);
    mockAugmentRawTextWithCustomLayers.mockResolvedValueOnce({
      augmentedText: 'latitude,longitude,rainfall\n1,2,5',
      descriptors: [{ id: 'rainfall', name: 'rainfall', valueType: 'ratio' }],
      assetsById: new Map(),
    });
    mockUploadRawObservations.mockResolvedValueOnce({
      blob: new Blob(['zip']),
      contentType: 'application/zip',
      filename: 'processed.zip',
      status: 200,
    });

    const customLayerAsset = {
      name: 'rainfall.tif',
      uri: 'file://rainfall.tif',
    } as never;
    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.processRawObservations({
        customLayers: [customLayerAsset],
      });
    });

    expect(mockAugmentRawTextWithCustomLayers).toHaveBeenCalledWith(
      'latitude,longitude\n1,2\n',
      ',',
      [customLayerAsset],
    );
    const [uploadArgs] = mockUploadRawObservations.mock.calls[0];
    expect(uploadArgs.customLayerMetadata).toBe(
      JSON.stringify([
        { id: 'rainfall', name: 'rainfall', valueType: 'ratio' },
      ]),
    );
    expect(await (uploadArgs.file as Blob).text()).toBe(
      'latitude,longitude,rainfall\n1,2,5',
    );
  });

  it('skips custom-layer sampling for a parquet raw upload', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      file: { name: 'obs.parquet', uri: 'file://obs.parquet' } as never,
    });
    mockUploadRawObservations.mockResolvedValueOnce({
      blob: new Blob(['zip']),
      contentType: 'application/zip',
      filename: 'processed.zip',
      status: 200,
    });

    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.processRawObservations({
        customLayers: [
          { name: 'rainfall.tif', uri: 'file://rainfall.tif' } as never,
        ],
      });
    });

    expect(mockAugmentRawTextWithCustomLayers).not.toHaveBeenCalled();
    const [uploadArgs] = mockUploadRawObservations.mock.calls[0];
    expect(uploadArgs.customLayerMetadata).toBeUndefined();
  });

  it('omits extra options from uploadRawObservations when none are given', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      file: {
        name: 'obs.csv',
        uri: 'file://obs.csv',
        mimeType: 'text/csv',
      } as never,
    });
    mockUploadRawObservations.mockResolvedValueOnce({
      blob: new Blob(['zip']),
      contentType: 'application/zip',
      filename: 'processed.zip',
      status: 200,
    });

    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.processRawObservations();
    });

    expect(mockUploadRawObservations).toHaveBeenCalledWith(
      expect.objectContaining({
        generateDescription: undefined,
        image: undefined,
        imageUrl: undefined,
        parentTaxonId: undefined,
      }),
      expect.any(Function),
    );
  });

  it('surfaces picker failures during raw upload selection', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      errorMessage: 'picker failed',
    });

    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.processRawObservations();
    });

    expect(result.current.rawUploadStatusMessage).toBe('picker failed');
    expect(mockUploadRawObservations).not.toHaveBeenCalled();
    expect(mockTriggerErrorHaptic).toHaveBeenCalled();
  });

  it('surfaces picker failures during zip upload selection', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      errorMessage: 'picker failed',
    });

    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.processZippedObservations();
    });

    expect(result.current.zipUploadError).toBe('picker failed');
    expect(mockParseUploadedParquetZipToRawBundle).not.toHaveBeenCalled();
    expect(mockTriggerErrorHaptic).toHaveBeenCalled();
  });

  it('does nothing when downloadProcessedZip is called with no zip available', async () => {
    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.downloadProcessedZip();
    });

    expect(mockDeliverProcessedZip).not.toHaveBeenCalled();
  });

  it('seeds the data sources cache when the bundle includes dataSources', async () => {
    const { seedDataSourcesCache } = jest.requireMock('@/hooks/useDataSources');
    const dataSources = { source1: {} };
    mockNormalizeRawUploadedParquetBundle.mockReturnValueOnce({
      categoricalStats: [],
      densityGraph: [],
      meta: {},
      occurrenceIndex: [],
      occurrences: [],
      summaryStats: [],
      variableDefinitions: [],
      dataSources,
    } as never);

    mockSelectFileFromPicker.mockResolvedValueOnce({
      file: {
        name: 'data.zip',
        uri: 'file://data.zip',
        mimeType: 'application/zip',
      } as never,
    });
    mockParseUploadedParquetZipToRawBundle.mockResolvedValueOnce({} as never);

    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.processZippedObservations();
    });

    expect(seedDataSourcesCache).toHaveBeenCalledWith(dataSources);
  });

  it('reports an error when auto-import of the processed zip fails after raw upload', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      file: {
        name: 'obs.csv',
        uri: 'file://obs.csv',
        mimeType: 'text/csv',
      } as never,
    });
    mockUploadRawObservations.mockResolvedValueOnce({
      blob: new Blob(['zip']),
      contentType: 'application/zip',
      filename: 'obs.zip',
      status: 200,
    });
    mockNormalizeRawUploadedParquetBundle.mockImplementationOnce(() => {
      throw new Error('corrupt bundle');
    });

    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.processRawObservations();
    });

    expect(result.current.zipUploadError).toBe('corrupt bundle');
    expect(mockTriggerErrorHaptic).toHaveBeenCalled();
  });

  it('fires the upload progress callback including queued-with-position state', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      file: {
        name: 'obs.csv',
        uri: 'file://obs.csv',
        mimeType: 'text/csv',
      } as never,
    });
    mockUploadRawObservations.mockImplementationOnce(
      async (_payload, onProgress) => {
        onProgress?.({ status: 'queued', position: 3 });
        onProgress?.({ status: 'queued', position: 1 });
        onProgress?.({ status: 'processing', position: 0 });
        return {
          blob: new Blob(['zip']),
          contentType: 'application/zip',
          filename: 'obs.zip',
          status: 200,
        };
      },
    );

    const { result } = renderHook(() => useUploadWorkflow());

    await act(async () => {
      await result.current.processRawObservations();
    });

    expect(result.current.rawUploadStatusMessage).toContain('obs.zip');
  });

  it('shows the backend-reported stage while processing', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      file: {
        name: 'obs.csv',
        uri: 'file://obs.csv',
        mimeType: 'text/csv',
      } as never,
    });
    let resolveUpload!: (
      value: Awaited<ReturnType<typeof uploadRawObservations>>,
    ) => void;
    const uploadPromise = new Promise<
      Awaited<ReturnType<typeof uploadRawObservations>>
    >((resolve) => {
      resolveUpload = resolve;
    });
    let capturedOnProgress: Parameters<typeof uploadRawObservations>[1];
    mockUploadRawObservations.mockImplementationOnce(
      async (_payload, onProgress) => {
        capturedOnProgress = onProgress;
        return uploadPromise;
      },
    );

    const { result } = renderHook(() => useUploadWorkflow());

    let processDone!: Promise<void>;
    act(() => {
      processDone = result.current.processRawObservations();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      capturedOnProgress?.({
        status: 'processing',
        position: 0,
        stage: 'Sampling environmental layers',
      });
    });
    expect(result.current.rawUploadStatusMessage).toBe(
      'Sampling environmental layers…',
    );

    act(() => {
      resolveUpload({
        blob: new Blob(['zip']),
        contentType: 'application/zip',
        filename: 'obs.zip',
        status: 200,
      });
    });
    await act(async () => {
      await processDone;
    });
  });

  it('falls back to a generic "Processing…" message when no stage is reported', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      file: {
        name: 'obs.csv',
        uri: 'file://obs.csv',
        mimeType: 'text/csv',
      } as never,
    });
    let resolveUpload!: (
      value: Awaited<ReturnType<typeof uploadRawObservations>>,
    ) => void;
    const uploadPromise = new Promise<
      Awaited<ReturnType<typeof uploadRawObservations>>
    >((resolve) => {
      resolveUpload = resolve;
    });
    let capturedOnProgress: Parameters<typeof uploadRawObservations>[1];
    mockUploadRawObservations.mockImplementationOnce(
      async (_payload, onProgress) => {
        capturedOnProgress = onProgress;
        return uploadPromise;
      },
    );

    const { result } = renderHook(() => useUploadWorkflow());

    let processDone!: Promise<void>;
    act(() => {
      processDone = result.current.processRawObservations();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      capturedOnProgress?.({ status: 'processing', position: 0 });
    });
    expect(result.current.rawUploadStatusMessage).toBe('Processing…');

    act(() => {
      resolveUpload({
        blob: new Blob(['zip']),
        contentType: 'application/zip',
        filename: 'obs.zip',
        status: 200,
      });
    });
    await act(async () => {
      await processDone;
    });
  });

  it('shows a local-sampling message while custom layers are being sampled client-side', async () => {
    mockSelectFileFromPicker.mockResolvedValueOnce({
      file: {
        name: 'obs.csv',
        uri: 'file://obs.csv',
        mimeType: 'text/csv',
      } as never,
    });
    mockResolveAssetBlob.mockResolvedValueOnce({
      text: () => Promise.resolve('latitude,longitude\n1,2\n'),
    } as never);
    let resolveAugment!: (
      value: Awaited<ReturnType<typeof augmentRawTextWithCustomLayers>>,
    ) => void;
    mockAugmentRawTextWithCustomLayers.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAugment = resolve;
      }),
    );
    mockUploadRawObservations.mockResolvedValueOnce({
      blob: new Blob(['zip']),
      contentType: 'application/zip',
      filename: 'obs.zip',
      status: 200,
    });

    const { result } = renderHook(() => useUploadWorkflow());

    let processDone!: Promise<void>;
    act(() => {
      processDone = result.current.processRawObservations({
        customLayers: [
          { name: 'rainfall.tif', uri: 'file://rainfall.tif' } as never,
        ],
      });
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.rawUploadStatusMessage).toBe(
      'Sampling custom layers locally…',
    );

    act(() => {
      resolveAugment({
        augmentedText: 'latitude,longitude\n1,2\n',
        descriptors: [],
        assetsById: new Map(),
      });
    });
    await act(async () => {
      await processDone;
    });
  });

  describe('Step 2 with Extra options custom layers', () => {
    const zipAsset = {
      name: 'processed.zip',
      uri: 'file://processed.zip',
    } as never;
    const layerAsset = (name: string) =>
      ({ name, uri: `file://${name}` }) as never;

    const bundleWithCustomLayer = {
      categoricalStats: [],
      densityGraph: [],
      meta: {},
      occurrenceIndex: [],
      occurrences: [],
      summaryStats: [],
      variableDefinitions: [
        {
          id: 'salinity_two',
          name: 'salinity_two',
          valueType: 'ordinal',
          category: 'Custom Layers',
          legendClasses: [{ id: 0, name: 'Low', color: null }],
        },
      ],
    };

    beforeEach(() => {
      mockSelectFileFromPicker.mockResolvedValue({ file: zipAsset });
      mockResolveAssetBlob.mockResolvedValue(new Blob(['zip']));
      mockParseUploadedParquetZipToRawBundle.mockResolvedValue({
        occurrences: [
          { catalogNumber: 'A', decimalLatitude: 1, decimalLongitude: 2 },
        ],
      } as never);
      mockNormalizeRawUploadedParquetBundle.mockReturnValue(
        bundleWithCustomLayer as never,
      );
    });

    it('skips re-processing for a layer already in the ZIP and just attaches its file', async () => {
      const asset = layerAsset('salinity_two.tif');
      const { result } = renderHook(() => useUploadWorkflow());

      await act(async () => {
        await result.current.processZippedObservations({
          customLayers: [asset],
        });
      });

      expect(mockUploadRawObservations).not.toHaveBeenCalled();
      expect(mockAugmentRawTextWithCustomLayers).not.toHaveBeenCalled();
      expect(result.current.customLayerAssets.get('salinity_two')).toBe(asset);
      expect(result.current.uploadedBundle).toBe(bundleWithCustomLayer);
    });

    it('re-uploads for a genuinely new layer, forwarding the Extra options and making the ZIP downloadable', async () => {
      const newAsset = layerAsset('rainfall.tif');
      const image = layerAsset('cover.png');
      mockAugmentRawTextWithCustomLayers.mockResolvedValueOnce({
        augmentedText: 'catalogNumber,rainfall\nA,5',
        descriptors: [{ id: 'rainfall', name: 'rainfall', valueType: 'ratio' }],
        assetsById: new Map([['rainfall', newAsset]]),
      });
      mockUploadRawObservations.mockResolvedValueOnce({
        blob: new Blob(['new zip']),
        contentType: 'application/zip',
        filename: 'processed_observations.zip',
      } as never);

      const { result } = renderHook(() => useUploadWorkflow());

      await act(async () => {
        await result.current.processZippedObservations({
          customLayers: [newAsset],
          generateDescription: true,
          image,
          imageUrl: 'https://example.com/i.png',
          parentTaxonId: 'ABC',
        });
      });

      const params = mockUploadRawObservations.mock.calls[0][0];
      expect(params).toMatchObject({
        filename: 'reimported_observations.csv',
        generateDescription: true,
        image,
        imageUrl: 'https://example.com/i.png',
        parentTaxonId: 'ABC',
      });
      // The already-present custom layer is preserved alongside the new one.
      expect(
        JSON.parse(params.customLayerMetadata as string).map(
          (d: { id: string }) => d.id,
        ),
      ).toEqual(['salinity_two', 'rainfall']);
      expect(result.current.canDownloadProcessedZip).toBe(true);
      expect(result.current.customLayerAssets.get('rainfall')).toBe(newAsset);
    });
  });
});
