import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import type {
  SpeciesEnvironmentCategory,
  SpeciesEnvironmentRelativeRank,
} from '@/data/types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { NavigationPillList } from '@/components/navigation/NavigationPillList';
import { SummaryItem } from './SummaryItem';
import type { RankContextOption } from './model';
import { formatCategoryPercent, formatValue } from './model';

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
    mode_class: SpeciesEnvironmentRelativeRank | null;
    selected_class: SpeciesEnvironmentRelativeRank | null;
  };
  categoricalDistribution: SpeciesEnvironmentCategory[];
  selectedCategoryValue: number | string | null;
  locationFilterActive: boolean;
};

export function NominalInsights({
  showRankContext,
  rankContextOptions,
  selectedRankContext,
  onRankContextChange,
  summary,
  summaryRanks,
  categoricalDistribution,
  selectedCategoryValue,
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

  const selectedCategory =
    selectedCategoryValue != null
      ? (categoricalDistribution.find(
          (c) => c.value === selectedCategoryValue,
        ) ?? null)
      : null;

  const modeCategory =
    categoricalDistribution.find((c) => c.value === summary?.mode) ?? null;

  const thirdSlot =
    selectedCategory != null
      ? {
          label: selectedCategory.className,
          value: formatCategoryPercent(selectedCategory.fraction),
          rank: summaryRanks.selected_class,
        }
      : {
          label: modeCategory?.className ?? 'Mode',
          value:
            modeCategory != null
              ? formatCategoryPercent(modeCategory.fraction)
              : '—',
          rank: summaryRanks.mode_class,
        };

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
          label={thirdSlot.label}
          value={thirdSlot.value}
          rank={locationFilterActive ? undefined : (thirdSlot.rank ?? null)}
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
