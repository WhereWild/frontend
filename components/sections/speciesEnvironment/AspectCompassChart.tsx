import { Size } from '@/constants/theme';
import type { SpeciesEnvironmentCategory } from '@/data/types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { ThemedText } from '@/components/text/ThemedText';
import { NavigationPillList } from '@/components/navigation/NavigationPillList';
import { formatCategoryPercent, formatValue } from './model';

const CHART_SIZE = 240;
const CX = CHART_SIZE / 2;
const CY = CHART_SIZE / 2;
const INNER_RADIUS = 18;
const MAX_OUTER_RADIUS = 86;
const LABEL_RADIUS = 107;
/** Half-width of each wedge in degrees — flush with neighbours (45° / 2). */
const SPAN_HALF_DEG = 22.5;

/**
 * SVG angles for each compass direction.
 * SVG: 0° = right (East), 90° = down (South), measured clockwise.
 */
const COMPASS_SVG_ANGLES: Record<string, number> = {
  N: 270,
  NE: 315,
  E: 0,
  SE: 45,
  S: 90,
  SW: 135,
  W: 180,
  NW: 225,
};

const DIR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const NUMERIC_ID_TO_DIR: Record<number, string> = {
  1: 'N',
  2: 'NE',
  3: 'E',
  4: 'SE',
  5: 'S',
  6: 'SW',
  7: 'W',
  8: 'NW',
};

