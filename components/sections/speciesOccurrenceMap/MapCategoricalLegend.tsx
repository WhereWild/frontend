import type { LegendClass } from '@/data/types';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';

type MapCategoricalLegendProps = {
  classes: LegendClass[];
};

export function MapCategoricalLegend({ classes }: MapCategoricalLegendProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  if (classes.length === 0) return null;

  return (
    <View
      style={[
        styles.overlay,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      <ScrollView
        scrollEnabled={false}
        style={styles.scroll}
        contentContainerStyle={styles.list}
      >
        {classes.map((cls) => (
          <View key={cls.id} style={styles.row}>
            <View
              style={[styles.dot, { backgroundColor: cls.color ?? '#888888' }]}
            />
            <ThemedText
              variant='bodyTiny'
              numberOfLines={1}
              style={styles.label}
            >
              {cls.name}
            </ThemedText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 8,
    top: 82,
    bottom: 10,
    zIndex: 1000,
    borderRadius: Size.radius['400'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['200'],
    maxWidth: 140,
    pointerEvents: 'none',
  },
  scroll: {
    flex: 1,
  },
  list: {
    gap: Size.space['100'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['100'],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  label: {
    flex: 1,
  },
});
