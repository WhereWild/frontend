// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Line } from 'react-native-svg';
import { ThemedText } from '@/components/text/ThemedText';
import { VIRIDIS_STOPS } from './variableColors';

const BAR_WIDTH = 12;

type ViridisBarProps = {
  width?: number;
  height: number;
  /** 0 = top of bar, 1 = bottom — position for the dashed pin line. */
  pinFraction?: number | null;
};

/** Viridis gradient bar rendered via SVG — smooth on all platforms. */
export function ViridisBar({
  width = BAR_WIDTH,
  height,
  pinFraction,
}: ViridisBarProps) {
  const pinY = pinFraction != null ? Math.round(pinFraction * height) : null;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id='grad' x1='0' y1='0' x2='0' y2='1'>
          {VIRIDIS_STOPS.map(({ offset, color }) => (
            <Stop key={offset} offset={offset} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill='url(#grad)'
        rx={4}
        ry={4}
      />
      {pinY != null && (
        <Line
          x1={0}
          y1={pinY}
          x2={width}
          y2={pinY}
          stroke='#fffffff2'
          strokeWidth={1.5}
          strokeDasharray='4,3'
          strokeDashoffset={3}
        />
      )}
    </Svg>
  );
}

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
  const [barHeight, setBarHeight] = React.useState(0);

  const pinFraction =
    pinnedValue != null && max > min
      ? Math.max(0, Math.min(1, (max - pinnedValue) / (max - min)))
      : null;

  return (
    <View
      style={[
        styles.overlay,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      <ThemedText variant='bodyTiny' style={styles.label}>
        {fmt(max)}
      </ThemedText>
      <View style={styles.barRow}>
        <View
          style={styles.barContainer}
          onLayout={(e) =>
            setBarHeight(Math.max(1, e.nativeEvent.layout.height))
          }
        >
          <ViridisBar
            width={BAR_WIDTH}
            height={Math.max(1, barHeight)}
            pinFraction={barHeight > 0 ? pinFraction : null}
          />
        </View>
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
    pointerEvents: 'none',
  },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  barContainer: {
    width: BAR_WIDTH,
  },
  label: {
    textAlign: 'center',
  },
  units: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
