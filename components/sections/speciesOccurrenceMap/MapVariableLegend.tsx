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
import { useLegendRangeDrag, type LegendRange } from './legendRangeSelection';

const BAR_WIDTH = 12;
const DEFAULT_SVG_STOPS = COLORMAPS.viridis.barSvgStops;
/** Dims everything outside a drag-selected sub-range, so the selected slice
 * of the gradient reads as "still active" against the rest. */
const DIM_OVERLAY_FILL = '#00000066';

type GradientBarProps = {
  width?: number;
  height: number;
  stops: { offset: string; color: string }[];
  pinFraction?: number | null;
  /** [0,1] fractions (0 = max/top) bounding the drag-selected sub-range. */
  selectionFractions?: { top: number; bottom: number } | null;
};

function GradientBar({
  width = BAR_WIDTH,
  height,
  stops,
  pinFraction,
  selectionFractions,
}: GradientBarProps) {
  const pinY = pinFraction != null ? Math.round(pinFraction * height) : null;
  const selTopY = selectionFractions
    ? Math.round(selectionFractions.top * height)
    : null;
  const selBottomY = selectionFractions
    ? Math.round(selectionFractions.bottom * height)
    : null;
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
      {selTopY != null && selBottomY != null && (
        <>
          {selTopY > 0 && (
            <Rect
              x={0}
              y={0}
              width={width}
              height={selTopY}
              fill={DIM_OVERLAY_FILL}
            />
          )}
          {selBottomY < height && (
            <Rect
              x={0}
              y={selBottomY}
              width={width}
              height={height - selBottomY}
              fill={DIM_OVERLAY_FILL}
            />
          )}
        </>
      )}
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
  /** Drag-selected value range, filtering which pixels render on the map. */
  selectedRange?: LegendRange | null;
  onRangeChange?: (range: LegendRange | null) => void;
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
  selectedRange,
  onRangeChange,
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

  // Top of the bar is `max`, bottom is `min` — mirrors pinFraction's mapping.
  const locationToValue = React.useCallback(
    (_locationX: number, locationY: number) => {
      if (!barHeight || max <= min) {
        return null;
      }
      const fraction = Math.max(0, Math.min(1, locationY / barHeight));
      return max - fraction * (max - min);
    },
    [barHeight, min, max],
  );

  const responderHandlers = useLegendRangeDrag(
    locationToValue,
    (start, end) =>
      onRangeChange?.({ min: Math.min(start, end), max: Math.max(start, end) }),
    () => onRangeChange?.(null),
  );

  const selectionFractions =
    selectedRange && max > min
      ? {
          top: Math.max(
            0,
            Math.min(1, (max - selectedRange.max) / (max - min)),
          ),
          bottom: Math.max(
            0,
            Math.min(1, (max - selectedRange.min) / (max - min)),
          ),
        }
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
      <View
        testID='map-variable-legend-bar-row'
        style={styles.barRow}
        onLayout={(e) => setBarHeight(Math.round(e.nativeEvent.layout.height))}
      >
        <View
          testID='map-variable-legend-bar'
          style={styles.barContainer}
          {...(onRangeChange ? responderHandlers : null)}
        >
          {barHeight > 0 && (
            <GradientBar
              height={barHeight}
              stops={activeStops}
              pinFraction={pinFraction}
              selectionFractions={selectionFractions}
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
      {selectedRange ? (
        <View style={styles.selectedRangeStack}>
          <ThemedText
            variant='bodyTiny'
            style={[
              styles.selectedRange,
              { color: palette.text.default.tertiary },
            ]}
          >
            {fmt(selectedRange.min)}
          </ThemedText>
          <ThemedText
            variant='bodyTiny'
            style={[
              styles.selectedRange,
              { color: palette.text.default.tertiary },
            ]}
          >
            to
          </ThemedText>
          <ThemedText
            variant='bodyTiny'
            style={[
              styles.selectedRange,
              { color: palette.text.default.tertiary },
            ]}
          >
            {fmt(selectedRange.max)}
          </ThemedText>
        </View>
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
    pointerEvents: 'box-none',
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
  selectedRangeStack: {
    alignItems: 'center',
  },
  selectedRange: {
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 11,
  },
});
