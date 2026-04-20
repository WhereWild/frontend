import React from 'react';
import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import Upload from '../upload';

const mockWebMetadata = jest.fn();

jest.mock('@/components/upload/UploadScreen', () => ({
  UploadScreen: () => {
    const ReactActual = jest.requireActual('react');
    const { View } = jest.requireActual('react-native');

    return ReactActual.createElement(View, { testID: 'upload-screen' });
  },
}));

jest.mock('@/utils/webMetadata', () => ({
  WebMetadata: (props: Record<string, unknown>) => {
    mockWebMetadata(props);
    const ReactActual = jest.requireActual('react');
    const { View } = jest.requireActual('react-native');

    return ReactActual.createElement(View, { testID: 'web-metadata' });
  },
}));

describe('Upload route', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    mockWebMetadata.mockReset();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  it('renders web metadata on web', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });

    render(<Upload />);

    expect(screen.getByTestId('upload-screen')).toBeTruthy();
    expect(screen.getByTestId('web-metadata')).toBeTruthy();
    expect(mockWebMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'WhereWild | Upload',
        description:
          'Upload your own coordinate data to analyze it with WhereWild.',
        path: '/upload',
      }),
    );
  });

  it('omits web metadata on native', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });

    render(<Upload />);

    expect(screen.getByTestId('upload-screen')).toBeTruthy();
    expect(screen.queryByTestId('web-metadata')).toBeNull();
    expect(mockWebMetadata).not.toHaveBeenCalled();
  });
});
