import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';

const GRADIENT_CSS =
  'linear-gradient(to bottom, rgb(230,57,70), rgb(246,190,0), rgb(59,170,165), rgb(34,94,168), rgb(28,38,102))';
const GRADIENT_COLORS = [
  'rgb(230,57,70)',
  'rgb(246,190,0)',
  'rgb(59,170,165)',
  'rgb(34,94,168)',
  'rgb(28,38,102)',
];

type MapVariableLegendProps = {
  min: number;
  max: number;
  units?: string | null;
  pinnedValue?: number | null;
};

function fmt(v: number): string {
  return Math.abs(v) >= 1000
    ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function MapVariableLegend({
  min,
  max,
  units,
  pinnedValue,
}: MapVariableLegendProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const pinFraction =
    pinnedValue != null && max > min
      ? Math.max(0, Math.min(1, (max - pinnedValue) / (max - min)))
      : null;

  return (
    <View
      pointerEvents='none'
      style={[
        styles.overlay,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      <ThemedText variant='bodyTiny' style={styles.label}>
        {fmt(max)}
      </ThemedText>
      <View style={styles.barRow}>
        <View style={styles.barContainer}>
          {Platform.OS === 'web' ? (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { borderRadius: 4, backgroundImage: GRADIENT_CSS } as object,
              ]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { borderRadius: 4, overflow: 'hidden' },
              ]}
            >
              {GRADIENT_COLORS.map((color, i) => (
                <View
                  key={i}
                  style={[styles.segment, { backgroundColor: color }]}
                />
              ))}
            </View>
          )}
          {pinFraction != null && (
            <View
              pointerEvents='none'
              style={[
                styles.pinLine,
                {
                  top: `${Math.round(pinFraction * 100)}%` as unknown as number,
                },
                Platform.OS === 'web'
                  ? ({ borderTopStyle: 'dashed' } as object)
                  : {},
              ]}
            />
          )}
        </View>
        {pinFraction != null && (
          <View style={styles.pinLabelContainer}>
            <ThemedText
              variant='bodyTiny'
              numberOfLines={1}
              style={[
                styles.pinLabel,
                {
                  top: `${Math.round(pinFraction * 100)}%` as unknown as number,
                },
              ]}
            >
              {fmt(pinnedValue!)}
            </ThemedText>
          </View>
        )}
      </View>
      <ThemedText variant='bodyTiny' style={styles.label}>
        {fmt(min)}
      </ThemedText>
      {units ? (
        <ThemedText variant='bodyTiny' style={styles.units}>
          {units}
        </ThemedText>
      ) : null}
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
    alignItems: 'center',
    gap: Size.space['100'],
  },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  barContainer: {
    width: 12,
    position: 'relative',
  },
  segment: {
    flex: 1,
    width: 12,
  },
  pinLine: {
    position: 'absolute',
    left: -2,
    right: -2,
    height: 0,
    borderTopWidth: 1.5,
    borderTopColor: '#fffffff2',
  },
  pinLabelContainer: {
    flex: 1,
    position: 'relative',
    marginLeft: 4,
  },
  pinLabel: {
    position: 'absolute',
    color: '#fffffff2',
    transform: [{ translateY: -6 }],
  },
  label: {
    textAlign: 'center',
  },
  units: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
