// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Size } from '@/constants/theme';
import type { SpeciesEnvironmentDensity } from '@/data/types';
import React from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { ThemedText } from '@/components/text/ThemedText';
import { buildDensitySamples } from './densityChartUtils';
import { useScrollLock } from '@/context/ScrollLockContext';
import type { DensitySelectionRange } from './model';

const CHART_SIZE = 260;
const CX = CHART_SIZE / 2;
const CY = CHART_SIZE / 2;
const INNER_RADIUS = 14;
const MAX_RADIUS = 104;
const LABEL_RADIUS = 120;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Maps (aspect degrees, radius) → SVG (x, y).
 * Aspect: 0° = North, 90° = East, clockwise.
 * SVG: 0° = right — so svgAngle = aspectDeg - 90.
 */
const toSvgPoint = (aspectDeg: number, r: number) => {
  const rad = toRad(aspectDeg - 90);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
};

/** Converts a touch position (relative to the chart view) to a compass bearing 0–360. */
const touchToDeg = (x: number, y: number): number =>
  ((Math.atan2(y - CY, x - CX) * 180) / Math.PI + 90 + 360) % 360;

/**
 * Builds a donut-sector arc path clockwise from startDeg to endDeg.
 * Handles wrap (start > end means the arc passes through 0°/North).
 */
const buildSelectionArcPath = (startDeg: number, endDeg: number): string => {
  const span = (endDeg - startDeg + 360) % 360;
  if (span <= 0) return '';
  const largeArc = span > 180 ? 1 : 0;
  const outerStart = toSvgPoint(startDeg, MAX_RADIUS);
  const outerEnd = toSvgPoint(endDeg, MAX_RADIUS);
  const innerStart = toSvgPoint(startDeg, INNER_RADIUS);
  const innerEnd = toSvgPoint(endDeg, INNER_RADIUS);
  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${MAX_RADIUS} ${MAX_RADIUS} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    'Z',
  ].join(' ');
};

/** Reference rings at 25/50/75/100% of MAX_RADIUS. */
const RING_FRACTIONS = [0.25, 0.5, 0.75, 1];

const CARDINALS = [
  { label: 'N', deg: 0 },
  { label: 'E', deg: 90 },
  { label: 'S', deg: 180 },
  { label: 'W', deg: 270 },
];

type PolarDensityChartProps = {
  /** KDE density curve for a 0–360° circular variable. */
  curve: SpeciesEnvironmentDensity | null | undefined;
  /** Fill color for the density area. */
  fillColor: string;
  /** Stroke color for the density outline. */
  lineColor: string;
  /** Color for guide rings, axis lines, and labels. */
  guideColor: string;
  /** Current arc selection in degrees, if any. */
  selection?: DensitySelectionRange | null;
  /** Called with an arc range (degrees) when the user drags, or null to clear. */
  onSelectionChange?: (range: DensitySelectionRange | null) => void;
  /** Bearing (0–360°) of a pinned observation to highlight. */
  pinValue?: number | null;
  /** Whether the pin value is still loading. */
  pinLoading?: boolean;
  /** Circular mean bearing (0–360°) to render as a reference line. */
  circularMean?: number | null;
};

