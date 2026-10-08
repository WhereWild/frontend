// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import type { RankDensity } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
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
  /** Units appended to the min/max axis labels. */
  units?: string | null;
  height?: number;
};

const toPercentX = (value: number, domain: DensityDomain) =>
  ((value - domain.minX) / domain.spanX) * 100;

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
  units,
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

  if (circular && density.curve) {
    return (
      <PolarDensityChart
        curve={density.curve}
        fillColor={brand}
        lineColor={brand}
        guideColor={guide}
        selections={highlight ? [highlight] : []}
        pinValue={marker ?? null}
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
  const unitSuffix = units ? ` ${units}` : '';

  return (
    <View testID='rank-density-chart' style={styles.container}>
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
      <View style={styles.axisLabels}>
        <ThemedText variant='bodySmall'>
          {formatValue(domain.minX, 2)}
          {unitSuffix}
        </ThemedText>
        <ThemedText variant='bodySmall'>
          {density.count.toLocaleString()} taxa
        </ThemedText>
        <ThemedText variant='bodySmall'>
          {formatValue(domain.maxX, 2)}
          {unitSuffix}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Size.space['100'],
  },
  axisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
