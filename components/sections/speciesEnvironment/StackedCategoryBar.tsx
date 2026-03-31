import { Colors, Size } from '@/constants/theme';
import type { SpeciesEnvironmentCategory } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { NavigationPillList } from '@/components/navigation/NavigationPillList';
import { formatCategoryPercent, formatValue } from './model';

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
  /** Called when a category is selected from chart or pills. */
  onSelect?: (value: number | string) => void;
  /** Text color token for category description copy. */
  descriptionColor: string;
  /** Category value of the pinned observation to highlight with a dashed outline. */
  pinnedValue?: number | string | null;
  /** Human-readable class name for the pinned value, from the backend legend. */
  pinnedClassName?: string | null;
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
  onSelect,
  descriptionColor,
  pinnedValue,
  pinnedClassName,
}: StackedCategoryBarProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const validCategories = categories.filter(
    (category) => Number.isFinite(category.fraction) && category.fraction >= 0,
  );

  if (!validCategories.length) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant="bodySmall">Categories unavailable.</ThemedText>
      </View>
    );
  }

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

  const displayCategories = otherCategory ? [...topCategories, otherCategory] : topCategories;

  const { resolvedPinnedKey, pinnedInOtherLabel } = React.useMemo(() => {
    if (pinnedValue === null || pinnedValue === undefined) {
      return { resolvedPinnedKey: null, pinnedInOtherLabel: null };
    }
    const pinnedStr = String(pinnedValue);
    if (topCategories.some((cat) => String(cat.value) === pinnedStr)) {
      return { resolvedPinnedKey: pinnedStr, pinnedInOtherLabel: null };
    }
    const inOther = otherCategories.find((cat) => String(cat.value) === pinnedStr);
    if (otherCategory && inOther) {
      return { resolvedPinnedKey: '__other__', pinnedInOtherLabel: inOther.className };
    }
    return { resolvedPinnedKey: null, pinnedInOtherLabel: null };
  }, [otherCategories, otherCategory, pinnedValue, topCategories]);

  const pinnedIsOutOfDistribution =
    pinnedValue !== null && pinnedValue !== undefined && resolvedPinnedKey === null;

  const selectedCategory =
    selectedValue !== null
      ? displayCategories.find((cat) => String(cat.value) === String(selectedValue))
      : null;

  return (
    <View style={styles.stackedCategoryContainer}>
      <View style={styles.stackedBarTrack}>
        {displayCategories.map((category, index) => {
          const fraction = category.fraction;
          const percent = Math.min(100, Math.max(0, fraction * 100));
          const categoryColor = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          const backgroundColor = category.color ?? categoryColor;
          const isPinned = resolvedPinnedKey !== null && resolvedPinnedKey === String(category.value);

          return (
            <Pressable
              key={String(category.value)}
              testID={`stacked-segment-${index}`}
              onPress={() => onSelect?.(category.value)}
              style={[
                styles.stackedBarSegment,
                {
                  width: `${percent}%`,
                  backgroundColor,
                },
                isPinned
                  ? { borderWidth: 2, borderStyle: 'dashed', borderColor: palette.border.warning.default }
                  : null,
              ]}
            />
          );
        })}
      </View>

      <NavigationPillList
        pinnedKey={resolvedPinnedKey ?? undefined}
        pills={displayCategories.map((category, index) => {
          const baseColor = category.color ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          const isOtherPinned = pinnedInOtherLabel && String(category.value) === '__other__';
          return {
            key: String(category.value),
            label: isOtherPinned ? `Other (${pinnedInOtherLabel})` : category.className,
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
        })}
        selectedKey={selectedValue !== null ? String(selectedValue) : ''}
        onSelectionChange={(key) => {
          const value = displayCategories.find((cat) => String(cat.value) === key)?.value;
          if (value !== undefined) {
            onSelect?.(value);
          }
        }}
        direction="horizontal"
        accessibilityLabel="Category selection"
      />

      {pinnedIsOutOfDistribution && pinnedClassName ? (
        <View style={[styles.pinnedCategoryPill, { borderColor: palette.border.warning.default }]}>
          <ThemedText variant="singleLineBody" style={{ color: palette.text.warning.default }} numberOfLines={1}>
            {pinnedClassName}
          </ThemedText>
        </View>
      ) : null}

      {pinnedIsOutOfDistribution ? (
        <View
          style={[
            styles.oodWarningBlock,
            {
              backgroundColor: palette.background.warning.secondary,
              borderColor: palette.border.warning.default,
            },
          ]}
        >
          <ThemedText variant="bodySmall" style={{ color: palette.text.warning.default }}>
            {'Never been observed in '}
            {pinnedClassName
              ? pinnedClassName.charAt(0).toLowerCase() + pinnedClassName.slice(1)
              : 'this location\u2019s category'}
            {'.'}
          </ThemedText>
        </View>
      ) : null}

      {selectedCategory ? (
        <ThemedText variant="bodySmall" style={[styles.categoryDescription, { color: descriptionColor }]}>
          {getSelectedCategoryDescription(selectedCategory)}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyChart: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryDescription: {},
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
  },
  pinnedCategoryPill: {
    borderWidth: Size.stroke.border,
    borderStyle: 'dashed',
    borderRadius: Size.radius['full'],
    paddingVertical: Size.space['150'],
    paddingHorizontal: Size.space['250'],
    alignSelf: 'flex-start',
  },
  oodWarningBlock: {
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    paddingVertical: Size.space['100'],
    paddingHorizontal: Size.space['200'],
    alignSelf: 'flex-start',
  },
});