/** Renders a circular KDE for a 0–360° directional variable with arc selection. */
export function PolarDensityChart({
  curve,
  fillColor,
  lineColor,
  guideColor,
  selection,
  onSelectionChange,
  pinValue,
  pinLoading,
  circularMean,
}: PolarDensityChartProps) {
  const samples = React.useMemo(() => buildDensitySamples(curve), [curve]);
  const dragOrigin = React.useRef<number | null>(null);
  const hasDragged = React.useRef(false);
  const { lockScroll, unlockScroll } = useScrollLock();

  const handleTouchStart = React.useCallback(
    (e: GestureResponderEvent) => {
      lockScroll();
      dragOrigin.current = touchToDeg(
        e.nativeEvent.locationX,
        e.nativeEvent.locationY,
      );
      hasDragged.current = false;
    },
    [lockScroll],
  );

  const handleTouchMove = React.useCallback(
    (e: GestureResponderEvent) => {
      if (dragOrigin.current === null) return;
      hasDragged.current = true;
      const currentDeg = touchToDeg(
        e.nativeEvent.locationX,
        e.nativeEvent.locationY,
      );
      onSelectionChange?.({ start: dragOrigin.current, end: currentDeg });
    },
    [onSelectionChange],
  );

  const handleTouchEnd = React.useCallback(() => {
    unlockScroll();
    if (!hasDragged.current) {
      onSelectionChange?.(null);
    }
    dragOrigin.current = null;
    hasDragged.current = false;
  }, [unlockScroll, onSelectionChange]);

  if (!samples.length) {
    return (
      <View style={styles.empty}>
        <ThemedText variant='bodySmall'>Density curve unavailable.</ThemedText>
      </View>
    );
  }

  const maxDensity = Math.max(...samples.map((s) => s.y));
  if (!maxDensity) {
    return (
      <View style={styles.empty}>
        <ThemedText variant='bodySmall'>Density curve unavailable.</ThemedText>
      </View>
    );
  }

  const toRadius = (density: number) =>
    INNER_RADIUS + (density / maxDensity) * (MAX_RADIUS - INNER_RADIUS);

  const pathCommands = samples.map((sample, index) => {
    const { x, y } = toSvgPoint(sample.x, toRadius(sample.y));
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  });
  pathCommands.push('Z');
  const densityPath = pathCommands.join(' ');

  const selectionPath =
    selection != null
      ? buildSelectionArcPath(selection.start, selection.end)
      : null;

  const pinPoint =
    pinValue != null && !pinLoading
      ? {
          inner: toSvgPoint(pinValue, INNER_RADIUS),
          outer: toSvgPoint(pinValue, MAX_RADIUS),
          label: toSvgPoint(pinValue, LABEL_RADIUS),
        }
      : null;

  const meanPoint =
    circularMean != null
      ? {
          inner: toSvgPoint(circularMean, INNER_RADIUS),
          outer: toSvgPoint(circularMean, MAX_RADIUS),
          label: toSvgPoint(circularMean, LABEL_RADIUS),
        }
      : null;

  return (
    <View
      style={styles.wrapper}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleTouchStart}
      onResponderMove={handleTouchMove}
      onResponderRelease={handleTouchEnd}
      onResponderTerminate={handleTouchEnd}
    >
      <Svg
        width={CHART_SIZE}
        height={CHART_SIZE}
        viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
      >
        {/* Reference rings */}
        {RING_FRACTIONS.map((fraction) => (
          <Circle
            key={fraction}
            cx={CX}
            cy={CY}
            r={INNER_RADIUS + fraction * (MAX_RADIUS - INNER_RADIUS)}
            fill='none'
            stroke={guideColor}
            strokeWidth={0.5}
            opacity={0.2}
          />
        ))}

        {/* Cardinal axis lines */}
        {[0, 90].map((deg) => {
          const p1 = toSvgPoint(deg, MAX_RADIUS);
          const p2 = toSvgPoint(deg + 180, MAX_RADIUS);
          return (
            <Line
              key={deg}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={guideColor}
              strokeWidth={0.5}
              opacity={0.2}
            />
          );
        })}

        {/* Selection arc */}
        {selectionPath ? (
          <Path d={selectionPath} fill={lineColor} opacity={0.35} />
        ) : null}

        {/* Density fill */}
        <Path d={densityPath} fill={fillColor} opacity={0.35} />

        {/* Density stroke */}
        <Path
          d={densityPath}
          fill='none'
          stroke={lineColor}
          strokeWidth={1.5}
        />

        {/* Circular mean radial line */}
        {meanPoint ? (
          <>
            <Line
              x1={meanPoint.inner.x}
              y1={meanPoint.inner.y}
              x2={meanPoint.outer.x}
              y2={meanPoint.outer.y}
              stroke={guideColor}
              strokeWidth={1.5}
              strokeDasharray='4 3'
              pointerEvents='none'
            />
            <SvgText
              x={meanPoint.label.x}
              y={meanPoint.label.y}
              textAnchor='middle'
              alignmentBaseline='middle'
              fontSize={10}
              fill={guideColor}
              opacity={0.85}
              pointerEvents='none'
            >
              {`${Math.round(circularMean!)}°`}
            </SvgText>
          </>
        ) : null}

        {/* Inner baseline ring */}
        <Circle
          cx={CX}
          cy={CY}
          r={INNER_RADIUS}
          fill='none'
          stroke={guideColor}
          strokeWidth={1}
          opacity={0.4}
        />

        {/* Pin radial line for selected observation bearing */}
        {pinPoint ? (
          <>
            <Line
              x1={pinPoint.inner.x}
              y1={pinPoint.inner.y}
              x2={pinPoint.outer.x}
              y2={pinPoint.outer.y}
              stroke='#F59E0B'
              strokeWidth={2}
              strokeDasharray='4 3'
              pointerEvents='none'
            />
            <SvgText
              x={pinPoint.label.x}
              y={pinPoint.label.y}
              textAnchor='middle'
              alignmentBaseline='middle'
              fontSize={10}
              fill='#F59E0B'
              fontWeight='bold'
              pointerEvents='none'
            >
              {`${Math.round(pinValue!)}°`}
            </SvgText>
          </>
        ) : null}

        {/* Cardinal labels — hidden when pin or mean is within 5° to avoid overlap */}
        {CARDINALS.map(({ label, deg }) => {
          if (pinPoint != null) {
            const diff = Math.abs(((pinValue! - deg + 540) % 360) - 180);
            if (diff <= 5) return null;
          }
          if (meanPoint != null) {
            const diff = Math.abs(((circularMean! - deg + 540) % 360) - 180);
            if (diff <= 5) return null;
          }
          const { x, y } = toSvgPoint(deg, LABEL_RADIUS);
          return (
            <SvgText
              key={label}
              x={x}
              y={y}
              textAnchor='middle'
              alignmentBaseline='middle'
              fontSize={11}
              fill={guideColor}
              opacity={0.7}
              pointerEvents='none'
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: Size.space['200'],
    width: CHART_SIZE,
    alignSelf: 'center',
    userSelect: 'none',
  },
  empty: {
    height: CHART_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
