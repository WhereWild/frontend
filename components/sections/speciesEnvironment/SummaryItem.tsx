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
export function SummaryItem({
  label,
  value,
  rank,
  comparison,
  isLast,
  stacked,
}: SummaryItemProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const borderColor = palette.border.default.default;
  const rankText =
    typeof rank?.rank === 'number' && typeof rank.count === 'number'
      ? `Ranks ${Math.round(rank.rank).toLocaleString()} / ${Math.round(rank.count).toLocaleString()} in ${rank.label || 'selected taxon'}`
      : ' ';
  const percentileText =
    typeof rank?.percentile === 'number' && Number.isFinite(rank.percentile)
      ? `(${formatPercent(rank.percentile)} percentile)`
      : ' ';
  const secondaryText = comparison ?? rankText;
  const secondaryDisplayText =
    secondaryText.trim().length > 0 ? secondaryText : ' ';
  const percentileDisplayText =
    percentileText.trim().length > 0 && !comparison ? percentileText : ' ';

  return (
    <View
      collapsable={false}
      style={[
        styles.summaryItem,
        stacked ? styles.summaryItemStacked : { borderRightColor: borderColor },
        stacked && !isLast && { borderBottomColor: borderColor },
        isLast && !stacked && styles.summaryItemLast,
      ]}
    >
      <ThemedText variant='body'>
        {label}: {value}
      </ThemedText>
      <View collapsable={false} style={styles.detailSlot}>
        <ThemedText
          variant='body'
          style={[
            styles.detailLine,
            {
              color: palette.text.default.secondary,
              textAlign: stacked ? 'left' : 'center',
            },
          ]}
        >
          {secondaryDisplayText}
        </ThemedText>
      </View>
      <View collapsable={false} style={styles.detailSlot}>
        <ThemedText
          variant='bodySmall'
          style={[
            styles.detailLine,
            {
              color: palette.text.default.tertiary,
              textAlign: stacked ? 'left' : 'center',
            },
          ]}
        >
          {percentileDisplayText}
        </ThemedText>
      </View>
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
  detailLine: {
    minHeight: 20,
  },
  detailSlot: {
    minHeight: 20,
    width: '100%',
  },
});
