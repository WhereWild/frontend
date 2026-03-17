import { Colors, Size } from '@/constants/theme';
import type { SpeciesEnvironmentRelativeRank } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { formatPercent } from './model';

/** Props for one metric summary card in the insights row. */
type SummaryItemProps = {
  /** Metric label (for example Min, Mean, Max). */
  label: string;
  /** Formatted metric value text. */
  value: string;
  /** Optional ranking metadata for this metric. */
  rank?: SpeciesEnvironmentRelativeRank | null;
  /** Optional baseline comparison label when location filter is active. */
  comparison?: string | null;
  /** Removes trailing divider when this card is last in row. */
  isLast?: boolean;
  /** Indicates stacked single-column layout on phone widths. */
  stacked?: boolean;
};

/** Displays one summary metric with optional rank/comparison metadata. */
export function SummaryItem({ label, value, rank, comparison, isLast, stacked }: SummaryItemProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const borderColor = palette.border.default.default;

  return (
    <View
      style={[
        styles.summaryItem,
        stacked ? styles.summaryItemStacked : { borderRightColor: borderColor },
        stacked && !isLast && { borderBottomColor: borderColor },
        isLast && !stacked && styles.summaryItemLast,
      ]}
    >
      <ThemedText variant="body">{label}: {value}</ThemedText>
      {comparison ? (
        <ThemedText variant="body" style={{ color: palette.text.default.secondary }}>
          {comparison}
        </ThemedText>
      ) : rank ? (
        <>
          {typeof rank.rank === 'number' && typeof rank.count === 'number' ? (
            <ThemedText
              variant="body"
              style={{ color: palette.text.default.secondary, textAlign: stacked ? 'left' : 'center' }}
            >
              Ranks {Math.round(rank.rank).toLocaleString()} / {Math.round(rank.count).toLocaleString()}{' '}
              in {rank.label || 'selected taxon'}
            </ThemedText>
          ) : null}
          {typeof rank.percentile === 'number' && Number.isFinite(rank.percentile) ? (
            <ThemedText variant="bodySmall" style={{ color: palette.text.default.tertiary }}>
              ({formatPercent(rank.percentile)} percentile)
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryItem: {
    flexDirection: 'column',
    flex: 1,
    minWidth: 140,
    gap: Size.space.text.line,
    alignItems: 'center',
    borderRightWidth: 1,
    paddingHorizontal: Size.space['200'],
  },
  summaryItemLast: {
    borderRightWidth: 0,
  },
  summaryItemStacked: {
    alignItems: 'flex-start',
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
    paddingVertical: Size.space['200'],
    paddingHorizontal: 0,
  },
});
