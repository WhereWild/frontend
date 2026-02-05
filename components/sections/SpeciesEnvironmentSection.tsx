import { Colors, Responsive, Size } from '@/constants/theme';
import {
  fetchEnvironmentVariables,
  fetchSpeciesEnvironment,
  fetchEnvironmentRangeSlice,
  fetchSpeciesEnvironmentCategorySamples,
} from '@/data/api';
import type {
  EnvironmentVariableDefinition,
  SpeciesEnvironmentCategory,
  SpeciesEnvironmentCategoricalTotals,
  SpeciesEnvironmentHistogram,
  SpeciesEnvironmentDensity,
  SpeciesEnvironmentObservation,
  SpeciesEnvironmentRelativeRank,
  SpeciesEnvironmentStats,
  SpeciesEnvironmentSummary,
} from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path, Defs, ClipPath, Rect } from 'react-native-svg';
import { ThemedText } from '../text/ThemedText';
import { NavigationPillList } from '../navigation/NavigationPillList';

const DEFAULT_VARIABLE = 'bio_1';
const CHART_PADDING = 10; // Pads the top of the density curve so the top doesn't clip
const CHART_HEIGHT = 160;
const CATEGORY_DISPLAY_LIMIT = 8;
const ALL_CONTEXT_KEY = '__all__';
const SIGNIFICANT_CATEGORY_THRESHOLD = 0.02;
const FORCED_CATEGORICAL_VARIABLES = new Set(['landcover']);

type EnvironmentVariableOption = {
  id: string;
  label: string;
  units?: string | null;
  valueType?: string | null;
};

