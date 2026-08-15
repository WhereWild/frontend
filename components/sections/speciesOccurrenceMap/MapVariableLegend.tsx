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
import type { LegendRange } from './legendRangeSelection';
import { useLinearLegendDragSelection } from './useLinearLegendDragSelection';

const BAR_WIDTH = 12;
const DEFAULT_SVG_STOPS = COLORMAPS.viridis.barSvgStops;
/** Dims everything outside the union of the drag-selected sub-ranges, so
 * the selected slices of the gradient read as "still active" against the
 * rest. */
const DIM_OVERLAY_FILL = '#00000066';

/** [0,1] fraction pair (0 = max/top of the bar) bounding one selected band. */
type SelectionBand = { top: number; bottom: number };

type GradientBarProps = {
  width?: number;
  height: number;
  stops: { offset: string; color: string }[];
  pinFraction?: number | null;
  /** Sorted ascending by `top` — non-overlapping, since callers merge
   * overlapping ranges before this point (see rangeMerge's mergeRanges). */
  selectionBands?: SelectionBand[] | null;
};

function GradientBar({
  width = BAR_WIDTH,
  height,
  stops,
  pinFraction,
  selectionBands,
}: GradientBarProps) {
  const pinY = pinFraction != null ? Math.round(pinFraction * height) : null;
  // Dim rects fill the gaps between selected bands — before the first,
  // between consecutive ones, and after the last — rather than one top/
  // bottom pair, so any number of disjoint selections dims correctly.
  const dimRects: { y: number; h: number }[] = [];
  if (selectionBands && selectionBands.length > 0) {
    let cursor = 0;
    for (const band of selectionBands) {
      const bandTop = Math.round(band.top * height);
      const bandBottom = Math.round(band.bottom * height);
      if (bandTop > cursor) {
        dimRects.push({ y: cursor, h: bandTop - cursor });
      }
      cursor = Math.max(cursor, bandBottom);
    }
    if (cursor < height) {
      dimRects.push({ y: cursor, h: height - cursor });
    }
  }
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
      {dimRects.map(
        (rect, i) =>
          rect.h > 0 && (
            <Rect
              key={i}
              x={0}
              y={rect.y}
              width={width}
              height={rect.h}
              fill={DIM_OVERLAY_FILL}
            />
          ),
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
  /** Drag-selected value ranges, filtering which pixels render on the map —
   * multiple disjoint ranges can be active at once (shift/cmd-drag, or a
   * ~500ms long-press-to-arm, adds a range instead of replacing the
   * selection; see useLinearLegendDragSelection). */
  selectedRanges?: LegendRange[];
  onRangeChange?: (
    range: LegendRange | null,
    options?: { additive?: boolean; sessionId?: number; final?: boolean },
  ) => void;
  /** Forces every drag to be additive with no long-press wait — see
   * useLinearLegendDragSelection's own doc comment on why (mobile
   * touchscreen long-press-to-arm reliability). */
  forceAdditive?: boolean;
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
  selectedRanges,
  onRangeChange,
  forceAdditive = false,
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

  const handleRangeChange = React.useCallback(
    (
      range: { start: number; end: number } | null,
      options?: { additive?: boolean; sessionId?: number; final?: boolean },
    ) => {
      onRangeChange?.(
        range ? { min: range.start, max: range.end } : null,
        options,
      );
    },
    [onRangeChange],
  );

  const responderHandlers = useLinearLegendDragSelection({
    locationToValue,
    onRangeChange: handleRangeChange,
    webTestID: 'map-variable-legend-bar',
    forceAdditive,
  });

  const selectionBands: SelectionBand[] | null =
    selectedRanges && selectedRanges.length > 0 && max > min
      ? selectedRanges
          .map((range) => ({
            top: Math.max(0, Math.min(1, (max - range.max) / (max - min))),
            bottom: Math.max(0, Math.min(1, (max - range.min) / (max - min))),
          }))
          .sort((a, b) => a.top - b.top)
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
              selectionBands={selectionBands}
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
    // Clears the map's native bottom-left attribution/scale-bar row (see
    // SpeciesOccurrenceMap.html/SpeciesOccurrenceGlobeMap.html) instead of
    // running the gradient bar underneath it.
    bottom: 40,
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
});
