import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { TopAppBar } from '../TopAppBar.tsx';
import { TopAppBar as TopAppBarNative } from '../TopAppBar.native';

jest.mock('../TopAppBar.native', () => ({
  TopAppBar: jest.fn(() => null),
}));

const mockTopAppBarNative = TopAppBarNative as jest.Mock;

describe('TopAppBar wrapper', () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    jest.replaceProperty(Platform, 'OS', originalPlatformOS);
    mockTopAppBarNative.mockClear();
  });

  it('forwards props to native implementation on non-web platforms', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');

    render(
      <TopAppBar
        variant='home'
        title='WhereWild'
        logoSource={require('@/assets/images/wherewild.png')}
        logoAccessibilityLabel='WhereWild logo'
      />,
    );

    expect(mockTopAppBarNative).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'home',
        title: 'WhereWild',
        logoAccessibilityLabel: 'WhereWild logo',
      }),
      undefined,
    );
  });

  it('throws on web platforms', () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    expect(() =>
      render(
        <TopAppBar
          variant='home'
          title='WhereWild'
          logoSource={require('@/assets/images/wherewild.png')}
          logoAccessibilityLabel='WhereWild logo'
        />,
      ),
    ).toThrow('TopAppBar is native-only and is not supported on web.');
  });
});
