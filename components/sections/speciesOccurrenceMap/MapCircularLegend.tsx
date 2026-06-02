// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { ThemedText } from '@/components/text/ThemedText';
import { ASPECT_RING_SEGMENT_COLORS, donutArcPath } from './variableColors';

const SEG_DEG = 5;

type AspectRingSvgProps = {
  /** Outer diameter of the ring in px. */
  size: number;
  /** Inner hole diameter in px. */
  holeSize: number;
  /** Hole fill color — should match the card background. */
  holeFill: string;
  /** Optional pinned bearing in degrees (0 = North, clockwise). */
  pinnedValue?: number | null;
};

/** SVG conic color ring for aspect/bearing — works identically on native and web. */
export function AspectRingSvg({
  size,
  holeSize,
  holeFill,
  pinnedValue,
}: AspectRingSvgProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2;
  const innerR = holeSize / 2;

  const needleAngleRad =
    pinnedValue != null ? ((pinnedValue - 90) * Math.PI) / 180 : null;

  return (
    <Svg width={size} height={size}>
      {ASPECT_RING_SEGMENT_COLORS.map((color, i) => (
        <Path
          key={i}
          d={donutArcPath(
            cx,
            cy,
            outerR,
            innerR,
            i * SEG_DEG,
            (i + 1) * SEG_DEG,
          )}
          fill={color}
          stroke={color}
          strokeWidth={1}
        />
      ))}
      {needleAngleRad != null && (
        <Line
          x1={cx + innerR * Math.cos(needleAngleRad)}
          y1={cy + innerR * Math.sin(needleAngleRad)}
          x2={cx + outerR * Math.cos(needleAngleRad)}
          y2={cy + outerR * Math.sin(needleAngleRad)}
          stroke='#fffffff2'
          strokeWidth={1.5}
          strokeLinecap='butt'
          strokeDasharray='4,3'
          strokeDashoffset={3}
        />
      )}
      <Circle cx={cx} cy={cy} r={innerR} fill={holeFill} />
    </Svg>
  );
}

type MapCircularLegendProps = {
  pinnedValue?: number | null;
};

export function MapCircularLegend({ pinnedValue }: MapCircularLegendProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const bg = palette.background.default.secondary;

  const RING = 56;
  const HOLE = 32;

  return (
    <View style={[styles.overlay, { backgroundColor: bg }]}>
      <ThemedText variant='bodyTiny' style={styles.cardinal}>
        N
      </ThemedText>
      <View style={styles.row}>
        <ThemedText variant='bodyTiny' style={styles.cardinal}>
          W
        </ThemedText>
        <AspectRingSvg
          size={RING}
          holeSize={HOLE}
          holeFill={bg}
          pinnedValue={pinnedValue}
        />
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
});
