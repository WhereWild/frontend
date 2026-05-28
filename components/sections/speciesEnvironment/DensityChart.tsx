import type {
  SpeciesEnvironmentDensity,
  SpeciesEnvironmentSummary,
} from '@/data/types';
import React from 'react';
import {
  Image,
  LayoutChangeEvent,
  GestureResponderEvent,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Path, Defs, ClipPath, Rect } from 'react-native-svg';
import { Colors, Size } from '@/constants/theme';
import { ThemedText } from '@/components/text/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { formatValue } from './model';
import {
  buildDensitySamples,
  getDensityDomain,
  getSelectionBounds,
  getValueForLocation as mapLocationXToValue,
  normalizeDensitySamples,
  resampleHistogram,
  toSortedSelectionRange,
} from './densityChartUtils';

const CHART_PADDING = Size.space['200'];
const CHART_HEIGHT = 240;
const MIN_BAR_PX = 28;
const MAX_HISTOGRAM_BARS = 40;
const MEAN_LABEL_HALF_WIDTH = 24;
const PIN_LABEL_HALF_WIDTH = 36;
const PIN_IMAGE_WIDTH = 22;
const PIN_IMAGE_HEIGHT = 29;
const PIN_IMAGE = require('@/assets/images/wherewild.png');

type ClipPathWithUnitsProps = React.ComponentProps<typeof ClipPath> & {
  clipPathUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
};

const ClipPathWithUnits =
  ClipPath as React.ComponentType<ClipPathWithUnitsProps>;

