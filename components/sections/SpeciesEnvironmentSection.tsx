import { Colors, Responsive, Size } from '@/constants/theme';
import { fetchSpeciesEnvironment } from '@/data/api';
import type { SpeciesEnvironmentStats } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMeasurementPreferences } from '@/hooks/useMeasurementPreferences';
import { useResponsive } from '@/hooks/useResponsive';
import { convertStatsToPreferredUnits } from '@/utils/measurement';
import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '../text/ThemedText';
import { HistogramChart } from './speciesEnvironment/HistogramChart';
import { CategoryDistributionList } from './speciesEnvironment/CategoryDistributionList';
import { buildHistogramBars, formatBinLabel } from './speciesEnvironment/utils';
import type { HistogramBar } from './speciesEnvironment/utils';

const DEFAULT_VARIABLE = 'elevation';

export type SpeciesEnvironmentSectionProps = {
  taxonId?: number;
  variableId?: string;
  title?: string;
  initialStats?: SpeciesEnvironmentStats | null;
};

export function SpeciesEnvironmentSection({
  taxonId,
  variableId = DEFAULT_VARIABLE,
  title,
  initialStats,
}: SpeciesEnvironmentSectionProps) {
  const scheme = useColorScheme();
  const { isCompact } = useResponsive();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const measurementPreferences = useMeasurementPreferences();
  const measurementSnapshot = measurementPreferences.snapshot;
  const [rawStats, setRawStats] = React.useState<SpeciesEnvironmentStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selectedBinIndex, setSelectedBinIndex] = React.useState<number | null>(null);
  const [selectedCategoryValue, setSelectedCategoryValue] = React.useState<number | null>(null);
  const effectiveVariableId = variableId || DEFAULT_VARIABLE;

  React.useEffect(() => {
    setSelectedBinIndex(null);
    setSelectedCategoryValue(null);
  }, [effectiveVariableId]);

  React.useEffect(() => {
    if (!taxonId) {
      setRawStats(null);
      setError(null);
      setLoading(false);
      return;
    }

    const hasPrefetchedStats = Boolean(
      initialStats &&
        initialStats.speciesId === taxonId &&
        initialStats.variable === effectiveVariableId,
    );

    if (hasPrefetchedStats) {
      setRawStats(initialStats!);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setRawStats(null);
    (async () => {
      try {
        const response = await fetchSpeciesEnvironment(taxonId, effectiveVariableId);
        if (!cancelled) {
          setRawStats(response);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load environment stats';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taxonId, effectiveVariableId, initialStats]);

  const stats = React.useMemo(
    () =>
      rawStats ? convertStatsToPreferredUnits(rawStats, measurementSnapshot) : null,
    [rawStats, measurementSnapshot],
  );

  const summary = stats?.summary;
  const totalSamples = summary?.count ?? 0;
  const categoricalDistribution = stats?.categoricalDistribution ?? [];
  const isCategorical =
    stats?.variableType === 'categorical' || categoricalDistribution.length > 0;
  const histogramBars: HistogramBar[] = isCategorical
    ? []
    : buildHistogramBars(stats?.histogram ?? null);
  const categorySampleMap = React.useMemo(() => {
    if (!stats?.categoricalSamples || !stats.categoricalSamples.length) {
      return {} as Record<number, (number | string)[]>;
    }
    return stats.categoricalSamples.reduce((memo, entry) => {
      memo[entry.value] = Array.isArray(entry.observationIds) ? entry.observationIds : [];
      return memo;
    }, {} as Record<number, (number | string)[]>);
  }, [stats]);
  const binObservationMap = React.useMemo(() => {
    if (isCategorical || !stats?.binSamples) {
      return {} as Record<number, (number | string)[]>;
    }
    return stats.binSamples.reduce((memo, entry) => {
      memo[entry.index] = Array.isArray(entry.observationIds) ? entry.observationIds : [];
      return memo;
    }, {} as Record<number, (number | string)[]>);
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
  const graphLabel = title ? `${title} environmental distribution` : undefined;
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

  if (!taxonId) {
    return null;
  }

  const histogramOrientation = isCompact ? 'horizontal' : 'vertical';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
      ]}
      accessible={Boolean(graphLabel)}
      accessibilityLabel={graphLabel}
    >
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
              observationPanelColor={palette.background.default.tertiary}
              observationChipColor={palette.background.default.secondary}
              hintColor={palette.text.default.secondary}
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
                trackColor={palette.background.default.secondary}
                totalCount={totalSamples}
                selectedIndex={selectedBinIndex}
                onSelectBin={(index) =>
                  setSelectedBinIndex((prev) => (prev === index ? null : index))
                }
                selectionColor={palette.text.brand.default}
                orientation={histogramOrientation}
                style={styles.chartWrapper}
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
    gap: Size.space['600'],
    position: 'relative',
    paddingTop: Size.space['800'],
    paddingBottom: Size.space['200'],
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  errorRow: {
    paddingVertical: Size.space['200'],
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
});
