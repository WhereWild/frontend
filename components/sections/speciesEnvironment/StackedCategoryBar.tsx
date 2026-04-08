import { Colors, Size } from '@/constants/theme';
import type { SpeciesEnvironmentCategory } from '@/data/types';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { NavigationPillList } from '@/components/navigation/NavigationPillList';
import { useColorScheme } from '@/hooks/useColorScheme';
import { formatCategoryPercent, formatValue, type PinnedCategoryBadge } from './model';

const CATEGORY_DISPLAY_LIMIT = 8;
const CATEGORY_COLORS = [
  '#466237', // brand green
  '#E07A5F', // coral
  '#3D5A80', // navy
  '#F2CC8F', // sand
  '#81B29A', // sage
  '#E76F51', // burnt orange
  '#264653', // dark teal
  '#E9C46A', // gold
  '#F4A261', // peach
];

/** Props for rendering categorical distribution summary and selector. */
type StackedCategoryBarProps = {
  /** Category distribution data for selected variable. */
  categories: SpeciesEnvironmentCategory[];
  /** Selected category value, if any. */
  selectedValue: number | string | null;
  /** Raw category value returned for a pinned map location. */
  pinnedValue?: number | string | null;
  /** Human-readable class name returned for a pinned map location. */
  pinnedClassName?: string | null;
  /** Location-derived category value to emphasize, if any. */
  highlightedValue?: number | string | null;
  /** Point-derived category that is not present in the observed distribution. */
  unobservedHighlightedCategory?: PinnedCategoryBadge | null;
  /** Called when a category is selected from chart or pills. */
  onSelect?: (value: number | string) => void;
  /** Text color token for category description copy. */
  descriptionColor: string;
  /** Outline color used for the location-derived highlighted category. */
  highlightOutlineColor?: string;
};

/** Builds human-readable description text for the selected category. */
const getSelectedCategoryDescription = (category: SpeciesEnvironmentCategory) => {
  const accountPhrase =
    String(category.value) === '__other__' ? 'Together these account' : 'This accounts';
  const summarySentence = `${accountPhrase} for ${formatCategoryPercent(category.fraction)} of all observations (${formatValue(category.count)} samples).`;
  if (!category.description) {
    return summarySentence;
  }
  const cleanedDescription = category.description.replace(/\.$/, '');
  return `${cleanedDescription}. ${summarySentence}`;
};

