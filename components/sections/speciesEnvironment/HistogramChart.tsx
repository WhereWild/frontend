import { Size } from '@/constants/theme';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { ThemedText } from '../../text/ThemedText';
import type { HistogramBar } from './utils';
import { formatBinLabel, formatValue } from './utils';

const CHART_HEIGHT = 160;
const CHART_PADDING = 20;
const MIN_BAR_HEIGHT = 6;
const MIN_BAR_PERCENT = 4;

const formatSamplePercent = (count: number, totalCount: number) => {
  if (!totalCount) {
    return '0%';
  }

  const value = (count / totalCount) * 100;
  return `${value.toFixed(1)}%`;
};

type HistogramChartProps = {
  bars: HistogramBar[];
  barColor: string;
  tooltipColor: string;
  trackColor?: string;
  totalCount: number;
  selectedIndex: number | null;
  onSelectBin?: (index: number) => void;
  selectionColor: string;
  orientation?: 'horizontal' | 'vertical';
  style?: StyleProp<ViewStyle>;
};

export function HistogramChart({
  bars,
  barColor,
  tooltipColor,
  trackColor,
  totalCount,
  selectedIndex,
  onSelectBin,
  selectionColor,
  orientation = 'vertical',
  style,
}: HistogramChartProps) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  if (!bars.length) {
    return (
      <View style={[styles.wrapper, style]}>
        <View style={styles.emptyChart}>
          <ThemedText variant="bodySmall">Histogram data unavailable.</ThemedText>
        </View>
      </View>
    );
  }

  const maxCount = Math.max(...bars.map((bar) => bar.count));
  const safeMax = maxCount || 1;
  const drawableHeight = CHART_HEIGHT - CHART_PADDING;
  const resolvedActiveIndex = hoverIndex ?? selectedIndex;
  const activeBar =
    typeof resolvedActiveIndex === 'number'
      ? bars.find((bar) => bar.index === resolvedActiveIndex)
      : null;

  const renderVertical = () => (
    <>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {bars.map((bar) => {
          const height = Math.max((bar.count / safeMax) * drawableHeight, MIN_BAR_HEIGHT);
          const handleEnter = () => setHoverIndex(bar.index);
          const handleLeave = () => setHoverIndex(null);
          const handlePress = () => onSelectBin?.(bar.index);
          const dimmed = hoverIndex !== null && hoverIndex !== bar.index;
          const selected = selectedIndex === bar.index;

          return (
            <View key={`bar-${bar.index}`} style={styles.barColumn}>
              <Pressable
                testID={`histogram-bar-${bar.index}`}
                onHoverIn={handleEnter}
                onHoverOut={handleLeave}
                onPressIn={handleEnter}
                onPressOut={handleLeave}
                onPress={handlePress}
                accessibilityRole="button"
                style={styles.barPressable}
              >
                <View style={styles.barAxis}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height,
                        backgroundColor: barColor,
                        opacity: dimmed ? 0.4 : 1,
                        borderColor: selected ? selectionColor : 'transparent',
                        borderWidth: selected ? 2 : 0,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={styles.barLabelRow} pointerEvents="none">
        {bars.map((bar) => (
          <View key={`label-${bar.index}`} style={styles.barLabelCell}>
            <ThemedText variant="bodySmall" style={styles.barLabelVertical}>
              {formatBinLabel(bar.start, bar.end)}
            </ThemedText>
          </View>
        ))}
      </View>
    </>
  );

  const renderHorizontal = () => (
    <View style={styles.horizontalChart}>
      {bars.map((bar) => {
        const percent = Math.min(
          100,
          Math.max((bar.count / safeMax) * 100, MIN_BAR_PERCENT),
        );
        const handleEnter = () => setHoverIndex(bar.index);
        const handleLeave = () => setHoverIndex(null);
        const handlePress = () => onSelectBin?.(bar.index);
        const dimmed = hoverIndex !== null && hoverIndex !== bar.index;
        const selected = selectedIndex === bar.index;

        return (
          <Pressable
            key={`bar-${bar.index}`}
            testID={`histogram-bar-${bar.index}`}
            onHoverIn={handleEnter}
            onHoverOut={handleLeave}
            onPressIn={handleEnter}
            onPressOut={handleLeave}
            onPress={handlePress}
            accessibilityRole="button"
            style={styles.horizontalBarRow}
          >
            <ThemedText variant="bodySmall" style={styles.barLabelHorizontal}>
              {formatBinLabel(bar.start, bar.end)}
            </ThemedText>
            <View
              testID={`histogram-horizontal-track-${bar.index}`}
              style={[styles.barTrack, trackColor ? { backgroundColor: trackColor } : null]}
            >
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${percent}%`,
                    backgroundColor: barColor,
                    opacity: dimmed ? 0.4 : 1,
                    borderColor: selected ? selectionColor : 'transparent',
                    borderWidth: selected ? 2 : 0,
                  },
                ]}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.wrapper, style]}>
      {activeBar ? (
        <View style={[styles.barTooltip, { backgroundColor: tooltipColor }]} pointerEvents="none">
          <ThemedText variant="bodySmallEmphasis">
            {formatBinLabel(activeBar.start, activeBar.end)} • Samples {formatValue(activeBar.count)} ({formatSamplePercent(activeBar.count, totalCount)})
          </ThemedText>
        </View>
      ) : null}
      {orientation === 'horizontal' ? renderHorizontal() : renderVertical()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Size.space['200'],
    position: 'relative',
  },
  barTooltip: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: Size.space['100'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
    borderRadius: Size.radius['200'],
  },
  chart: {
    flexDirection: 'row',
    width: '100%',
    gap: Size.space['200'],
    alignItems: 'flex-end',
    paddingTop: Size.space['200'],
  },
  barColumn: {
    flex: 1,
    alignItems: 'stretch',
  },
  barLabelRow: {
    flexDirection: 'row',
    gap: Size.space['200'],
  },
  barLabelCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  barPressable: {
    width: '100%',
  },
  barAxis: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    width: '100%',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: Size.radius['100'],
    borderTopRightRadius: Size.radius['100'],
  },
  barLabelVertical: {
    marginTop: Size.space['100'],
    textAlign: 'center',
  },
  horizontalChart: {
    gap: Size.space['200'],
    width: '100%',
  },
  horizontalBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['100'],
    width: '100%',
  },
  barLabelHorizontal: {
    // Reserve ~1/4 of the row so bin labels line up without wrapping.
    flexBasis: '26%',
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 72, // Replace with token later.
    textAlign: 'right',
    paddingRight: Size.space['050'],
  },
  barTrack: {
    flex: 1,
    height: Size.space['400'],
    width: '100%',
    alignSelf: 'stretch',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: Size.radius['200'],
    borderBottomRightRadius: Size.radius['200'],
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: Size.radius['200'],
    borderBottomRightRadius: Size.radius['200'],
  },
  emptyChart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