type CategorySampleState = {
  observations: SpeciesEnvironmentObservation[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

const DEFAULT_VARIABLES: EnvironmentVariableOption[] = [
  { id: 'elevation', label: 'Elevation' },
  { id: 'annual_precip', label: 'Annual Precipitation' },
  { id: 'mean_temp_coldest_quarter', label: 'Mean Temp (Cold Qtr)' },
  { id: 'max_temp_warmest_month', label: 'Max Temp (Warmest Mo)' },
  { id: 'landcover', label: 'Land Cover', valueType: 'categorical' },
];

const normalizeLabel = (value: string) =>
  value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export type SpeciesEnvironmentSectionProps = {
  taxonId?: number;
  variableId?: string;
  variables?: EnvironmentVariableOption[];
  onHighlightChange?: (catalogNumbers: Array<number | string>) => void;
  locationGid?: string | null;
};

type RankContextOption = {
  key: string;
  label: string;
};

type DensitySelectionRange = {
  start: number;
  end: number;
};

const formatValue = (value: number | null | undefined, digits = 0) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatRange = (
  start: number | null | undefined,
  end: number | null | undefined,
  digits = 0,
) => {
  if (typeof start !== 'number' || typeof end !== 'number') {
    return '—';
  }
  return `${formatValue(start, digits)} to ${formatValue(end, digits)}`;
};

type SummaryItemProps = {
  label: string;
  value: string;
  rank?: SpeciesEnvironmentRelativeRank | null;
  comparison?: string | null;
  isLast?: boolean;
};

const SummaryItem = ({ label, value, rank, comparison, isLast }: SummaryItemProps) => {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  return (
    <View style={[styles.summaryItem, isLast && styles.summaryItemLast]}>
      <ThemedText variant="body">{label}</ThemedText>
      <ThemedText variant="subtitle">{value}</ThemedText>
      {comparison ? (
        <ThemedText variant="body" style={{ color: palette.text.default.secondary }}>
          {comparison}
        </ThemedText>
      ) : rank ? (
        <>
          {(typeof rank.rank === 'number' && typeof rank.count === 'number') ? (
            <ThemedText variant="body" style={{ color: palette.text.default.secondary }}>
              Ranks <ThemedText variant="body" style={{ fontWeight: 'bold' }}>{Math.round(rank.rank).toLocaleString()} / {Math.round(rank.count).toLocaleString()}</ThemedText> in{' '}
              {rank.label || 'selected taxon'}
            </ThemedText>
          ) : null}
          {typeof rank.percentile === 'number' && Number.isFinite(rank.percentile) ? (
            <ThemedText variant="bodySmall" style={{ color: palette.text.default.secondary }}>
              ({formatPercent(rank.percentile)} percentile)
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

const DensityChart = ({
  curve,
  lineColor,
  fillColor,
  baselineColor,
  summary,
  selection,
  onSelectionChange,
}: {
  curve: SpeciesEnvironmentDensity | null | undefined;
  lineColor: string;
  fillColor: string;
  baselineColor: string;
  summary?: SpeciesEnvironmentSummary | null;
  selection?: DensitySelectionRange | null;
  onSelectionChange?: (range: DensitySelectionRange | null) => void;
}) => {
  const [chartWidth, setChartWidth] = React.useState(0);
  const dragOrigin = React.useRef<number | null>(null);
  const hasDragged = React.useRef(false);
  const pointCount = Math.min(curve?.points?.length ?? 0, curve?.density?.length ?? 0);
  if (!curve || pointCount === 0) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant="bodySmall">Density curve unavailable.</ThemedText>
      </View>
    );
  }
  const samples: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < pointCount; index += 1) {
    const x = curve.points[index];
    const y = curve.density[index];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      samples.push({ x, y });
    }
  }
  if (!samples.length) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant="bodySmall">Density curve unavailable.</ThemedText>
      </View>
    );
  }
  const minX = Math.min(...samples.map((sample) => sample.x));
  const maxX = Math.max(...samples.map((sample) => sample.x));
  const spanX = maxX - minX || 1;
  const maxY = Math.max(...samples.map((sample) => sample.y));
  const safeMaxY = maxY || 1;
  const normalized = samples.map((sample) => ({
    value: sample.x,
    x: ((sample.x - minX) / spanX) * 100,
    y: CHART_HEIGHT - (sample.y / safeMaxY) * (CHART_HEIGHT - CHART_PADDING),
  }));
  if (!normalized.length) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant="bodySmall">Density curve unavailable.</ThemedText>
      </View>
    );
  }
  const start = normalized[0];
  const end = normalized[normalized.length - 1];
  const linePath = normalized
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x},${y}`)
    .join(' ');
  const areaSegments = normalized.slice(1).map(({ x, y }) => `L${x},${y}`);
  const areaPath = [
    `M${start.x},${CHART_HEIGHT}`,
    `L${start.x},${start.y}`,
    ...areaSegments,
    `L${end.x},${CHART_HEIGHT}`,
    'Z',
  ].join(' ');
  const clipId = React.useMemo(
    () => `densitySelection-${Math.random().toString(36).slice(2)}`,
    [],
  );
  const selectionBounds = React.useMemo(() => {
    if (!selection) {
      return null;
    }
    const leftValue = Math.max(minX, Math.min(maxX, selection.start));
    const rightValue = Math.max(minX, Math.min(maxX, selection.end));
    const leftRatio = ((Math.min(leftValue, rightValue) - minX) / spanX) * 100;
    const rightRatio = ((Math.max(leftValue, rightValue) - minX) / spanX) * 100;
    if (!Number.isFinite(leftRatio) || !Number.isFinite(rightRatio)) {
      return null;
    }
    const width = Math.max(0, rightRatio - leftRatio);
    if (width <= 0) {
      return null;
    }
    return {
      left: leftRatio,
      width,
    };
  }, [selection, minX, maxX, spanX]);

  const getValueForLocation = React.useCallback(
    (x: number) => {
      if (!chartWidth) {
        return null;
      }
      const clamped = Math.min(Math.max(x, 0), chartWidth);
      const fraction = clamped / chartWidth;
      return minX + fraction * spanX;
    },
    [chartWidth, minX, spanX],
  );

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  }, []);

  const handleSelectionStart = React.useCallback(
    (event: GestureResponderEvent) => {
      const value = getValueForLocation(event.nativeEvent.locationX);
      if (value === null) {
        return;
      }
      dragOrigin.current = value;
      hasDragged.current = false;
    },
    [getValueForLocation],
  );

  const handleSelectionMove = React.useCallback(
    (event: GestureResponderEvent) => {
      if (dragOrigin.current === null) {
        return;
      }
      const value = getValueForLocation(event.nativeEvent.locationX);
      if (value === null) {
        return;
      }
      hasDragged.current = true;
      const startValue = Math.min(dragOrigin.current, value);
      const endValue = Math.max(dragOrigin.current, value);
      onSelectionChange?.({ start: startValue, end: endValue });
    },
    [getValueForLocation, onSelectionChange],
  );

  const handleSelectionEnd = React.useCallback(
    (event?: GestureResponderEvent) => {
      if (dragOrigin.current === null) {
        onSelectionChange?.(null);
        return;
      }
      const value =
        event && Number.isFinite(event.nativeEvent.locationX)
          ? getValueForLocation(event.nativeEvent.locationX)
          : dragOrigin.current;
      if (!hasDragged.current || value === null) {
        onSelectionChange?.(null);
      } else {
        const startValue = Math.min(dragOrigin.current, value);
        const endValue = Math.max(dragOrigin.current, value);
        onSelectionChange?.({ start: startValue, end: endValue });
      }
      dragOrigin.current = null;
      hasDragged.current = false;
    },
    [getValueForLocation, onSelectionChange],
  );

  return (
    <View
      style={styles.chartWrapper}
      onLayout={handleLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleSelectionStart}
      onResponderMove={handleSelectionMove}
      onResponderRelease={handleSelectionEnd}
      onResponderTerminate={() => handleSelectionEnd()}
    >
      <Svg
        width="100%"
        height={CHART_HEIGHT}
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Defs>
          {selectionBounds ? (
            <ClipPath id={clipId}>
              <Rect
                x={selectionBounds.left}
                y={0}
                width={selectionBounds.width}
                height={CHART_HEIGHT}
              />
            </ClipPath>
          ) : null}
        </Defs>
        <Path d={areaPath} fill={fillColor} opacity={0.3} />
        {selectionBounds ? (
          <>
            <Path d={areaPath} fill={fillColor} opacity={0.6} clipPath={`url(#${clipId})`} />
            <Path
              d={linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth={4}
              vectorEffect="non-scaling-stroke"
              clipPath={`url(#${clipId})`}
            />
          </>
        ) : null}
        <Path
          d={`M${start.x},0 L${end.x},0 L${end.x},${CHART_HEIGHT} L${start.x},${CHART_HEIGHT} Z`}
          fill="none"
          stroke={baselineColor}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {summary?.mean != null && (
          <Path
            d={`M${((summary.mean - minX) / (maxX - minX)) * 100},0 L${((summary.mean - minX) / (maxX - minX)) * 100},${CHART_HEIGHT}`}
            fill="none"
            stroke={baselineColor}
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <Path d={linePath} fill="none" stroke={lineColor} strokeWidth={2}  vectorEffect="non-scaling-stroke" />
      </Svg>
      <View style={styles.chartLabels}>
        {summary?.min != null && (
          <View style={{ position: 'absolute', left: 0, alignItems: 'center', gap: 0 }}>
            <ThemedText variant="bodySmall">{formatValue(summary.min, 1)}</ThemedText>
            <ThemedText variant="bodySmall" style={{ fontSize: 10, lineHeight: 10, opacity: 0.7 }}>min</ThemedText>
          </View>
        )}
        {summary?.mean != null && (
          <View
            style={{
              position: 'absolute',
              left: `${((summary.mean - minX) / (maxX - minX)) * 100}%`,
              alignItems: 'center',
              gap: 0,
              transform: [{ translateX: '-50%' }],
            }}
          >
            <ThemedText variant="bodySmall">{formatValue(summary.mean, 1)}</ThemedText>
            <ThemedText variant="bodySmall" style={{ fontSize: 10, lineHeight: 10, opacity: 0.7 }}>mean</ThemedText>
          </View>
        )}
        {summary?.max != null && (
          <View style={{ position: 'absolute', right: 0, alignItems: 'center', gap: 0 }}>
            <ThemedText variant="bodySmall">{formatValue(summary.max, 1)}</ThemedText>
            <ThemedText variant="bodySmall" style={{ fontSize: 10, lineHeight: 10, opacity: 0.7 }}>max</ThemedText>
          </View>
        )}
      </View>
    </View>
  );
};

