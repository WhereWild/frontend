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
import {
  fetchEnvironmentVariables,
  fetchRelativeRankingOptions,
  fetchRelativeRankings,
  fetchSpeciesList,
} from '@/data/api';
import type {
  EnvironmentVariableDefinition,
  LocationSearchResult,
  RelativeRankingOption,
  RelativeRankingResponse,
  SpeciesSummary,
} from '@/data/types';
import { PageHeader } from '@/components/sections/PageHeader';
import { ThemedText } from '@/components/text/ThemedText';
import { SpeciesCard } from '@/components/cards/SpeciesCard';
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
  const [taxonInput, setTaxonInput] = React.useState('1');
  const [taxonQuery, setTaxonQuery] = React.useState('');
  const [debouncedTaxonQuery, setDebouncedTaxonQuery] = React.useState('');
  const [taxonResults, setTaxonResults] = React.useState<SpeciesSummary[]>([]);
  const [taxonSearching, setTaxonSearching] = React.useState(false);
  const [taxonSearchError, setTaxonSearchError] = React.useState<string | null>(null);
  const [selectedTaxon, setSelectedTaxon] = React.useState<SpeciesSummary | null>(null);
  const [rankInput, setRankInput] = React.useState('SPECIES');
  const [variableInput, setVariableInput] = React.useState('bio_1');
  const [metricInput, setMetricInput] = React.useState('mean');
  const [limitInput, setLimitInput] = React.useState('25');
  const [sortDescending, setSortDescending] = React.useState(false);
  const [minSamplesInput, setMinSamplesInput] = React.useState('10');
  const [includeSpeciesLike, setIncludeSpeciesLike] = React.useState(false);
  const [selectedLocation, setSelectedLocation] = React.useState<LocationSearchResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<RelativeRankingResponse | null>(null);
  const [options, setOptions] = React.useState<RelativeRankingOption[]>([]);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [optionsError, setOptionsError] = React.useState<string | null>(null);
  const [variableDropdownOpen, setVariableDropdownOpen] = React.useState(false);
  const [metricDropdownOpen, setMetricDropdownOpen] = React.useState(false);
  const [variableCatalog, setVariableCatalog] = React.useState<EnvironmentVariableDefinition[]>([]);
  const [variableCatalogError, setVariableCatalogError] = React.useState<string | null>(null);
  const [variableCatalogLoading, setVariableCatalogLoading] = React.useState(false);
  const latestSelectionRef = React.useRef({
    variable: variableInput.trim(),
    metric: metricInput.trim(),
  });
  const rankIsSpecies = rankInput.trim().toUpperCase() === 'SPECIES';
  const variableNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    variableCatalog.forEach((entry) => {
      if (entry.id && entry.name) {
        map.set(entry.id, entry.name);
      }
    });
    return map;
  }, [variableCatalog]);
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
    const trimmedTaxon = taxonInput.trim();
    if (!trimmedTaxon) {
      return;
    }
    const handle = setTimeout(() => {
      loadRelativeRankings();
    }, 400);
    return () => clearTimeout(handle);
  }, [
    taxonInput,
    rankInput,
    variableInput,
    metricInput,
    limitInput,
    sortDescending,
    minSamplesInput,
    includeSpeciesLike,
    selectedLocation?.gid,
    loadRelativeRankings,
  ]);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedTaxonQuery(taxonQuery.trim());
    }, 350);
    return () => clearTimeout(handle);
  }, [taxonQuery]);

  React.useEffect(() => {
    let cancelled = false;
    const query = debouncedTaxonQuery.trim();
    if (!query) {
      setTaxonResults([]);
      setTaxonSearching(false);
      setTaxonSearchError(null);
      return () => {
        cancelled = true;
      };
    }
    if (/^\\d+$/.test(query)) {
      setTaxonInput(query);
      setTaxonResults([]);
      setTaxonSearching(false);
      setTaxonSearchError(null);
      setSelectedTaxon(null);
      return () => {
        cancelled = true;
      };
    }
    setTaxonSearching(true);
    setTaxonSearchError(null);
    (async () => {
      try {
        const payload = await fetchSpeciesList(12, query);
        if (cancelled) {
          return;
        }
        const mapped = payload
          .map((entry: any) => ({
            taxonId: entry?.taxon_id ?? entry?.taxonId ?? entry?.id,
            commonName: entry?.common_name ?? entry?.commonName ?? '',
            scientificName: entry?.scientific_name ?? entry?.scientificName ?? '',
            description: entry?.description ?? 'Tap to select this taxon',
            imageSource:
              typeof entry?.image_source === 'string'
                ? { uri: entry.image_source }
                : entry?.image_source,
          }))
          .filter((entry: SpeciesSummary) => Boolean(entry.taxonId))
          .slice(0, 8);
        setTaxonResults(mapped);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setTaxonSearchError(err instanceof Error ? err.message : 'Failed to search taxa');
        setTaxonResults([]);
      } finally {
        if (!cancelled) {
          setTaxonSearching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedTaxonQuery]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setVariableCatalogLoading(true);
      setVariableCatalogError(null);
      try {
        const variables = await fetchEnvironmentVariables();
        if (!cancelled) {
          setVariableCatalog(variables);
        }
      } catch (err) {
        if (!cancelled) {
          setVariableCatalogError(
            err instanceof Error ? err.message : 'Failed to load variable names',
          );
        }
      } finally {
        if (!cancelled) {
          setVariableCatalogLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const getVariableLabel = React.useCallback(
    (value: string) => variableNameMap.get(value) ?? value,
    [variableNameMap],
  );
  const getVariableUnits = React.useCallback(
    (value: string) => variableCatalog.find((entry) => entry.id === value)?.units ?? null,
    [variableCatalog],
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
  const resolvedVariableId = (data?.variable ?? variableInput ?? '').trim();
  const resolvedUnits = getVariableUnits(resolvedVariableId);
  const rankingIsCategorical = CATEGORICAL_VARIABLES.has(resolvedRankingVariable);
  const formatEntryValue = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '—';
      }
      if (rankingIsCategorical) {
        return `${(value * 100).toFixed(1)}%`;
      }
      const formatted = value.toFixed(2);
      return resolvedUnits ? `${formatted} ${resolvedUnits}` : formatted;
    },
    [rankingIsCategorical, resolvedUnits],
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.background.default.secondary }]}>
      <PageHeader
        searchValue=""
        onSearchChange={() => {}}
        onSubmitSearch={() => {}}
        showFilterButton={false}
      />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: palette.background.default.secondary },
        ]}
      >
        <View style={styles.hero}>
          <ThemedText variant="titlePage">Leaderboards</ThemedText>
          <ThemedText variant="bodySmall">
            Explore how descendants rank for a chosen taxon, environment variable, and metric.
          </ThemedText>
        </View>
        <View style={styles.sectionCard}>
          <ThemedText variant="bodySmallEmphasis">Base taxon</ThemedText>
          <ThemedText variant="bodySmall">
            Search for a family, genus, or species to anchor the leaderboard.
          </ThemedText>
          <TextInput
            value={taxonQuery}
            onChangeText={(value) => {
              setTaxonQuery(value);
              setSelectedTaxon(null);
            }}
            style={[styles.input, { color: palette.text.default.default, backgroundColor: palette.background.default.tertiary }]}
            placeholder="Search taxa (e.g. Cactaceae, Ribes, Podaxis pistillaris)"
            placeholderTextColor={palette.text.default.tertiary}
          />
          {taxonSearching ? (
            <ThemedText variant="bodySmall" style={{ color: palette.text.default.secondary }}>
              Searching…
            </ThemedText>
          ) : null}
          {taxonSearchError ? (
            <ThemedText variant="bodySmall" style={{ color: palette.text.danger.default }}>
              {taxonSearchError}
            </ThemedText>
          ) : null}
          {taxonResults.length ? (
            <View style={styles.taxonResults}>
              {taxonResults.map((taxon) => (
                <Pressable
                  key={taxon.taxonId}
                  style={styles.taxonResultItem}
                  onPress={() => {
                    setSelectedTaxon(taxon);
                    setTaxonInput(String(taxon.taxonId));
                    setTaxonQuery(
                      `${taxon.commonName || taxon.scientificName} (${taxon.scientificName})`,
                    );
                    setTaxonResults([]);
                  }}
                >
                  <ThemedText variant="bodySmallEmphasis">
                    {taxon.commonName || taxon.scientificName}
                  </ThemedText>
                  <ThemedText variant="bodySmall">
                    {taxon.scientificName} · #{taxon.taxonId}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}
          {selectedTaxon ? (
            <View style={styles.selectedTaxon}>
              <SpeciesCard
                taxonId={Number(selectedTaxon.taxonId)}
                commonName={selectedTaxon.commonName}
                scientificName={selectedTaxon.scientificName}
                description={selectedTaxon.description}
                imageSource={selectedTaxon.imageSource}
                onPress={() =>
                  openSpeciesPage(selectedTaxon.taxonId, selectedTaxon.scientificName)
                }
              />
            </View>
          ) : null}
        </View>
        <View style={styles.sectionCard}>
          <ThemedText variant="bodySmallEmphasis">Filters</ThemedText>
          <SpeciesLocationPicker value={selectedLocation} onChange={handleLocationChange} />
          <View style={styles.formRow}>
            <View style={styles.field}>
              <ThemedText variant="bodySmallEmphasis">Rank</ThemedText>
              <TextInput
                value={rankInput}
                onChangeText={setRankInput}
                style={[styles.input, { color: palette.text.default.default, backgroundColor: palette.background.default.tertiary }]}
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
                      {
                        borderColor: palette.border.default,
                        backgroundColor: palette.background.default.tertiary,
                      },
                    ]}
                    onPress={() => setVariableDropdownOpen((prev) => !prev)}
                  >
                    <ThemedText variant="bodySmall" style={{ color: palette.text.default.default }}>
                      {variableInput ? getVariableLabel(variableInput) : 'Select variable'}
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
                              {getVariableLabel(choice)}
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
                  style={[styles.input, { color: palette.text.default.default, backgroundColor: palette.background.default.tertiary }]}
                  autoCapitalize="none"
                  placeholder="Temperature (bio_1)"
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
                      {
                        borderColor: palette.border.default,
                        backgroundColor: palette.background.default.tertiary,
                      },
                    ]}
                    onPress={() => setMetricDropdownOpen((prev) => !prev)}
                  >
                    <ThemedText variant="bodySmall" style={{ color: palette.text.default.default }}>
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
                  style={[styles.input, { color: palette.text.default.default, backgroundColor: palette.background.default.tertiary }]}
                  autoCapitalize="none"
                  placeholder="mean"
                  placeholderTextColor={palette.text.default.tertiary}
                />
              )}
            </View>
          </View>
          <View style={styles.optionsHeader}>
            <ThemedText variant="bodySmallEmphasis">Available metric combinations</ThemedText>
            {optionsLoading || variableCatalogLoading ? (
              <ActivityIndicator size="small" color={palette.text.default.secondary} />
            ) : null}
          </View>
          {optionsError ? (
            <ThemedText variant="bodySmall" style={{ color: palette.text.danger.default }}>
              {optionsError}
            </ThemedText>
          ) : null}
          {variableCatalogError ? (
            <ThemedText variant="bodySmall" style={{ color: palette.text.danger.default }}>
              {variableCatalogError}
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
                style={[styles.input, { color: palette.text.default.default, backgroundColor: palette.background.default.tertiary }]}
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
                style={[styles.input, { color: palette.text.default.default, backgroundColor: palette.background.default.tertiary }]}
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
                Load Leaderboard
              </ThemedText>
            )}
          </Pressable>
          {error ? (
            <ThemedText variant="bodySmall" style={{ color: palette.text.danger.default }}>
              {error}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.sectionCard}>
          <View style={styles.selectionSummary}>
            <View style={styles.selectionMeta}>
              <ThemedText variant="bodySmallEmphasis">
                Variable: {getVariableLabel(variableInput.trim() || data?.variable || '—')}
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
              {data.entries.map((entry) => {
                const resolvedTaxonId = Number(entry.taxonId);
                const safeTaxonId = Number.isFinite(resolvedTaxonId) ? resolvedTaxonId : 0;
                const rawCommonName =
                  entry.commonName ??
                  (entry as any)?.common_name ??
                  (entry as any)?.commonName ??
                  (entry as any)?.name ??
                  (entry as any)?.label ??
                  (entry as any)?.taxon_name ??
                  (entry as any)?.taxonName ??
                  null;
                const rawScientificName =
                  entry.scientificName ??
                  (entry as any)?.scientific_name ??
                  (entry as any)?.scientificName ??
                  (entry as any)?.name ??
                  (entry as any)?.label ??
                  (entry as any)?.taxon_name ??
                  (entry as any)?.taxonName ??
                  null;
                const fallbackLabel =
                  rawCommonName ??
                  rawScientificName ??
                  (Number.isFinite(safeTaxonId) ? `Taxon #${safeTaxonId}` : 'Unknown species');
                const commonName = rawCommonName ?? fallbackLabel;
                const scientificName = rawScientificName ?? fallbackLabel;
                const displayCommonName = String(commonName).replace(/_/g, ' ');
                const displayScientificName = String(scientificName).replace(/_/g, ' ');
                const description = `#${entry.position} · Rank ${entry.rank ?? '—'} · Value ${formatEntryValue(entry.value)} · ${formatPercent(entry.percentile)} · Samples ${entry.sampleCount ?? '—'}`;
                return (
                  <SpeciesCard
                    key={`${entry.taxonId}-${entry.position}`}
                    taxonId={safeTaxonId}
                    commonName={displayCommonName}
                    scientificName={displayScientificName}
                    description={description}
                    imageSource={entry.imageSource}
                    size="large"
                    onPress={() =>
                      openSpeciesPage(entry.taxonId, entry.scientificName ?? entry.commonName)
                    }
                  />
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: Size.space['600'],
    gap: Size.space['300'],
  },
  hero: {
    gap: Size.space['100'],
  },
  sectionCard: {
    backgroundColor: '#2f2f2f',
    borderRadius: Size.radius['200'],
    padding: Size.space['400'],
    gap: Size.space['200'],
  },
  taxonResults: {
    borderRadius: Size.radius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#4a4a4a',
    overflow: 'hidden',
  },
  taxonResultItem: {
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['150'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#4a4a4a',
  },
  selectedTaxon: {
    marginTop: Size.space['200'],
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
