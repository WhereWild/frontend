import { Size } from '@/constants/theme';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '../text/ThemedText';
import { SpeciesOccurrenceMap } from './SpeciesOccurrenceMap';

const MAP_HEIGHT = 640;

const CONUS_MIN_ZOOM = 5;
const CONUS_MAX_ZOOM = 9;
const CONUS_INITIAL_LAT = 39.5;
const CONUS_INITIAL_LON = -98.35;
const CONUS_INITIAL_ZOOM = 4;
const CONUS_MAX_BOUNDS: [[number, number], [number, number]] = [
  [22.0, -135.0],
  [55.0, -60.0],
];

export type LocalMapSectionProps = {
  heatmapTileUrl?: string | null;
  showHeading?: boolean;
  onBoundsChange?: (bounds: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  }) => void;
  style?: StyleProp<ViewStyle>;
};

export function LocalMapSection({
  heatmapTileUrl = null,
  showHeading = true,
  onBoundsChange,
  style,
}: LocalMapSectionProps) {
  return (
    <View style={[styles.section, style]}>
      {showHeading ? (
        <ThemedText variant='heading'>Local Map</ThemedText>
      ) : null}
      <SpeciesOccurrenceMap
        occurrences={[]}
        heatmapTileUrl={heatmapTileUrl}
        heatmapOpacity={0.7}
        showMarkers={false}
        height={MAP_HEIGHT}
        minZoom={CONUS_MIN_ZOOM}
        maxZoom={CONUS_MAX_ZOOM}
        initialLat={CONUS_INITIAL_LAT}
        initialLon={CONUS_INITIAL_LON}
        initialZoom={CONUS_INITIAL_ZOOM}
        maxBounds={CONUS_MAX_BOUNDS}
        onBoundsChange={onBoundsChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Size.space['400'],
    width: '100%',
  },
});