/** Renders a stacked categorical bar and synchronized category pills. */
export function StackedCategoryBar({
  categories,
  selectedValue,
  pinnedValue = null,
  pinnedClassName = null,
  highlightedValue = null,
  unobservedHighlightedCategory = null,
  onSelect,
  descriptionColor,
  highlightOutlineColor = '#F59E0B',
}: StackedCategoryBarProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const validCategories = React.useMemo(
    () => categories.filter(
      (category) => Number.isFinite(category.fraction) && category.fraction >= 0,
    ),
    [categories],
  );
  const displayCategories = React.useMemo(() => {
    const topCategories = validCategories.slice(0, CATEGORY_DISPLAY_LIMIT);
    const otherCategories = validCategories.slice(CATEGORY_DISPLAY_LIMIT);

    const otherCategory: SpeciesEnvironmentCategory | null =
      otherCategories.length > 0
        ? {
          value: '__other__',
          className: 'Other',
          fraction: otherCategories.reduce((sum, cat) => sum + cat.fraction, 0),
          count: otherCategories.reduce(
            (sum, cat) =>
              sum + (Number.isFinite(cat.count) && cat.count >= 0 ? cat.count : 0),
            0,
          ),
          description: otherCategories
            .map((cat, index) => {
              if (index === 0) return cat.className;
              return cat.className.charAt(0).toLowerCase() + cat.className.slice(1);
            })
            .join(', '),
        }
        : null;

    return otherCategory ? [...topCategories, otherCategory] : topCategories;
  }, [validCategories]);
  const selectedCategory = React.useMemo(
    () => selectedValue !== null
      ? displayCategories.find((cat) => String(cat.value) === String(selectedValue)) ?? null
      : null,
    [displayCategories, selectedValue],
  );
  const hasOtherCategory = React.useMemo(
    () => displayCategories.some((category) => String(category.value) === '__other__'),
    [displayCategories],
  );
  const topCategories = React.useMemo(
    () => validCategories.slice(0, CATEGORY_DISPLAY_LIMIT),
    [validCategories],
  );
  const otherCategories = React.useMemo(
    () => validCategories.slice(CATEGORY_DISPLAY_LIMIT),
    [validCategories],
  );
  const { resolvedPinnedKey, pinnedOtherLabel } = React.useMemo(() => {
    if (pinnedValue !== null && pinnedValue !== undefined) {
      const pinnedKey = String(pinnedValue);
      if (topCategories.some((category) => String(category.value) === pinnedKey)) {
        return { resolvedPinnedKey: pinnedKey, pinnedOtherLabel: null };
      }
      const otherMatch = otherCategories.find((category) => String(category.value) === pinnedKey);
      if (hasOtherCategory && otherMatch) {
        return {
          resolvedPinnedKey: '__other__',
          pinnedOtherLabel: otherMatch.className,
        };
      }
      if (pinnedClassName?.trim()) {
        return {
          resolvedPinnedKey: '__other__',
          pinnedOtherLabel: pinnedClassName.trim(),
        };
      }
    }

    if (highlightedValue !== null) {
      return {
        resolvedPinnedKey: String(highlightedValue),
        pinnedOtherLabel: null,
      };
    }

    if (unobservedHighlightedCategory) {
      return {
        resolvedPinnedKey: '__other__',
        pinnedOtherLabel: unobservedHighlightedCategory.label,
      };
    }

    return { resolvedPinnedKey: null, pinnedOtherLabel: null };
  }, [
    hasOtherCategory,
    highlightedValue,
    otherCategories,
    pinnedClassName,
    pinnedValue,
    topCategories,
    unobservedHighlightedCategory,
  ]);
  const pills = React.useMemo(() => {
    const basePills = displayCategories.map((category, index) => {
      const baseColor = category.color ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length];
      const isOtherCategory = String(category.value) === '__other__';
      return {
        key: String(category.value),
        label:
          isOtherCategory && pinnedOtherLabel
            ? `Other (${pinnedOtherLabel})`
            : category.className,
        icon: (
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: baseColor,
            }}
          />
        ),
      };
    });

    if (!pinnedOtherLabel || !resolvedPinnedKey) {
      return basePills;
    }

    if (hasOtherCategory) {
      return basePills;
    }

    return [
      ...basePills,
      {
        key: '__other__',
        label: `Other (${pinnedOtherLabel})`,
      },
    ];
  }, [displayCategories, hasOtherCategory, pinnedOtherLabel, resolvedPinnedKey]);
  const handlePillSelectionChange = React.useCallback((key: string) => {
    if (key === '__other__' && !hasOtherCategory) {
      return;
    }
    const value = displayCategories.find((cat) => String(cat.value) === key)?.value;
    if (value !== undefined) {
      onSelect?.(value);
    }
  }, [displayCategories, hasOtherCategory, onSelect]);

  if (!validCategories.length) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant="bodySmall">Categories unavailable.</ThemedText>
      </View>
    );
  }

  const selectedCategoryDescription = selectedCategory
    ? getSelectedCategoryDescription(selectedCategory)
    : null;
  const effectiveHighlightedValue = resolvedPinnedKey;
  const descriptionDisplayText = selectedCategoryDescription?.trim().length
    ? selectedCategoryDescription
    : pinnedOtherLabel
      ? 'Species has never been observed in this environment'
      : ' ';

  return (
    <View collapsable={false} style={styles.stackedCategoryContainer}>
      <View collapsable={false} style={styles.stackedBarTrack}>
        {displayCategories.map((category, index) => {
          const fraction = category.fraction;
          const percent = Math.min(100, Math.max(0, fraction * 100));
          const categoryColor = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          const backgroundColor = category.color ?? categoryColor;
          const isHighlighted = effectiveHighlightedValue !== null &&
            String(category.value) === String(effectiveHighlightedValue);

          return (
            <Pressable
              collapsable={false}
              key={String(category.value)}
              testID={`stacked-segment-${index}`}
              onPress={() => onSelect?.(category.value)}
              style={[
                styles.stackedBarSegment,
                {
                  width: `${percent}%`,
                  backgroundColor,
                  borderWidth: 3,
                  borderColor: isHighlighted ? highlightOutlineColor : 'transparent',
                  borderStyle: isHighlighted ? 'dashed' : 'solid',
                },
              ]}
            />
          );
        })}
      </View>

      <NavigationPillList
        pills={pills}
        selectedKey={selectedValue !== null ? String(selectedValue) : ''}
        highlightedKey={
          effectiveHighlightedValue !== null
            ? String(effectiveHighlightedValue)
            : undefined
        }
        onSelectionChange={handlePillSelectionChange}
        direction="horizontal"
        accessibilityLabel="Category selection"
        highlightOutlineColor={highlightOutlineColor}
      />

      <View collapsable={false} style={styles.categoryDescriptionSlot}>
        {pinnedOtherLabel && !selectedCategoryDescription ? (
          <View
            style={[
              styles.warningPill,
              {
                backgroundColor: palette.background.warning.secondary,
                borderColor: palette.border.warning.default,
              },
            ]}
          >
            <ThemedText
              variant="bodySmall"
              style={{ color: palette.text.warning.default }}
            >
              Species has never been observed in this environment
            </ThemedText>
          </View>
        ) : (
          <ThemedText
            variant="bodySmall"
            style={[
              styles.categoryDescription,
              { color: descriptionColor },
            ]}
          >
            {descriptionDisplayText}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyChart: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryDescription: {
    minHeight: 20,
  },
  categoryDescriptionSlot: {
    minHeight: 20,
  },
  warningPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
  },
  stackedCategoryContainer: {
    gap: Size.space.text.section,
  },
  stackedBarTrack: {
    height: 32,
    borderRadius: Size.radius['200'],
    flexDirection: 'row',
    overflow: 'hidden',
  },
  stackedBarSegment: {
    height: '100%',
    minWidth: 4,
  },
});
