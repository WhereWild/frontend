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
};

/** Displays one summary metric with optional rank/comparison metadata. */
export function SummaryItem({ label, value, rank, comparison, isLast }: SummaryItemProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  return (
    <View
      style={[
        styles.summaryItem,
        { borderRightColor: palette.border.default.default },
        isLast && styles.summaryItemLast,
      ]}
    >
      <ThemedText variant="body">{label}</ThemedText>
      <ThemedText variant="subtitle">{value}</ThemedText>
      {comparison ? (
        <ThemedText variant="body" style={{ color: palette.text.default.secondary }}>
          {comparison}
        </ThemedText>
      ) : rank ? (
        <>
          {typeof rank.rank === 'number' && typeof rank.count === 'number' ? (
            <ThemedText variant="body" style={{ color: palette.text.default.secondary }}>
              Ranks{' '}
              <ThemedText variant="body" style={{ fontWeight: 'bold' }}>
                {Math.round(rank.rank).toLocaleString()} / {Math.round(rank.count).toLocaleString()}
              </ThemedText>{' '}
              in {rank.label || 'selected taxon'}
            </ThemedText>
          ) : null}
          {typeof rank.percentile === 'number' && Number.isFinite(rank.percentile) ? (
            <ThemedText variant="bodySmall" style={{ color: palette.text.default.secondary }}>
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
    gap: Size.space['100'],
    alignItems: 'center',
    borderRightWidth: 1,
    paddingHorizontal: Size.space['300'],
  },
  summaryItemLast: {
    borderRightWidth: 0,
  },
});
