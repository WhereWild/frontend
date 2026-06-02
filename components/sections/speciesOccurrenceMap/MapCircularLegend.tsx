import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { ASPECT_CONIC_CSS, ASPECT_NATIVE_COLOR } from './variableColors';

const RING = 56;
const HOLE = 32;

type MapCircularLegendProps = {
  pinnedValue?: number | null;
};

export function MapCircularLegend({ pinnedValue }: MapCircularLegendProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const bg = palette.background.default.secondary;

  return (
    <View style={[styles.overlay, { backgroundColor: bg }]}>
      <ThemedText variant='bodyTiny' style={styles.cardinal}>
        N
      </ThemedText>
      <View style={styles.row}>
        <ThemedText variant='bodyTiny' style={styles.cardinal}>
          W
        </ThemedText>
        <View style={{ position: 'relative', width: RING, height: RING }}>
          {Platform.OS === 'web' ? (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  borderRadius: RING / 2,
                  backgroundImage: ASPECT_CONIC_CSS,
                } as object,
              ]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  borderRadius: RING / 2,
                  backgroundColor: ASPECT_NATIVE_COLOR,
                },
              ]}
            />
          )}
          {pinnedValue != null && Platform.OS === 'web' && (
            <View
              style={[
                styles.needle,
                { transform: `rotate(${pinnedValue}deg)` } as object,
              ]}
            />
          )}
          {pinnedValue != null && Platform.OS !== 'web' && (
            <View
              style={[
                styles.needle,
                {
                  transform: [
                    { translateY: RING / 4 },
                    { rotate: `${pinnedValue}deg` },
                    { translateY: -(RING / 4) },
                  ],
                },
              ]}
            />
          )}
          <View
            style={[
              styles.hole,
              {
                width: HOLE,
                height: HOLE,
                borderRadius: HOLE / 2,
                backgroundColor: bg,
              },
            ]}
          />
        </View>
        <ThemedText variant='bodyTiny' style={styles.cardinal}>
          E
        </ThemedText>
      </View>
      <ThemedText variant='bodyTiny' style={styles.cardinal}>
        S
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 8,
    top: 82,
    zIndex: 1000,
    borderRadius: Size.radius['400'],
    padding: Size.space['200'],
    alignItems: 'center',
    gap: 2,
    pointerEvents: 'none',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardinal: {
    textAlign: 'center',
    opacity: 0.85,
  },
  needle: {
    position: 'absolute',
    width: 2,
    height: RING / 2,
    left: RING / 2 - 1,
    top: 0,
    backgroundColor: '#fffffff2',
    opacity: 0.9,
    transformOrigin: 'center bottom',
  } as object,
  hole: {
    position: 'absolute',
    top: (RING - HOLE) / 2,
    left: (RING - HOLE) / 2,
  },
});