const FULL_NAME_TO_DIR: Record<string, string> = {
  North: 'N',
  Northeast: 'NE',
  East: 'E',
  Southeast: 'SE',
  South: 'S',
  Southwest: 'SW',
  West: 'W',
  Northwest: 'NW',
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Resolves a category to its short compass direction key (N/NE/E/...). */
const resolveDirection = (category: SpeciesEnvironmentCategory): string | null => {
  if (COMPASS_SVG_ANGLES[category.className] !== undefined) return category.className;
  if (FULL_NAME_TO_DIR[category.className]) return FULL_NAME_TO_DIR[category.className];
  const numVal = Number(category.value);
  if (NUMERIC_ID_TO_DIR[numVal]) return NUMERIC_ID_TO_DIR[numVal];
  if (typeof category.value === 'string' && COMPASS_SVG_ANGLES[category.value] !== undefined)
    return category.value;
  return null;
};

/** Builds a donut-wedge SVG path from innerR to outerR centered on svgAngleDeg. */
const buildWedgePath = (svgAngleDeg: number, outerR: number): string => {
  const startDeg = svgAngleDeg - SPAN_HALF_DEG;
  const endDeg = svgAngleDeg + SPAN_HALF_DEG;
  const cos1 = Math.cos(toRad(startDeg));
  const sin1 = Math.sin(toRad(startDeg));
  const cos2 = Math.cos(toRad(endDeg));
  const sin2 = Math.sin(toRad(endDeg));

  const ix1 = CX + INNER_RADIUS * cos1;
  const iy1 = CY + INNER_RADIUS * sin1;
  const ox1 = CX + outerR * cos1;
  const oy1 = CY + outerR * sin1;
  const ox2 = CX + outerR * cos2;
  const oy2 = CY + outerR * sin2;
  const ix2 = CX + INNER_RADIUS * cos2;
  const iy2 = CY + INNER_RADIUS * sin2;

  return [
    `M ${ix1} ${iy1}`,
    `L ${ox1} ${oy1}`,
    `A ${outerR} ${outerR} 0 0 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${ix1} ${iy1}`,
    'Z',
  ].join(' ');
};

const getSelectedDescription = (category: SpeciesEnvironmentCategory) => {
  const accountPhrase =
    String(category.value) === '__other__' ? 'Together these account' : 'This accounts';
  const summarySentence = `${accountPhrase} for ${formatCategoryPercent(category.fraction)} of all observations (${formatValue(category.count)} samples).`;
  if (!category.description) return summarySentence;
  const cleaned = category.description.replace(/\.$/, '');
  return `${cleaned}. ${summarySentence}`;
};

type AspectCompassChartProps = {
  /** Categorical distribution for the aspect variable. */
  categories: SpeciesEnvironmentCategory[];
  /** Currently selected category value, if any. */
  selectedValue: number | string | null;
  /** Called when a wedge or pill is tapped. */
  onSelect?: (value: number | string) => void;
  /** Color for the description text below the chart. */
  descriptionColor: string;
  /** Fill color for unselected wedges. */
  fillColor?: string;
  /** Fill color for the selected wedge. */
  selectedFillColor?: string;
};

/** Renders aspect distribution as an interactive compass rose (polar bar chart). */
export function AspectCompassChart({
  categories,
  selectedValue,
  onSelect,
  descriptionColor,
  fillColor = '#466237',
  selectedFillColor = '#81B29A',
}: AspectCompassChartProps) {
  const validCategories = categories.filter(
    (cat) => Number.isFinite(cat.fraction) && cat.fraction >= 0,
  );

  if (!validCategories.length) {
    return (
      <View style={styles.empty}>
        <ThemedText variant="bodySmall">Aspect data unavailable.</ThemedText>
      </View>
    );
  }

  const maxFraction = Math.max(...validCategories.map((cat) => cat.fraction));

  const dirMap = new Map<string, SpeciesEnvironmentCategory>();
  for (const cat of validCategories) {
    const dir = resolveDirection(cat);
    if (dir) dirMap.set(dir, cat);
  }

  const selectedCategory =
    selectedValue !== null
      ? (validCategories.find((cat) => String(cat.value) === String(selectedValue)) ?? null)
      : null;

  const selectedDir = selectedCategory ? resolveDirection(selectedCategory) : null;

  // Sort pills in compass order for consistent display
  const orderedCategories = DIR_ORDER.flatMap((dir) => {
    const cat = dirMap.get(dir);
    return cat ? [cat] : [];
  });

  return (
    <View style={styles.container}>
      <View style={styles.chartWrapper}>
        <Svg
          width={CHART_SIZE}
          height={CHART_SIZE}
          viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
        >
          {/* Outer guide ring */}
          <Circle
            cx={CX}
            cy={CY}
            r={MAX_OUTER_RADIUS}
            fill="none"
            stroke="#888888"
            strokeWidth={0.5}
            opacity={0.2}
          />
          {/* Inner guide ring */}
          <Circle
            cx={CX}
            cy={CY}
            r={INNER_RADIUS}
            fill="none"
            stroke="#888888"
            strokeWidth={0.5}
            opacity={0.2}
          />

          {/* Wedges — radial extent proportional to fraction */}
          {DIR_ORDER.map((dir) => {
            const cat = dirMap.get(dir);
            if (!cat || cat.fraction <= 0) return null;

            const outerR =
              maxFraction > 0
                ? INNER_RADIUS + (cat.fraction / maxFraction) * (MAX_OUTER_RADIUS - INNER_RADIUS)
                : INNER_RADIUS;

            const isSelected = selectedDir === dir;
            const wedgeFill = cat.color ?? (isSelected ? selectedFillColor : fillColor);
            const svgAngle = COMPASS_SVG_ANGLES[dir];
            const d = buildWedgePath(svgAngle, outerR);

            return (
              <Path
                key={dir}
                d={d}
                fill={wedgeFill}
                opacity={isSelected ? 1 : 0.72}
                onPress={() => cat && onSelect?.(cat.value)}
              />
            );
          })}

          {/* Direction labels */}
          {DIR_ORDER.map((dir) => {
            const svgAngle = COMPASS_SVG_ANGLES[dir];
            const rad = toRad(svgAngle);
            const lx = CX + LABEL_RADIUS * Math.cos(rad);
            const ly = CY + LABEL_RADIUS * Math.sin(rad);
            const isSelected = selectedDir === dir;

            return (
              <SvgText
                key={`label-${dir}`}
                x={lx}
                y={ly}
                textAnchor="middle"
                alignmentBaseline="middle"
                fontSize={isSelected ? 13 : 10}
                fontWeight={isSelected ? 'bold' : 'normal'}
                fill={isSelected ? fillColor : '#999999'}
              >
                {dir}
              </SvgText>
            );
          })}
        </Svg>
      </View>

      <NavigationPillList
        pills={orderedCategories.map((cat) => {
          const dir = resolveDirection(cat) ?? cat.className;
          return { key: String(cat.value), label: dir };
        })}
        selectedKey={selectedValue !== null ? String(selectedValue) : ''}
        onSelectionChange={(key) => {
          const cat = validCategories.find((c) => String(c.value) === key);
          if (cat) onSelect?.(cat.value);
        }}
        direction="horizontal"
        accessibilityLabel="Aspect direction selection"
      />

      {selectedCategory ? (
        <ThemedText
          variant="bodySmall"
          style={[styles.description, { color: descriptionColor }]}
        >
          {getSelectedDescription(selectedCategory)}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Size.space['300'],
  },
  chartWrapper: {
    alignItems: 'center',
  },
  empty: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {},
});
