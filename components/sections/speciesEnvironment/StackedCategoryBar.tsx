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
  /** Selected category values (multiple = OR'd together within this variable). */
  selectedValues: (number | string)[];
  /** Raw category value returned for a pinned map location. */
  pinnedValue?: number | string | null;
  /** Human-readable class name returned for a pinned map location. */
  pinnedClassName?: string | null;
  /** Location-derived category value to emphasize, if any. */
  highlightedValue?: number | string | null;
  /** Point-derived category that is not present in the observed distribution. */
  unobservedHighlightedCategory?: PinnedCategoryBadge | null;
  /** Called when a category is selected from chart or pills. `additive` (ctrl/cmd-click
   * on web, long-press on mobile) toggles the value into/out of the selection instead
   * of replacing it. */
  onSelect?: (value: number | string, options?: { additive?: boolean }) => void;
  /** Text color token for category description copy. */
  descriptionColor: string;
  /** Outline color used for the location-derived highlighted category. */
  highlightOutlineColor?: string;
  /** Home location category value to emphasize, if any. */
  homeHighlightedValue?: number | string | null;
  /** Outline color used for the home location highlighted category. */
  homeHighlightOutlineColor?: string;
  /** Home location category that is not in the observed distribution. */
  homeUnobservedCategory?: PinnedCategoryBadge | null;
  anyFilterActive?: boolean;
  /** Word substituted for "environment" in never-observed messages. */
  environmentNoun?: string;
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
  selectedValues,
  pinnedValue = null,
  pinnedClassName = null,
  highlightedValue = null,
  homeHighlightedValue = null,
  homeUnobservedCategory = null,
  anyFilterActive = false,
  environmentNoun = 'environment',
  unobservedHighlightedCategory = null,
  onSelect,
  descriptionColor,
  highlightOutlineColor = '#F59E0B',
  homeHighlightOutlineColor = '#466237',
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
    return preserveOrder
      ? filtered
      : filtered.sort((a, b) => b.count - a.count);
  }, [categories, preserveOrder]);

  const hiddenCount = Math.max(
    0,
    validCategories.length - CATEGORY_DISPLAY_LIMIT,
  );
  const hasMore = hiddenCount > 0;

  const displayCategories = React.useMemo(() => {
    if (expanded || !hasMore) return validCategories;
    const base = validCategories.slice(0, CATEGORY_DISPLAY_LIMIT);
    if (homeHighlightedValue != null) {
      const homeIndex = validCategories.findIndex(
        (c) => String(c.value) === String(homeHighlightedValue),
      );
      if (homeIndex >= CATEGORY_DISPLAY_LIMIT) {
        base[CATEGORY_DISPLAY_LIMIT - 1] = validCategories[homeIndex];
      }
    }
    return base;
  }, [validCategories, expanded, hasMore, homeHighlightedValue]);

  const selectedValueKeys = React.useMemo(
    () => new Set(selectedValues.map((value) => String(value))),
    [selectedValues],
  );

  const selectedCategories = React.useMemo(
    () =>
      displayCategories.filter((cat) =>
        selectedValueKeys.has(String(cat.value)),
      ),
    [displayCategories, selectedValueKeys],
  );

  const selectedCategory =
    selectedCategories.length === 1 ? selectedCategories[0] : null;

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

  // Key to pass as homeHighlightedKey to NavigationPillList.
  // '__home_match__' means we also add an extra pill (home same as obs, or not in display).
  // A category value string means we reuse the existing pill (no extra pill needed).
  const homeMatchKey = React.useMemo(() => {
    if (homeHighlightedValue == null || homeUnobservedCategory) return null;
    const homeStr = String(homeHighlightedValue);
    const existsInDisplay = displayCategories.some(
      (c) => String(c.value) === homeStr,
    );
    if (!existsInDisplay || resolvedPinnedKey === homeStr)
      return '__home_match__';
    return homeStr;
  }, [
    homeHighlightedValue,
    homeUnobservedCategory,
    displayCategories,
    resolvedPinnedKey,
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
    const makeIcon = (color: string, classId: number) =>
      shapesEnabled && variableId && classId >= 0 ? (
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
      );

    // Build the home extra pill only when needed (same as obs or not in display).
    let homePill: (typeof base)[number] | null = null;
    if (homeMatchKey === '__home_match__' && homeHighlightedValue != null) {
      const homeMatchDisplayIndex = displayCategories.findIndex(
        (c) => String(c.value) === String(homeHighlightedValue),
      );
      if (homeMatchDisplayIndex >= 0) {
        const homeMatchCat = displayCategories[homeMatchDisplayIndex];
        const homeMatchColor =
          homeMatchCat.color ??
          CATEGORY_COLORS[homeMatchDisplayIndex % CATEGORY_COLORS.length];
        const homeMatchRawId = homeMatchCat.value;
        const homeMatchClassId =
          typeof homeMatchRawId === 'string' &&
          homeMatchRawId.startsWith('class_')
            ? Number(homeMatchRawId.slice(6))
            : Number(homeMatchRawId);
        homePill = {
          key: '__home_match__',
          label: homeMatchCat.className,
          icon: makeIcon(homeMatchColor, homeMatchClassId),
        };
      }
    } else if (homeUnobservedCategory) {
      const homeOtherColor = homeUnobservedCategory.color ?? '#9CA3AF';
      const homeRawId = homeUnobservedCategory.value;
      const homeClassId =
        homeRawId != null
          ? typeof homeRawId === 'string' && homeRawId.startsWith('class_')
            ? Number(homeRawId.slice(6))
            : Number(homeRawId)
          : -1;
      homePill = {
        key: '__home_other__',
        label: homeUnobservedCategory.label,
        icon: makeIcon(homeOtherColor, homeClassId),
      };
    }

    // Build obs extra pill and insert home pill immediately after it.
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
        icon: makeIcon(otherColor, otherClassId),
      });
      if (homePill) base.push(homePill);
    } else if (resolvedPinnedKey) {
      // Obs matched a regular category — insert home pill right after that pill.
      const obsIndex = base.findIndex((p) => p.key === resolvedPinnedKey);
      if (homePill) {
        if (obsIndex >= 0) {
          base.splice(obsIndex + 1, 0, homePill);
        } else {
          base.push(homePill);
        }
      }
    } else if (homePill) {
      base.push(homePill);
    }

    return base;
  }, [
    displayCategories,
    resolvedPinnedKey,
    pinnedOtherLabel,
    unobservedHighlightedCategory,
    homeMatchKey,
    homeHighlightedValue,
    homeUnobservedCategory,
    shapesEnabled,
    markerOutlineEnabled,
    variableId,
  ]);

  const handlePillSelectionChange = React.useCallback(
    (key: string, options?: { additive?: boolean }) => {
      const value = validCategories.find(
        (cat) => String(cat.value) === key,
      )?.value;
      if (value !== undefined) {
        onSelect?.(value, options);
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

  const selectedCategoryDescription =
    selectedCategories.length === 1
      ? getSelectedCategoryDescription(selectedCategories[0])
      : selectedCategories.length > 1
        ? `This accounts for ${formatCategoryPercent(
            selectedCategories.reduce((sum, c) => sum + c.fraction, 0),
          )} of all observations (${formatValue(
            selectedCategories.reduce((sum, c) => sum + c.count, 0),
          )} samples).`
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
          const isHomeHighlighted =
            !isHighlighted &&
            homeHighlightedValue != null &&
            String(category.value) === String(homeHighlightedValue);
          const isSelected = selectedValueKeys.has(String(category.value));

          return (
            <Pressable
              collapsable={false}
              key={String(category.value)}
              testID={`stacked-segment-${index}`}
              // Ctrl/Cmd-click (not shift-click) is the additive gesture —
              // shift-click is a browser-reserved "extend text selection"
              // gesture that a page can't reliably override (Firefox in
              // particular keeps extending a selection anchor from prior
              // clicks regardless of preventDefault/userSelect tricks on the
              // target), so it fights the browser instead of the user.
              // Ctrl/Cmd-click has no such built-in browser meaning here.
              onPress={(event) => {
                const nativeEvent = event?.nativeEvent as unknown as {
                  ctrlKey?: boolean;
                  metaKey?: boolean;
                };
                const additive = Boolean(
                  nativeEvent?.ctrlKey || nativeEvent?.metaKey,
                );
                onSelect?.(category.value, { additive });
              }}
              onLongPress={() => onSelect?.(category.value, { additive: true })}
              style={[
                styles.stackedBarSegment,
                {
                  width: `${percent}%`,
                  backgroundColor,
                  opacity:
                    selectedValueKeys.size > 0 && !isSelected ? 0.5 : 1,
                  borderWidth: isHighlighted || isHomeHighlighted ? 3 : 0,
                  borderColor: isHighlighted
                    ? highlightOutlineColor
                    : isHomeHighlighted
                      ? homeHighlightOutlineColor
                      : 'transparent',
                  borderStyle:
                    isHighlighted || isHomeHighlighted ? 'dashed' : 'solid',
                },
              ]}
            />
          );
        })}
      </View>

      <NavigationPillList
        pills={pills}
        selectedKey={
          selectedValues.length === 1 ? String(selectedValues[0]) : ''
        }
        selectedKeys={selectedValues.map((value) => String(value))}
        highlightedKey={
          effectiveHighlightedValue !== null
            ? String(effectiveHighlightedValue)
            : undefined
        }
        homeHighlightedKey={
          homeMatchKey ??
          (homeUnobservedCategory ? '__home_other__' : undefined)
        }
        homeHighlightOutlineColor={homeHighlightOutlineColor}
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
              {`Species has never been observed in this ${environmentNoun}${anyFilterActive ? ' with the current filters applied' : ''}`}
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
        {homeUnobservedCategory && !selectedCategoryDescription ? (
          <ThemedText
            variant='bodySmall'
            style={{ color: palette.text.brand.default }}
          >
            {`Species has never been observed in home location ${environmentNoun}${anyFilterActive ? ' with the current filters applied' : ''}`}
          </ThemedText>
        ) : null}
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
    userSelect: 'none',
  },
  stackedBarSegment: {
    height: '100%',
    minWidth: 4,
    userSelect: 'none',
  },
  showMoreButton: {
    alignSelf: 'flex-start',
  },
});
