// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import type { SpeciesEnvironmentCategory } from '@/data/types';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { NavigationPillList } from '@/components/navigation/NavigationPillList';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ShapeMarker } from '@/components/sections/speciesOccurrenceMap/ShapeMarker';
import { getCbShape } from '@/components/sections/speciesOccurrenceMap/cbColors';
import {
  formatCategoryPercent,
  formatValue,
  type PinnedCategoryBadge,
} from './model';

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
  /** Variable ID used to look up CB shapes. */
  variableId?: string;
  /** Whether to show per-category shapes on pill icons. */
  shapesEnabled?: boolean;
  /** Whether to draw a gray outline around pill icons. */
  markerOutlineEnabled?: boolean;
  /** Preserve input order instead of sorting by frequency (use for ordinal). */
  preserveOrder?: boolean;
};

/** Builds human-readable description text for the selected category. */
const getSelectedCategoryDescription = (
  category: SpeciesEnvironmentCategory,
) => {
  const summarySentence = `This accounts for ${formatCategoryPercent(category.fraction)} of all observations (${formatValue(category.count)} samples).`;
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
  variableId,
  shapesEnabled = false,
  markerOutlineEnabled = false,
  preserveOrder = false,
}: StackedCategoryBarProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const [expanded, setExpanded] = React.useState(false);

  const validCategories = React.useMemo(() => {
    const filtered = categories.filter(
      (category) => Number.isFinite(category.fraction) && category.fraction > 0,
    );
    return preserveOrder ? filtered : filtered.sort((a, b) => b.count - a.count);
  }, [categories, preserveOrder]);

  const hiddenCount = Math.max(
    0,
    validCategories.length - CATEGORY_DISPLAY_LIMIT,
  );
  const hasMore = hiddenCount > 0;

  const displayCategories = React.useMemo(
    () =>
      expanded || !hasMore
        ? validCategories
        : validCategories.slice(0, CATEGORY_DISPLAY_LIMIT),
    [validCategories, expanded, hasMore],
  );

  const selectedCategory = React.useMemo(
    () =>
      selectedValue !== null
        ? (displayCategories.find(
            (cat) => String(cat.value) === String(selectedValue),
          ) ?? null)
        : null,
    [displayCategories, selectedValue],
  );

  const { resolvedPinnedKey, pinnedOtherLabel } = React.useMemo(() => {
    if (pinnedValue !== null && pinnedValue !== undefined) {
      const pinnedKey = String(pinnedValue);
      const classKey = pinnedKey.startsWith('class_')
        ? pinnedKey
        : `class_${pinnedKey}`;
      const matchedCategory =
        validCategories.find((c) => String(c.value) === pinnedKey) ??
        validCategories.find((c) => String(c.value) === classKey);
      if (matchedCategory) {
        return {
          resolvedPinnedKey: String(matchedCategory.value),
          pinnedOtherLabel: null,
        };
      }
      if (pinnedClassName?.trim()) {
        return {
          resolvedPinnedKey: null,
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
        resolvedPinnedKey: null,
        pinnedOtherLabel: unobservedHighlightedCategory.label,
      };
    }

    return { resolvedPinnedKey: null, pinnedOtherLabel: null };
  }, [
    highlightedValue,
    pinnedClassName,
    pinnedValue,
    unobservedHighlightedCategory,
    validCategories,
  ]);

  React.useEffect(() => {
    if (!resolvedPinnedKey || expanded) return;
    const visibleKeys = new Set(
      validCategories
        .slice(0, CATEGORY_DISPLAY_LIMIT)
        .map((c) => String(c.value)),
    );
    if (!visibleKeys.has(resolvedPinnedKey)) setExpanded(true);
  }, [resolvedPinnedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pills = React.useMemo(() => {
    const base = displayCategories.map((category, index) => {
      const color =
        category.color ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length];
      const rawId = category.value;
      const classId =
        typeof rawId === 'string' && rawId.startsWith('class_')
          ? Number(rawId.slice(6))
          : Number(rawId);
      return {
        key: String(category.value),
        label: category.className,
        icon:
          shapesEnabled && variableId ? (
            <ShapeMarker
              shape={getCbShape(variableId, classId)}
              color={color}
              size={12}
              outline={markerOutlineEnabled}
            />
          ) : (
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: color,
                ...(markerOutlineEnabled
                  ? { borderWidth: 1, borderColor: 'rgba(176,176,176,0.65)' }
                  : {}),
              }}
            />
          ),
      };
    });
    if (pinnedOtherLabel) {
      const otherColor = unobservedHighlightedCategory?.color ?? '#9CA3AF';
      const rawOtherId = unobservedHighlightedCategory?.value;
      const otherClassId =
        rawOtherId != null
          ? typeof rawOtherId === 'string' && rawOtherId.startsWith('class_')
            ? Number(rawOtherId.slice(6))
            : Number(rawOtherId)
          : -1;
      base.push({
        key: '__other__',
        label: pinnedOtherLabel,
        icon:
          shapesEnabled && variableId && otherClassId >= 0 ? (
            <ShapeMarker
              shape={getCbShape(variableId, otherClassId)}
              color={otherColor}
              size={12}
              outline={markerOutlineEnabled}
            />
          ) : (
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: otherColor,
                ...(markerOutlineEnabled
                  ? { borderWidth: 1, borderColor: 'rgba(176,176,176,0.65)' }
                  : {}),
              }}
            />
          ),
      });
    }
    return base;
  }, [
    displayCategories,
    pinnedOtherLabel,
    unobservedHighlightedCategory,
    shapesEnabled,
    markerOutlineEnabled,
    variableId,
  ]);

  const handlePillSelectionChange = React.useCallback(
    (key: string) => {
      const value = validCategories.find(
        (cat) => String(cat.value) === key,
      )?.value;
      if (value !== undefined) {
        onSelect?.(value);
      }
    },
    [validCategories, onSelect],
  );

  if (!validCategories.length) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant='bodySmall'>Categories unavailable.</ThemedText>
      </View>
    );
  }

  const selectedCategoryDescription = selectedCategory
    ? getSelectedCategoryDescription(selectedCategory)
    : null;
  const effectiveHighlightedValue =
    resolvedPinnedKey ?? (pinnedOtherLabel ? '__other__' : null);
  const descriptionDisplayText = selectedCategoryDescription?.trim().length
    ? selectedCategoryDescription
    : pinnedOtherLabel
      ? 'Species has never been observed in this environment'
      : ' ';

  return (
    <View collapsable={false} style={styles.stackedCategoryContainer}>
      <View collapsable={false} style={styles.stackedBarTrack}>
        {validCategories.map((category, index) => {
          const fraction = category.fraction;
          const percent = Math.min(100, Math.max(0, fraction * 100));
          const categoryColor = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          const backgroundColor = category.color ?? categoryColor;
          const isHighlighted =
            effectiveHighlightedValue !== null &&
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
                  borderColor: isHighlighted
                    ? highlightOutlineColor
                    : 'transparent',
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
        direction='horizontal'
        accessibilityLabel='Category selection'
        highlightOutlineColor={highlightOutlineColor}
      />

      {hasMore && (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          style={styles.showMoreButton}
        >
          <ThemedText
            variant='bodySmall'
            style={{ color: palette.text.default.secondary }}
          >
            {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          </ThemedText>
        </Pressable>
      )}

      <View collapsable={false} style={styles.categoryDescriptionSlot}>
        {pinnedOtherLabel && !selectedCategoryDescription ? (
          <View
            style={[
              styles.warningPill,
              {
                backgroundColor: palette.background.warning.default,
                borderColor: palette.border.warning.default,
              },
            ]}
          >
            <ThemedText
              variant='bodySmall'
              style={{ color: palette.text.warning.default }}
            >
              Species has never been observed in this environment
            </ThemedText>
          </View>
        ) : (
          <ThemedText
            variant='bodySmall'
            style={[styles.categoryDescription, { color: descriptionColor }]}
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
  showMoreButton: {
    alignSelf: 'flex-start',
  },
});
