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
  selectFileFromPicker,
} from '@/hooks/upload/uploadWorkflowHelpers.ts';
import { triggerErrorHaptic } from '@/utils/haptics';

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
});