const getOrdinalSuffix = (num: number) => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
};

const formatPercent = (fraction: number) => {
  if (!Number.isFinite(fraction)) {
    return '0.0th';
  }
  if (fraction * 100 < 1) {
    return '<1st'
  }
  const num = Math.round(fraction * 100);
  return num + getOrdinalSuffix(num);
};

const formatComparisonLabel = (
  current: number | null | undefined,
  baseline: number | null | undefined,
  digits = 1,
) => {
  if (typeof current !== 'number' || typeof baseline !== 'number') {
    return null;
  }
  const baselineText = formatValue(baseline, digits);
  const delta = current - baseline;
  const percent =
    Math.abs(baseline) > 1e-9 ? ((delta / Math.abs(baseline)) * 100).toFixed(0) : null;
  if (percent === null || Number.isNaN(Number(percent))) {
    return `vs ${baselineText}`;
  }
  const signed = delta > 0 ? `+${percent}%` : delta < 0 ? `${percent}%` : `${percent}%`;
  return `vs ${baselineText} (${signed})`;
};

const buildCategoricalSummary = (
  distribution: SpeciesEnvironmentCategory[],
  summary?: SpeciesEnvironmentSummary | null,
  totals?: SpeciesEnvironmentCategoricalTotals | null,
) => {
  const totalSamples =
    totals?.totalSamples ??
    (typeof summary?.count === 'number' && summary.count > 0
      ? summary.count
      : distribution.reduce((sum, entry) => sum + (entry.count || 0), 0));
  const uniqueClasses = totals?.uniqueClasses ?? distribution.length;
  const significantClasses =
    totals?.significantUniqueClasses ??
    (distribution.length
      ? distribution.filter((entry) => entry.fraction >= SIGNIFICANT_CATEGORY_THRESHOLD).length
      : 0);
  const dominant =
    distribution.length > 0
      ? distribution
          .slice()
          .sort((a, b) => (b.fraction ?? 0) - (a.fraction ?? 0))[0]
      : null;
  return {
    totalSamples,
    uniqueClasses,
    significantClasses,
    dominant,
  };
};

const CategoryDistributionList = ({
  categories,
  barColor,
  trackColor,
  descriptionColor,
  selectedValue,
  onSelect,
}: {
  categories: SpeciesEnvironmentCategory[];
  barColor: string;
  trackColor: string;
  descriptionColor: string;
  selectedValue: number | string | null;
  onSelect?: (value: number | string) => void;
}) => {
  if (!categories.length) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant="bodySmall">Categories unavailable.</ThemedText>
      </View>
    );
  }
  const subset = categories.slice(0, CATEGORY_DISPLAY_LIMIT);
  return (
    <View style={styles.categoryList}>
      {subset.map((category) => {
        const percent = Math.min(100, Math.max(0, category.fraction * 100));
        const content = (
          <>
            <View style={styles.categoryRowHeader}>
              <ThemedText variant="bodyStrong">{category.className}</ThemedText>
              <ThemedText variant="bodySmall">
                {formatPercent(category.fraction)} • {formatValue(category.count)} samples
              </ThemedText>
            </View>
            <View style={[styles.categoryBarTrack, { backgroundColor: trackColor }]}>
              <View
                style={[
                  styles.categoryBarFill,
                  { width: `${percent}%`, backgroundColor: barColor },
                ]}
              />
            </View>
            {category.description ? (
              <ThemedText
                variant="bodySmall"
                style={[styles.categoryDescription, { color: descriptionColor }]}
              >
                {category.description}
              </ThemedText>
            ) : null}
          </>
        );
        const contentWrapper =
          typeof onSelect === 'function' ? (
            <Pressable onPress={() => onSelect?.(category.value)}>{content}</Pressable>
          ) : (
            content
          );
        return (
          <View key={String(category.value)} style={styles.categoryRow}>
            {contentWrapper}
          </View>
        );
      })}
    </View>
  );
};

const estimatePercentileFromHistogram = (
  histogram: SpeciesEnvironmentHistogram | null,
  target: number | null | undefined,
): number | null => {
  if (!histogram || typeof target !== 'number' || Number.isNaN(target)) {
    return null;
  }
  const { bins, counts } = histogram;
  if (bins.length < 2 || !counts.length) {
    return null;
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) {
    return null;
  }
  let cumulative = 0;
  for (let index = 0; index < counts.length; index += 1) {
    const start = bins[index] ?? bins[index - 1] ?? 0;
    const end = bins[index + 1] ?? start;
    if (target >= end) {
      cumulative += counts[index];
      continue;
    }
    if (target <= start) {
      break;
    }
    const span = end - start || 1;
    const fraction = Math.max(0, Math.min(1, (target - start) / span));
    cumulative += counts[index] * fraction;
    break;
  }
  return Math.min(1, Math.max(0, cumulative / total));
};

