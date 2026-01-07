import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Platform,
} from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fetchRelativeRankingOptions, fetchRelativeRankings } from '@/data/api';
import type {
  LocationSearchResult,
  RelativeRankingOption,
  RelativeRankingResponse,
} from '@/data/types';
import { ThemedText } from '@/components/text/ThemedText';
import { useRouter } from 'expo-router';
import { toKebabCase } from '@/utils/string';
import { SpeciesLocationPicker } from '@/components/sections/SpeciesLocationPicker';

const formatPercent = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(1)}%`;
};

const formatValue = (value: number | null | undefined, digits = 1) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const CATEGORICAL_VARIABLES = new Set(['landcover']);

export default function RelativeRankingScreen() {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const router = useRouter();
  const [taxonInput, setTaxonInput] = React.useState('2519');
  const [rankInput, setRankInput] = React.useState('SPECIES');
  const [variableInput, setVariableInput] = React.useState('bio_1');
  const [metricInput, setMetricInput] = React.useState('mean');
  const [limitInput, setLimitInput] = React.useState('25');
  const [sortDescending, setSortDescending] = React.useState(false);
  const [minSamplesInput, setMinSamplesInput] = React.useState('0');
  const [includeSpeciesLike, setIncludeSpeciesLike] = React.useState(true);
  const [selectedLocation, setSelectedLocation] = React.useState<LocationSearchResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<RelativeRankingResponse | null>(null);
  const [options, setOptions] = React.useState<RelativeRankingOption[]>([]);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [optionsError, setOptionsError] = React.useState<string | null>(null);
  const [variableDropdownOpen, setVariableDropdownOpen] = React.useState(false);
  const [metricDropdownOpen, setMetricDropdownOpen] = React.useState(false);
  const latestSelectionRef = React.useRef({
    variable: variableInput.trim(),
    metric: metricInput.trim(),
  });
  const rankIsSpecies = rankInput.trim().toUpperCase() === 'SPECIES';
  const openSpeciesPage = React.useCallback(
    (taxonId: number | string, label?: string | null) => {
      const normalized = String(taxonId ?? '').trim();
      if (!normalized.length) {
        return;
      }
      const slug = label ? toKebabCase(label) : '';
      const targetPath = slug ? `/species/${normalized}/${slug}` : `/species/${normalized}`;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(targetPath, '_blank', 'noopener,noreferrer');
        return;
      }
      router.push(targetPath);
    },
    [router],
  );

  const loadRelativeRankings = React.useCallback(
    async (overrides?: { location?: string | null }) => {
      if (!taxonInput.trim() || !rankInput.trim() || !variableInput.trim() || !metricInput.trim()) {
        setError('Taxon, rank, variable, and metric are required.');
        return;
      }
      const normalizedRank = rankInput.trim();
      const includeSpecies = normalizedRank.toUpperCase() === 'SPECIES' && includeSpeciesLike;
      const resolvedLocation = overrides?.location ?? selectedLocation?.gid ?? null;
      setLoading(true);
      setError(null);
      try {
        const response = await fetchRelativeRankings({
          taxonId: taxonInput.trim(),
          rank: normalizedRank,
          variableId: variableInput.trim(),
          metric: metricInput.trim(),
          limit: Number(limitInput) || undefined,
          order: sortDescending ? 'desc' : 'asc',
          minSamples: Number(minSamplesInput) || undefined,
          includeSpeciesLike: includeSpecies,
          location: resolvedLocation ?? undefined,
        });
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load relative rankings');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [
      limitInput,
      metricInput,
      minSamplesInput,
      rankInput,
      sortDescending,
      taxonInput,
      variableInput,
      includeSpeciesLike,
      selectedLocation?.gid,
    ],
  );

  React.useEffect(() => {
    loadRelativeRankings();
  }, []); // load defaults on first render

  React.useEffect(() => {
    latestSelectionRef.current = {
      variable: variableInput.trim(),
      metric: metricInput.trim(),
    };
  }, [variableInput, metricInput]);

  const handleLocationChange = React.useCallback(
    (value: LocationSearchResult | null) => {
      setSelectedLocation(value);
      loadRelativeRankings({ location: value?.gid ?? null });
    },
    [loadRelativeRankings],
  );

  React.useEffect(() => {
    const trimmedTaxon = taxonInput.trim();
    const trimmedRank = rankInput.trim();
    if (!trimmedTaxon || !trimmedRank) {
      setOptions([]);
      setOptionsError(null);
      setOptionsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setOptionsLoading(true);
      setOptionsError(null);
      try {
        const response = await fetchRelativeRankingOptions({
          taxonId: trimmedTaxon,
          rank: trimmedRank,
        });
        if (cancelled) {
          return;
        }
        const received = response.options ?? [];
        setOptions(received);
        if (received.length) {
          const { variable: selectedVariable, metric: selectedMetric } = latestSelectionRef.current;
          const hasMatch = received.some(
            (option) =>
              option.variable === selectedVariable && option.metric === selectedMetric,
          );
          if (!hasMatch) {
            setVariableInput(received[0].variable);
            setMetricInput(received[0].metric);
          }
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        setOptions([]);
        setOptionsError(
          err instanceof Error ? err.message : 'Failed to load available ranking metrics',
        );
      } finally {
        if (!cancelled) {
          setOptionsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taxonInput, rankInput]);

  const groupedOptions = React.useMemo(() => {
    const map = new Map<string, RelativeRankingOption[]>();
    options.forEach((option) => {
      const existing = map.get(option.variable) ?? [];
      existing.push(option);
      map.set(option.variable, existing);
    });
    return Array.from(map.entries()).map(([variable, entries]) => ({
      variable,
      entries: entries.sort((a, b) => a.metric.localeCompare(b.metric)),
    }));
  }, [options]);
  const variableChoices = React.useMemo(
    () => groupedOptions.map((entry) => entry.variable),
    [groupedOptions],
  );
  const metricChoices = React.useMemo(() => {
    const normalized = variableInput.trim();
    const target = groupedOptions.find((entry) => entry.variable === normalized);
    return target ? target.entries.map((entry) => entry.metric) : [];
  }, [groupedOptions, variableInput]);

  const selectVariable = React.useCallback(
    (value: string) => {
      setVariableInput(value);
      setVariableDropdownOpen(false);
      setMetricDropdownOpen(false);
      const normalized = value.trim();
      const matchingMetrics =
        groupedOptions.find((entry) => entry.variable === normalized)?.entries ?? [];
      const hasMetric = matchingMetrics.some(
        (entry) => entry.metric === metricInput.trim(),
      );
      if (!hasMetric && matchingMetrics.length) {
        setMetricInput(matchingMetrics[0].metric);
      }
    },
    [groupedOptions, metricInput],
  );

  const selectMetric = React.useCallback((value: string) => {
    setMetricInput(value);
    setMetricDropdownOpen(false);
  }, []);

  const resolvedRankingVariable = (data?.variable ?? variableInput ?? '')
    .trim()
    .toLowerCase();
  const rankingIsCategorical = CATEGORICAL_VARIABLES.has(resolvedRankingVariable);
  const formatEntryValue = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '—';
      }
      if (rankingIsCategorical) {
        return `${(value * 100).toFixed(1)}%`;
      }
      return value.toFixed(2);
    },
    [rankingIsCategorical],
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      <ThemedText variant="heading">Relative Ranking Explorer</ThemedText>
      <ThemedText variant="bodySmall">
        Provide a taxon id, descendant rank, GIS variable, and metric to inspect the relative rankings
        computed from its children.
      </ThemedText>
      <SpeciesLocationPicker value={selectedLocation} onChange={handleLocationChange} />
      <View style={styles.formRow}>
        <View style={styles.field}>
          <ThemedText variant="bodySmallEmphasis">Taxon ID</ThemedText>
          <TextInput
            value={taxonInput}
            onChangeText={setTaxonInput}
            style={[styles.input, { color: palette.text.default.primary }]}
            keyboardType="numeric"
            placeholder="e.g. 2519"
            placeholderTextColor={palette.text.default.tertiary}
          />
        </View>
        <View style={styles.field}>
          <ThemedText variant="bodySmallEmphasis">Rank</ThemedText>
          <TextInput
            value={rankInput}
            onChangeText={setRankInput}
            style={[styles.input, { color: palette.text.default.primary }]}
            autoCapitalize="characters"
            placeholder="SPECIES"
            placeholderTextColor={palette.text.default.tertiary}
          />
        </View>
      </View>
      {rankIsSpecies ? (
        <Pressable
          style={[
            styles.speciesToggle,
            {
              backgroundColor: includeSpeciesLike
                ? palette.background.brand.secondary
                : palette.background.default.tertiary,
            },
          ]}
          onPress={() => setIncludeSpeciesLike((prev) => !prev)}
        >
          <ThemedText
            variant="bodySmall"
            style={{
              color: includeSpeciesLike
                ? palette.text.brand.onBrand
                : palette.text.default.secondary,
            }}
          >
            Include subspecies / varieties / forms
          </ThemedText>
        </Pressable>
      ) : null}
      <View style={styles.formRow}>
        <View style={styles.field}>
          <ThemedText variant="bodySmallEmphasis">Variable</ThemedText>
          {variableChoices.length ? (
            <View style={styles.dropdownContainer}>
              <Pressable
                style={[
                  styles.dropdownButton,
                  { borderColor: palette.border.default, backgroundColor: palette.background.default.tertiary },
                ]}
                onPress={() => setVariableDropdownOpen((prev) => !prev)}
              >
                <ThemedText variant="bodySmall">
                  {variableInput ? variableInput : 'Select variable'}
                </ThemedText>
              </Pressable>
              {variableDropdownOpen ? (
                <View
                  style={[
                    styles.dropdownList,
                    { backgroundColor: palette.background.default.secondary },
                  ]}
                >
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {variableChoices.map((choice) => (
                      <Pressable
                        key={choice}
                        style={styles.dropdownOption}
                        onPress={() => selectVariable(choice)}
                      >
                        <ThemedText
                          variant="bodySmall"
                          style={{
                            color:
                              choice === variableInput.trim()
                                ? palette.text.brand.default
                                : palette.text.default.primary,
                          }}
                        >
                          {choice}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          ) : (
            <TextInput
              value={variableInput}
              onChangeText={setVariableInput}
              style={[styles.input, { color: palette.text.default.primary }]}
              autoCapitalize="none"
              placeholder="bio_1"
              placeholderTextColor={palette.text.default.tertiary}
            />
          )}
        </View>
        <View style={styles.field}>
          <ThemedText variant="bodySmallEmphasis">Metric</ThemedText>
          {metricChoices.length ? (
            <View style={styles.dropdownContainer}>
              <Pressable
                style={[
                  styles.dropdownButton,
                  { borderColor: palette.border.default, backgroundColor: palette.background.default.tertiary },
                ]}
                onPress={() => setMetricDropdownOpen((prev) => !prev)}
              >
                <ThemedText variant="bodySmall">
                  {metricInput ? metricInput : 'Select metric'}
                </ThemedText>
              </Pressable>
              {metricDropdownOpen ? (
                <View
                  style={[
                    styles.dropdownList,
                    { backgroundColor: palette.background.default.secondary },
                  ]}
                >
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {metricChoices.map((choice) => (
                      <Pressable
                        key={choice}
                        style={styles.dropdownOption}
                        onPress={() => selectMetric(choice)}
                      >
                        <ThemedText
                          variant="bodySmall"
                          style={{
                            color:
                              choice === metricInput.trim()
                                ? palette.text.brand.default
                                : palette.text.default.primary,
                          }}
                        >
                          {choice}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          ) : (
            <TextInput
              value={metricInput}
              onChangeText={setMetricInput}
              style={[styles.input, { color: palette.text.default.primary }]}
              autoCapitalize="none"
              placeholder="mean"
              placeholderTextColor={palette.text.default.tertiary}
            />
          )}
        </View>
      </View>
      <View style={styles.optionsHeader}>
        <ThemedText variant="bodySmallEmphasis">Available metric combinations</ThemedText>
        {optionsLoading ? (
          <ActivityIndicator size="small" color={palette.text.default.secondary} />
        ) : null}
      </View>
      {optionsError ? (
        <ThemedText variant="bodySmall" style={{ color: palette.text.danger.default }}>
          {optionsError}
        </ThemedText>
      ) : null}
      {!optionsLoading && !groupedOptions.length && !optionsError ? (
        <ThemedText variant="bodySmall">No ranking columns available for this rank.</ThemedText>
      ) : null}
      <View style={styles.formRow}>
        <View style={styles.field}>
          <ThemedText variant="bodySmallEmphasis">Limit</ThemedText>
          <TextInput
            value={limitInput}
            onChangeText={setLimitInput}
            style={[styles.input, { color: palette.text.default.primary }]}
            keyboardType="numeric"
            placeholder="25"
            placeholderTextColor={palette.text.default.tertiary}
          />
        </View>
        <View style={styles.field}>
          <ThemedText variant="bodySmallEmphasis">Min samples</ThemedText>
          <TextInput
            value={minSamplesInput}
            onChangeText={setMinSamplesInput}
            style={[styles.input, { color: palette.text.default.primary }]}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={palette.text.default.tertiary}
          />
        </View>
        <View style={styles.field}>
          <ThemedText variant="bodySmallEmphasis">Sort order</ThemedText>
          <View style={styles.toggleRow}>
            {[
              { key: 'asc', label: 'Ascending', selected: !sortDescending },
              { key: 'desc', label: 'Descending', selected: sortDescending },
            ].map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setSortDescending(option.key === 'desc')}
                style={[
                  styles.toggleChip,
                  {
                    backgroundColor: option.selected
                      ? palette.background.brand.default
                      : palette.background.default.tertiary,
                  },
                ]}
              >
                <ThemedText
                  variant="bodySmall"
                  style={{
                    color: option.selected
                      ? palette.text.brand.contrast
                      : palette.text.default.secondary,
                  }}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <Pressable
        style={[
          styles.button,
          { backgroundColor: palette.background.brand.default },
          loading ? styles.buttonDisabled : null,
        ]}
        onPress={loadRelativeRankings}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={palette.text.brand.contrast} />
        ) : (
          <ThemedText variant="bodyStrong" style={{ color: palette.text.brand.contrast }}>
            Load Relative Rankings
          </ThemedText>
        )}
      </Pressable>
      {error ? (
        <ThemedText variant="bodySmall" style={{ color: palette.text.danger.default }}>
          {error}
        </ThemedText>
      ) : null}
      <View style={styles.selectionSummary}>
        <View style={styles.selectionMeta}>
          <ThemedText variant="bodySmallEmphasis">
            Variable: {variableInput.trim() || data?.variable || '—'}
          </ThemedText>
          <ThemedText variant="bodySmallEmphasis">
            Metric: {metricInput.trim() || data?.metric || '—'}
          </ThemedText>
          <ThemedText variant="bodySmallEmphasis">
            Location: {selectedLocation ? selectedLocation.name : 'Global'}
          </ThemedText>
        </View>
        <ThemedText variant="bodySmall">
          Showing {(data?.entries.length ?? 0)} entries (limit{' '}
          {(data?.limit ?? (Number(limitInput) || 0))})
        </ThemedText>
      </View>
      {data ? (
        <View style={styles.results}>
          <ThemedText variant="bodySmallEmphasis">
            Showing {data.entries.length} of {data.total || data.entries.length} entries •{' '}
            {data.order === 'desc' ? 'Descending' : 'Ascending'}
          </ThemedText>
          {data.entries.map((entry) => (
            <Pressable
              key={`${entry.taxonId}-${entry.position}`}
              style={styles.entryRow}
              onPress={() =>
                openSpeciesPage(entry.taxonId, entry.scientificName ?? entry.commonName)
              }
            >
              <ThemedText variant="bodyStrong">
                #{entry.position} · {entry.scientificName ?? entry.commonName ?? entry.taxonId}
              </ThemedText>
              <ThemedText variant="bodySmall">
                Rank {entry.rank ?? '—'} • Value {formatEntryValue(entry.value)} •{' '}
                {formatPercent(entry.percentile)} • Samples {entry.sampleCount ?? '—'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: Size.space['500'],
    gap: Size.space['300'],
  },
  formRow: {
    flexDirection: 'row',
    gap: Size.space['300'],
  },
  field: {
    flex: 1,
    gap: Size.space['100'],
  },
  input: {
    borderRadius: Size.radius['200'],
    borderWidth: 1,
    borderColor: '#555',
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
    fontSize: 16,
  },
  button: {
    paddingVertical: Size.space['200'],
    borderRadius: Size.radius['200'],
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  selectionSummary: {
    gap: Size.space['100'],
  },
  selectionMeta: {
    flexDirection: 'row',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
  results: {
    gap: Size.space['200'],
  },
  entryRow: {
    paddingVertical: Size.space['150'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#444',
    gap: Size.space['50'],
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Size.space['200'],
  },
  toggleChip: {
    flex: 1,
    paddingVertical: Size.space['150'],
    borderRadius: Size.radius['200'],
    alignItems: 'center',
  },
  speciesToggle: {
    paddingVertical: Size.space['150'],
    paddingHorizontal: Size.space['200'],
    borderRadius: Size.radius['200'],
    alignItems: 'center',
  },
  optionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownContainer: {
    position: 'relative',
  },
  dropdownButton: {
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['150'],
  },
  dropdownList: {
    marginTop: Size.space['100'],
    borderRadius: Size.radius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#555',
    maxHeight: 240,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['150'],
  },
});
