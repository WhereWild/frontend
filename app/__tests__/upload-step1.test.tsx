import * as Haptics from 'expo-haptics';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import {
  initializeUploadTestState,
  mockFileCreate,
  mockFileWrite,
  mockGetDocumentAsync,
  mockImpactAsync,
  mockIsShareAvailableAsync,
  mockNotificationAsync,
  mockPickerWithCsvFile,
  mockShareAsync,
  mockUploadRawObservations,
  mockUseResponsive,
  pressUploadButton,
  renderUpload,
  restoreUploadTestGlobals,
  restoreUploadTestState,
  setPlatformOS,
  makeDocumentAsset,
  makeFile,
  makePickerSelection,
} from '../../test-utils/uploadTestUtils';

describe('Upload screen step 1', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    // Shared upload test utils already establish the File polyfill when needed.
  });

  afterAll(() => {
    restoreUploadTestGlobals();
  });

  beforeEach(() => {
    consoleErrorSpy = initializeUploadTestState();
  });

  afterEach(() => {
    restoreUploadTestState(consoleErrorSpy);
  });

  it('renders core content and accessible upload actions', () => {
    setPlatformOS('web');

    renderUpload();

    expect(screen.getByTestId('upload-screen')).toBeTruthy();
    expect(screen.getByText('Upload Custom Data')).toBeTruthy();
    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(screen.getByText('Step 2')).toBeTruthy();
    expect(screen.getAllByLabelText('Upload')).toHaveLength(2);
    expect(screen.queryByLabelText('Download ZIP')).toBeNull();
  });

  it('centers upload content inside a padded shell with max content width', () => {
    renderUpload();

    expect(
      StyleSheet.flatten(screen.getByTestId('upload-content-shell').props.style)
        .alignItems,
    ).toBe('center');
    expect(
      StyleSheet.flatten(screen.getByTestId('upload-content').props.style)
        .maxWidth,
    ).toBe(1200);
  });

  it('stacks upload cards at tablet breakpoint', () => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'tablet',
      contentWidth: 720,
      gap: 24,
      marginHorizontal: 24,
    });

    renderUpload();

    expect(
      StyleSheet.flatten(screen.getByTestId('upload-step-card-1').props.style)
        .width,
    ).toBe('100%');
  });

  it('opens the file picker from both upload buttons', async () => {
    setPlatformOS('ios');

    renderUpload();

    const [stepOneUploadButton, stepTwoUploadButton] =
      screen.getAllByLabelText('Upload');

    fireEvent.press(stepOneUploadButton);
    await waitFor(() =>
      expect(mockGetDocumentAsync).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ type: '*/*' }),
      ),
    );

    fireEvent.press(stepTwoUploadButton);
    await waitFor(() =>
      expect(mockGetDocumentAsync).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ type: '*/*' }),
      ),
    );
  });

  it('uses extension-driven picker selection on web for both upload steps', async () => {
    setPlatformOS('web');

    renderUpload();

    const [stepOneUploadButton, stepTwoUploadButton] =
      screen.getAllByLabelText('Upload');

    fireEvent.press(stepOneUploadButton);
    await waitFor(() =>
      expect(mockGetDocumentAsync).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ type: '*/*' }),
      ),
    );

    fireEvent.press(stepTwoUploadButton);
    await waitFor(() =>
      expect(mockGetDocumentAsync).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ type: '*/*' }),
      ),
    );
  });

  it('shows a validation message when an unsupported raw file is selected on ios', async () => {
    setPlatformOS('ios');
    mockGetDocumentAsync.mockResolvedValue(
      makePickerSelection([
        makeDocumentAsset({
          uri: 'file://notes.txt',
          name: 'notes.txt',
          mimeType: 'text/plain',
          file: makeFile('hello', 'notes.txt', 'text/plain'),
        }),
      ]),
    );

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Unsupported file type. Please select a CSV, TSV, or parquet file.',
        ),
      ).toBeTruthy();
    });
    expect(mockUploadRawObservations).not.toHaveBeenCalled();
    expect(mockNotificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error,
    );
  });

  it('plays an error haptic when raw upload processing fails', async () => {
    setPlatformOS('ios');
    mockUploadRawObservations.mockRejectedValueOnce(
      new Error('Failed to process raw observations.'),
    );

    mockPickerWithCsvFile();

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to process raw observations.'),
      ).toBeTruthy();
    });

    expect(mockNotificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error,
    );
  });

  it('replaces step 1 upload button with loading state while upload is in progress', async () => {
    setPlatformOS('web');
    let resolveUpload:
      | ((value: Awaited<ReturnType<typeof mockUploadRawObservations>>) => void)
      | undefined;
    const stalledUploadPromise = new Promise<
      Awaited<ReturnType<typeof mockUploadRawObservations>>
    >((resolve) => {
      resolveUpload = resolve;
    });
    mockUploadRawObservations.mockReturnValue(stalledUploadPromise);

    mockPickerWithCsvFile();

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(screen.getByText('Processing upload...')).toBeTruthy();
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
    expect(screen.getByLabelText('Download ZIP')).toBeTruthy();
    expect(screen.getByText(/Processed ZIP ready to download/)).toBeTruthy();
  });

  it('keeps the generated zip available for download instead of auto-delivering it', async () => {
    setPlatformOS('ios');
    mockUploadRawObservations.mockResolvedValue({
      blob: new Blob(['zip-data']),
      status: 200,
      contentType: 'application/zip',
      filename: 'processed observations.zip',
    });

    mockPickerWithCsvFile();

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(screen.getByLabelText('Download ZIP')).toBeTruthy();
    });
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Processed ZIP ready to download: processed observations.zip',
      ),
    ).toBeTruthy();
  });

  it('shows a download loading state while the processed zip is being delivered', async () => {
    setPlatformOS('ios');
    let resolveShare: (() => void) | undefined;
    const stalledSharePromise = new Promise<void>((resolve) => {
      resolveShare = resolve;
    });

    mockUploadRawObservations.mockResolvedValue({
      blob: new Blob(['zip-data']),
      status: 200,
      contentType: 'application/zip',
      filename: 'processed observations.zip',
    });
    mockShareAsync.mockReturnValue(stalledSharePromise);

    mockPickerWithCsvFile();

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(screen.getByLabelText('Download ZIP')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Download ZIP'));

    await waitFor(() => {
      expect(screen.getByText('Preparing ZIP...')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Download ZIP')).toBeNull();

    await act(async () => {
      resolveShare?.();
      await stalledSharePromise;
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Download ZIP')).toBeTruthy();
    });
  });

  it('auto-imports the generated zip into the preview and downloads it on demand', async () => {
    setPlatformOS('ios');
    const generatedZip = new Blob(['zip-data'], { type: 'application/zip' });
    mockUploadRawObservations.mockResolvedValue({
      blob: generatedZip,
      status: 200,
      contentType: 'application/zip',
      filename: 'processed observations.zip',
    });

    mockPickerWithCsvFile();

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(screen.getByText('Species Environment')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Download ZIP'));

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
    expect(mockNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('falls back to FileReader when native blob lacks arrayBuffer', async () => {
    setPlatformOS('ios');
    const fallbackBytes = new Uint8Array([80, 75, 3, 4]);
    class MockFileReader {
      result: ArrayBuffer | null = null;
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      readAsArrayBuffer(_blob: Blob) {
        this.result = fallbackBytes.buffer.slice(0);
        this.onload?.();
      }
    }
    (global as { FileReader?: unknown }).FileReader = MockFileReader;

    mockUploadRawObservations.mockResolvedValue({
      blob: {
        size: fallbackBytes.byteLength,
        type: 'application/zip',
      } as Blob,
      status: 200,
      contentType: 'application/zip',
      filename: 'processed observations.zip',
    });

    mockPickerWithCsvFile();

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(screen.getByLabelText('Download ZIP')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Download ZIP'));

    await waitFor(() => {
      expect(mockShareAsync).toHaveBeenCalled();
    });
    expect(mockFileWrite).toHaveBeenCalledWith(fallbackBytes);
    expect(
      screen.getByText(
        'Processed ZIP ready to share: processed observations.zip',
      ),
    ).toBeTruthy();
  });

  it('reports a saved-local message when native sharing is unavailable', async () => {
    setPlatformOS('android');
    mockIsShareAvailableAsync.mockResolvedValue(false);
    mockUploadRawObservations.mockResolvedValue({
      blob: new Blob(['zip-data']),
      status: 200,
      contentType: 'application/zip',
      filename: 'processed observations.zip',
    });

    mockPickerWithCsvFile();

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(screen.getByLabelText('Download ZIP')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Download ZIP'));

    await waitFor(() => {
      expect(mockFileWrite).toHaveBeenCalledWith(expect.any(Uint8Array));
    });
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Processed ZIP saved to selected folder: processed observations.zip',
      ),
    ).toBeTruthy();
    expect(mockNotificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it('triggers press haptics for upload and download actions', async () => {
    setPlatformOS('ios');
    mockUploadRawObservations.mockResolvedValue({
      blob: new Blob(['zip-data']),
      status: 200,
      contentType: 'application/zip',
      filename: 'processed observations.zip',
    });

    mockPickerWithCsvFile();

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(screen.getByLabelText('Download ZIP')).toBeTruthy();
    });
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );

    fireEvent.press(screen.getByLabelText('Download ZIP'));

    await waitFor(() => {
      expect(mockShareAsync).toHaveBeenCalled();
    });
    expect(mockImpactAsync).toHaveBeenCalledTimes(2);
    expect(mockImpactAsync).toHaveBeenNthCalledWith(
      2,
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it('triggers a success haptic when the share sheet returns', async () => {
    setPlatformOS('ios');
    mockUploadRawObservations.mockResolvedValue({
      blob: new Blob(['zip-data']),
      status: 200,
      contentType: 'application/zip',
      filename: 'processed observations.zip',
    });

    mockPickerWithCsvFile();

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(screen.getByLabelText('Download ZIP')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Download ZIP'));

    await waitFor(() => {
      expect(mockShareAsync).toHaveBeenCalled();
    });

    expect(mockNotificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );

    mockShareAsync.mockRejectedValueOnce(new Error('share failed'));

    fireEvent.press(screen.getByLabelText('Download ZIP'));

    await waitFor(() => {
      expect(mockNotificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Error,
      );
    });
  });

  it('triggers a success haptic when step 1 auto-imports the processed zip', async () => {
    setPlatformOS('ios');
    const generatedZip = new Blob(['zip-data'], { type: 'application/zip' });
    mockUploadRawObservations.mockResolvedValue({
      blob: generatedZip,
      status: 200,
      contentType: 'application/zip',
      filename: 'processed observations.zip',
    });

    mockPickerWithCsvFile();

    renderUpload();

    pressUploadButton(0);

    await waitFor(() => {
      expect(screen.getByText('Species Environment')).toBeTruthy();
    });

    expect(mockNotificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });
});
