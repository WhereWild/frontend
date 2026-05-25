import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import type { SpeciesEnvironmentCategory, SpeciesEnvironmentRelativeRank } from '@/data/types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { NavigationPillList } from '@/components/navigation/NavigationPillList';
import { SummaryItem } from './SummaryItem';
import type { RankContextOption } from './model';
import { formatValue } from './model';

type NominalInsightsProps = {
  showRankContext: boolean;
  rankContextOptions: RankContextOption[];
  selectedRankContext: string | null;
  onRankContextChange: (value: string) => void;
  summary:
    | {
        unique_classes?: number | null;
        entropy?: number | null;
        mode?: number | string | null;
      }
    | null
    | undefined;
  summaryRanks: {
    unique_classes: SpeciesEnvironmentRelativeRank | null;
    entropy: SpeciesEnvironmentRelativeRank | null;
  };
  categoricalDistribution: SpeciesEnvironmentCategory[];
  locationFilterActive: boolean;
};

const resolveModeName = (
  mode: number | string | null | undefined,
  distribution: SpeciesEnvironmentCategory[],
): string => {
  if (mode == null) {
    return '—';
  }
  const match = distribution.find((entry) => entry.value === mode);
  return match?.className ?? String(mode);
};

export function NominalInsights({
  showRankContext,
  rankContextOptions,
  selectedRankContext,
  onRankContextChange,
  summary,
  summaryRanks,
  categoricalDistribution,
  locationFilterActive,
}: NominalInsightsProps) {
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

  const modeName = resolveModeName(summary?.mode, categoricalDistribution);

  return (
    <View collapsable={false} style={styles.container}>
      <View
        collapsable={false}
        testID='nominal-insights-rank-context-slot'
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
        <SummaryItem
          label='Unique classes'
          value={
            typeof summary?.unique_classes === 'number'
              ? String(summary.unique_classes)
              : '—'
          }
          rank={
            locationFilterActive
              ? undefined
              : (summaryRanks.unique_classes ?? null)
          }
          stacked={isStacked}
        />
        <SummaryItem
          label='Entropy'
          value={formatValue(summary?.entropy, 3)}
          rank={
            locationFilterActive ? undefined : (summaryRanks.entropy ?? null)
          }
          stacked={isStacked}
        />
        <SummaryItem
          label='Mode'
          value={modeName}
          stacked={isStacked}
          isLast
        />
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
