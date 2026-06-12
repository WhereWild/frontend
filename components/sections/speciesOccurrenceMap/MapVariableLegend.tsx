// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Line, Rect, Stop } from 'react-native-svg';
import { ThemedText } from '@/components/text/ThemedText';
import { COLORMAPS } from './variableColors';

const BAR_WIDTH = 12;
const DEFAULT_SVG_STOPS = COLORMAPS.viridis.barSvgStops;

type GradientBarProps = {
  width?: number;
  height: number;
  stops: { offset: string; color: string }[];
  pinFraction?: number | null;
};

function GradientBar({
  width = BAR_WIDTH,
  height,
  stops,
  pinFraction,
}: GradientBarProps) {
  const pinY = pinFraction != null ? Math.round(pinFraction * height) : null;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id='grad' x1='0' y1='0' x2='0' y2='1'>
          {stops.map(({ offset, color }) => (
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
      />
      {pinY != null && (
        <Line
          x1={-2}
          y1={pinY}
          x2={width + 2}
          y2={pinY}
          stroke='#fffffff2'
          strokeWidth={1.5}
          strokeDasharray='3,2'
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
  barSvgStops?: { offset: string; color: string }[];
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
  barSvgStops,
}: MapVariableLegendProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [barHeight, setBarHeight] = React.useState(0);

  const pinFraction =
    pinnedValue != null && max > min
      ? Math.max(0, Math.min(1, (max - pinnedValue) / (max - min)))
      : null;

  const activeStops = barSvgStops ?? DEFAULT_SVG_STOPS;

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
      <View
        style={styles.barRow}
        onLayout={(e) => setBarHeight(Math.round(e.nativeEvent.layout.height))}
      >
        <View style={styles.barContainer}>
          {barHeight > 0 && (
            <GradientBar
              height={barHeight}
              stops={activeStops}
              pinFraction={pinFraction}
            />
          )}
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
