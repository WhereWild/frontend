import type { SpeciesEnvironmentDensity, SpeciesEnvironmentSummary } from '@/data/types';
import React from 'react';
import { LayoutChangeEvent, GestureResponderEvent, StyleSheet, View } from 'react-native';
import Svg, { Path, Defs, ClipPath, Rect } from 'react-native-svg';
import { Size } from '@/constants/theme';
import { ThemedText } from '@/components/text/ThemedText';
import { formatValue } from './model';
import {
  buildDensitySamples,
  getDensityDomain,
  getSelectionBounds,
  getValueForLocation as mapLocationXToValue,
  normalizeDensitySamples,
  toSortedSelectionRange,
} from './densityChartUtils';

const CHART_PADDING = Size.space['200'];
const CHART_HEIGHT = 240;
const MEAN_LABEL_HALF_WIDTH = 24;
const PIN_LABEL_HALF_WIDTH = 36;

type ClipPathWithUnitsProps = React.ComponentProps<typeof ClipPath> & {
  clipPathUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
};

const ClipPathWithUnits = ClipPath as React.ComponentType<ClipPathWithUnitsProps>;

/** Selected value range on the density curve. */
type DensitySelectionRange = {
  start: number;
  end: number;
};

/** Props for rendering interactive density distribution chart. */
type DensityChartProps = {
  /** Density curve points and values. */
  curve: SpeciesEnvironmentDensity | null | undefined;
  /** Stroke color for the density line. */
  lineColor: string;
  /** Fill color for the density area. */
  fillColor: string;
  /** Baseline and axis stroke color. */
  baselineColor: string;
  /** Summary values used for min/mean/max markers. */
  summary?: SpeciesEnvironmentSummary | null;
  /** Current selected drag range, if any. */
  selection?: DensitySelectionRange | null;
  /** Called when drag selection changes or clears. */
  onSelectionChange?: (range: DensitySelectionRange | null) => void;
  pinValue?: number | null;
  pinLoading?: boolean;
};

