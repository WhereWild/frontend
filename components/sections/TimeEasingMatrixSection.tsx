// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ThemedText } from '@/components';
import { Colors, Size, Time, getReactNativeEasing } from '@/constants/theme';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, type ViewStyle, View } from 'react-native';

type TimeDurationKey = keyof typeof Time.duration;
type TimeEasingKey = keyof typeof Time.easing;
type Palette = typeof Colors.light;

type TimeEasingMatrixSectionProps = {
  palette: Palette;
};

const TIME_DURATION_KEYS = Object.keys(Time.duration) as TimeDurationKey[];
const TIME_EASING_KEYS = Object.keys(Time.easing) as TimeEasingKey[];
const PREVIEW_TICK_INTERVAL_MS = 33;
const PREVIEW_MIN_OPACITY = 0.4;
const PREVIEW_MAX_OPACITY = 1;
const PREVIEW_TRAVEL_DISTANCE = Size.space['1200'];

const formatTokenLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/(\d+)/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const clamp01 = (value: number) => Math.max(0, Math.min(value, 1));

const getTokenSurfaceStyle = (palette: Palette): ViewStyle => ({
  borderColor: palette.border.default.default,
  backgroundColor: palette.background.default.secondary,
});

const getProgressFromTick = (tickMs: number, durationMs: number) =>
  (tickMs % durationMs) / durationMs;

function TimeMotionCell({
  durationKey,
  easingKey,
  palette,
  tickMs,
}: {
  durationKey: TimeDurationKey;
  easingKey: TimeEasingKey;
  palette: Palette;
  tickMs: number;
}) {
  const durationMs = Math.max(Time.duration[durationKey], 1);
  const easingFn = useMemo(() => getReactNativeEasing(easingKey), [easingKey]);
  const tokenSurfaceStyle = getTokenSurfaceStyle(palette);

  const normalizedProgress = getProgressFromTick(tickMs, durationMs);
  const easedProgress = easingFn(normalizedProgress);
  const safeProgress = Number.isFinite(easedProgress)
    ? clamp01(easedProgress)
    : normalizedProgress;

  const translateX = safeProgress * PREVIEW_TRAVEL_DISTANCE;
  const opacity =
    PREVIEW_MIN_OPACITY +
    safeProgress * (PREVIEW_MAX_OPACITY - PREVIEW_MIN_OPACITY);

  return (
    <View
      testID='time-motion-preview-cell'
      style={[styles.motionCell, tokenSurfaceStyle]}
    >
      <View
        style={[
          styles.motionTrack,
          {
            backgroundColor: palette.background.default.default,
          },
        ]}
      >
        <View
          style={[
            styles.motionDot,
            {
              backgroundColor: palette.icon.brand.default,
              opacity,
              transform: [{ translateX }],
            },
          ]}
        />
      </View>
      <ThemedText variant='bodyTiny'>{`${durationMs}ms`}</ThemedText>
    </View>
  );
}

export function TimeEasingMatrixSection({
  palette,
}: TimeEasingMatrixSectionProps) {
  const [tickMs, setTickMs] = useState(() => Date.now());
  const tokenSurfaceStyle = getTokenSurfaceStyle(palette);

  useEffect(() => {
    const interval = setInterval(() => {
      setTickMs(Date.now());
    }, PREVIEW_TICK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <View>
      <ThemedText variant='heading'>Time + Easing Tokens</ThemedText>
      <ThemedText variant='body'>
        Durations are rows and easing curves are columns; each cell previews
        that exact pair.
      </ThemedText>

      <View style={styles.matrix}>
        <View style={styles.headerRow}>
          <View style={[styles.headerCell, styles.durationHeaderCell]}>
            <ThemedText variant='bodySmallStrong'>Duration \ Easing</ThemedText>
          </View>
          {TIME_EASING_KEYS.map((easingKey) => (
            <View
              key={easingKey}
              testID='time-easing-header'
              style={[styles.headerCell, tokenSurfaceStyle]}
            >
              <ThemedText variant='bodySmallStrong'>
                {formatTokenLabel(easingKey)}
              </ThemedText>
              <ThemedText variant='bodyTiny'>
                {Time.easing[easingKey]}
              </ThemedText>
            </View>
          ))}
        </View>

        {TIME_DURATION_KEYS.map((durationKey) => (
          <View key={durationKey} style={styles.matrixRow}>
            <View
              testID='time-duration-header'
              style={[styles.durationCell, tokenSurfaceStyle]}
            >
              <ThemedText variant='bodySmallStrong'>
                {formatTokenLabel(durationKey)}
              </ThemedText>
              <ThemedText variant='bodyTiny'>
                {Time.duration[durationKey]}ms
              </ThemedText>
            </View>

            {TIME_EASING_KEYS.map((easingKey) => (
              <TimeMotionCell
                key={`${durationKey}-${easingKey}`}
                durationKey={durationKey}
                easingKey={easingKey}
                palette={palette}
                tickMs={tickMs}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  matrix: {
    marginTop: Size.space['300'],
    gap: Size.space['300'],
  },
  headerRow: {
    flexDirection: 'row',
    gap: Size.space['200'],
  },
  matrixRow: {
    flexDirection: 'row',
    gap: Size.space['200'],
  },
  headerCell: {
    flex: 1,
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['200'],
    padding: Size.space['200'],
    gap: Size.space['100'],
    minWidth: 140,
  },
  durationHeaderCell: {
    borderWidth: 0,
    justifyContent: 'center',
    minWidth: 170,
    flex: 0,
  },
  durationCell: {
    minWidth: 170,
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['200'],
    padding: Size.space['200'],
    gap: Size.space['100'],
    justifyContent: 'center',
  },
  motionCell: {
    flex: 1,
    borderWidth: Size.stroke.border,
    borderRadius: Size.radius['200'],
    minWidth: 140,
    padding: Size.space['200'],
  },
  motionTrack: {
    height: Size.space['400'],
    justifyContent: 'center',
    borderRadius: Size.radius['full'],
    paddingHorizontal: Size.space['100'],
  },
  motionDot: {
    width: Size.space['200'],
    height: Size.space['200'],
    borderRadius: Size.radius['full'],
  },
});
