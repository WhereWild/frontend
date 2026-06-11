// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { ThemedText } from '@/components/text/ThemedText';
import { CIRCULAR_COLORMAPS, donutArcPath } from './variableColors';
import { ShapeMarker } from './ShapeMarker';
import type { ShapeKey } from './cbColors';

const RING = 56;
const HOLE = 32;
const SEG_DEG = 5;
const OUTER_R = RING / 2;
const INNER_R = HOLE / 2;

const NSWE_ENTRIES: { dir: string; shape: ShapeKey }[] = [
  { dir: 'N', shape: 'triangle' },
  { dir: 'E', shape: 'arrow' },
  { dir: 'S', shape: 'triangle-down' },
  { dir: 'W', shape: 'diamond' },
];

type AspectRingSvgProps = {
  size: number;
  arcSegmentColors: string[];
  holeFill: string;
  pinnedValue?: number | null;
};

function AspectRingSvg({
  size,
  arcSegmentColors,
  holeFill,
  pinnedValue,
}: AspectRingSvgProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2;
  const innerR = outerR * (INNER_R / OUTER_R);

  return (
    <Svg width={size} height={size}>
      {arcSegmentColors.map((color, i) => (
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
        />
      ))}
      <Circle cx={cx} cy={cy} r={innerR} fill={holeFill} />
      {pinnedValue != null && (
        <Line
          x1={cx}
          y1={cy - outerR}
          x2={cx}
          y2={cy - innerR - 1}
          stroke='#fffffff2'
          strokeWidth={2}
          transform={`rotate(${pinnedValue}, ${cx}, ${cy})`}
        />
      )}
    </Svg>
  );
}

type MapCircularLegendProps = {
  pinnedValue?: number | null;
  conicCss?: string;
  arcSegmentColors?: string[];
  shapesEnabled?: boolean;
  markerOutlineEnabled?: boolean;
  nsweColors?: [string, string, string, string];
};

const DEFAULT_CONIC_CSS = CIRCULAR_COLORMAPS['twilight_90'].conicCss;
const DEFAULT_ARC_SEGMENT_COLORS =
  CIRCULAR_COLORMAPS['twilight_90'].arcSegmentColors;

export function MapCircularLegend({
  pinnedValue,
  conicCss,
  arcSegmentColors,
  shapesEnabled = false,
  markerOutlineEnabled = false,
  nsweColors,
}: MapCircularLegendProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const bg = palette.background.default.secondary;

  const activeArcColors = arcSegmentColors ?? DEFAULT_ARC_SEGMENT_COLORS;

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
            <>
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    borderRadius: RING / 2,
                    backgroundImage: conicCss ?? DEFAULT_CONIC_CSS,
                  } as object,
                ]}
              />
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
              {pinnedValue != null && (
                <View
                  style={[
                    styles.needle,
                    { transform: `rotate(${pinnedValue}deg)` } as object,
                  ]}
                />
              )}
            </>
          ) : (
            <AspectRingSvg
              size={RING}
              arcSegmentColors={activeArcColors}
              holeFill={bg}
              pinnedValue={pinnedValue}
            />
          )}
        </View>
        <ThemedText variant='bodyTiny' style={styles.cardinal}>
          E
        </ThemedText>
      </View>
      <ThemedText variant='bodyTiny' style={styles.cardinal}>
        S
      </ThemedText>
      {shapesEnabled && (
        <View style={styles.nsweGrid}>
          {NSWE_ENTRIES.map(({ dir, shape }, i) => (
            <View key={dir} style={styles.nsweItem}>
              <ShapeMarker
                shape={shape}
                color={nsweColors ? nsweColors[i] : '#888888'}
                size={10}
                outline={markerOutlineEnabled}
              />
              <ThemedText variant='bodyTiny' style={styles.nsweLabel}>
                {dir}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
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
  nsweGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 56,
    gap: 4,
    justifyContent: 'space-between',
  },
  nsweItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    width: 24,
  },
  nsweLabel: {
    opacity: 0.85,
  },
});
