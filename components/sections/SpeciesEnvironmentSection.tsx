import { Colors, Responsive, Size } from '@/constants/theme';
import { fetchEnvironmentVariables, fetchSpeciesEnvironment } from '@/data/api';
import type {
  SpeciesEnvironmentCategory,
  SpeciesEnvironmentHistogram,
  SpeciesEnvironmentStats,
} from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '../text/ThemedText';

const DEFAULT_VARIABLE = 'elevation';
const MAX_BARS = 12;
const CHART_HEIGHT = 160;
const CHART_PADDING = 20;
const MIN_BAR_HEIGHT = 6;
const CATEGORY_DISPLAY_LIMIT = 8;

type EnvironmentVariableOption = {
  id: string;
  label: string;
};

const DEFAULT_VARIABLES: EnvironmentVariableOption[] = [
  { id: 'elevation', label: 'Elevation' },
  { id: 'annual_precip', label: 'Annual Precipitation' },
  { id: 'mean_temp_coldest_quarter', label: 'Mean Temp (Cold Qtr)' },
  { id: 'max_temp_warmest_month', label: 'Max Temp (Warmest Mo)' },
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
};

type HistogramBar = {
  index: number;
  start: number;
  end: number;
  count: number;
};

const buildBars = (histogram: SpeciesEnvironmentHistogram | null): HistogramBar[] => {
  if (!histogram) {
    return [];
  }
  const { bins, counts } = histogram;
  if (!bins.length || !counts.length) {
    return [];
  }
  const effectiveCounts = counts.length;
  const limit = Math.min(MAX_BARS, effectiveCounts);
  if (limit === effectiveCounts) {
    return counts.map((count, index) => ({
      index,
      count,
      start: bins[index] ?? 0,
      end: bins[index + 1] ?? bins[index] ?? 0,
    }));
  }
  const indices = Array.from({ length: limit }, (_, idx) => {
    const raw = Math.floor((idx / limit) * effectiveCounts);
    return Math.min(raw, effectiveCounts - 1);
  });
  const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
  return uniqueIndices.map((index) => ({
    index,
    count: counts[index],
    start: bins[index] ?? 0,
    end: bins[index + 1] ?? bins[index] ?? 0,
  }));
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

const SummaryItem = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.summaryItem}>
    <ThemedText variant="bodySmallEmphasis">{label}</ThemedText>
    <ThemedText variant="bodyStrong">{value}</ThemedText>
  </View>
);

const formatTick = (value: number) => {
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? '0' : rounded.toString();
};

const formatBinLabel = (start: number, end: number) => {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return '—';
  }
  return `${formatTick(start)} to ${formatTick(end)}`;
};

