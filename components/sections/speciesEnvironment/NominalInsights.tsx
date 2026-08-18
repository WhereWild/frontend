// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import type {
  SpeciesEnvironmentCategory,
  SpeciesEnvironmentRelativeRank,
} from '@/data/types';

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { NavigationPillList } from '@/components/navigation/NavigationPillList';
import { SummaryItem } from './SummaryItem';
import type { RankContextOption } from './model';
import {
  formatCategoryPercent,
  formatValue,
  joinClassNamesWithAnd,
} from './model';

type NominalInsightsProps = {
  showRankContext: boolean;
  rankContextOptions: RankContextOption[];
  selectedRankContext: string | null;
  onRankContextChange: (value: string) => void;
  isOrdinal?: boolean;
  summary:
    | {
        unique_classes?: number | null;
        entropy?: number | null;
        mode?: number | string | null;
        median?: number | null;
        q10?: number | null;
        q25?: number | null;
        q75?: number | null;
        q90?: number | null;
      }
    | null
    | undefined;
  summaryRanks: {
    unique_classes: SpeciesEnvironmentRelativeRank | null;
    entropy: SpeciesEnvironmentRelativeRank | null;
    mode_class: SpeciesEnvironmentRelativeRank | null;
    selected_class: SpeciesEnvironmentRelativeRank | null;
    q10?: SpeciesEnvironmentRelativeRank | null;
    q25?: SpeciesEnvironmentRelativeRank | null;
    median?: SpeciesEnvironmentRelativeRank | null;
    q75?: SpeciesEnvironmentRelativeRank | null;
    q90?: SpeciesEnvironmentRelativeRank | null;
  };
  summaryComparisons?: Record<string, string | null>;
  baselineCategoricalDistribution?: SpeciesEnvironmentCategory[] | null;
  categoricalDistribution: SpeciesEnvironmentCategory[];
  selectedCategoryValues: (number | string)[];
  anyFilterActive: boolean;
};

