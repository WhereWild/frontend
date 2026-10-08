// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Shadows, Size } from '@/constants/theme';
import type { SpeciesEnvironmentRelativeRank } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { formatPercent } from './model';
import { RankDensityChart } from './RankDensityChart';
import { useRankDensity } from './useRankDensity';

const PEEK_WIDTH = 280;

/** The enclosing summary row's tap action (expand/collapse). A rank box with a
 * peekable distribution becomes its own Pressable for hover/long-press, which
 * would otherwise swallow the row's taps — so it forwards them here. */
export const SummaryRowPressContext = React.createContext<(() => void) | null>(
  null,
);

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
  /** When true, omits rank/percentile rows and uses a larger value text size. */
  prominent?: boolean;
};

/** Displays one summary metric with optional rank/comparison metadata. */
export function SummaryItem({
  label,
  value,
  rank,
  comparison,
  isLast,
  stacked,
  prominent = false,
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

  const onRowPress = React.useContext(SummaryRowPressContext);
  const canPeek =
    !comparison &&
    !!rank?.contextTaxonId &&
    !!rank.contextRank &&
    !!rank.variable;
  const [peeking, setPeeking] = React.useState(false);
  const heldOpen = React.useRef(false);
  const { density, loading, failed } = useRankDensity(rank, canPeek && peeking);

  const itemStyle = [
    styles.summaryItem,
    stacked ? styles.summaryItemStacked : { borderRightColor: borderColor },
    stacked && !isLast && { borderBottomColor: borderColor },
    isLast && !stacked && styles.summaryItemLast,
    peeking && styles.summaryItemPeeking,
  ];

  const content = (
    <>
      <ThemedText
        variant='body'
        style={prominent ? styles.prominentValue : undefined}
      >
        {label}: {value}
      </ThemedText>
      {(!prominent || secondaryDisplayText.trim().length > 0) && (
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
      )}
      {(!prominent || percentileDisplayText.trim().length > 0) && (
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
      )}
    </>
  );

  if (!canPeek) {
    return (
      <View collapsable={false} style={itemStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      collapsable={false}
      testID='summary-item-peekable'
      style={itemStyle}
      onPress={onRowPress ?? undefined}
      onHoverIn={() => setPeeking(true)}
      onHoverOut={() => setPeeking(false)}
      onLongPress={() => {
        heldOpen.current = true;
        setPeeking(true);
      }}
      onPressOut={() => {
        if (heldOpen.current) {
          heldOpen.current = false;
          setPeeking(false);
        }
      }}
      accessibilityHint='Hover or press and hold to see how this compares across the group'
    >
      {content}
      <View
        collapsable={false}
        testID='rank-density-peek'
        style={[
          styles.peek,
          stacked ? styles.peekStacked : styles.peekCentered,
          !peeking && styles.peekHidden,
          Shadows.dropShadow400.style,
          {
            backgroundColor: palette.background.default.default,
            borderColor,
          },
        ]}
      >
        <ThemedText variant='bodySmall'>
          {label} across {rank.label || 'selected taxon'}
        </ThemedText>
        {density ? (
          <RankDensityChart density={density} marker={rank.value ?? null} />
        ) : (
          <ThemedText
            variant='bodySmall'
            style={{ color: palette.text.default.secondary }}
          >
            {loading
              ? 'Loading distribution…'
              : failed
                ? 'Distribution unavailable.'
                : ' '}
          </ThemedText>
        )}
      </View>
    </Pressable>
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
  summaryItemPeeking: {
    zIndex: 10,
  },
  peek: {
    position: 'absolute',
    bottom: '100%',
    width: PEEK_WIDTH,
    marginBottom: Size.space['100'],
    padding: Size.space['200'],
    gap: Size.space['100'],
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    pointerEvents: 'none',
  },
  peekCentered: {
    left: '50%',
    marginLeft: -PEEK_WIDTH / 2,
  },
  peekStacked: {
    left: 0,
  },
  peekHidden: {
    display: 'none',
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
  prominentValue: {
    fontSize: 18,
  },
});
