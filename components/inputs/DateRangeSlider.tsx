import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/text/ThemedText';
import { SelectField } from './SelectField';
import type { SelectOption } from './SelectField';

export type MonthYear = { year: number; month: number; day?: number };

export type DateRangeSliderProps = {
  startDate: MonthYear;
  endDate: MonthYear;
  minDate?: MonthYear;
  maxDate?: MonthYear;
  onStartChange: (d: MonthYear) => void;
  onEndChange: (d: MonthYear) => void;
  style?: StyleProp<ViewStyle>;
};

const THUMB_SIZE = 22;
const TRACK_HEIGHT = 4;
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toMonths(d: MonthYear): number {
  return d.year * 12 + d.month - 1;
}

function fromMonths(m: number): MonthYear {
  return { year: Math.floor(m / 12), month: (m % 12) + 1 };
}

function toRatio(d: MonthYear, min: MonthYear, max: MonthYear): number {
  const span = toMonths(max) - toMonths(min);
  return span === 0 ? 0 : (toMonths(d) - toMonths(min)) / span;
}

function fromRatio(r: number, min: MonthYear, max: MonthYear): MonthYear {
  const span = toMonths(max) - toMonths(min);
  const clamped = Math.max(0, Math.min(1, r));
  return fromMonths(toMonths(min) + Math.round(clamped * span));
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function buildDayOptions(year: number, month: number): SelectOption[] {
  const count = daysInMonth(year, month);
  return Array.from({ length: count }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));
}

function formatDate(d: MonthYear): string {
  const day = d.day != null ? ` ${d.day},` : '';
  return `${MONTH_SHORT[d.month - 1]}${day} ${d.year}`;
}

const NOW = new Date();
const DEFAULT_MIN: MonthYear = { year: 1980, month: 1 };
const DEFAULT_MAX: MonthYear = {
  year: NOW.getFullYear(),
  month: NOW.getMonth() + 1,
};

function buildYearOptions(min: MonthYear, max: MonthYear): SelectOption[] {
  const options: SelectOption[] = [];
  for (let y = min.year; y <= max.year; y++) {
    options.push({ value: String(y), label: String(y) });
  }
  return options;
}

const MONTH_OPTIONS: SelectOption[] = MONTH_SHORT.map((m, i) => ({
  value: String(i + 1),
  label: m,
}));

