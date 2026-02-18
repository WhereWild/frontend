import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { SpeciesEnvironmentRelativeRank } from '@/data/types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { NavigationPillList } from '@/components/navigation/NavigationPillList';
import { SummaryItem } from './SummaryItem';
import type { RankContextOption } from './model';
import { formatValue } from './model';

/** Props for the continuous-variable summary and ranking panel. */
type ContinuousInsightsProps = {
  /** Whether rank context controls should be shown. */
  showRankContext: boolean;
  /** Rank contexts available for selection. */
  rankContextOptions: RankContextOption[];
  /** Currently selected rank context key. */
  selectedRankContext: string | null;
  /** Updates the selected rank context key. */
  onRankContextChange: (value: string) => void;
  /** Numeric summary values shown under the density chart. */
  summary: {
    min?: number | null;
    mean?: number | null;
    max?: number | null;
  } | null | undefined;
  /** Rank metadata for min/mean/max values. */
  summaryRanks: {
    min: SpeciesEnvironmentRelativeRank | null;
    mean: SpeciesEnvironmentRelativeRank | null;
    max: SpeciesEnvironmentRelativeRank | null;
  };
  /** Comparison labels against baseline/location-filter context. */
  summaryComparisons: Record<string, string | null>;
  /** Indicates whether comparisons should be shown instead of rank labels. */
  locationFilterActive: boolean;
};

/** Renders rank-context controls and min/mean/max summary cards for continuous variables. */
export function ContinuousInsights({
  showRankContext,
  rankContextOptions,
  selectedRankContext,
  onRankContextChange,
  summary,
  summaryRanks,
  summaryComparisons,
  locationFilterActive,
}: ContinuousInsightsProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  return (
    <>
      {showRankContext && rankContextOptions.length > 1 ? (
        <>
          <View style={[styles.divider, { backgroundColor: palette.border.default.default }]} />
          <View style={styles.rankContextRow}>
            <ThemedText
              variant="body"
              style={{ textAlign: 'center' }}
            >
              Select a taxon to see how this compares to related species.
            </ThemedText>
            <NavigationPillList
              pills={rankContextOptions}
              selectedKey={selectedRankContext ?? rankContextOptions[0].key}
              onSelectionChange={onRankContextChange}
              direction="horizontal"
              accessibilityLabel="Rank context selection"
            />
          </View>
        </>
      ) : showRankContext && rankContextOptions.length === 1 ? (
        <>
          <View style={[styles.divider, { backgroundColor: palette.border.default.default }]} />
          <View style={styles.rankContextRow}>
            <ThemedText
              variant="body"
              style={{ textAlign: 'center' }}
            >
              Rankings within {rankContextOptions[0].label}
            </ThemedText>
          </View>
        </>
      ) : null}

      <View style={[styles.summaryRow, { paddingTop: Size.space['300'] }]}>
        <SummaryItem
          label="Min"
          value={formatValue(summary?.min, 1)}
          rank={locationFilterActive ? undefined : summaryRanks.min}
          comparison={locationFilterActive ? summaryComparisons.min ?? null : null}
        />
        <SummaryItem
          label="Mean"
          value={formatValue(summary?.mean, 1)}
          rank={locationFilterActive ? undefined : summaryRanks.mean}
          comparison={locationFilterActive ? summaryComparisons.mean ?? null : null}
        />
        <SummaryItem
          label="Max"
          value={formatValue(summary?.max, 1)}
          rank={locationFilterActive ? undefined : summaryRanks.max}
          comparison={locationFilterActive ? summaryComparisons.max ?? null : null}
          isLast
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    width: '100%',
    marginTop: Size.space['600'],
    marginBottom: Size.space['100'],
  },
  rankContextRow: {
    flexDirection: 'column',
    gap: Size.space['200'],
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['400'],
    justifyContent: 'space-evenly',
  },
});
