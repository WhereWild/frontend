// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
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
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const assetSource = getAssetSourceForDimensions(source);
  const asset = assetSource ? Asset.fromModule(assetSource) : null;
  // This only reads dimensions from sources expo-asset can resolve synchronously.
  const aspectRatio =
    asset?.width && asset.height ? asset.width / asset.height : 1;

  return (
    // A screenshot's own background often nearly matches the page's (most
    // of these are dark-mode UI captures on an already-dark page) — with
    // nothing marking where the page ends and the image begins, content
    // and screenshot visually run together. The card behind it (background
    // + border) gives every image a visible edge regardless of what's in
    // the image itself.
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.background.default.secondary,
          borderColor: palette.border.default.secondary,
        },
        style,
      ]}
    >
      <View
        testID='content-image-frame'
        style={[styles.frame, { aspectRatio }]}
      >
        <Image
          source={source}
          style={styles.image}
          resizeMode='contain'
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignSelf: 'center',
    padding: Size.space['200'],
    borderRadius: Size.radius['200'],
    borderWidth: Size.stroke.border,
  },
  frame: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: Size.radius['100'],
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
