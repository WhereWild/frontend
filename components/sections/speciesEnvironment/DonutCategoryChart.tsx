// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import type { SpeciesEnvironmentCategory } from '@/data/types';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
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
const OTHER_COLOR = '#9CA3AF';

const CHART_SIZE = 200;
const CX = CHART_SIZE / 2;
const CY = CHART_SIZE / 2;
const R_OUTER = 92;
const R_INNER = 54;
const GAP_DEG = 1.2;

/** Cartesian point on a circle; 0deg = top, clockwise. */
const polar = (radius: number, angleDeg: number): [number, number] => {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
};

/** SVG path for a donut wedge between two angles (degrees). */
const wedgePath = (startDeg: number, endDeg: number): string => {
  const [x1, y1] = polar(R_OUTER, startDeg);
  const [x2, y2] = polar(R_OUTER, endDeg);
  const [x3, y3] = polar(R_INNER, endDeg);
  const [x4, y4] = polar(R_INNER, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
};

/** Props mirror StackedCategoryBar so the two are drop-in swappable. */
type DonutCategoryChartProps = {
  categories: SpeciesEnvironmentCategory[];
  selectedValues: (number | string)[];
  pinnedValue?: number | string | null;
  pinnedClassName?: string | null;
  highlightedValue?: number | string | null;
  unobservedHighlightedCategory?: PinnedCategoryBadge | null;
  onSelect?: (value: number | string, options?: { additive?: boolean }) => void;
  descriptionColor: string;
  highlightOutlineColor?: string;
  homeHighlightedValue?: number | string | null;
  homeHighlightOutlineColor?: string;
  homeUnobservedCategory?: PinnedCategoryBadge | null;
  anyFilterActive?: boolean;
  environmentNoun?: string;
  variableId?: string;
  shapesEnabled?: boolean;
  markerOutlineEnabled?: boolean;
  /** Accepted for prop-parity with StackedCategoryBar; ignored (donut is nominal only). */
  preserveOrder?: boolean;
};

const getSelectedCategoryDescription = (
  category: SpeciesEnvironmentCategory,
) => {
  const summarySentence = `This accounts for ${formatCategoryPercent(category.fraction)} of all observations (${formatValue(category.count)} samples).`;
  if (!category.description) return summarySentence;
  const cleanedDescription = category.description.replace(/\.$/, '');
  return `${cleanedDescription}. ${summarySentence}`;
};

/** Donut variant of the categorical distribution display (nominal path only). */
export function DonutCategoryChart({
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
}: DonutCategoryChartProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const [expanded, setExpanded] = React.useState(false);

  const validCategories = React.useMemo(
    () =>
      categories
        .filter(
          (category) =>
            Number.isFinite(category.fraction) && category.fraction > 0,
        )
        .sort((a, b) => b.count - a.count),
    [categories],
  );

  const hiddenCount = Math.max(
    0,
    validCategories.length - CATEGORY_DISPLAY_LIMIT,
  );
  const hasMore = hiddenCount > 0;

  const selectedValueKeys = React.useMemo(
    () => new Set(selectedValues.map((value) => String(value))),
    [selectedValues],
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

  // Wedges: top N by count, with the long tail rolled into a single "Other" wedge.
  // If a highlighted/home category lands in the tail, promote it so it stays visible.
  const wedges = React.useMemo(() => {
    if (!hasMore || expanded) {
      return {
        slices: validCategories,
        other: null as null | { fraction: number; count: number },
      };
    }
    const promoteKeys = new Set(
      [resolvedPinnedKey, homeHighlightedValue].filter(Boolean).map(String),
    );
    const head: SpeciesEnvironmentCategory[] = [];
    const tail: SpeciesEnvironmentCategory[] = [];
    validCategories.forEach((c, i) => {
      if (i < CATEGORY_DISPLAY_LIMIT || promoteKeys.has(String(c.value)))
        head.push(c);
      else tail.push(c);
    });
    const other = tail.length
      ? {
          fraction: tail.reduce((s, c) => s + c.fraction, 0),
          count: tail.reduce((s, c) => s + c.count, 0),
        }
      : null;
    return { slices: head, other };
  }, [
    validCategories,
    hasMore,
    expanded,
    resolvedPinnedKey,
    homeHighlightedValue,
  ]);

  const arcs = React.useMemo(() => {
    const total =
      wedges.slices.reduce((s, c) => s + c.fraction, 0) +
      (wedges.other?.fraction ?? 0);
    if (total <= 0) return [];
    const items: {
      key: string;
      color: string;
      startDeg: number;
      endDeg: number;
      category: SpeciesEnvironmentCategory | null;
    }[] = [];
    let cursor = 0;
    wedges.slices.forEach((category, index) => {
      const sweep = (category.fraction / total) * 360;
      items.push({
        key: String(category.value),
        color:
          category.color ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        startDeg: cursor + GAP_DEG / 2,
        endDeg: cursor + sweep - GAP_DEG / 2,
        category,
      });
      cursor += sweep;
    });
    if (wedges.other) {
      const sweep = (wedges.other.fraction / total) * 360;
      items.push({
        key: '__other_wedge__',
        color: OTHER_COLOR,
        startDeg: cursor + GAP_DEG / 2,
        endDeg: cursor + sweep - GAP_DEG / 2,
        category: null,
      });
    }
    return items;
  }, [wedges]);

  const selectedCategories = React.useMemo(
    () =>
      validCategories.filter((cat) => selectedValueKeys.has(String(cat.value))),
    [validCategories, selectedValueKeys],
  );

  const pills = React.useMemo(() => {
    const source = expanded || !hasMore ? validCategories : wedges.slices;
    const base = source.map((category, index) => {
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
    return base;
  }, [
    validCategories,
    wedges.slices,
    expanded,
    hasMore,
    shapesEnabled,
    markerOutlineEnabled,
    variableId,
  ]);

  const handlePillSelectionChange = React.useCallback(
    (key: string, options?: { additive?: boolean }) => {
      const value = validCategories.find(
        (cat) => String(cat.value) === key,
      )?.value;
      if (value !== undefined) onSelect?.(value, options);
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

  const effectiveHighlightedValue =
    resolvedPinnedKey ?? (pinnedOtherLabel ? '__other__' : null);

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
  const descriptionDisplayText = selectedCategoryDescription?.trim().length
    ? selectedCategoryDescription
    : pinnedOtherLabel
      ? 'Species has never been observed in this environment'
      : ' ';

  // Center label: selected total, else the mode (largest) category.
  const centerCategory =
    selectedCategories.length > 0 ? null : validCategories[0];
  const centerValue =
    selectedCategories.length > 0
      ? formatCategoryPercent(
          selectedCategories.reduce((s, c) => s + c.fraction, 0),
        )
      : centerCategory
        ? formatCategoryPercent(centerCategory.fraction)
        : '';
  const centerLabel =
    selectedCategories.length > 0
      ? selectedCategories.length === 1
        ? selectedCategories[0].className
        : `${selectedCategories.length} selected`
      : (centerCategory?.className ?? '');

  return (
    <View collapsable={false} style={styles.container}>
      <View collapsable={false} style={styles.chartWrap}>
        <Svg width={CHART_SIZE} height={CHART_SIZE}>
          <G>
            {arcs.map((arc) => {
              const isHighlighted =
                effectiveHighlightedValue !== null &&
                arc.key === String(effectiveHighlightedValue);
              const isHomeHighlighted =
                !isHighlighted &&
                homeHighlightedValue != null &&
                arc.key === String(homeHighlightedValue);
              const isSelected = selectedValueKeys.has(arc.key);
              const dimmed = selectedValueKeys.size > 0 && !isSelected;
              return (
                <Path
                  key={arc.key}
                  d={wedgePath(arc.startDeg, arc.endDeg)}
                  fill={arc.color}
                  opacity={dimmed ? 0.4 : 1}
                  stroke={
                    isHighlighted
                      ? highlightOutlineColor
                      : isHomeHighlighted
                        ? homeHighlightOutlineColor
                        : palette.background.default.default
                  }
                  strokeWidth={isHighlighted || isHomeHighlighted ? 3 : 1}
                  strokeDasharray={
                    isHighlighted || isHomeHighlighted ? '4 3' : undefined
                  }
                  onPress={(event) => {
                    if (!arc.category) {
                      setExpanded(true);
                      return;
                    }
                    const nativeEvent = event?.nativeEvent as unknown as {
                      ctrlKey?: boolean;
                      metaKey?: boolean;
                    };
                    const additive = Boolean(
                      nativeEvent?.ctrlKey || nativeEvent?.metaKey,
                    );
                    onSelect?.(arc.category.value, { additive });
                  }}
                />
              );
            })}
          </G>
          {centerLabel ? (
            <SvgText
              x={CX}
              y={CY - 4}
              textAnchor='middle'
              fontSize={13}
              fontWeight='600'
              fill={palette.text.default.default}
            >
              {centerValue}
            </SvgText>
          ) : null}
          {centerLabel ? (
            <SvgText
              x={CX}
              y={CY + 14}
              textAnchor='middle'
              fontSize={10}
              fill={palette.text.default.secondary}
            >
              {centerLabel.length > 16
                ? `${centerLabel.slice(0, 15)}…`
                : centerLabel}
            </SvgText>
          ) : null}
        </Svg>
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
          homeHighlightedValue != null
            ? String(homeHighlightedValue)
            : undefined
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
  container: {
    gap: Size.space.text.section,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
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
  showMoreButton: {
    alignSelf: 'flex-start',
  },
});
