// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import type { RankDensity } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ThemedText } from '@/components/text/ThemedText';
import { PolarDensityChart } from './PolarDensityChart';
import {
  buildDensitySamples,
  buildSelectionAreaPath,
  getDensityDomain,
  getSelectionBounds,
  normalizeDensitySamples,
  type DensityDomain,
} from './densityChartUtils';
import { formatValue } from './model';

const CHART_PADDING = Size.space['200'];
const MEAN_LABEL_HALF_WIDTH = 24;
const MARKER_LABEL_HALF_WIDTH = 36;
const EDGE_LABEL_WIDTH = MEAN_LABEL_HALF_WIDTH * 2;
const LABEL_GAP = 4;

type RankDensityChartProps = {
  /** Distribution of the metric across the cohort of taxa. */
  density: RankDensity;
  /** Value to mark with a dashed line (e.g. this taxon's own value). */
  marker?: number | null;
  /** Value range to highlight (e.g. the current results page). For a
   * circular chart, the arc runs clockwise from `start` to `end`. */
  highlight?: { start: number; end: number } | null;
  /** Renders a polar chart for a 0–360° bearing metric. */
  circular?: boolean;
  height?: number;
};

const toPercentX = (value: number, domain: DensityDomain) =>
  ((value - domain.minX) / domain.spanX) * 100;

/**
 * Places the mean and marker labels under their lines (all in px): each is
 * pushed in clear of the fixed min/max edge labels, then the two are nudged
 * apart if they overlap — same rules as DensityChart's mean/pin labels.
 */
export const layoutMarkerLabels = (
  width: number,
  meanCenter: number | null,
  markerCenter: number | null,
): { mean: number | null; marker: number | null } => {
  const clamp = (center: number, half: number) => {
    const lo = EDGE_LABEL_WIDTH + LABEL_GAP + half;
    const hi = width - EDGE_LABEL_WIDTH - LABEL_GAP - half;
    return lo < hi ? Math.min(Math.max(center, lo), hi) : width / 2;
  };
  let mean =
    meanCenter != null ? clamp(meanCenter, MEAN_LABEL_HALF_WIDTH) : null;
  let marker =
    markerCenter != null ? clamp(markerCenter, MARKER_LABEL_HALF_WIDTH) : null;
  if (mean != null && marker != null) {
    const overlap =
      MEAN_LABEL_HALF_WIDTH +
      MARKER_LABEL_HALF_WIDTH +
      LABEL_GAP -
      Math.abs(mean - marker);
    if (overlap > 0) {
      const dir = mean <= marker ? -1 : 1;
      mean = clamp(mean + (dir * overlap) / 2, MEAN_LABEL_HALF_WIDTH);
      marker = clamp(marker - (dir * overlap) / 2, MARKER_LABEL_HALF_WIDTH);
    }
  }
  return { mean, marker };
};

const strokeProps = {
  fill: 'none',
  vectorEffect: 'non-scaling-stroke',
} as const;

/** Read-only distribution of one ranked metric across a cohort of taxa: a KDE
 * curve, or a strip of ticks when the cohort is too small for one. */
