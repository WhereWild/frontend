// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Haptics from 'expo-haptics';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import {
  initializeUploadTestState,
  makeFile,
  mockBuildDataSource,
  mockNotificationAsync,
  mockNormalize,
  mockParseZip,
  mockPickerWithZipFile,
  pressUploadButton,
  renderUpload,
  restoreUploadTestGlobals,
  restoreUploadTestState,
} from '../../test-utils/uploadTestUtils';

describe('Upload screen step 2', () => {
  let consoleErrorSpy: jest.SpyInstance;

  afterAll(() => {
    restoreUploadTestGlobals();
  });

  beforeEach(() => {
    consoleErrorSpy = initializeUploadTestState();
  });

  afterEach(() => {
    restoreUploadTestState(consoleErrorSpy);
  });

  it('processes zip file and displays preview on success', async () => {
    const zipFile = makeFile('PK...', 'data.zip', 'application/zip');
    mockPickerWithZipFile({ file: zipFile });

    renderUpload();

    pressUploadButton(1);

    await waitFor(() => {
      expect(mockParseZip).toHaveBeenCalledWith(zipFile);
    });

    await waitFor(() => {
      expect(screen.getByText('Species Environment')).toBeTruthy();
    });
    expect(screen.getByText('Map links false')).toBeTruthy();

    expect(mockNotificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it('forwards uploaded map pin selections into environment highlighting', async () => {
    const zipFile = makeFile('PK...', 'data.zip', 'application/zip');
    mockPickerWithZipFile({ file: zipFile });

    renderUpload();

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
    expect(screen.getByTestId('mock-selected-point').props.children).toBe(
      '10,20',
    );
  });

  it('shows a non-fatal warning when uploaded categorical keys cannot support highlighting', async () => {
    mockNormalize.mockReturnValue({
      categoricalStats: [],
      ordinalStats: [],
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
    });

    const zipFile = makeFile('PK...', 'data.zip', 'application/zip');
    mockPickerWithZipFile({ file: zipFile });

    renderUpload();

    pressUploadButton(1);

    await waitFor(() => {
      expect(
        screen.getByText(/categorical highlighting may be unavailable/i),
      ).toBeTruthy();
    });
  });

  it('processes a URI-backed zip asset on native platforms', async () => {
    const zipBlob = new Blob(['PK...'], { type: 'application/zip' });

    global.fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue(zipBlob),
    }) as unknown as typeof fetch;

    mockPickerWithZipFile({
      uri: 'file://native-data.zip',
      name: 'native-data.zip',
    });

    renderUpload();

    pressUploadButton(1);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('file://native-data.zip');
    });
    await waitFor(() => {
      expect(mockParseZip).toHaveBeenCalledWith(zipBlob);
    });
  });

  it('falls back to XMLHttpRequest when fetching a URI-backed zip fails', async () => {
    const zipBlob = new Blob(['PK...'], { type: 'application/zip' });

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

    mockPickerWithZipFile({
      uri: 'file://native-fallback.zip',
      name: 'native-fallback.zip',
    });

    renderUpload();

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

  it('shows loading state while processing zip file', async () => {
    const stalledParsePromise = new Promise(() => undefined);
    mockParseZip.mockReturnValue(stalledParsePromise as never);

    const zipFile = makeFile('PK...', 'data.zip', 'application/zip');
    mockPickerWithZipFile({ file: zipFile });

    renderUpload();

    pressUploadButton(1);

    await waitFor(() => {
      expect(screen.getByText('Importing ZIP...')).toBeTruthy();
    });

    expect(screen.getAllByLabelText('Upload')).toHaveLength(1);
  });

  it('displays error message when zip parsing fails', async () => {
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

    renderUpload();

    pressUploadButton(1);

    await waitFor(() => {
      expect(screen.getByText(/Failed to parse upload zip/)).toBeTruthy();
    });

    expect(mockNormalize).not.toHaveBeenCalled();
    expect(mockBuildDataSource).not.toHaveBeenCalled();
    expect(mockNotificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error,
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('displays validation error when bundle is invalid', async () => {
    mockParseZip.mockResolvedValue({
      categoricalStats: [],
      densityGraph: [],
      occurrences: [],
      occurrenceIndex: [],
      summaryStats: [],
    } as never);
    mockNormalize.mockImplementation(() => {
      throw new Error(
        'Uploaded parquet bundle is invalid: occurrence did not produce any valid rows',
      );
    });

    const zipFile = makeFile('PK...', 'data.zip', 'application/zip');
    mockPickerWithZipFile({ file: zipFile });

    renderUpload();

    pressUploadButton(1);

    await waitFor(() => {
      expect(
        screen.getByText(/Uploaded parquet bundle is invalid/),
      ).toBeTruthy();
    });

    expect(mockBuildDataSource).not.toHaveBeenCalled();
    expect(mockNotificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error,
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