const HistogramChart = ({
  bars,
  barColor,
  tooltipColor,
  totalCount,
  selectedIndex,
  onSelectBin,
  selectionColor,
}: {
  bars: HistogramBar[];
  barColor: string;
  tooltipColor: string;
  totalCount: number;
  selectedIndex: number | null;
  onSelectBin?: (index: number) => void;
  selectionColor: string;
}) => {
  if (!bars.length) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant="bodySmall">Histogram data unavailable.</ThemedText>
      </View>
    );
  }
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const maxCount = Math.max(...bars.map((bar) => bar.count));
  const safeMax = maxCount || 1;
  const drawableHeight = CHART_HEIGHT - CHART_PADDING;
  const resolvedActiveIndex = hoverIndex ?? selectedIndex;
  const activeBar =
    typeof resolvedActiveIndex === 'number'
      ? bars.find((bar) => bar.index === resolvedActiveIndex)
      : null;
  const formatPercent = (count: number) => {
    if (!totalCount) {
      return '0%';
    }
    const value = (count / totalCount) * 100;
    return `${value.toFixed(1)}%`;
  };
  return (
    <View style={styles.chartWrapper}>
      {activeBar ? (
        <View
          style={[styles.barTooltip, { backgroundColor: tooltipColor }]}
          pointerEvents="none"
        >
          <ThemedText variant="bodySmallEmphasis">
            {formatBinLabel(activeBar.start, activeBar.end)} • Samples {formatValue(activeBar.count)} ({formatPercent(activeBar.count)})
          </ThemedText>
        </View>
      ) : null}
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {bars.map((bar) => {
          const height = Math.max((bar.count / safeMax) * drawableHeight, MIN_BAR_HEIGHT);
          const handleEnter = () => setHoverIndex(bar.index);
          const handleLeave = () =>
            setHoverIndex((prev) => (prev === bar.index ? null : prev));
          const handlePress = () => onSelectBin?.(bar.index);
          const dimmed = hoverIndex !== null && hoverIndex !== bar.index;
          const selected = selectedIndex === bar.index;
          return (
          <View key={bar.index} style={styles.barColumn}>
            <Pressable
                onHoverIn={handleEnter}
                onHoverOut={handleLeave}
                onPressIn={handleEnter}
                onPressOut={handleLeave}
                onPress={handlePress}
                style={styles.barPressable}
              >
                <View style={styles.barAxis}>
                  <View style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: barColor,
                      opacity: dimmed ? 0.4 : 1,
                      borderColor: selected ? selectionColor : 'transparent',
                      borderWidth: selected ? 2 : 0,
                    },
                  ]} />
                </View>
              </Pressable>
              <ThemedText variant="bodySmall" style={styles.barLabel}>
                {formatBinLabel(bar.start, bar.end)}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const formatPercent = (fraction: number) => {
  if (!Number.isFinite(fraction)) {
    return '0%';
  }
  return `${(fraction * 100).toFixed(1)}%`;
};

const CategoryDistributionList = ({
  categories,
  barColor,
  trackColor,
  descriptionColor,
  selectedValue,
  onSelect,
  resolveSamples,
  onObservationPress,
}: {
  categories: SpeciesEnvironmentCategory[];
  barColor: string;
  trackColor: string;
  descriptionColor: string;
  selectedValue: number | null;
  onSelect?: (value: number) => void;
  resolveSamples?: (value: number) => Array<number | string> | null;
  onObservationPress?: (id: number | string) => void;
}) => {
  if (!categories.length) {
    return (
      <View style={styles.emptyChart}>
        <ThemedText variant="bodySmall">Landcover categories unavailable.</ThemedText>
      </View>
    );
  }
  const subset = categories.slice(0, CATEGORY_DISPLAY_LIMIT);
  return (
    <View style={styles.categoryList}>
      {subset.map((category) => {
        const percent = Math.min(100, Math.max(0, category.fraction * 100));
        const samples = resolveSamples?.(category.value) ?? null;
        const interactive = Boolean(samples && samples.length);
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
        if (interactive) {
          const selected = selectedValue === category.value;
          return (
            <View key={category.value} style={styles.categoryRow}>
              <Pressable onPress={() => onSelect?.(category.value)}>{content}</Pressable>
              {selected ? (
                <View style={styles.observationPanel}>
                  <ThemedText variant="bodySmallEmphasis">
                    Observations in {category.className}
                  </ThemedText>
                  {samples!.length ? (
                    <View style={styles.observationList}>
                      {samples!.slice(0, 12).map((id) => (
                        <Pressable
                          key={String(id)}
                          onPress={() => onObservationPress?.(id)}
                          style={styles.observationChip}
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
                    style={[styles.observationHint, styles.categoryHint]}
                  >
                    Tap again to hide observation IDs.
                  </ThemedText>
                </View>
              ) : null}
            </View>
          );
        }
        return (
          <View key={category.value} style={styles.categoryRow}>
            {content}
          </View>
        );
      })}
    </View>
  );
};

export function SpeciesEnvironmentSection({
  taxonId,
  variableId = DEFAULT_VARIABLE,
  variables,
}: SpeciesEnvironmentSectionProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [remoteVariables, setRemoteVariables] = React.useState<EnvironmentVariableOption[] | null>(
    null,
  );
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
    setSelectedBinIndex(null);
    setSelectedCategoryValue(null);
  }, [selectedVariable]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetchEnvironmentVariables();
        if (!cancelled && response.length) {
          const mapped = response.map((entry) => ({
            id: entry.id,
            label: entry.name ?? normalizeLabel(entry.id),
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

  const [statsByVariable, setStatsByVariable] = React.useState<Record<string, SpeciesEnvironmentStats>>({});
  const [errorByVariable, setErrorByVariable] = React.useState<Record<string, string | null>>({});
  const [loadingVariable, setLoadingVariable] = React.useState<string | null>(null);
  const [selectedBinIndex, setSelectedBinIndex] = React.useState<number | null>(null);
  const [selectedCategoryValue, setSelectedCategoryValue] = React.useState<number | null>(null);

  React.useEffect(() => {
    setStatsByVariable({});
    setErrorByVariable({});
    setSelectedBinIndex(null);
    setSelectedCategoryValue(null);
  }, [taxonId]);

  const hasStatsForSelection = Boolean(
    selectedVariable && statsByVariable[selectedVariable],
  );

  React.useEffect(() => {
    if (!taxonId || !selectedVariable || hasStatsForSelection) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingVariable(selectedVariable);
      setErrorByVariable((prev) => ({ ...prev, [selectedVariable]: null }));
      try {
        const response = await fetchSpeciesEnvironment(taxonId, selectedVariable);
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
  }, [hasStatsForSelection, selectedVariable, taxonId]);

  if (!taxonId) {
    return null;
  }

  const stats = selectedVariable ? statsByVariable[selectedVariable] ?? null : null;
  const error = selectedVariable ? errorByVariable[selectedVariable] ?? null : null;
  const loading = loadingVariable === selectedVariable;
  const summary = stats?.summary;
  const totalSamples = summary?.count ?? 0;
  const categoricalDistribution = stats?.categoricalDistribution ?? [];
  const isCategorical = categoricalDistribution.length > 0;
  const histogramBars = isCategorical ? [] : buildBars(stats?.histogram ?? null);
  const categorySampleMap = React.useMemo(() => {
    if (!stats?.categoricalSamples || !stats.categoricalSamples.length) {
      return {} as Record<number, Array<number | string>>;
    }
    return stats.categoricalSamples.reduce((memo, entry) => {
      memo[entry.value] = Array.isArray(entry.observationIds) ? entry.observationIds : [];
      return memo;
    }, {} as Record<number, Array<number | string>>);
  }, [stats]);
  const binObservationMap = React.useMemo(() => {
    if (isCategorical || !stats?.binSamples) {
      return {} as Record<number, Array<number | string>>;
    }
    return stats.binSamples.reduce((memo, entry) => {
      memo[entry.index] = Array.isArray(entry.observationIds) ? entry.observationIds : [];
      return memo;
    }, {} as Record<number, Array<number | string>>);
  }, [isCategorical, stats]);
  const selectedObservations =
    !isCategorical && selectedBinIndex !== null
      ? binObservationMap[selectedBinIndex] ?? []
      : null;
  const selectedBar =
    !isCategorical && selectedBinIndex !== null
      ? histogramBars.find((bar) => bar.index === selectedBinIndex)
      : null;
  const selectedBinLabel = selectedBar ? formatBinLabel(selectedBar.start, selectedBar.end) : null;
  const selectedCategory =
    isCategorical && selectedCategoryValue !== null
      ? categoricalDistribution.find((category) => category.value === selectedCategoryValue)
      : null;
  const selectedCategoryObservations =
    selectedCategoryValue !== null ? categorySampleMap[selectedCategoryValue] ?? [] : null;
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

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      <View style={styles.headingRow}>
        <ThemedText variant="heading">
          {stats?.variableName ?? 'Environment'}
        </ThemedText>
        {stats?.units ? (
          <ThemedText variant="bodySmall">Units: {stats.units}</ThemedText>
        ) : null}
      </View>

      {resolvedVariables.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.variableSelector}
        >
          {resolvedVariables.map((option) => {
            const selected = option.id === selectedVariable;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSelectedVariable(option.id)}
                style={[
                  styles.variablePill,
                  {
                    backgroundColor: selected
                      ? palette.background.brand.default
                      : palette.background.default.tertiary,
                  },
                ]}
              >
                <ThemedText
                  variant="bodySmall"
                  style={{
                    color: selected
                      ? palette.text.brand.contrast
                      : palette.text.default.secondary,
                  }}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

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
              resolveSamples={(value) => categorySampleMap[value] ?? null}
              onObservationPress={handleObservationPress}
            />
          ) : (
            <>
              <HistogramChart
                bars={histogramBars}
                barColor={palette.background.brand.default}
                tooltipColor={palette.background.default.tertiary}
                totalCount={totalSamples}
                selectedIndex={selectedBinIndex}
                onSelectBin={(index) =>
                  setSelectedBinIndex((prev) => (prev === index ? null : index))
                }
                selectionColor={palette.text.brand.default}
              />
              {selectedBinLabel ? (
                <View
                  style={[
                    styles.observationPanel,
                    { backgroundColor: palette.background.default.tertiary },
                  ]}
                >
                  <ThemedText variant="bodySmallEmphasis">
                    Observations in {selectedBinLabel}
                  </ThemedText>
                  {selectedObservations && selectedObservations.length > 0 ? (
                    <View style={styles.observationList}>
                      {selectedObservations.slice(0, 12).map((id) => (
                        <Pressable
                          key={String(id)}
                          onPress={() => handleObservationPress(id)}
                          style={styles.observationChip}
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
                    style={[styles.observationHint, { color: palette.text.default.secondary }]}
                  >
                    Showing up to 12 observation IDs.
                  </ThemedText>
                </View>
              ) : null}
            </>
          )}
          <View style={styles.summaryRow}>
            <SummaryItem label="Samples" value={formatValue(summary?.count ?? 0)} />
            <SummaryItem label="Mean" value={formatValue(summary?.mean, 1)} />
            <SummaryItem label="10th %" value={formatValue(summary?.q10, 1)} />
            <SummaryItem label="90th %" value={formatValue(summary?.q90, 1)} />
          </View>
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
    position: 'relative',
    paddingTop: Size.space['200'],
  },
  barTooltip: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
    borderRadius: Size.radius['200'],
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  variableSelector: {
    gap: Size.space['200'],
  },
  variablePill: {
    paddingVertical: Size.space['100'],
    paddingHorizontal: Size.space['200'],
    borderRadius: Size.radius['400'],
    marginRight: Size.space['200'],
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  errorRow: {
    paddingVertical: Size.space['200'],
  },
  chart: {
    flexDirection: 'row',
    width: '100%',
    gap: Size.space['200'],
    alignItems: 'flex-end',
    paddingTop: Size.space['200'],
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barPressable: {
    width: '100%',
  },
  barAxis: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  bar: {
    width: '80%',
    borderTopLeftRadius: Size.radius['100'],
    borderTopRightRadius: Size.radius['100'],
  },
  barLabel: {
    marginTop: Size.space['100'],
    textAlign: 'center',
  },
  emptyChart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['400'],
  },
  summaryItem: {
    flexDirection: 'column',
    minWidth: 120,
  },
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
    backgroundColor: Colors.dark.background.default.secondary,
  },
  observationLink: {
    textDecorationLine: 'underline',
  },
  observationHint: {
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
  categoryHint: {
    color: Colors.dark.text.default.secondary,
  },
});
