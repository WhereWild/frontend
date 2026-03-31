import { useColorScheme } from '@/hooks/useColorScheme';
import { uploadRawObservations } from '@/data/api';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

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

jest.mock('expo-document-picker');
const { getDocumentAsync: mockGetDocumentAsync } = require('expo-document-picker') as {
  getDocumentAsync: jest.Mock;
};

const Upload = require('../upload').default;

jest.mock('@/data/api', () => ({
  uploadRawObservations: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockUploadRawObservations = uploadRawObservations as jest.MockedFunction<typeof uploadRawObservations>;

const originalFile = (global as { File?: unknown }).File;

describe('Upload screen', () => {
  beforeAll(() => {
    if (typeof (global as { File?: unknown }).File === 'undefined') {
      (global as { File?: unknown }).File = class MockFile {};
    }
  });

  afterAll(() => {
    (global as { File?: unknown }).File = originalFile;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('dark');
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
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

    const [stepOneUploadButton, stepTwoUploadButton] = screen.getAllByLabelText('Upload');

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
    let resolveUpload: ((value: Awaited<ReturnType<typeof uploadRawObservations>>) => void) | undefined;
    const stalledUploadPromise = new Promise<Awaited<ReturnType<typeof uploadRawObservations>>>((resolve) => {
      resolveUpload = resolve;
    });
    mockUploadRawObservations.mockReturnValue(stalledUploadPromise);

    const fileForUpload = new File(['lat,lon\n1,2'], 'observations.csv', { type: 'text/csv' });
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file://observations.csv',
          name: 'observations.csv',
          mimeType: 'text/csv',
          file: fileForUpload,
        },
      ],
    });

    render(<Upload />);

    const [stepOneUploadButton] = screen.getAllByLabelText('Upload');
    fireEvent.press(stepOneUploadButton);

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
  });
});