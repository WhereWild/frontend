import { Size } from '@/constants/theme';
import React from 'react';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';
import { ThemedText } from '../text/ThemedText';

const MAP_HEIGHT = 640;

export type LocalMapSectionProps = {
  heatmapImage: ImageSourcePropType;
  controlsImage: ImageSourcePropType;
  showHeading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function LocalMapSection({
  heatmapImage,
  controlsImage,
  showHeading = true,
  style,
}: LocalMapSectionProps) {
  return (
    <View style={[styles.section, style]}>
      {showHeading ? <ThemedText variant="heading">Local Map</ThemedText> : null}

      <View style={styles.mapContainer}>
        <Image source={heatmapImage} style={styles.mapImage} resizeMode="cover" />
        <Image source={controlsImage} style={styles.mapControls} resizeMode="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Size.space['400'],
    width: '100%',
  },
  mapContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: MAP_HEIGHT,
  },
  mapControls: {
    position: 'absolute',
    top: Size.space['200'],
    left: Size.space['200'],
    width: 26,
    height: 52,
  },
});