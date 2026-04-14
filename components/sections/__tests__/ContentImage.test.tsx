import { render } from '@testing-library/react-native';
import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';
import { ContentImage } from '../ContentImage';

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(),
  },
}));

const mockFromModule = Asset.fromModule as jest.MockedFunction<
  typeof Asset.fromModule
>;

describe('ContentImage', () => {
  beforeEach(() => {
    mockFromModule.mockReset();
  });

  it('uses the asset dimensions to set the frame aspect ratio', () => {
    mockFromModule.mockReturnValue({ width: 300, height: 150 } as never);

    const { UNSAFE_getByType } = render(
      <ContentImage source={1} label='Example content image' />,
    );

    const frame = UNSAFE_getByType(View);
    const image = UNSAFE_getByType(Image);
    const frameStyle = StyleSheet.flatten(frame.props.style);
    const imageStyle = StyleSheet.flatten(image.props.style);

    expect(mockFromModule).toHaveBeenCalledWith(1);
    expect(frameStyle.aspectRatio).toBe(2);
    expect(image.props.accessibilityLabel).toBe('Example content image');
    expect(imageStyle.width).toBe('100%');
    expect(imageStyle.height).toBe('100%');
  });

  it('falls back to a square frame when asset dimensions are missing', () => {
    mockFromModule.mockReturnValue({
      width: undefined,
      height: undefined,
    } as never);

    const { UNSAFE_getByType } = render(
      <ContentImage source={2} label='Fallback content image' />,
    );

    const frame = UNSAFE_getByType(View);
    const frameStyle = StyleSheet.flatten(frame.props.style);

    expect(frameStyle.aspectRatio).toBe(1);
  });

  it('resolves string-based sources through expo-asset', () => {
    mockFromModule.mockReturnValue({ width: 120, height: 60 } as never);
    const stringSource =
      'https://example.com/content-image.png' as unknown as ImageSourcePropType;

    const { UNSAFE_getByType } = render(
      <ContentImage source={stringSource} label='Remote content image' />,
    );

    const frame = UNSAFE_getByType(View);
    const frameStyle = StyleSheet.flatten(frame.props.style);

    expect(mockFromModule).toHaveBeenCalledWith(stringSource);
    expect(frameStyle.aspectRatio).toBe(2);
  });

  it('uses uri sources with explicit dimensions to compute aspect ratio', () => {
    mockFromModule.mockReturnValue({ width: 90, height: 30 } as never);

    const source = {
      uri: 'https://example.com/content-image.png',
      width: 90,
      height: 30,
    } as const;

    const { UNSAFE_getByType } = render(
      <ContentImage source={source} label='Dimensioned URI content image' />,
    );

    const frame = UNSAFE_getByType(View);
    const frameStyle = StyleSheet.flatten(frame.props.style);

    expect(mockFromModule).toHaveBeenCalledWith(source);
    expect(frameStyle.aspectRatio).toBe(3);
  });

  it('falls back without calling expo-asset for unsupported source arrays', () => {
    const { UNSAFE_getByType } = render(
      <ContentImage
        source={[
          { uri: 'https://example.com/1.png' },
          { uri: 'https://example.com/2.png' },
        ]}
        label='Array content image'
      />,
    );

    const frame = UNSAFE_getByType(View);
    const frameStyle = StyleSheet.flatten(frame.props.style);

    expect(mockFromModule).not.toHaveBeenCalled();
    expect(frameStyle.aspectRatio).toBe(1);
  });
});