type ObservationPanelItem = number | string | { id: number | string; label?: string };

const isObjectObservationItem = (
  item: ObservationPanelItem,
): item is { id: number | string; label?: string } =>
  typeof item === 'object' && item !== null && 'id' in item;

const normalizeObservationItem = (
  item: ObservationPanelItem,
): { id: number | string; label: string } => {
  if (isObjectObservationItem(item)) {
    const label =
      item.label && item.label.length > 0 ? item.label : `#${String(item.id ?? '')}`.trim();
    return { id: item.id, label };
  }
  return { id: item, label: `#${String(item)}` };
};

const ObservationPanel = ({
  title,
  description,
  items,
  onPressItem,
  backgroundColor,
  chipColor,
  emptyMessage,
}: {
  title: string;
  description: string;
  items: ObservationPanelItem[];
  onPressItem?: (id: number | string) => void;
  backgroundColor?: string;
  chipColor?: string;
  emptyMessage?: string;
}) => (
  <View style={[styles.observationPanel, backgroundColor ? { backgroundColor } : null]}>
    <ThemedText variant="bodySmallEmphasis">{title}</ThemedText>
    <ThemedText variant="bodySmall">{description}</ThemedText>
    {items.length ? (
      <View style={styles.observationList}>
        {items.slice(0, 12).map((item, index) => {
          const normalized = normalizeObservationItem(item);
          return (
            <Pressable
              key={`${String(normalized.id)}-${index}`}
              onPress={() => onPressItem?.(normalized.id)}
              style={[styles.observationChip, chipColor ? { backgroundColor: chipColor } : null]}
            >
              <ThemedText variant="bodySmall" style={styles.observationLink}>
                {normalized.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    ) : (
      <ThemedText variant="bodySmall">
        {emptyMessage ?? 'No observations recorded.'}
      </ThemedText>
    )}
  </View>
);

export function SpeciesEnvironmentSection({
  taxonId,
  variableId = DEFAULT_VARIABLE,
  variables,
  onHighlightChange,
  locationGid,
}: SpeciesEnvironmentSectionProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [remoteVariables, setRemoteVariables] =
    React.useState<EnvironmentVariableOption[] | null>(null);
  const resolvedVariables = React.useMemo(() => {
    if (variables && variables.length > 0) {
      return variables;
    }
    if (remoteVariables && remoteVariables.length > 0) {
      return remoteVariables;
    }
    return DEFAULT_VARIABLES;
  }, [remoteVariables, variables]);
  const fallbackVariable = variableId || resolvedVariables[0]?.id || DEFAULT_VARIABLE;
  const [selectedVariable, setSelectedVariable] = React.useState(fallbackVariable);
  React.useEffect(() => {
    setSelectedVariable(fallbackVariable);
  }, [fallbackVariable]);
  React.useEffect(() => {
    setSelectedCategoryValue(null);
    setSelectedDensityRange(null);
    setRangeObservations([]);
    setRangeObservationsError(null);
    setCategorySamplesByValue({});
  }, [selectedVariable]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetchEnvironmentVariables();
        if (!cancelled && response.length) {
          const mapped: EnvironmentVariableOption[] = response.map((entry) => ({
            id: entry.id,
            label: entry.name ?? normalizeLabel(entry.id),
            units: entry.units ?? null,
            valueType: entry.valueType ?? entry.valueType ?? null,
          }));
          setRemoteVariables(mapped);
        }
      } catch (err) {
        console.warn('Failed to load variable catalog', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    setCategorySamplesByValue({});
  }, [taxonId, locationGid]);

  const [statsByVariable, setStatsByVariable] = React.useState<
    Record<string, SpeciesEnvironmentStats>
  >({});
  const [errorByVariable, setErrorByVariable] = React.useState<Record<string, string | null>>({});
  const [loadingVariable, setLoadingVariable] = React.useState<string | null>(null);
  const [selectedCategoryValue, setSelectedCategoryValue] = React.useState<
    number | string | null
  >(null);
  const [categorySamplesByValue, setCategorySamplesByValue] = React.useState<
    Record<string, CategorySampleState>
  >({});
  const [selectedRankContext, setSelectedRankContext] = React.useState<string | null>(null);
  const [selectedDensityRange, setSelectedDensityRange] =
    React.useState<DensitySelectionRange | null>(null);
  const [rangeObservations, setRangeObservations] = React.useState<
    SpeciesEnvironmentObservation[]
  >([]);
  const [rangeObservationsLoading, setRangeObservationsLoading] = React.useState(false);
  const [rangeObservationsError, setRangeObservationsError] = React.useState<string | null>(null);
  const locationFilterActive = Boolean(locationGid);

  React.useEffect(() => {
    setStatsByVariable({});
    setErrorByVariable({});
    setSelectedCategoryValue(null);
    setSelectedDensityRange(null);
    setRangeObservations([]);
    setRangeObservationsError(null);
  }, [taxonId, locationGid]);

  const hasStatsForSelection = Boolean(selectedVariable && statsByVariable[selectedVariable]);

  React.useEffect(() => {
    if (!taxonId || !selectedVariable || hasStatsForSelection) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingVariable(selectedVariable);
      setErrorByVariable((prev) => ({ ...prev, [selectedVariable]: null }));
      try {
        const response = await fetchSpeciesEnvironment(taxonId, selectedVariable, {
          location: locationGid,
        });
        if (cancelled) {
          return;
        }
        setStatsByVariable((prev) => ({ ...prev, [selectedVariable]: response }));
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Failed to load environment stats';
        setErrorByVariable((prev) => ({ ...prev, [selectedVariable]: message }));
      } finally {
        if (!cancelled) {
          setLoadingVariable((prev) => (prev === selectedVariable ? null : prev));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasStatsForSelection, selectedVariable, taxonId, locationGid]);

  if (!taxonId) {
    return null;
  }

  const stats = selectedVariable ? statsByVariable[selectedVariable] ?? null : null;
  const baselineSummary = locationFilterActive ? stats?.baselineSummary ?? null : null;
  const baselineCategoricalDistribution = locationFilterActive
    ? stats?.baselineCategoricalDistribution ?? []
    : [];
  const baselineCategoricalTotals = locationFilterActive
    ? stats?.baselineCategoricalTotals ?? null
    : null;
  const selectedVariableMeta = React.useMemo(
    () => resolvedVariables.find((option) => option.id === selectedVariable) ?? null,
    [resolvedVariables, selectedVariable],
  );
  const error = selectedVariable ? errorByVariable[selectedVariable] ?? null : null;
  const loading = loadingVariable === selectedVariable;
  const summary = stats?.summary;
  const summaryRangeValue =
    typeof summary?.q01 === 'number' && typeof summary?.q99 === 'number'
      ? summary.q99 - summary.q01
      : null;
  const baselineRangeValue =
    typeof baselineSummary?.q01 === 'number' && typeof baselineSummary?.q99 === 'number'
      ? baselineSummary.q99 - baselineSummary.q01
      : null;
  const categoricalDistribution = stats?.categoricalDistribution ?? [];
  const variableType =
    stats?.variableType?.toLowerCase?.() ??
    selectedVariableMeta?.valueType?.toLowerCase?.() ??
    null;
  const forcedCategorical = FORCED_CATEGORICAL_VARIABLES.has(
    (selectedVariable ?? '').toLowerCase(),
  );
  const isCategorical =
    forcedCategorical || variableType === 'categorical' || categoricalDistribution.length > 0;
  const densityCurve = isCategorical ? null : stats?.densityCurve ?? null;

  const rankContextOptions = React.useMemo(() => {
    if (
      locationFilterActive ||
      !stats?.relativeRanks ||
      !stats.relativeRanks.length
    ) {
      return [] as RankContextOption[];
    }
    const seen = new Map<string, string>();
    stats.relativeRanks.forEach((entry) => {
      const label = entry.label ?? entry.context ?? null;
      if (!label || seen.has(label)) {
        return;
      }
      seen.set(label, label);
    });
    const contexts = Array.from(seen.entries()).map(([key, label]) => ({
      key,
      label,
    }));
    return contexts.reverse();
  }, [locationFilterActive, stats?.relativeRanks]);

  React.useEffect(() => {
    if (!rankContextOptions.length) {
      setSelectedRankContext(null);
      return;
    }
    setSelectedRankContext((prev) => {
      if (prev && rankContextOptions.some((option) => option.key === prev)) {
        return prev;
      }
      return rankContextOptions[0].key;
    });
  }, [rankContextOptions]);

  const selectedCategory =
    isCategorical && selectedCategoryValue !== null
      ? categoricalDistribution.find(
          (category) => String(category.value) === String(selectedCategoryValue),
        )
      : null;
  const selectedCategoryKey =
    selectedCategoryValue !== null ? String(selectedCategoryValue) : null;
  const selectedCategorySampleState = selectedCategoryKey
    ? categorySamplesByValue[selectedCategoryKey]
    : undefined;
  const selectedCategoryObservationItems = React.useMemo(() => {
    if (!selectedCategorySampleState?.observations?.length) {
      return [];
    }
    return selectedCategorySampleState.observations.map((obs) => ({
      id: obs.catalogNumber,
      label:
        typeof obs.value === 'number' || typeof obs.value === 'string'
          ? `#${obs.catalogNumber} (${obs.value})`
          : `#${obs.catalogNumber}`,
    }));
  }, [selectedCategorySampleState]);
  const selectedCategoryObservationDescription = selectedCategorySampleState?.error
    ? selectedCategorySampleState.error
    : selectedCategorySampleState?.loading
      ? 'Loading observations…'
      : 'Tap an observation ID to open it on iNaturalist.';
  const selectionRangeKey = selectedDensityRange
    ? `${selectedDensityRange.start.toFixed(4)}:${selectedDensityRange.end.toFixed(4)}`
    : null;

  React.useEffect(() => {
    if (!stats?.categoricalSamples || !stats.categoricalSamples.length) {
      return;
    }
    if (locationGid) {
      return;
    }
    setCategorySamplesByValue((prev) => {
      let changed = false;
      const next = { ...prev };
      stats.categoricalSamples?.forEach((entry) => {
        const key = String(entry.value);
        if (!Array.isArray(entry.observationIds) || !entry.observationIds.length) {
          return;
        }
        const existing = next[key];
        if (existing && existing.loaded && existing.observations.length) {
          return;
        }
        next[key] = {
          observations: entry.observationIds.map((id) => ({
            catalogNumber: id,
            value: null,
            latitude: null,
            longitude: null,
          })),
          loading: false,
          loaded: true,
          error: null,
        };
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [stats?.categoricalSamples, selectedVariable, locationGid]);

  React.useEffect(() => {
    if (
      !isCategorical ||
      !taxonId ||
      !selectedVariable ||
      !selectedCategoryKey ||
      selectedCategorySampleState?.loading ||
      selectedCategorySampleState?.loaded
    ) {
      return;
    }
    let cancelled = false;
    setCategorySamplesByValue((prev) => ({
      ...prev,
      [selectedCategoryKey]: {
        observations: prev[selectedCategoryKey]?.observations ?? [],
        loading: true,
        loaded: false,
        error: null,
      },
    }));
    (async () => {
      try {
        const response = await fetchSpeciesEnvironmentCategorySamples(
          taxonId,
          selectedVariable,
          selectedCategoryKey,
          { location: locationGid ?? undefined },
        );
        if (cancelled) {
          return;
        }
        setCategorySamplesByValue((prev) => ({
          ...prev,
          [selectedCategoryKey]: {
            observations: response.observations ?? [],
            loading: false,
            loaded: true,
            error: null,
          },
        }));
      } catch (err) {
        if (cancelled) {
          return;
        }
        setCategorySamplesByValue((prev) => ({
          ...prev,
          [selectedCategoryKey]: {
            observations: [],
            loading: false,
            loaded: true,
            error:
              err instanceof Error ? err.message : 'Failed to load category observations.',
          },
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isCategorical,
    selectedCategoryKey,
    selectedVariable,
    taxonId,
    locationGid,
  ]);

  const handleDensitySelectionChange = React.useCallback(
    (range: DensitySelectionRange | null) => {
      setSelectedDensityRange(range);
    },
    [],
  );

  React.useEffect(() => {
    if (!taxonId || !selectedVariable || !selectedDensityRange) {
      setRangeObservations([]);
      setRangeObservationsError(null);
      setRangeObservationsLoading(false);
      onHighlightChange?.([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setRangeObservationsLoading(true);
      setRangeObservationsError(null);
      try {
        const response = await fetchEnvironmentRangeSlice({
          taxonId,
          variableId: selectedVariable,
          min: selectedDensityRange.start,
          max: selectedDensityRange.end,
          location: locationGid ?? undefined,
        });
        if (cancelled) {
          return;
        }
        setRangeObservations(response.observations ?? []);
        onHighlightChange?.(
          (response.observations ?? [])
            .map((entry) => entry.catalogNumber)
            .filter((id) => typeof id === 'number' || typeof id === 'string'),
        );
      } catch (err) {
        if (cancelled) {
          return;
        }
        setRangeObservationsError(
          err instanceof Error ? err.message : 'Failed to load observations',
        );
        setRangeObservations([]);
        onHighlightChange?.([]);
      } finally {
        if (!cancelled) {
          setRangeObservationsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    onHighlightChange,
    selectedDensityRange,
    selectionRangeKey,
    selectedVariable,
    taxonId,
    locationGid,
  ]);

  React.useEffect(() => {
    if (!selectedDensityRange) {
      onHighlightChange?.([]);
    }
  }, [onHighlightChange, selectedDensityRange]);

  React.useEffect(() => {
    if (!onHighlightChange) {
      return;
    }
    if (!isCategorical) {
      return;
    }
    if (selectedCategoryValue === null) {
      onHighlightChange([]);
      return;
    }
    const catalogs = (selectedCategorySampleState?.observations ?? [])
      .map((entry) => entry.catalogNumber)
      .filter((id) => typeof id === 'number' || typeof id === 'string');
    if (!catalogs.length) {
      onHighlightChange([]);
      return;
    }
    onHighlightChange(catalogs);
  }, [
    isCategorical,
    onHighlightChange,
    selectedCategorySampleState?.observations,
    selectedCategoryValue,
  ]);

  const rangeObservationItems = React.useMemo(
    () =>
      rangeObservations.map((entry) => ({
        id: entry.catalogNumber,
        label:
          typeof entry.value === 'number'
            ? `#${entry.catalogNumber} (${formatValue(entry.value, 1)})`
            : `#${entry.catalogNumber}`,
      })),
    [rangeObservations],
  );

  const handleObservationPress = React.useCallback((id: number | string) => {
    const normalized = String(id).trim();
    if (!normalized.length) {
      return;
    }
    const url = `https://www.inaturalist.org/observations/${normalized}`;
    Linking.openURL(url).catch((err) => {
      console.warn('Failed to open observation', id, err);
    });
  }, []);

const resolveRankForMetric = React.useCallback(
    (
      metric: string,
      value: number | null | undefined,
      options?: { allowHistogramFallback?: boolean },
    ) => {
      const allowHistogramFallback =
        options?.allowHistogramFallback ?? ['min', 'mean', 'max'].includes(metric.toLowerCase());
      if (!stats) {
        return null;
      }
      const normalizedMetric = metric.toLowerCase();
      const rawCandidates =
        stats.relativeRanks?.filter((entry) => entry.metric?.toLowerCase?.() === normalizedMetric) ??
        [];
      const filteredCandidates =
        selectedRankContext && selectedRankContext !== ALL_CONTEXT_KEY
          ? rawCandidates.filter(
              (entry) => (entry.label ?? entry.context ?? '') === selectedRankContext,
            )
          : rawCandidates;
      const prioritized = filteredCandidates.length ? filteredCandidates : rawCandidates;
      if (prioritized.length) {
        return prioritized
          .filter(
            (entry) => typeof entry.rank === 'number' || typeof entry.percentile === 'number',
          )
          .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0];
      }
      if (!allowHistogramFallback) {
        return null;
      }
      const fallbackPercentile = estimatePercentileFromHistogram(stats.histogram ?? null, value);
      if (fallbackPercentile === null) {
        return null;
      }
      return {
        metric,
        percentile: fallbackPercentile,
        label: 'Distribution',
      } as SpeciesEnvironmentRelativeRank;
    },
    [stats, selectedRankContext],
  );

  const summaryRanks = React.useMemo(
    () => ({
      min: resolveRankForMetric('min', summary?.min),
      mean: resolveRankForMetric('mean', summary?.mean),
      max: resolveRankForMetric('max', summary?.max),
      std: resolveRankForMetric('std', summary?.stddev, { allowHistogramFallback: false }),
      range99: resolveRankForMetric(
        '1-99 range',
        summaryRangeValue,
        { allowHistogramFallback: false },
      ),
    }),
    [
      resolveRankForMetric,
      summary?.max,
      summary?.mean,
      summary?.min,
      summary?.stddev,
      summaryRangeValue,
    ],
  );
  const summaryComparisons = React.useMemo<Record<string, string | null>>(() => {
    if (!locationFilterActive) {
      return {
        min: null,
        mean: null,
        max: null,
        std: null,
        range99: null,
      };
    }
    return {
      min: formatComparisonLabel(summary?.min ?? null, baselineSummary?.min ?? null, 1),
      mean: formatComparisonLabel(summary?.mean ?? null, baselineSummary?.mean ?? null, 1),
      max: formatComparisonLabel(summary?.max ?? null, baselineSummary?.max ?? null, 1),
      std: formatComparisonLabel(summary?.stddev ?? null, baselineSummary?.stddev ?? null, 1),
      range99: formatComparisonLabel(summaryRangeValue, baselineRangeValue, 1),
    };
  }, [
    baselineRangeValue,
    baselineSummary?.max,
    baselineSummary?.mean,
    baselineSummary?.min,
    baselineSummary?.stddev,
    locationFilterActive,
    summary?.max,
    summary?.mean,
    summary?.min,
    summary?.stddev,
    summaryRangeValue,
  ]);

  const categoricalSummary = React.useMemo(
    () => (isCategorical ? buildCategoricalSummary(categoricalDistribution, summary) : null),
    [categoricalDistribution, isCategorical, summary],
  );

  const baselineCategoricalSummary = React.useMemo(() => {
    if (!locationFilterActive || !isCategorical) {
      return null;
    }
    return buildCategoricalSummary(
      baselineCategoricalDistribution,
      baselineSummary,
      baselineCategoricalTotals,
    );
  }, [
    baselineCategoricalDistribution,
    baselineCategoricalTotals,
    baselineSummary,
    isCategorical,
    locationFilterActive,
  ]);

  const categoricalComparisons = React.useMemo<Record<string, string | null>>(() => {
    if (!locationFilterActive) {
      return {
        unique: null,
        significant: null,
      };
    }
    return {
      unique: formatComparisonLabel(
        categoricalSummary?.uniqueClasses ?? null,
        baselineCategoricalSummary?.uniqueClasses ?? null,
        0,
      ),
      significant: formatComparisonLabel(
        categoricalSummary?.significantClasses ?? null,
        baselineCategoricalSummary?.significantClasses ?? null,
        0,
      ),
    };
  }, [baselineCategoricalSummary, categoricalSummary, locationFilterActive]);

  const categoricalTopComparison =
    locationFilterActive && baselineCategoricalSummary?.dominant
      ? `Global top: ${baselineCategoricalSummary.dominant.className} (${formatPercent(
          baselineCategoricalSummary.dominant.fraction,
        )})`
      : null;
  const showRankContext = !locationFilterActive && rankContextOptions.length > 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      {resolvedVariables.length ? (
        <ScrollView
          style={styles.variableScroll}
          showsVerticalScrollIndicator
        >
          <NavigationPillList
            pills={resolvedVariables.map((option) => ({
              key: option.id,
              label: option.label,
            }))}
            selectedKey={selectedVariable}
            onSelectionChange={setSelectedVariable}
            direction="horizontal"
            accessibilityLabel="Environment variables"
          />
        </ScrollView>
      ) : null}

      {stats && (
        <View style={styles.variableHeadingRow}>
          <ThemedText variant="heading">
            {stats?.variableName ?? selectedVariableMeta?.label ?? 'Environment'}
            {!isCategorical && (stats?.units || selectedVariableMeta?.units) ? ` (${stats?.units ?? selectedVariableMeta?.units})` : ''}
          </ThemedText>
          <ThemedText variant="bodySmall">
            Based on{' '}
            {formatValue(
              isCategorical
                ? categoricalSummary?.totalSamples ?? summary?.count ?? 0
                : summary?.count ?? 0,
            )}{' '}
            samples
          </ThemedText>
        </View>
      )}

      {loading && !stats ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={palette.text.brand.default} />
          <ThemedText variant="bodySmall">Loading environment data…</ThemedText>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.errorRow}>
          <ThemedText variant="bodySmall">{error}</ThemedText>
        </View>
      ) : null}

      {stats ? (
        <>
          {isCategorical ? (
            <CategoryDistributionList
              categories={categoricalDistribution}
              barColor={palette.background.brand.default}
              trackColor={palette.background.default.tertiary}
              descriptionColor={palette.text.default.secondary}
              selectedValue={selectedCategoryValue}
              onSelect={(value) =>
                setSelectedCategoryValue((prev) => (prev === value ? null : value))
              }
            />
          ) : (
            <DensityChart
              curve={densityCurve}
              lineColor={palette.background.brand.default}
              fillColor={palette.background.brand.default}
              baselineColor={palette.text.default.default}
              summary={summary}
              selection={selectedDensityRange}
              onSelectionChange={handleDensitySelectionChange}
            />
          )}

          {!isCategorical && selectedDensityRange ? (
            <View style={styles.selectionSummary}>
              <ThemedText variant="bodySmall">
                Selected range {formatValue(selectedDensityRange.start, 1)} to{' '}
                {formatValue(selectedDensityRange.end, 1)}
              </ThemedText>
              <Pressable onPress={() => setSelectedDensityRange(null)}>
                <ThemedText variant="bodySmallEmphasis">Clear</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {!isCategorical && selectedDensityRange ? (
            <ObservationPanel
              title={`${rangeObservationItems.length} observations in selected range`}
              description={
                rangeObservationsError
                  ? rangeObservationsError
                  : rangeObservationsLoading
                    ? 'Loading observations…'
                    : 'Tap an observation ID to open it on iNaturalist.'
              }
              items={rangeObservationItems}
              onPressItem={handleObservationPress}
              backgroundColor={palette.background.default.tertiary}
              chipColor={palette.background.default.secondary}
              emptyMessage={rangeObservationsLoading ? 'Loading observations…' : undefined}
            />
          ) : null}

          {isCategorical ? (
            <View style={[styles.summaryRow, { paddingTop: Size.space['600'] }]}>
              <SummaryItem
                label="Unique classes"
                value={formatValue(categoricalSummary?.uniqueClasses ?? 0)}
                comparison={
                  locationFilterActive ? categoricalComparisons.unique ?? null : null
                }
              />
              <SummaryItem
                label="Significant classes"
                value={formatValue(categoricalSummary?.significantClasses ?? 0)}
                comparison={
                  locationFilterActive ? categoricalComparisons.significant ?? null : null
                }
              />
              {categoricalSummary?.dominant ? (
                <SummaryItem
                  label="Top class"
                  value={`${categoricalSummary.dominant.className} (${formatPercent(
                    categoricalSummary.dominant.fraction,
                  )})`}
                  comparison={locationFilterActive ? categoricalTopComparison : null}
                />
              ) : null}
            </View>
          ) : (
            <View style={[styles.summaryRow, { paddingTop: Size.space['600'] }]}>
              <SummaryItem
                label="Min"
                value={formatValue(summary?.min, 1)}
                rank={locationFilterActive ? undefined : summaryRanks.min}
                comparison={locationFilterActive ? summaryComparisons.min ?? null : null}
              />
              <SummaryItem
                label="Mean"
                value={formatValue(summary?.mean, 1)}
                rank={locationFilterActive ? undefined : summaryRanks.mean}
                comparison={locationFilterActive ? summaryComparisons.mean ?? null : null}
              />
              <SummaryItem
                label="Max"
                value={formatValue(summary?.max, 1)}
                rank={locationFilterActive ? undefined : summaryRanks.max}
                comparison={locationFilterActive ? summaryComparisons.max ?? null : null}
                isLast
              />
            </View>
          )}
          {showRankContext && rankContextOptions.length > 1 ? (
            <View style={styles.rankContextRow}>
              <NavigationPillList
                pills={rankContextOptions}
                selectedKey={selectedRankContext ?? rankContextOptions[0].key}
                onSelectionChange={setSelectedRankContext}
                direction="horizontal"
                accessibilityLabel="Rank context options"
              />
            </View>
          ) : showRankContext && rankContextOptions.length === 1 ? (
            <View style={styles.rankContextRow}>
              <ThemedText variant="bodySmallEmphasis">Rank context</ThemedText>
              <ThemedText variant="bodySmall">{rankContextOptions[0].label}</ThemedText>
            </View>
          ) : null}

          {isCategorical && selectedCategory ? (
            <ObservationPanel
              title={`Observations in ${selectedCategory.className}`}
              description={selectedCategoryObservationDescription}
              items={selectedCategoryObservationItems}
              onPressItem={handleObservationPress}
              backgroundColor={palette.background.default.tertiary}
              chipColor={palette.background.default.secondary}
              emptyMessage={
                selectedCategorySampleState?.loading
                  ? 'Loading observations…'
                  : selectedCategorySampleState?.error ?? undefined
              }
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: Responsive.contentWidth,
    borderRadius: Size.radius['200'],
    padding: Size.space['400'],
    alignSelf: 'center',
    gap: Size.space['400'],
  },
  chartWrapper: {
    gap: Size.space['200'],
    paddingTop: Size.space['100'],
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  variableScroll: {
    maxHeight: 220,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  errorRow: {
    paddingVertical: Size.space['200'],
  },
  emptyChart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  variableHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  selectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  rankContextRow: {
    gap: Size.space['100'],
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['400'],
    justifyContent: 'space-evenly',
  },
  summaryItem: {
    flexDirection: 'column',
    flex: 1,
    minWidth: 140,
    gap: Size.space['100'],
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.light.border.default.default,
    paddingHorizontal: Size.space['300'],
  },
  summaryItemLast: {
    borderRightWidth: 0,
  },
  rankLabel: {},
  observationPanel: {
    gap: Size.space['200'],
    padding: Size.space['300'],
    borderRadius: Size.radius['200'],
  },
  observationList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['200'],
  },
  observationChip: {
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
    borderRadius: Size.radius['200'],
  },
  observationLink: {
    textDecorationLine: 'underline',
  },
  categoryList: {
    gap: Size.space['300'],
  },
  categoryRow: {
    gap: Size.space['200'],
    paddingVertical: Size.space['200'],
  },
  categoryRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  categoryBarTrack: {
    height: 8,
    borderRadius: Size.radius['200'],
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: Size.radius['200'],
  },
  categoryDescription: {},
});
