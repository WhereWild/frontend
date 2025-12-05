import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Size } from '@/constants/theme';
import type { SpeciesEnvironmentCategory } from '@/data/types';
import { ThemedText } from '../../text/ThemedText';
import { formatFractionPercent, formatValue } from './utils';

export type CategoryDistributionListProps = {
  categories: SpeciesEnvironmentCategory[];
  barColor: string;
  trackColor: string;
  descriptionColor: string;
  observationPanelColor: string;
  observationChipColor: string;
  hintColor: string;
  selectedValue: number | null;
  onSelect?: (value: number) => void;
  resolveSamples?: (value: number) => (number | string)[] | null;
  onObservationPress?: (id: number | string) => void;
};

const CATEGORY_DISPLAY_LIMIT = 8;

export function CategoryDistributionList({
  categories,
  barColor,
  trackColor,
  descriptionColor,
  observationPanelColor,
  observationChipColor,
  hintColor,
  selectedValue,
  onSelect,
  resolveSamples,
  onObservationPress,
}: CategoryDistributionListProps) {
  if (!categories.length) {
    return (
      <View style={styles.emptyState}>
        <ThemedText variant="bodySmall">Landcover categories unavailable.</ThemedText>
      </View>
    );
  }

  const subset = categories.slice(0, CATEGORY_DISPLAY_LIMIT);

  return (
    <View style={styles.container}>
      {subset.map((category) => {
        const percent = Math.min(100, Math.max(0, category.fraction * 100));
        const samples = resolveSamples?.(category.value) ?? null;
        const interactive = Boolean(samples && samples.length);
        const content = (
          <>
            <View style={styles.rowHeader}>
              <ThemedText variant="bodySmallStrong">{category.className}</ThemedText>
              <ThemedText variant="bodySmall">
                {formatFractionPercent(category.fraction)} • {formatValue(category.count)} samples
              </ThemedText>
            </View>
            <View style={[styles.barTrack, { backgroundColor: trackColor }]}>
              <View
                style={[
                  styles.barFill,
                  { width: `${percent}%`, backgroundColor: barColor },
                ]}
              />
            </View>
            {category.description ? (
              <ThemedText
                variant="bodySmall"
                style={[styles.description, { color: descriptionColor }]}
              >
                {category.description}
              </ThemedText>
            ) : null}
          </>
        );

        if (interactive) {
          const selected = selectedValue === category.value;
          return (
            <View key={category.value} style={styles.interactiveRow}>
              <Pressable
                testID={`category-toggle-${category.value}`}
                accessibilityRole="button"
                onPress={() => onSelect?.(category.value)}
              >
                {content}
              </Pressable>
              {selected ? (
                <View style={[styles.observationPanel, { backgroundColor: observationPanelColor }]}>
                  <ThemedText variant="bodySmall">
                    Observations in {category.className}
                  </ThemedText>
                  {(samples?.length ?? 0) > 0 ? (
                    <View style={styles.observationList}>
                      {(samples ?? []).slice(0, 12).map((id) => (
                        <Pressable
                          key={String(id)}
                          onPress={() => onObservationPress?.(id)}
                          style={[styles.observationChip, { backgroundColor: observationChipColor }]}
                        >
                          <ThemedText variant="bodySmall" style={styles.observationLink}>
                            #{id}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <ThemedText variant="bodySmall">No observations recorded.</ThemedText>
                  )}
                  <ThemedText
                    variant="bodySmall"
                    style={[styles.observationHint, { color: hintColor }]}
                  >
                    Tap again to hide observation IDs.
                  </ThemedText>
                </View>
              ) : null}
            </View>
          );
        }

        return (
          <View key={category.value} style={styles.interactiveRow}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Size.space['200'],
  },
  emptyState: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interactiveRow: {
    gap: Size.space['150'],
    paddingVertical: Size.space['150'],
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  barTrack: {
    height: Size.space['150'],
    borderRadius: Size.radius['200'],
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Size.radius['200'],
  },
  description: {},
  observationPanel: {
    gap: Size.space['150'],
    padding: Size.space['200'],
    borderRadius: Size.radius['200'],
  },
  observationList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['150'],
  },
  observationChip: {
    paddingHorizontal: Size.space['150'],
    paddingVertical: Size.space['050'],
    borderRadius: Size.radius['200'],
  },
  observationLink: {
    textDecorationLine: 'underline',
  },
  observationHint: {},
});