export function NominalInsights({
  showRankContext,
  rankContextOptions,
  selectedRankContext,
  onRankContextChange,
  isOrdinal = false,
  summary,
  summaryRanks,
  summaryComparisons,
  baselineCategoricalDistribution,
  categoricalDistribution,
  selectedCategoryValues,
  anyFilterActive,
}: NominalInsightsProps) {
  const { breakpoint } = useResponsive();
  const isStacked = breakpoint === 'phone' || breakpoint === 'tablet';
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [expanded, setExpanded] = React.useState(false);
  const handleToggle = React.useCallback(() => setExpanded((e) => !e), []);

  const resolveOrdinalClassName = React.useCallback(
    (classId: number | null | undefined): string | null => {
      if (classId == null) return null;
      const rounded = Math.round(classId);
      return (
        categoricalDistribution.find(
          (c) =>
            String(c.value) === `class_${rounded}` ||
            String(c.value) === String(rounded),
        )?.className ?? null
      );
    },
    [categoricalDistribution],
  );
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

  const selectedCategories = categoricalDistribution.filter((c) =>
    selectedCategoryValues.includes(c.value),
  );
  // Only one selected class has a well-defined "rank vs. other species" —
  // summaryRanks.selected_class is only ever computed for a single selection
  // (see useSpeciesEnvironmentState), so multi-select falls back to the
  // combined label/fraction without a rank.
  const selectedCategory =
    selectedCategories.length === 1 ? selectedCategories[0] : null;

  const modeCategory = (() => {
    const mode = summary?.mode;
    if (mode == null) return null;
    return (
      categoricalDistribution.find((c) => c.value === mode) ??
      (isOrdinal
        ? (categoricalDistribution.find(
            (c) => String(c.value) === `class_${Math.round(Number(mode))}`,
          ) ?? null)
        : null)
    );
  })();

  const baselineThirdFraction =
    anyFilterActive && selectedCategories.length > 0
      ? selectedCategories.reduce(
          (sum, c) =>
            sum +
            (baselineCategoricalDistribution?.find(
              (b) => String(b.value) === String(c.value),
            )?.fraction ?? 0),
          0,
        )
      : null;
  const thirdSlotComparison =
    baselineThirdFraction != null
      ? `vs. ${formatCategoryPercent(baselineThirdFraction)} globally`
      : null;

  const thirdSlot =
    selectedCategories.length > 0
      ? {
          label: joinClassNamesWithAnd(
            selectedCategories.map((c) => c.className),
          ),
          value: formatCategoryPercent(
            selectedCategories.reduce((sum, c) => sum + c.fraction, 0),
          ),
          rank: selectedCategory != null ? summaryRanks.selected_class : null,
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

      {isOrdinal ? (
        <Pressable
          onPress={handleToggle}
          testID='summary-row'
          accessibilityRole='button'
          accessibilityLabel={expanded ? 'Show fewer stats' : 'Show more stats'}
          accessibilityState={{ expanded }}
          style={({ pressed, hovered }) => [
            (pressed || (hovered ?? false)) && {
              backgroundColor: palette.background.default.secondaryHover,
              borderRadius: Size.radius['100'],
            },
          ]}
        >
          <View
            collapsable={false}
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
                anyFilterActive
                  ? undefined
                  : (summaryRanks.unique_classes ?? null)
              }
              comparison={
                anyFilterActive
                  ? (summaryComparisons?.unique_classes ?? null)
                  : null
              }
              stacked={isStacked}
              prominent={!showRankContext}
            />
            <SummaryItem
              label='Entropy'
              value={formatValue(summary?.entropy, 3)}
              rank={
                anyFilterActive ? undefined : (summaryRanks.entropy ?? null)
              }
              comparison={
                anyFilterActive ? (summaryComparisons?.entropy ?? null) : null
              }
              stacked={isStacked}
              prominent={!showRankContext}
            />
            <SummaryItem
              label={thirdSlot.label}
              value={thirdSlot.value}
              rank={anyFilterActive ? undefined : (thirdSlot.rank ?? null)}
              comparison={anyFilterActive ? thirdSlotComparison : null}
              stacked={isStacked}
              prominent={!showRankContext}
              isLast
            />
          </View>
          <View
            collapsable={false}
            style={[
              !expanded ? styles.hiddenSlot : undefined,
              { pointerEvents: expanded ? 'auto' : 'none' },
            ]}
            accessibilityElementsHidden={!expanded}
            importantForAccessibility={
              expanded ? 'auto' : 'no-hide-descendants'
            }
          >
            <View
              collapsable={false}
              style={[
                styles.summaryRow,
                { paddingTop: Size.space['200'] },
                isStacked && styles.summaryRowStacked,
              ]}
            >
              <SummaryItem
                label='Q25'
                value={resolveOrdinalClassName(summary?.q25) ?? '—'}
                rank={null}
                comparison={null}
                stacked={isStacked}
                prominent
              />
              <SummaryItem
                label='Median'
                value={resolveOrdinalClassName(summary?.median) ?? '—'}
                rank={null}
                comparison={null}
                stacked={isStacked}
                prominent
              />
              <SummaryItem
                label='Q75'
                value={resolveOrdinalClassName(summary?.q75) ?? '—'}
                rank={null}
                comparison={null}
                stacked={isStacked}
                prominent
                isLast
              />
            </View>
            <View
              collapsable={false}
              style={[
                styles.summaryRow,
                { paddingTop: Size.space['200'] },
                isStacked && styles.summaryRowStacked,
              ]}
            >
              <SummaryItem
                label='Q10'
                value={resolveOrdinalClassName(summary?.q10) ?? '—'}
                rank={null}
                comparison={null}
                stacked={isStacked}
                prominent
              />
              <SummaryItem
                label='Q90'
                value={resolveOrdinalClassName(summary?.q90) ?? '—'}
                rank={null}
                comparison={null}
                stacked={isStacked}
                prominent
                isLast
              />
            </View>
          </View>
        </Pressable>
      ) : (
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
              anyFilterActive
                ? undefined
                : (summaryRanks.unique_classes ?? null)
            }
            comparison={
              anyFilterActive
                ? (summaryComparisons?.unique_classes ?? null)
                : null
            }
            stacked={isStacked}
            prominent={!showRankContext}
          />
          <SummaryItem
            label='Entropy'
            value={formatValue(summary?.entropy, 3)}
            rank={anyFilterActive ? undefined : (summaryRanks.entropy ?? null)}
            comparison={
              anyFilterActive ? (summaryComparisons?.entropy ?? null) : null
            }
            stacked={isStacked}
            prominent={!showRankContext}
          />
          <SummaryItem
            label={thirdSlot.label}
            value={thirdSlot.value}
            rank={anyFilterActive ? undefined : (thirdSlot.rank ?? null)}
            comparison={anyFilterActive ? thirdSlotComparison : null}
            stacked={isStacked}
            prominent={!showRankContext}
            isLast
          />
        </View>
      )}
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