export function RankDensityChart({
  density,
  marker,
  highlight,
  circular = false,
  height = 120,
}: RankDensityChartProps) {
  const palette = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const brand = palette.background.brand.default;
  const guide = palette.text.default.secondary;

  const samples = React.useMemo(
    () => buildDensitySamples(density.curve),
    [density.curve],
  );
  const values = React.useMemo(() => density.values ?? [], [density.values]);
  const domain = React.useMemo(
    () =>
      samples.length
        ? getDensityDomain(samples)
        : getDensityDomain(values.map((x) => ({ x, y: 1 }))),
    [samples, values],
  );
  const normalized = React.useMemo(
    () => normalizeDensitySamples(samples, domain, height, CHART_PADDING),
    [samples, domain, height],
  );

  const [width, setWidth] = React.useState(0);
  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  if (circular && density.curve) {
    return (
      <PolarDensityChart
        curve={density.curve}
        fillColor={brand}
        lineColor={brand}
        guideColor={guide}
        selections={highlight ? [highlight] : []}
        pinValue={marker ?? null}
        circularMean={density.mean}
      />
    );
  }

  const areaPath = normalized.length
    ? [
        `M${normalized[0].x},${height}`,
        ...normalized.map(({ x, y }) => `L${x},${y}`),
        `L${normalized[normalized.length - 1].x},${height}`,
        'Z',
      ].join(' ')
    : '';
  const linePath = normalized
    .map(({ x, y }, i) => `${i === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ');
  const highlightBounds = highlight
    ? getSelectionBounds(
        {
          start: Math.min(highlight.start, highlight.end),
          end: Math.max(highlight.start, highlight.end),
        },
        domain,
      )
    : null;
  const highlightPath =
    highlightBounds && normalized.length
      ? buildSelectionAreaPath(
          normalized,
          highlightBounds.left,
          highlightBounds.left + highlightBounds.width,
          height,
        )
      : '';
  const isInHighlight = (value: number) =>
    highlight != null &&
    value >= Math.min(highlight.start, highlight.end) &&
    value <= Math.max(highlight.start, highlight.end);
  const markerX =
    marker != null && Number.isFinite(marker)
      ? Math.min(Math.max(toPercentX(marker, domain), 0), 100)
      : null;
  const meanX =
    density.mean != null
      ? Math.min(Math.max(toPercentX(density.mean, domain), 0), 100)
      : null;
  const labels = layoutMarkerLabels(
    width,
    meanX != null ? (meanX / 100) * width : null,
    markerX != null ? (markerX / 100) * width : null,
  );

  return (
    <View
      testID='rank-density-chart'
      style={styles.container}
      onLayout={handleLayout}
    >
      <Svg
        width='100%'
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio='none'
      >
        {areaPath ? <Path d={areaPath} fill={brand} opacity={0.3} /> : null}
        {highlightPath ? (
          <Path
            testID='rank-density-highlight'
            d={highlightPath}
            fill={brand}
            opacity={0.6}
          />
        ) : null}
        {linePath ? (
          <Path
            d={linePath}
            stroke={brand}
            strokeWidth={1.5}
            {...strokeProps}
          />
        ) : null}
        {values.map((value, i) => {
          const x = toPercentX(value, domain);
          return (
            <Path
              key={i}
              d={`M${x},${height * 0.35} L${x},${height}`}
              stroke={brand}
              strokeWidth={2}
              opacity={highlight == null || isInHighlight(value) ? 0.9 : 0.35}
              {...strokeProps}
            />
          );
        })}
        <Path
          d={`M0,${height} L100,${height}`}
          stroke={guide}
          strokeWidth={1}
          {...strokeProps}
        />
        {meanX != null ? (
          <Path
            testID='rank-density-mean'
            d={`M${meanX},0 L${meanX},${height}`}
            stroke={guide}
            strokeWidth={1}
            strokeDasharray='4 4'
            {...strokeProps}
          />
        ) : null}
        {markerX != null ? (
          <Path
            testID='rank-density-marker'
            d={`M${markerX},0 L${markerX},${height}`}
            stroke={palette.background.warning.default}
            strokeWidth={2}
            strokeDasharray='4 3'
            {...strokeProps}
          />
        ) : null}
      </Svg>
      <View style={styles.chartLabels}>
        <View style={styles.minLabelContainer}>
          <ThemedText variant='bodySmall'>
            {formatValue(domain.minX, 2)}
          </ThemedText>
          <ThemedText variant='bodySmall'>min</ThemedText>
        </View>
        {labels.mean != null && width > 0 ? (
          <View
            style={[
              styles.centeredLabelContainer,
              {
                left: labels.mean - MEAN_LABEL_HALF_WIDTH,
                width: MEAN_LABEL_HALF_WIDTH * 2,
              },
            ]}
          >
            <ThemedText variant='bodySmall'>
              {formatValue(density.mean, 2)}
            </ThemedText>
            <ThemedText variant='bodySmall'>mean</ThemedText>
          </View>
        ) : null}
        {labels.marker != null && width > 0 ? (
          <View
            testID='rank-density-marker-label'
            style={[
              styles.centeredLabelContainer,
              {
                left: labels.marker - MARKER_LABEL_HALF_WIDTH,
                width: MARKER_LABEL_HALF_WIDTH * 2,
              },
            ]}
          >
            <ThemedText
              variant='bodySmall'
              style={{ color: palette.background.warning.default }}
            >
              {formatValue(marker, 2)}
            </ThemedText>
            <ThemedText
              variant='bodySmall'
              style={{ color: palette.background.warning.default }}
            >
              This taxon
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.maxLabelContainer}>
          <ThemedText variant='bodySmall'>
            {formatValue(domain.maxX, 2)}
          </ThemedText>
          <ThemedText variant='bodySmall'>max</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Size.space['100'],
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
  },
  centeredLabelContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  maxLabelContainer: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
  },
});