/** Displays an interactive density chart with draggable range selection. */
export function DensityChart({
  curve,
  lineColor,
  fillColor,
  baselineColor,
  summary,
  selection,
  onSelectionChange,
  pinValue,
  pinLoading,
}: DensityChartProps) {
  const [chartWidth, setChartWidth] = React.useState(0);
  const dragOrigin = React.useRef<number | null>(null);
  const dragValue = React.useRef<number | null>(null);
  const hasDragged = React.useRef(false);
  const samples = React.useMemo(() => buildDensitySamples(curve), [curve]);
  const hasCurveData = samples.length > 0;
  const densityDomain = React.useMemo(() => getDensityDomain(samples), [samples]);
  const normalized = React.useMemo(
    () => normalizeDensitySamples(samples, densityDomain, CHART_HEIGHT, CHART_PADDING),
    [densityDomain, samples],
  );
  const rawId = React.useId();
  const clipId = React.useMemo(
    () => `densitySelection-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [rawId],
  );

  const selectionBounds = React.useMemo(() => {
    return getSelectionBounds(selection, densityDomain);
  }, [selection, densityDomain]);

  const getValueForLocation = React.useCallback(
    (x: number) => {
      return mapLocationXToValue(x, chartWidth, densityDomain);
    },
    [chartWidth, densityDomain],
  );

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  }, []);

  const handleSelectionStart = React.useCallback(
    (event: GestureResponderEvent) => {
      const value = getValueForLocation(event.nativeEvent.locationX);
      if (value === null) {
        return;
      }
      dragOrigin.current = value;
      dragValue.current = value;
      hasDragged.current = false;
    },
    [getValueForLocation],
  );

  const handleSelectionMove = React.useCallback(
    (event: GestureResponderEvent) => {
      if (dragOrigin.current === null) {
        return;
      }
      const value = getValueForLocation(event.nativeEvent.locationX);
      if (value === null) {
        return;
      }
      dragValue.current = value;
      hasDragged.current = true;
      onSelectionChange?.(toSortedSelectionRange(dragOrigin.current, value));
    },
    [getValueForLocation, onSelectionChange],
  );

  const handleSelectionEnd = React.useCallback(
    (event?: GestureResponderEvent) => {
      if (dragOrigin.current === null) {
        onSelectionChange?.(null);
        return;
      }
      const value =
        event && Number.isFinite(event.nativeEvent.locationX)
          ? getValueForLocation(event.nativeEvent.locationX)
          : dragValue.current ?? dragOrigin.current;
      if (value !== null) {
        dragValue.current = value;
      }
      if (!hasDragged.current || value === null) {
        onSelectionChange?.(null);
      } else {
        onSelectionChange?.(toSortedSelectionRange(dragOrigin.current, value));
      }
      dragOrigin.current = null;
      dragValue.current = null;
      hasDragged.current = false;
    },
    [getValueForLocation, onSelectionChange],
  );

  const handleSelectionTerminate = React.useCallback(() => {
    if (dragOrigin.current === null) {
      onSelectionChange?.(null);
      return;
    }

    const value = dragValue.current ?? dragOrigin.current;

    if (!hasDragged.current || value === null) {
      onSelectionChange?.(null);
    } else {
      onSelectionChange?.(toSortedSelectionRange(dragOrigin.current, value));
    }

    dragOrigin.current = null;
    dragValue.current = null;
    hasDragged.current = false;
  }, [onSelectionChange]);

  const shouldSetSelectionResponder = () => {
    return true;
  };

  const shouldKeepSelectionResponder = () => {
    return dragOrigin.current !== null;
  };

  const shouldAllowSelectionTermination = () => {
    return dragOrigin.current === null || !hasDragged.current;
  };

  const meanPosition =
    summary?.mean != null
      ? ((summary.mean - densityDomain.minX) / densityDomain.spanX) * 100
      : null;
  const pinPosition =
    pinValue != null && !pinLoading && densityDomain.spanX > 0
      ? ((pinValue - densityDomain.minX) / densityDomain.spanX) * 100
      : null;

  // Nudge mean and pin labels apart if they overlap. Hide pin label if it
  // gets too close to the fixed min/max labels. All calculations in pixels.
  const { meanLeft, pinLeft, pinLabelVisible } = React.useMemo(() => {
    if (chartWidth === 0) {
      return { meanLeft: meanPosition, pinLeft: pinPosition, pinLabelVisible: true };
    }

    const gap = 4; // minimum pixel gap between label edges
    const meanHalf = MEAN_LABEL_HALF_WIDTH;
    const pinHalf = PIN_LABEL_HALF_WIDTH;
    const MIN_LABEL_WIDTH = MEAN_LABEL_HALF_WIDTH * 2;
    const MAX_LABEL_WIDTH = MEAN_LABEL_HALF_WIDTH * 2;

    // Start with raw pixel centers.
    let meanCenter = meanPosition != null ? (meanPosition / 100) * chartWidth : null;
    let pinCenter = pinPosition != null ? (pinPosition / 100) * chartWidth : null;

    // Hide pin label if it overlaps min or max labels.
    let pinLabelVisible = true;
    if (pinCenter != null) {
      const pinLeftEdge = pinCenter - pinHalf;
      const pinRightEdge = pinCenter + pinHalf;
      if (summary?.min != null && pinLeftEdge < MIN_LABEL_WIDTH + gap) {
        pinLabelVisible = false;
      }
      if (summary?.max != null && pinRightEdge > chartWidth - MAX_LABEL_WIDTH - gap) {
        pinLabelVisible = false;
      }
    }

    // Nudge mean and pin apart symmetrically.
    if (meanCenter != null && pinCenter != null) {
      const overlap = meanHalf + pinHalf + gap - Math.abs(meanCenter - pinCenter);
      if (overlap > 0) {
        const shift = overlap / 2;
        const direction = meanCenter <= pinCenter ? -1 : 1;
        meanCenter = meanCenter + direction * shift;
        pinCenter = pinCenter - direction * shift;
      }
    }

    return {
      meanLeft: meanCenter != null ? (meanCenter / chartWidth) * 100 : meanPosition,
      pinLeft: pinCenter != null ? (pinCenter / chartWidth) * 100 : pinPosition,
      pinLabelVisible,
    };
  }, [meanPosition, pinPosition, chartWidth, summary?.min, summary?.max]);

  if (!hasCurveData || !normalized.length) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant="bodySmall">Density curve unavailable.</ThemedText>
      </View>
    );
  }

  const start = normalized[0];
  const end = normalized[normalized.length - 1];
  const linePath = normalized.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaSegments = normalized.slice(1).map(({ x, y }) => `L${x},${y}`);
  const areaPath = [`M${start.x},${CHART_HEIGHT}`, `L${start.x},${start.y}`, ...areaSegments, `L${end.x},${CHART_HEIGHT}`, 'Z'].join(' ');

  return (
    <View style={styles.chartWrapper}>
      <View testID="density-chart-surface" style={styles.chartSurface} onLayout={handleLayout}>
        <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 100 ${CHART_HEIGHT}`} preserveAspectRatio="none">
          <Defs>
            {selectionBounds ? (
              <ClipPathWithUnits id={clipId} clipPathUnits="userSpaceOnUse">
                <Rect x={selectionBounds.left} y={0} width={selectionBounds.width} height={CHART_HEIGHT} />
              </ClipPathWithUnits>
            ) : null}
          </Defs>
          <Path d={areaPath} fill={fillColor} opacity={0.3} />
          {selectionBounds ? (
            <Path d={areaPath} fill={fillColor} opacity={0.6} clipPath={`url(#${clipId})`} />
          ) : null}
          <Path
            d={`M${start.x},0 L${end.x},0 L${end.x},${CHART_HEIGHT} L${start.x},${CHART_HEIGHT} Z`}
            fill="none"
            stroke={baselineColor}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {meanPosition != null && Number.isFinite(meanPosition) ? (
            <Path
              d={`M${meanPosition},0 L${meanPosition},${CHART_HEIGHT}`}
              fill="none"
              stroke={baselineColor}
              strokeWidth={1}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {pinPosition != null && Number.isFinite(pinPosition) ? (
            <Path
              d={`M${pinPosition},0 L${pinPosition},${CHART_HEIGHT}`}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <Path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </Svg>
        <View
          collapsable={false}
          testID="density-chart-responder"
          style={styles.chartResponder}
          onStartShouldSetResponder={shouldSetSelectionResponder}
          onStartShouldSetResponderCapture={shouldSetSelectionResponder}
          onMoveShouldSetResponder={shouldKeepSelectionResponder}
          onMoveShouldSetResponderCapture={shouldKeepSelectionResponder}
          onResponderGrant={handleSelectionStart}
          onResponderMove={handleSelectionMove}
          onResponderRelease={handleSelectionEnd}
          onResponderTerminationRequest={shouldAllowSelectionTermination}
          onResponderTerminate={handleSelectionTerminate}
        />
      </View>
      <View style={styles.chartLabels}>
        {summary?.min != null && (
          <View style={styles.minLabelContainer}>
            <ThemedText variant="bodySmall">{formatValue(summary.min, 1)}</ThemedText>
            <ThemedText variant="bodySmall">min</ThemedText>
          </View>
        )}
        {meanLeft != null && Number.isFinite(meanLeft) ? (
          <View
            style={{
              ...styles.meanLabelContainer,
              left: `${meanLeft}%`,
              marginLeft: -MEAN_LABEL_HALF_WIDTH,
            }}
          >
            <ThemedText variant="bodySmall">{formatValue(summary?.mean, 1)}</ThemedText>
            <ThemedText variant="bodySmall">mean</ThemedText>
          </View>
        ) : null}
        {pinLeft != null && Number.isFinite(pinLeft) && pinLabelVisible ? (
          <View
            style={{
              ...styles.meanLabelContainer,
              left: `${pinLeft}%`,
              marginLeft: -PIN_LABEL_HALF_WIDTH,
              width: PIN_LABEL_HALF_WIDTH * 2,
            }}
          >
            <ThemedText variant="bodySmall">{formatValue(pinValue, 1)}</ThemedText>
            <ThemedText variant="bodySmall">Selected</ThemedText>
          </View>
        ) : null}
        {summary?.max != null && (
          <View style={styles.maxLabelContainer}>
            <ThemedText variant="bodySmall">{formatValue(summary.max, 1)}</ThemedText>
            <ThemedText variant="bodySmall">max</ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrapper: {
    gap: Size.space['200'],
    paddingTop: Size.space['100'],
  },
  chartSurface: {
    position: 'relative',
    height: CHART_HEIGHT,
  },
  chartResponder: {
    ...StyleSheet.absoluteFillObject,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: Size.space['800'],
  },
  minLabelContainer: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
    gap: 0,
  },
  meanLabelContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 0,
    width: MEAN_LABEL_HALF_WIDTH * 2,
  },
  maxLabelContainer: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
    gap: 0,
  },
  emptyChart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});