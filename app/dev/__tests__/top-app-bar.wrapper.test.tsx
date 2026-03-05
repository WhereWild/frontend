import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import TopAppBarDevScreen from '../top-app-bar.tsx';
import TopAppBarDevScreenNative from '../top-app-bar.native';

jest.mock('../top-app-bar.native', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockTopAppBarDevScreenNative = TopAppBarDevScreenNative as jest.Mock;

describe('TopAppBar dev wrapper', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    jest.replaceProperty(Platform, 'OS', originalPlatformOS);
    mockTopAppBarDevScreenNative.mockClear();
  });

  it('renders native screen on non-web platforms', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');

    render(<TopAppBarDevScreen />);

    expect(mockTopAppBarDevScreenNative).toHaveBeenCalledTimes(1);
  });

  it('throws on web platforms', () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    expect(() => render(<TopAppBarDevScreen />)).toThrow(
      'The /dev/top-app-bar route is native-only and is not supported on web.',
    );
  });
});
