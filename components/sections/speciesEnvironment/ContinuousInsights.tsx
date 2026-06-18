// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import type {
  SpeciesEnvironmentRelativeRank,
  SpeciesEnvironmentSummary,
} from '@/data/types';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
  summary: SpeciesEnvironmentSummary | null | undefined;
  /** Rank metadata for summary metrics. */
  summaryRanks: {
    min: SpeciesEnvironmentRelativeRank | null;
    mean: SpeciesEnvironmentRelativeRank | null;
    max: SpeciesEnvironmentRelativeRank | null;
    median?: SpeciesEnvironmentRelativeRank | null;
    range?: SpeciesEnvironmentRelativeRank | null;
    std?: SpeciesEnvironmentRelativeRank | null;
    q10?: SpeciesEnvironmentRelativeRank | null;
    q25?: SpeciesEnvironmentRelativeRank | null;
    q75?: SpeciesEnvironmentRelativeRank | null;
    q90?: SpeciesEnvironmentRelativeRank | null;
    iqr?: SpeciesEnvironmentRelativeRank | null;
    q10_90_range?: SpeciesEnvironmentRelativeRank | null;
    rbar?: SpeciesEnvironmentRelativeRank | null;
    circular_std?: SpeciesEnvironmentRelativeRank | null;
    entropy?: SpeciesEnvironmentRelativeRank | null;
    mode?: SpeciesEnvironmentRelativeRank | null;
  };
  /** Comparison labels against baseline/location-filter context. */
  summaryComparisons: Record<string, string | null>;
  /** Indicates whether comparisons should be shown instead of rank labels. */
  anyFilterActive: boolean;
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
  anyFilterActive,
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

  const [expanded, setExpanded] = React.useState(false);
  const handleToggle = React.useCallback(() => setExpanded((e) => !e), []);

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

      {/* Primary row — plain View for circular (non-interactive), Pressable for numeric */}
      {isCircular ? (
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
              label='Mean'
              value={formatDeg(summary?.circular_mean)}
              comparison={
                anyFilterActive
                  ? (summaryComparisons.circular_mean ?? null)
                  : null
              }
              stacked={isStacked}
              prominent={!showRankContext}
            />
            <SummaryItem
              label='R̄'
              value={formatValue(summary?.rbar, 3)}
              rank={anyFilterActive ? undefined : (summaryRanks.rbar ?? null)}
              comparison={
                anyFilterActive ? (summaryComparisons.rbar ?? null) : null
              }
              stacked={isStacked}
              prominent={!showRankContext}
            />
            <SummaryItem
              label='Standard Deviation'
              value={formatDeg(summary?.circular_std)}
              rank={
                anyFilterActive
                  ? undefined
                  : (summaryRanks.circular_std ?? null)
              }
              comparison={
                anyFilterActive
                  ? (summaryComparisons.circular_std ?? null)
                  : null
              }
              stacked={isStacked}
              prominent={!showRankContext}
              isLast
            />
          </View>
          <View
            collapsable={false}
            style={!expanded ? styles.hiddenSlot : undefined}
            accessibilityElementsHidden={!expanded}
            importantForAccessibility={
              expanded ? 'auto' : 'no-hide-descendants'
            }
            pointerEvents={expanded ? 'auto' : 'none'}
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
                label='Mode'
                value={formatDeg(summary?.mode as number | null | undefined)}
                stacked={isStacked}
                prominent
                rank={null}
                comparison={anyFilterActive ? (summaryComparisons.mode ?? null) : null}
              />
              <SummaryItem
                label='Entropy'
                value={formatValue(summary?.entropy, 3)}
                rank={
                  anyFilterActive ? undefined : (summaryRanks.entropy ?? null)
                }
                comparison={
                  anyFilterActive ? (summaryComparisons.entropy ?? null) : null
                }
                stacked={isStacked}
                prominent
                isLast
              />
            </View>
          </View>
        </Pressable>
      ) : (
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
          {/* Primary row */}
          <View
            collapsable={false}
            style={[
              styles.summaryRow,
              { paddingTop: Size.space['300'] },
              isStacked && styles.summaryRowStacked,
            ]}
          >
            <SummaryItem
              label='Median'
              value={formatValue(summary?.median, 1)}
              rank={anyFilterActive ? undefined : (summaryRanks.median ?? null)}
              comparison={
                anyFilterActive ? (summaryComparisons.median ?? null) : null
              }
              stacked={isStacked}
              prominent={!showRankContext}
            />
            <SummaryItem
              label='Std Dev'
              value={formatValue(summary?.std, 2)}
              rank={anyFilterActive ? undefined : (summaryRanks.std ?? null)}
              comparison={
                anyFilterActive ? (summaryComparisons.std ?? null) : null
              }
              stacked={isStacked}
              prominent={!showRankContext}
            />
            <SummaryItem
              label='Range'
              value={formatValue(summary?.range, 1)}
              rank={anyFilterActive ? undefined : (summaryRanks.range ?? null)}
              comparison={
                anyFilterActive ? (summaryComparisons.range ?? null) : null
              }
              stacked={isStacked}
              prominent={!showRankContext}
              isLast
            />
          </View>

          {/* Expanded rows */}
          <View
            collapsable={false}
            style={!expanded ? styles.hiddenSlot : undefined}
            accessibilityElementsHidden={!expanded}
            importantForAccessibility={
              expanded ? 'auto' : 'no-hide-descendants'
            }
            pointerEvents={expanded ? 'auto' : 'none'}
          >
            {/* Row 2: Mean / Min / Max */}
            <View
              collapsable={false}
              style={[
                styles.summaryRow,
                { paddingTop: Size.space['200'] },
                isStacked && styles.summaryRowStacked,
              ]}
            >
              <SummaryItem
                label='Mean'
                value={formatValue(summary?.mean, 1)}
                rank={anyFilterActive ? undefined : summaryRanks.mean}
                comparison={
                  anyFilterActive ? (summaryComparisons.mean ?? null) : null
                }
                stacked={isStacked}
                prominent
              />
              <SummaryItem
                label='Min'
                value={formatValue(summary?.min, 1)}
                rank={anyFilterActive ? undefined : summaryRanks.min}
                comparison={
                  anyFilterActive ? (summaryComparisons.min ?? null) : null
                }
                stacked={isStacked}
                prominent
              />
              <SummaryItem
                label='Max'
                value={formatValue(summary?.max, 1)}
                rank={anyFilterActive ? undefined : summaryRanks.max}
                comparison={
                  anyFilterActive ? (summaryComparisons.max ?? null) : null
                }
                stacked={isStacked}
                prominent
                isLast
              />
            </View>

            {/* Row 3: Q10 / Q90 / Q10–Q90 */}
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
                value={formatValue(summary?.q10, 1)}
                rank={anyFilterActive ? undefined : (summaryRanks.q10 ?? null)}
                comparison={
                  anyFilterActive ? (summaryComparisons.q10 ?? null) : null
                }
                stacked={isStacked}
                prominent
              />
              <SummaryItem
                label='Q90'
                value={formatValue(summary?.q90, 1)}
                rank={anyFilterActive ? undefined : (summaryRanks.q90 ?? null)}
                comparison={
                  anyFilterActive ? (summaryComparisons.q90 ?? null) : null
                }
                stacked={isStacked}
                prominent
              />
              <SummaryItem
                label='Q10–Q90'
                value={formatValue(summary?.q10_90_range, 1)}
                rank={
                  anyFilterActive
                    ? undefined
                    : (summaryRanks.q10_90_range ?? null)
                }
                comparison={
                  anyFilterActive
                    ? (summaryComparisons.q10_90_range ?? null)
                    : null
                }
                stacked={isStacked}
                prominent
                isLast
              />
            </View>

            {/* Row 4: Q25 / Q75 / IQR */}
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
                value={formatValue(summary?.q25, 1)}
                rank={anyFilterActive ? undefined : (summaryRanks.q25 ?? null)}
                comparison={
                  anyFilterActive ? (summaryComparisons.q25 ?? null) : null
                }
                stacked={isStacked}
                prominent
              />
              <SummaryItem
                label='Q75'
                value={formatValue(summary?.q75, 1)}
                rank={anyFilterActive ? undefined : (summaryRanks.q75 ?? null)}
                comparison={
                  anyFilterActive ? (summaryComparisons.q75 ?? null) : null
                }
                stacked={isStacked}
                prominent
              />
              <SummaryItem
                label='IQR'
                value={formatValue(summary?.iqr, 1)}
                rank={anyFilterActive ? undefined : (summaryRanks.iqr ?? null)}
                comparison={
                  anyFilterActive ? (summaryComparisons.iqr ?? null) : null
                }
                stacked={isStacked}
                prominent
                isLast
              />
            </View>

            {/* Row 5: Mode / Entropy */}
            <View
              collapsable={false}
              style={[
                styles.summaryRow,
                { paddingTop: Size.space['200'] },
                isStacked && styles.summaryRowStacked,
              ]}
            >
              <SummaryItem
                label='Mode'
                value={formatValue(
                  summary?.mode as number | null | undefined,
                  1,
                )}
                rank={anyFilterActive ? undefined : (summaryRanks.mode ?? null)}
                comparison={
                  anyFilterActive ? (summaryComparisons.mode ?? null) : null
                }
                stacked={isStacked}
                prominent
              />
              <SummaryItem
                label='Entropy'
                value={formatValue(summary?.entropy, 3)}
                rank={
                  anyFilterActive ? undefined : (summaryRanks.entropy ?? null)
                }
                comparison={
                  anyFilterActive ? (summaryComparisons.entropy ?? null) : null
                }
                stacked={isStacked}
                prominent
                isLast
              />
            </View>
          </View>
        </Pressable>
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
    alignItems: 'center',
  },
  summaryRowStacked: {
    flexDirection: 'column',
  },
});