/** Selected value range on the density curve. */
type DensitySelectionRange = {
  start: number;
  end: number;
  displayStart?: number;
  displayEnd?: number;
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
  /** When true, renders as a discrete histogram (bar chart) instead of a smooth KDE curve. */
  isDiscrete?: boolean;
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
  isDiscrete = false,
}: DensityChartProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [chartWidth, setChartWidth] = React.useState(0);
  const dragOrigin = React.useRef<number | null>(null);
  const dragValue = React.useRef<number | null>(null);
  const hasDragged = React.useRef(false);
  const rawSamples = React.useMemo(() => buildDensitySamples(curve), [curve]);
  const samples = React.useMemo(() => {
    if (!isDiscrete) return rawSamples;
    const effectiveWidth = chartWidth > 0 ? chartWidth : 360;
    const maxBars = Math.min(
      MAX_HISTOGRAM_BARS,
      Math.max(1, Math.floor(effectiveWidth / MIN_BAR_PX)),
    );
    return resampleHistogram(rawSamples, maxBars);
  }, [isDiscrete, rawSamples, chartWidth]);
  const hasCurveData = samples.length > 0;
  const densityDomain = React.useMemo(
    () => getDensityDomain(samples),
    [samples],
  );
  const normalized = React.useMemo(
    () =>
      normalizeDensitySamples(
        samples,
        densityDomain,
        CHART_HEIGHT,
        CHART_PADDING,
      ),
    [densityDomain, samples],
  );
  const discreteBars = React.useMemo(() => {
    if (!isDiscrete || normalized.length === 0) return null;
    const barWidth = 100 / normalized.length;
    const domainStep =
      samples.length > 1
        ? (samples[samples.length - 1].x - samples[0].x) / (samples.length - 1)
        : densityDomain.spanX;
    const domainHw = domainStep / 2;
    const last = normalized.length - 1;
    return normalized.map(({ y }, i) => {
      const left = i * barWidth;
      const right = i === last ? 100 : (i + 1) * barWidth;
      return {
        path: `M${left},${CHART_HEIGHT} L${left},${y} L${right},${y} L${right},${CHART_HEIGHT} Z`,
        domainStart: samples[i].x - domainHw,
        domainEnd: samples[i].x + domainHw,
      };
    });
  }, [isDiscrete, normalized, samples, densityDomain.spanX]);

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

  const getBarIndexForLocation = React.useCallback(
    (locationX: number): number | null => {
      if (!isDiscrete || !chartWidth || normalized.length === 0) return null;
      const xPct =
        (Math.min(Math.max(locationX, 0), chartWidth) / chartWidth) * 100;
      const barWidth = 100 / normalized.length;
      return Math.min(Math.floor(xPct / barWidth), normalized.length - 1);
    },
    [isDiscrete, chartWidth, normalized],
  );

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  }, []);

  const handleSelectionStart = React.useCallback(
    (event: GestureResponderEvent) => {
      hasDragged.current = false;
      if (isDiscrete) {
        dragOrigin.current = getBarIndexForLocation(
          event.nativeEvent.locationX,
        );
        return;
      }
      const value = getValueForLocation(event.nativeEvent.locationX);
      if (value === null) return;
      dragOrigin.current = value;
      dragValue.current = value;
    },
    [isDiscrete, getBarIndexForLocation, getValueForLocation],
  );

  const handleSelectionMove = React.useCallback(
    (event: GestureResponderEvent) => {
      if (dragOrigin.current === null) return;
      hasDragged.current = true;
      if (isDiscrete) {
        return;
      }
      const value = getValueForLocation(event.nativeEvent.locationX);
      if (value === null) return;
      dragValue.current = value;
      onSelectionChange?.(toSortedSelectionRange(dragOrigin.current, value));
    },
    [isDiscrete, getValueForLocation, onSelectionChange],
  );

  const handleSelectionEnd = React.useCallback(
    (event?: GestureResponderEvent) => {
      if (isDiscrete) {
        const idx = event
          ? getBarIndexForLocation(event.nativeEvent.locationX)
          : (dragOrigin.current as number | null);
        dragOrigin.current = null;
        hasDragged.current = false;
        if (idx !== null && discreteBars?.[idx]) {
          const bar = discreteBars[idx];
          const sample = samples[idx];
          onSelectionChange?.({
            start: bar.domainStart,
            end: bar.domainEnd,
            ...(sample.rangeStart != null && sample.rangeEnd != null
              ? { displayStart: sample.rangeStart, displayEnd: sample.rangeEnd }
              : {}),
          });
        }
        return;
      }
      if (dragOrigin.current === null) {
        onSelectionChange?.(null);
        return;
      }
      const value =
        event && Number.isFinite(event.nativeEvent.locationX)
          ? getValueForLocation(event.nativeEvent.locationX)
          : (dragValue.current ?? dragOrigin.current);
      if (value !== null) dragValue.current = value;
      if (!hasDragged.current || value === null) {
        onSelectionChange?.(null);
      } else {
        onSelectionChange?.(toSortedSelectionRange(dragOrigin.current, value));
      }
      dragOrigin.current = null;
      dragValue.current = null;
      hasDragged.current = false;
    },
    [
      isDiscrete,
      getBarIndexForLocation,
      discreteBars,
      samples,
      getValueForLocation,
      onSelectionChange,
    ],
  );

  const handleSelectionTerminate = React.useCallback(() => {
    if (isDiscrete) {
      dragOrigin.current = null;
      hasDragged.current = false;
      return;
    }
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
  }, [isDiscrete, onSelectionChange]);

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
  const pinRawPosition =
    pinValue != null && !pinLoading && densityDomain.spanX > 0
      ? ((pinValue - densityDomain.minX) / densityDomain.spanX) * 100
      : null;
  const pinIsOutsideRange =
    pinValue != null &&
    !pinLoading &&
    (summary?.min != null || summary?.max != null
      ? (summary.min != null && pinValue < summary.min) ||
        (summary.max != null && pinValue > summary.max)
      : pinRawPosition != null &&
        Number.isFinite(pinRawPosition) &&
        (pinRawPosition < 0 || pinRawPosition > 100));
  const pinIsBelowRange =
    pinIsOutsideRange &&
    (summary?.min != null
      ? pinValue! < summary.min
      : (pinRawPosition ?? 0) < 0);
  const pinBarIndex = React.useMemo(() => {
    if (
      !isDiscrete ||
      !discreteBars ||
      pinValue == null ||
      pinLoading ||
      pinIsOutsideRange
    )
      return -1;
    return discreteBars.findIndex(
      (bar) => pinValue >= bar.domainStart && pinValue <= bar.domainEnd,
    );
  }, [isDiscrete, discreteBars, pinValue, pinLoading, pinIsOutsideRange]);
  const pinInUnobservedBin =
    isDiscrete &&
    pinBarIndex === -1 &&
    pinValue != null &&
    !pinLoading &&
    !pinIsOutsideRange;
  const pinPosition = pinIsOutsideRange ? null : pinRawPosition;
  const pinMarkerVisible = pinPosition != null && Number.isFinite(pinPosition);

  // Nudge mean and pin labels apart if they overlap. Hide pin label if it
  // gets too close to the fixed min/max labels. All calculations in pixels.
  const { meanLeft, pinLeft, pinLabelVisible } = React.useMemo(() => {
    if (chartWidth === 0) {
      return {
        meanLeft: meanPosition,
        pinLeft: pinPosition,
        pinLabelVisible: true,
      };
    }

    const gap = 4; // minimum pixel gap between label edges
    const meanHalf = MEAN_LABEL_HALF_WIDTH;
    const pinHalf = PIN_LABEL_HALF_WIDTH;
    const MIN_LABEL_WIDTH = MEAN_LABEL_HALF_WIDTH * 2;
    const MAX_LABEL_WIDTH = MEAN_LABEL_HALF_WIDTH * 2;

    // Start with raw pixel centers.
    let meanCenter =
      meanPosition != null ? (meanPosition / 100) * chartWidth : null;
    let pinCenter =
      pinPosition != null ? (pinPosition / 100) * chartWidth : null;

    // Hide pin label if it overlaps min or max labels.
    let pinLabelVisible = true;
    if (pinCenter != null) {
      const pinLeftEdge = pinCenter - pinHalf;
      const pinRightEdge = pinCenter + pinHalf;
      if (summary?.min != null && pinLeftEdge < MIN_LABEL_WIDTH + gap) {
        pinLabelVisible = false;
      }
      if (
        summary?.max != null &&
        pinRightEdge > chartWidth - MAX_LABEL_WIDTH - gap
      ) {
        pinLabelVisible = false;
      }
    }

    // Nudge mean and pin apart symmetrically.
    if (meanCenter != null && pinCenter != null) {
      const overlap =
        meanHalf + pinHalf + gap - Math.abs(meanCenter - pinCenter);
      if (overlap > 0) {
        const shift = overlap / 2;
        const direction = meanCenter <= pinCenter ? -1 : 1;
        meanCenter = meanCenter + direction * shift;
        pinCenter = pinCenter - direction * shift;
      }
    }

    // Clamp mean label away from min/max edge labels.
    if (meanCenter != null) {
      const minSafeLeft =
        summary?.min != null ? MIN_LABEL_WIDTH + gap + meanHalf : meanHalf;
      const maxSafeRight =
        summary?.max != null
          ? chartWidth - MAX_LABEL_WIDTH - gap - meanHalf
          : chartWidth - meanHalf;
      if (minSafeLeft < maxSafeRight) {
        meanCenter = Math.min(Math.max(meanCenter, minSafeLeft), maxSafeRight);
      }
    }

    return {
      meanLeft:
        meanCenter != null ? (meanCenter / chartWidth) * 100 : meanPosition,
      pinLeft: pinCenter != null ? (pinCenter / chartWidth) * 100 : pinPosition,
      pinLabelVisible,
    };
  }, [meanPosition, pinPosition, chartWidth, summary?.min, summary?.max]);

  const start = normalized.length > 0 ? normalized[0] : null;
  const end = normalized.length > 0 ? normalized[normalized.length - 1] : null;

  const { linePath, areaPath } = React.useMemo(() => {
    if (isDiscrete || !start || !end) return { linePath: '', areaPath: '' };
    const line = normalized
      .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x},${y}`)
      .join(' ');
    const segments = normalized.slice(1).map(({ x, y }) => `L${x},${y}`);
    const area = [
      `M${start.x},${CHART_HEIGHT}`,
      `L${start.x},${start.y}`,
      ...segments,
      `L${end.x},${CHART_HEIGHT}`,
      'Z',
    ].join(' ');
    return { linePath: line, areaPath: area };
  }, [isDiscrete, normalized, start, end]);

  if (!hasCurveData || !normalized.length) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant='bodySmall'>Density curve unavailable.</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.chartWrapper}>
      <View
        testID='density-chart-surface'
        style={styles.chartSurface}
        onLayout={handleLayout}
      >
        <Svg
          width='100%'
          height={CHART_HEIGHT}
          viewBox={`0 0 100 ${CHART_HEIGHT}`}
          preserveAspectRatio='none'
        >
          <Defs>
            {selectionBounds ? (
              <ClipPathWithUnits id={clipId} clipPathUnits='userSpaceOnUse'>
                <Rect
                  x={selectionBounds.left}
                  y={0}
                  width={selectionBounds.width}
                  height={CHART_HEIGHT}
                />
              </ClipPathWithUnits>
            ) : null}
          </Defs>
          {isDiscrete && discreteBars ? (
            <>
              {discreteBars.map(({ path }, i) => {
                const isSelected =
                  selection != null &&
                  samples[i] != null &&
                  samples[i].x >= selection.start &&
                  samples[i].x <= selection.end;
                const fill = isSelected ? lineColor : fillColor;
                const opacity = isSelected
                  ? 0.8
                  : selection != null
                    ? 0.2
                    : 0.5;
                return <Path key={i} d={path} fill={fill} opacity={opacity} />;
              })}
              {pinBarIndex !== -1 ? (
                <Path
                  key='pin-outline'
                  d={discreteBars[pinBarIndex].path}
                  fill='none'
                  stroke={palette.background.warning.default}
                  strokeWidth={2}
                  strokeDasharray='4 3'
                  vectorEffect='non-scaling-stroke'
                />
              ) : null}
            </>
          ) : (
            <>
              <Path d={areaPath} fill={fillColor} opacity={0.3} />
              {selectionBounds ? (
                <Path
                  d={areaPath}
                  fill={fillColor}
                  opacity={0.6}
                  clipPath={`url(#${clipId})`}
                />
              ) : null}
            </>
          )}
          {start && end ? (
            <Path
              d={`M${start.x},0 L${end.x},0 L${end.x},${CHART_HEIGHT} L${start.x},${CHART_HEIGHT} Z`}
              fill='none'
              stroke={baselineColor}
              strokeWidth={2}
              vectorEffect='non-scaling-stroke'
            />
          ) : null}
          {meanPosition != null && Number.isFinite(meanPosition) ? (
            <Path
              d={`M${meanPosition},0 L${meanPosition},${CHART_HEIGHT}`}
              fill='none'
              stroke={baselineColor}
              strokeWidth={1}
              strokeDasharray='4 4'
              vectorEffect='non-scaling-stroke'
            />
          ) : null}
          {!isDiscrete &&
          pinPosition != null &&
          Number.isFinite(pinPosition) ? (
            <Path
              d={`M${pinPosition},0 L${pinPosition},${CHART_HEIGHT}`}
              fill='none'
              stroke={palette.background.warning.default}
              strokeWidth={2}
              strokeDasharray='4 3'
              vectorEffect='non-scaling-stroke'
            />
          ) : null}
          {!isDiscrete && (
            <Path
              d={linePath}
              fill='none'
              stroke={lineColor}
              strokeWidth={2}
              vectorEffect='non-scaling-stroke'
            />
          )}
        </Svg>
        {!isDiscrete ? (
          <View
            pointerEvents='none'
            style={[
              styles.pinImageContainer,
              {
                opacity: pinMarkerVisible ? 1 : 0,
                left: pinMarkerVisible ? `${pinPosition}%` : '0%',
              },
            ]}
          >
            <Image
              source={PIN_IMAGE}
              resizeMode='contain'
              testID='density-chart-pin-image'
              style={styles.pinImage}
            />
          </View>
        ) : null}
        <View
          collapsable={false}
          testID='density-chart-responder'
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
            <ThemedText variant='bodySmall'>
              {formatValue(summary.min, 1)}
            </ThemedText>
            <ThemedText variant='bodySmall'>min</ThemedText>
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
            <ThemedText variant='bodySmall'>
              {formatValue(summary?.mean, 1)}
            </ThemedText>
            <ThemedText variant='bodySmall'>mean</ThemedText>
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
            <ThemedText variant='bodySmall'>
              {formatValue(pinValue, 1)}
            </ThemedText>
            <ThemedText variant='bodySmall'>Selected</ThemedText>
          </View>
        ) : null}
        {summary?.max != null && (
          <View style={styles.maxLabelContainer}>
            <ThemedText variant='bodySmall'>
              {formatValue(summary.max, 1)}
            </ThemedText>
            <ThemedText variant='bodySmall'>max</ThemedText>
          </View>
        )}
      </View>
      {pinIsOutsideRange && pinValue != null ? (
        <View
          style={[
            styles.outOfRangeWarning,
            {
              backgroundColor: palette.background.warning.secondary,
              borderColor: palette.border.warning.default,
            },
          ]}
        >
          <ThemedText
            variant='bodySmall'
            style={{ color: palette.text.warning.default }}
          >
            {`Location value (${formatValue(pinValue, 1)}) is ${pinIsBelowRange ? 'below' : 'above'} this species' observed range`}
          </ThemedText>
        </View>
      ) : null}
      {pinInUnobservedBin && pinValue != null ? (
        <View
          style={[
            styles.outOfRangeWarning,
            {
              backgroundColor: palette.background.warning.secondary,
              borderColor: palette.border.warning.default,
            },
          ]}
        >
          <ThemedText
            variant='bodySmall'
            style={{ color: palette.text.warning.default }}
          >
            {`Location value (${formatValue(pinValue, 1)}) has no observed occurrences in this range`}
          </ThemedText>
        </View>
      ) : null}
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
  pinImageContainer: {
    position: 'absolute',
    top: -(PIN_IMAGE_HEIGHT - Size.space['100']),
    marginLeft: -(PIN_IMAGE_WIDTH / 2),
  },
  pinImage: {
    width: PIN_IMAGE_WIDTH,
    height: PIN_IMAGE_HEIGHT,
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
  outOfRangeWarning: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
  },
});
