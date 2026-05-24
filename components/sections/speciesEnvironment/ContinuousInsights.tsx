import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import type { SpeciesEnvironmentRelativeRank } from '@/data/types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { NavigationPillList } from '@/components/navigation/NavigationPillList';
import { SummaryItem } from './SummaryItem';
import type { RankContextOption } from './model';
import { formatValue } from './model';

const formatDeg = (value: number | null | undefined): string => {
  const formatted = formatValue(value, 1);
  return formatted === '—' ? '—' : `${formatted}°`;
};

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
  summary:
    | {
        min?: number | null;
        mean?: number | null;
        max?: number | null;
        circular_mean?: number | null;
        rbar?: number | null;
        circular_std?: number | null;
      }
    | null
    | undefined;
  /** Rank metadata for min/mean/max (continuous) and rbar/circular_std (circular) values. */
  summaryRanks: {
    min: SpeciesEnvironmentRelativeRank | null;
    mean: SpeciesEnvironmentRelativeRank | null;
    max: SpeciesEnvironmentRelativeRank | null;
    rbar?: SpeciesEnvironmentRelativeRank | null;
    circular_std?: SpeciesEnvironmentRelativeRank | null;
  };
  /** Comparison labels against baseline/location-filter context. */
  summaryComparisons: Record<string, string | null>;
  /** Indicates whether comparisons should be shown instead of rank labels. */
  locationFilterActive: boolean;
  /** When 'circular', renders circular mean / R̄ / std dev instead of min/mean/max. */
  valueType?: string | null;
};

/** Renders rank-context controls and min/mean/max (or circular) summary cards. */
export function ContinuousInsights({
  showRankContext,
  rankContextOptions,
  selectedRankContext,
  onRankContextChange,
  summary,
  summaryRanks,
  summaryComparisons,
  locationFilterActive,
  valueType,
}: ContinuousInsightsProps) {
  const isCircular = valueType?.toLowerCase() === 'circular';
  const { breakpoint } = useResponsive();
  const isStacked = breakpoint === 'phone' || breakpoint === 'tablet';
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const hasMultipleRankContexts =
    showRankContext && rankContextOptions.length > 1;
  const hasSingleRankContext =
    showRankContext && rankContextOptions.length === 1;
  const showRankContextSection =
    hasMultipleRankContexts || hasSingleRankContext;
  const rankContextMessage = hasMultipleRankContexts
    ? 'Select a taxon to see how this compares to related species.'
    : hasSingleRankContext
      ? `Rankings within ${rankContextOptions[0].label}`
      : ' ';
  const selectedRankContextKey =
    rankContextOptions.length > 0
      ? (selectedRankContext ?? rankContextOptions[0].key)
      : '';

  return (
    <View collapsable={false} style={styles.container}>
      <View
        collapsable={false}
        testID='continuous-insights-rank-context-slot'
        accessibilityElementsHidden={!showRankContextSection}
        importantForAccessibility={
          showRankContextSection ? 'auto' : 'no-hide-descendants'
        }
        style={[
          styles.rankContextSection,
          !showRankContextSection && styles.hiddenSlot,
        ]}
      >
        <View
          collapsable={false}
          testID='continuous-insights-rank-context-content-slot'
          style={!showRankContextSection ? styles.hiddenSlot : undefined}
        >
          <View
            style={[
              styles.divider,
              {
                backgroundColor: palette.border.default.default,
                pointerEvents: 'none',
              },
            ]}
          />
          <View collapsable={false} style={styles.rankContextRow}>
            <View collapsable={false} style={styles.rankContextMessageSlot}>
              <ThemedText variant='body' style={{ textAlign: 'center' }}>
                {rankContextMessage}
              </ThemedText>
            </View>
            <View
              collapsable={false}
              testID='continuous-insights-rank-context-selector-slot'
              accessibilityElementsHidden={!hasMultipleRankContexts}
              importantForAccessibility={
                hasMultipleRankContexts ? 'auto' : 'no-hide-descendants'
              }
              style={!hasMultipleRankContexts ? styles.hiddenSlot : undefined}
            >
              <NavigationPillList
                pills={hasMultipleRankContexts ? rankContextOptions : []}
                selectedKey={selectedRankContextKey}
                onSelectionChange={onRankContextChange}
                direction='horizontal'
                accessibilityLabel='Rank context selection'
              />
            </View>
          </View>
        </View>
      </View>

      <View
        collapsable={false}
        testID='summary-row'
        style={[
          styles.summaryRow,
          { paddingTop: Size.space['300'] },
          isStacked && styles.summaryRowStacked,
        ]}
      >
        {isCircular ? (
          <>
            <SummaryItem
              label='Mean'
              value={formatDeg(summary?.circular_mean)}
              stacked={isStacked}
            />
            <SummaryItem
              label='R̄'
              value={formatValue(summary?.rbar, 3)}
              rank={locationFilterActive ? undefined : (summaryRanks.rbar ?? null)}
              stacked={isStacked}
            />
            <SummaryItem
              label='Standard Deviation'
              value={formatDeg(summary?.circular_std)}
              rank={locationFilterActive ? undefined : (summaryRanks.circular_std ?? null)}
              isLast
              stacked={isStacked}
            />
          </>
        ) : (
          <>
            <SummaryItem
              label='Min'
              value={formatValue(summary?.min, 1)}
              rank={locationFilterActive ? undefined : summaryRanks.min}
              comparison={
                locationFilterActive ? (summaryComparisons.min ?? null) : null
              }
              stacked={isStacked}
            />
            <SummaryItem
              label='Mean'
              value={formatValue(summary?.mean, 1)}
              rank={locationFilterActive ? undefined : summaryRanks.mean}
              comparison={
                locationFilterActive ? (summaryComparisons.mean ?? null) : null
              }
              stacked={isStacked}
            />
            <SummaryItem
              label='Max'
              value={formatValue(summary?.max, 1)}
              rank={locationFilterActive ? undefined : summaryRanks.max}
              comparison={
                locationFilterActive ? (summaryComparisons.max ?? null) : null
              }
              isLast
              stacked={isStacked}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: Size.space['100'],
  },
  hiddenSlot: {
    opacity: 0,
    width: 0,
    height: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  rankContextMessageSlot: {
    width: '100%',
  },
  rankContextSection: {
    width: '100%',
  },
  rankContextRow: {
    flexDirection: 'column',
    gap: Size.space.text.paragraph,
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
  },
  summaryRowStacked: {
    flexDirection: 'column',
  },
});
