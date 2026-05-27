import { DateRangeSlider } from '@/components/inputs/DateRangeSlider';
import type { MonthYear } from '@/components/inputs/DateRangeSlider';
import { ThemedText } from '@/components/text/ThemedText';
import { Size } from '@/constants/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export type SpeciesTimestampFiltersProps = {
  startTimestamp: number | null;
  endTimestamp: number | null;
  minTimestamp: number | null;
  maxTimestamp: number | null;
  onStartChange: (ts: number | null) => void;
  onEndChange: (ts: number | null) => void;
};

function tsToMonthYear(ts: number): MonthYear {
  const d = new Date(ts * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function monthYearToTs(my: MonthYear): number {
  return Date.UTC(my.year, my.month - 1, my.day ?? 1) / 1000;
}

const NOW = new Date();
const FALLBACK_MIN: MonthYear = { year: 1980, month: 1 };
const FALLBACK_MAX: MonthYear = {
  year: NOW.getUTCFullYear(),
  month: NOW.getUTCMonth() + 1,
};

export function SpeciesTimestampFilters({
  startTimestamp,
  endTimestamp,
  minTimestamp,
  maxTimestamp,
  onStartChange,
  onEndChange,
}: SpeciesTimestampFiltersProps) {
  const minDate =
    minTimestamp != null ? tsToMonthYear(minTimestamp) : FALLBACK_MIN;
  const maxDate =
    maxTimestamp != null ? tsToMonthYear(maxTimestamp) : FALLBACK_MAX;

  const startDate =
    startTimestamp != null ? tsToMonthYear(startTimestamp) : minDate;
  const endDate = endTimestamp != null ? tsToMonthYear(endTimestamp) : maxDate;

  return (
    <View style={styles.container}>
      <ThemedText variant='subheading'>Date Range</ThemedText>
      <DateRangeSlider
        startDate={startDate}
        endDate={endDate}
        minDate={minDate}
        maxDate={maxDate}
        onStartChange={(d) => {
          const ts = monthYearToTs(d);
          onStartChange(ts <= monthYearToTs(minDate) ? null : ts);
        }}
        onEndChange={(d) => {
          const ts = monthYearToTs(d);
          onEndChange(ts >= monthYearToTs(maxDate) ? null : ts);
        }}
      />
    </View>
  );
}

export default SpeciesTimestampFilters;

const styles = StyleSheet.create({
  container: {
    gap: Size.space.text.paragraph,
  },
});