export function DateRangeSlider({
  startDate,
  endDate,
  minDate = DEFAULT_MIN,
  maxDate = DEFAULT_MAX,
  onStartChange,
  onEndChange,
  style,
}: DateRangeSliderProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const trackWidth = useSharedValue(0);
  const startRatio = useSharedValue(toRatio(startDate, minDate, maxDate));
  const endRatio = useSharedValue(toRatio(endDate, minDate, maxDate));
  const startPanBase = useSharedValue(0);
  const endPanBase = useSharedValue(0);

  // Minimum gap: 1 month expressed as a ratio
  const minGapRatio = useSharedValue(0);
  useEffect(() => {
    const span = toMonths(maxDate) - toMonths(minDate);
    minGapRatio.value = span > 0 ? 1 / span : 0;
  }, [minDate, maxDate, minGapRatio]);

  // Sync thumb positions when controlled props change
  useEffect(() => {
    startRatio.value = toRatio(startDate, minDate, maxDate);
  }, [startDate, minDate, maxDate, startRatio]);

  useEffect(() => {
    endRatio.value = toRatio(endDate, minDate, maxDate);
  }, [endDate, minDate, maxDate, endRatio]);

  const [editingSide, setEditingSide] = useState<'start' | 'end' | null>(null);

  const notifyStart = useCallback(
    (r: number) => onStartChange(fromRatio(r, minDate, maxDate)),
    [onStartChange, minDate, maxDate],
  );
  const notifyEnd = useCallback(
    (r: number) => onEndChange(fromRatio(r, minDate, maxDate)),
    [onEndChange, minDate, maxDate],
  );

  const startGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startPanBase.value = startRatio.value;
        })
        .onUpdate((e) => {
          if (trackWidth.value === 0) return;
          startRatio.value = Math.max(
            0,
            Math.min(
              endRatio.value - minGapRatio.value,
              startPanBase.value + e.translationX / trackWidth.value,
            ),
          );
        })
        .onEnd(() => {
          runOnJS(notifyStart)(startRatio.value);
        }),
    // shared values are stable refs — only notifyStart needs to be a dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notifyStart],
  );

  const endGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          endPanBase.value = endRatio.value;
        })
        .onUpdate((e) => {
          if (trackWidth.value === 0) return;
          endRatio.value = Math.max(
            startRatio.value + minGapRatio.value,
            Math.min(1, endPanBase.value + e.translationX / trackWidth.value),
          );
        })
        .onEnd(() => {
          runOnJS(notifyEnd)(endRatio.value);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notifyEnd],
  );

  const startThumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: startRatio.value * trackWidth.value - THUMB_SIZE / 2 },
    ],
  }));

  const endThumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: endRatio.value * trackWidth.value - THUMB_SIZE / 2 },
    ],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    left: startRatio.value * trackWidth.value,
    width: (endRatio.value - startRatio.value) * trackWidth.value,
  }));

  const yearTicks = useMemo(() => {
    const span = toMonths(maxDate) - toMonths(minDate);
    const numYears = maxDate.year - minDate.year;
    const step =
      numYears <= 10 ? 1 : numYears <= 20 ? 2 : numYears <= 40 ? 5 : 10;
    const ticks: { year: number; pct: number }[] = [];
    const firstTick = Math.ceil(minDate.year / step) * step;
    for (let y = firstTick; y <= maxDate.year; y += step) {
      const ratio =
        span > 0
          ? (toMonths({ year: y, month: 1 }) - toMonths(minDate)) / span
          : 0;
      if (ratio >= 0 && ratio <= 1) ticks.push({ year: y, pct: ratio * 100 });
    }
    return ticks;
  }, [minDate, maxDate]);

  const yearOptions = useMemo(
    () => buildYearOptions(minDate, maxDate),
    [minDate, maxDate],
  );

  const trackBg = palette.background.neutral.secondary;
  const fillBg = palette.background.brand.default;
  const thumbBg = palette.background.default.default;
  const thumbBorder = palette.border.neutral.default;
  const textColor = palette.text.default.default;
  const dimColor = palette.text.default.secondary;

  const editedDate = editingSide === 'start' ? startDate : endDate;
  const onEditChange = editingSide === 'start' ? onStartChange : onEndChange;

  return (
    <View style={[styles.container, style]}>
      {/* Date labels */}
      <View style={styles.labelsRow}>
        <Pressable
          onPress={() => setEditingSide((s) => (s === 'start' ? null : 'start'))}
          hitSlop={8}
        >
          <ThemedText variant='bodySmallStrong' style={{ color: textColor }}>
            {formatDate(startDate)} {editingSide === 'start' ? '▴' : '▾'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setEditingSide((s) => (s === 'end' ? null : 'end'))}
          hitSlop={8}
        >
          <ThemedText variant='bodySmallStrong' style={{ color: textColor }}>
            {editingSide === 'end' ? '▴' : '▾'} {formatDate(endDate)}
          </ThemedText>
        </Pressable>
      </View>

      {/* Inline precision editor — shared panel, switches content based on side */}
      {editingSide !== null && (
        <View style={styles.editRow}>
          <View style={styles.editField}>
            <SelectField
              label='Month'
              options={MONTH_OPTIONS}
              value={String(editedDate.month)}
              onValueChange={(v) => {
                const month = Number(v);
                const maxDay = daysInMonth(editedDate.year, month);
                const day = editedDate.day != null ? Math.min(editedDate.day, maxDay) : undefined;
                onEditChange({ ...editedDate, month, day });
              }}
              allowSearch={false}
            />
          </View>
          <View style={styles.editField}>
            <SelectField
              label='Day'
              options={buildDayOptions(editedDate.year, editedDate.month)}
              value={String(editedDate.day ?? '')}
              onValueChange={(v) =>
                onEditChange({ ...editedDate, day: v ? Number(v) : undefined })
              }
              allowSearch={false}
              placeholder='—'
            />
          </View>
          <View style={styles.editField}>
            <SelectField
              label='Year'
              options={yearOptions}
              value={String(editedDate.year)}
              onValueChange={(v) =>
                onEditChange({ ...editedDate, year: Number(v) })
              }
            />
          </View>
        </View>
      )}

      {/* Slider track */}
      <View
        style={styles.trackWrapper}
        onLayout={(e) => {
          trackWidth.value = e.nativeEvent.layout.width;
        }}
      >
        <View style={[styles.track, { backgroundColor: trackBg }]} />
        <Animated.View
          style={[styles.fill, fillStyle, { backgroundColor: fillBg }]}
        />

        <GestureDetector gesture={startGesture}>
          <Animated.View
            style={[
              styles.thumb,
              startThumbStyle,
              { backgroundColor: thumbBg, borderColor: thumbBorder },
            ]}
          />
        </GestureDetector>

        <GestureDetector gesture={endGesture}>
          <Animated.View
            style={[
              styles.thumb,
              endThumbStyle,
              { backgroundColor: thumbBg, borderColor: thumbBorder },
            ]}
          />
        </GestureDetector>
      </View>

      {/* Year tick marks */}
      <View style={styles.ticksContainer}>
        {yearTicks.map(({ year, pct }) => (
          <View
            key={year}
            style={[styles.tickWrapper, { left: `${pct}%` }]}
          >
            <View style={[styles.tickMark, { backgroundColor: dimColor }]} />
            <ThemedText variant='bodyTiny' style={{ color: dimColor }}>
              {year}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Size.space['200'],
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editRow: {
    flexDirection: 'row',
    gap: Size.space['300'],
  },
  editField: {
    flex: 1,
  },
  trackWrapper: {
    height: THUMB_SIZE,
    position: 'relative',
    justifyContent: 'center',
    marginHorizontal: THUMB_SIZE / 2,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  fill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    top: 0,
  },
  ticksContainer: {
    position: 'relative',
    height: 18,
    marginHorizontal: THUMB_SIZE / 2,
  },
  tickWrapper: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -8 }],
  },
  tickMark: {
    width: 1,
    height: 4,
  },
});
