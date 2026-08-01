// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Size } from '@/constants/theme';
import type { SpeciesEnvironmentDensity } from '@/data/types';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { ThemedText } from '@/components/text/ThemedText';
import { buildDensitySamples } from './densityChartUtils';
import { useScrollLock } from '@/context/ScrollLockContext';
import type { DensitySelectionRange } from './model';
import {
  useCircularDragSelection,
  circularRangeSpan,
  FULL_CIRCLE_SPAN_THRESHOLD,
  type CircularDragRange,
} from '@/hooks/useCircularDragSelection';

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

/**
 * Full-donut SVG path: outer circle CW + inner circle CCW.
 * Nonzero winding makes the inner region transparent, matching the arc donut shape.
 */
const FULL_DONUT_PATH = [
  `M ${CX} ${CY - MAX_RADIUS}`,
  `A ${MAX_RADIUS} ${MAX_RADIUS} 0 1 1 ${CX} ${CY + MAX_RADIUS}`,
  `A ${MAX_RADIUS} ${MAX_RADIUS} 0 1 1 ${CX} ${CY - MAX_RADIUS}`,
  `M ${CX} ${CY - INNER_RADIUS}`,
  `A ${INNER_RADIUS} ${INNER_RADIUS} 0 1 0 ${CX} ${CY + INNER_RADIUS}`,
  `A ${INNER_RADIUS} ${INNER_RADIUS} 0 1 0 ${CX} ${CY - INNER_RADIUS}`,
  'Z',
].join(' ');

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
  /** Currently selected arc(s) in degrees. */
  selections: DensitySelectionRange[];
  /** Called with an arc range (degrees) when the user drags, or null to
   * clear. `options.additive` (shift/cmd-drag — NOT ctrl, which
   * react-native-web's GestureResponder system blocks from starting any
   * drag at all; see useAdditiveModifierRef) adds the range to whatever's
   * already selected instead of replacing it. */
  onSelectionChange?: (
    range: DensitySelectionRange | null,
    options?: { additive?: boolean; sessionId?: number; final?: boolean },
  ) => void;
  /** Bearing (0–360°) of a pinned observation to highlight. */
  pinValue?: number | null;
  /** Whether the pin value is still loading. */
  pinLoading?: boolean;
  /** Bearing (0–360°) of the home location to highlight. */
  homePinValue?: number | null;
  /** Whether the home pin value is still loading. */
  homePinLoading?: boolean;
  /** Color for the home pin line and label. */
  homePinColor?: string;
  /** Circular mean bearing (0–360°) to render as a reference line. */
  circularMean?: number | null;
};

/** Renders a circular KDE for a 0–360° directional variable with arc selection. */
export function PolarDensityChart({
  curve,
  fillColor,
  lineColor,
  guideColor,
  selections,
  onSelectionChange,
  pinValue,
  pinLoading,
  homePinValue,
  homePinLoading,
  homePinColor = '#466237',
  circularMean,
}: PolarDensityChartProps) {
  const samples = React.useMemo(() => buildDensitySamples(curve), [curve]);
  const { lockScroll, unlockScroll } = useScrollLock();
  const wrapperRef = React.useRef<View>(null);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !onSelectionChange) return;

    const styleEl = document.createElement('style');
    styleEl.textContent =
      '[data-testid="polar-density-chart-responder"] { touch-action: none !important; }';
    document.head.appendChild(styleEl);

    const onDocPointerDown = (e: PointerEvent) => {
      const responder = document.querySelector(
        '[data-testid="polar-density-chart-responder"]',
      );
      if (
        responder &&
        (e.target === responder || responder.contains(e.target as Node))
      ) {
        responder.setPointerCapture(e.pointerId);
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown, {
      capture: true,
    });

    return () => {
      styleEl.remove();
      document.removeEventListener('pointerdown', onDocPointerDown, {
        capture: true,
      });
    };
  }, [onSelectionChange]);

  const handleRangeChange = React.useCallback(
    (range: CircularDragRange | null, options?: { additive?: boolean }) =>
      onSelectionChange?.(range, options),
    [onSelectionChange],
  );
  const responderHandlers = useCircularDragSelection({
    center: { cx: CX, cy: CY },
    onRangeChange: handleRangeChange,
    onDragStart: lockScroll,
    onDragEnd: unlockScroll,
  });

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

  const selectionArcs = selections
    .map((selection) => {
      const span = circularRangeSpan(selection);
      const isFullCircle = span >= FULL_CIRCLE_SPAN_THRESHOLD;
      return {
        isFullCircle,
        path: isFullCircle
          ? null
          : buildSelectionArcPath(selection.start, selection.end),
      };
    })
    .filter((arc) => arc.isFullCircle || arc.path);
  const hasFullCircleSelection = selectionArcs.some((arc) => arc.isFullCircle);

  const pinPoint =
    pinValue != null && !pinLoading
      ? {
          inner: toSvgPoint(pinValue, INNER_RADIUS),
          outer: toSvgPoint(pinValue, MAX_RADIUS),
          label: toSvgPoint(pinValue, LABEL_RADIUS),
        }
      : null;

  const homePinPoint =
    homePinValue != null && !homePinLoading
      ? {
          inner: toSvgPoint(homePinValue, INNER_RADIUS),
          outer: toSvgPoint(homePinValue, MAX_RADIUS),
          label: toSvgPoint(homePinValue, LABEL_RADIUS),
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
      ref={wrapperRef}
      testID='polar-density-chart-responder'
      style={styles.wrapper}
      {...responderHandlers}
      // A shift-drag would otherwise start the browser's native "extend
      // text selection" gesture — blocking mousedown's default (web-only
      // prop passed through by View; not in its RN type, hence the cast)
      // means no selection anchor is ever placed here.
      {...({
        onMouseDown: (event: { preventDefault?: () => void }) => {
          event?.preventDefault?.();
        },
      } as Record<string, unknown>)}
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

        {/* Selection arc(s) — or a full donut ring when any span ≥ 358° */}
        {hasFullCircleSelection ? (
          <Path d={FULL_DONUT_PATH} fill={lineColor} opacity={0.35} />
        ) : (
          selectionArcs.map((arc, index) =>
            arc.path ? (
              <Path key={index} d={arc.path} fill={lineColor} opacity={0.35} />
            ) : null,
          )
        )}

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

        {/* Home pin radial line for saved home location bearing */}
        {homePinPoint ? (
          <>
            <Line
              x1={homePinPoint.inner.x}
              y1={homePinPoint.inner.y}
              x2={homePinPoint.outer.x}
              y2={homePinPoint.outer.y}
              stroke={homePinColor}
              strokeWidth={2}
              strokeDasharray='4 3'
              pointerEvents='none'
            />
            <SvgText
              x={homePinPoint.label.x}
              y={homePinPoint.label.y}
              textAnchor='middle'
              alignmentBaseline='middle'
              fontSize={10}
              fill={homePinColor}
              fontWeight='bold'
              pointerEvents='none'
            >
              {`${Math.round(homePinValue!)}°`}
            </SvgText>
          </>
        ) : null}

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

        {/* Cardinal labels — hidden when pin, home pin, or mean is within 5° to avoid overlap */}
        {CARDINALS.map(({ label, deg }) => {
          if (pinPoint != null) {
            const diff = Math.abs(((pinValue! - deg + 540) % 360) - 180);
            if (diff <= 5) return null;
          }
          if (homePinPoint != null) {
            const diff = Math.abs(((homePinValue! - deg + 540) % 360) - 180);
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
