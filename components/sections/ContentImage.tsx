import { Asset } from 'expo-asset';
import React from 'react';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';

export type ContentImageProps = {
  source: ImageSourcePropType;
  label: string;
  style?: StyleProp<ViewStyle>;
};

function getAssetSourceForDimensions(source: ImageSourcePropType) {
  if (typeof source === 'number' || typeof source === 'string') {
    return source;
  }

  if (
    source &&
    !Array.isArray(source) &&
    typeof source.uri === 'string' &&
    typeof source.width === 'number' &&
    typeof source.height === 'number'
  ) {
    return {
      uri: source.uri,
      width: source.width,
      height: source.height,
    };
  }

  return null;
}

export function ContentImage({ source, label, style }: ContentImageProps) {
  const assetSource = getAssetSourceForDimensions(source);
  const asset = assetSource ? Asset.fromModule(assetSource) : null;
  // This only reads dimensions from sources expo-asset can resolve synchronously.
  const aspectRatio =
    asset?.width && asset.height ? asset.width / asset.height : 1;

  return (
    <View style={[styles.frame, { aspectRatio }, style]}>
      <Image
        source={source}
        style={styles.image}
        resizeMode='contain'
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
