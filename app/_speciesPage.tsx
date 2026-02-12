import {
  InlineExpandableRows,
  NearbySpeciesCarousel,
  PageHeader,
  SpeciesPageTitle,
  ThemedText,
} from '@/components';
import { SpeciesEnvironmentSection } from '@/components/sections/SpeciesEnvironmentSection';
import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { Colors, Size } from '@/constants/theme';
import { fetchSpeciesOccurrences, fetchLocationsByHierarchy } from '@/data/api';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { LocationSearchResult, SpeciesOccurrence, SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { SelectField } from '@/components/inputs/SelectField';
import { stripDiacritics } from '@/utils/stripDiacritics';

type SpeciesSampleScreenProps = {
  data?: SpeciesPageData;
};



export default function SpeciesPage({ data = mountainBallCactusData }: SpeciesSampleScreenProps) {
  const { taxonId, commonName, scientificName, overview, nearbySpecies, heatmap } =
    data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  const [occurrences, setOccurrences] = React.useState<SpeciesOccurrence[]>([]);
  const [occurrenceLoading, setOccurrenceLoading] = React.useState(false);
  const [occurrenceError, setOccurrenceError] = React.useState<string | null>(null);
  const shouldRenderOccurrenceMap = Boolean(taxonId);
  const [highlightedCatalogs, setHighlightedCatalogs] = React.useState<(number | string)[]>([]);
  const [selectedContinentGid, setSelectedContinentGid] = React.useState<string>('world');

  const [countryOptions, setCountryOptions] = React.useState<{ label: string; value: string }[]>(
    [],
  );
  const [stateOptions, setStateOptions] = React.useState<{ label: string; value: string }[]>(
    [],
  );
  const [countyOptions, setCountyOptions] = React.useState<{ label: string; value: string }[]>(
    [],
  );

  const [countryLoading, setCountryLoading] = React.useState(false);
  const [stateLoading, setStateLoading] = React.useState(false);
  const [countyLoading, setCountyLoading] = React.useState(false);

  const [selectedCountryGid, setSelectedCountryGid] = React.useState<string | null>(null);
  const [selectedStateGid, setSelectedStateGid] = React.useState<string | null>(null);
  const [selectedCountyGid, setSelectedCountyGid] = React.useState<string | null>(null);

  // Maps to store full LocationSearchResult entries keyed by gid for inference when needed.
  const continentMapRef = React.useRef<Record<string, LocationSearchResult>>({});
  const countryMapRef = React.useRef<Record<string, LocationSearchResult>>({});
  const stateMapRef = React.useRef<Record<string, LocationSearchResult>>({});
  const countyMapRef = React.useRef<Record<string, LocationSearchResult>>({});

  // simple cache for lists: { `${taxonId}::level::parentGid` => LocationSearchResult[] }
  const speciesLocationCacheRef = React.useRef<Record<string, LocationSearchResult[]>>({});

  const finalLocationGid: string | null = React.useMemo(() => {
    return (
      selectedCountyGid ??
      selectedStateGid ??
      selectedCountryGid ??
      (selectedContinentGid !== 'world' ? selectedContinentGid : null)
    ) ?? null;
  }, [selectedContinentGid, selectedCountryGid, selectedStateGid, selectedCountyGid]);

  // loadSpeciesLocations remains for states/counties and still filters to places that have observations
  const loadSpeciesLocations = React.useCallback(
    async (
      level: 'country' | 'state' | 'county',
      parentGidOrName: string | null,
    ): Promise<LocationSearchResult[]> => {
      if (!taxonId) return [];

      const cacheKey = `${taxonId}::${level}::${parentGidOrName ?? 'root'}`;
      if (speciesLocationCacheRef.current[cacheKey]) {
        return speciesLocationCacheRef.current[cacheKey];
      }

      // Determine parent token to send to backend:
      let parentToken: string | null = null;
      if (parentGidOrName) {
        const byGid =
          countryMapRef.current[parentGidOrName] ||
          stateMapRef.current[parentGidOrName] ||
          continentMapRef.current[parentGidOrName] ||
          countyMapRef.current[parentGidOrName];
        parentToken = byGid ? byGid.name : parentGidOrName;
      }

      const q = ''; // we prefer passing parent as parent param; backend will enumerate children
      let candidates: LocationSearchResult[] = [];
      try {
        const backendResults = await fetchLocationsByHierarchy(q, level, parentToken ?? undefined, 500);
        candidates = backendResults;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
        candidates = [];
      }

      // Optionally filter client-side by matching exact parent in hierarchy:
      if (parentToken) {
        const lowerParent = parentToken.toLowerCase();
        candidates = candidates.filter((c) =>
          (c.hierarchy || []).some((h) => String(h ?? '').toLowerCase() === lowerParent),
        );
      }

      // Now check which candidates actually have species occurrences
      const positives: LocationSearchResult[] = [];
      const concurrency = 8;
      const queue = candidates.slice();
      const worker = async () => {
        while (queue.length) {
          const candidate = queue.shift()!;
          try {
            const occs = await fetchSpeciesOccurrences(taxonId, { location: candidate.gid });
            if (occs && occs.length > 0) {
              positives.push(candidate);
            }
          } catch {
            // ignore network errors for candidate
          }
        }
      };
      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      positives.sort((a, b) => a.name.localeCompare(b.name));
      speciesLocationCacheRef.current[cacheKey] = positives;
      return positives;
    },
    [taxonId],
  );

  //utility: infer parents from an entry's hierarchy
  const inferAndSetParentsFromEntry = React.useCallback(
    (entry: LocationSearchResult | undefined) => {
      if (!entry) return;

      const hierarchy = Array.isArray(entry.hierarchy) ? entry.hierarchy.map((s) => String(s ?? '')) : [];

      const findByNameInMap = (name: string, map: Record<string, LocationSearchResult>) => {
        if (!name) return null;
        const lower = name.toLowerCase();
        for (const [gid, loc] of Object.entries(map)) {
          if ((loc.name ?? '').toLowerCase() === lower) return gid;
        }
        return null;
      };

      if (entry && entry.level != null) {
        const lvl = entry.level;
        if (lvl <= -1) {
          setSelectedContinentGid(entry.gid);
        } else if (lvl === 0) {
          setSelectedCountryGid(entry.gid);
          const continentName = hierarchy[0] ?? '';
          const continentGid = findByNameInMap(continentName, continentMapRef.current);
          if (continentGid) setSelectedContinentGid(continentGid);
        } else if (lvl === 1) {
          setSelectedStateGid(entry.gid);
          const countryName = hierarchy[1] ?? '';
          const countryGid = findByNameInMap(countryName, countryMapRef.current);
          if (countryGid) setSelectedCountryGid(countryGid);
          const continentName = hierarchy[0] ?? '';
          const continentGid = findByNameInMap(continentName, continentMapRef.current);
          if (continentGid) setSelectedContinentGid(continentGid);
        } else if (lvl >= 2) {
          setSelectedCountyGid(entry.gid);
          const stateName = hierarchy[hierarchy.length - 2] ?? '';
          const countryName = hierarchy[hierarchy.length - 3] ?? hierarchy[1] ?? '';
          const continentName = hierarchy[0] ?? '';

          const stateGid = findByNameInMap(stateName, stateMapRef.current);
          if (stateGid) setSelectedStateGid(stateGid);
          const countryGid = findByNameInMap(countryName, countryMapRef.current);
          if (countryGid) setSelectedCountryGid(countryGid);
          const continentGid = findByNameInMap(continentName, continentMapRef.current);
          if (continentGid) setSelectedContinentGid(continentGid);
        } else {
          if (entry.level <= -1) setSelectedContinentGid(entry.gid);
        }
      }
    },
    [],
  );

  //load countries on mount
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setCountryLoading(true);
      try {
        const list = await loadSpeciesLocations('country', null);
        if (!cancelled) {
          const opts = list.map((l) => ({
            label: l.name,
            value: l.gid,
            labelNorm: stripDiacritics(l.name),
          }));
          setCountryOptions(opts);
          for (const c of list) countryMapRef.current[c.gid] = c;
        }
      } catch {
        if (!cancelled) setCountryOptions([]);
      } finally {
        if (!cancelled) setCountryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taxonId, loadSpeciesLocations]); // run once on mount

  //load states when country changes 
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setStateOptions([]);
      setCountyOptions([]);
      setSelectedStateGid(null);
      setSelectedCountyGid(null);

      if (!taxonId || !selectedCountryGid) {
        return;
      }

      setStateLoading(true);

      try {
        const list = await loadSpeciesLocations('state', selectedCountryGid);
        if (!cancelled) {
          setStateOptions(list.map((l) => ({ label: l.name, value: l.gid })));
          for (const e of list) stateMapRef.current[e.gid] = e;
        }
      } catch {
        if (!cancelled) setStateOptions([]);
      } finally {
        if (!cancelled) setStateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCountryGid, taxonId, loadSpeciesLocations]);

  //load counties when state changes
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setCountyOptions([]);
      setSelectedCountyGid(null);
      if (!taxonId || !selectedStateGid) return;
      setCountyLoading(true);
      try {
        const list = await loadSpeciesLocations('county', selectedStateGid);
        if (!cancelled) {
          setCountyOptions(list.map((l) => ({ label: l.name, value: l.gid })));
          for (const e of list) countyMapRef.current[e.gid] = e;
        }
      } catch {
        if (!cancelled) setCountyOptions([]);
      } finally {
        if (!cancelled) setCountyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStateGid, taxonId, loadSpeciesLocations]);

  //clear highlights when selection changes
  React.useEffect(() => {
    setHighlightedCatalogs([]);
  }, [finalLocationGid]);

  //fetch occurrences using effectiveLocationGid
  React.useEffect(() => {
    let cancelled = false;
    if (!taxonId) {
      setOccurrences([]);
      setOccurrenceError('No taxon ID supplied.');
      return () => {
        cancelled = true;
      };
    }
    setOccurrenceLoading(true);
    setOccurrenceError(null);
    (async () => {
      try {
        const rows = await fetchSpeciesOccurrences(taxonId, {
          location: finalLocationGid ?? undefined,
        });
        if (!cancelled) {
          setOccurrences(rows);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load observations.';
          setOccurrenceError(message);
          setOccurrences([]);
        }
      } finally {
        if (!cancelled) {
          setOccurrenceLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taxonId, finalLocationGid]);

  const handleDownload = React.useCallback(() => {
    Alert.alert('Download started', `Preparing ${commonName} data…`);
  }, [commonName]);

  const onCountryChange = React.useCallback(
    (gid: string | null) => {
      setSelectedCountryGid(gid);
      setSelectedStateGid(null);
      setSelectedCountyGid(null);
    },
    [],
  );

  const onStateChange = React.useCallback(
    (gid: string | null) => {
      setSelectedStateGid(gid);
      setSelectedCountyGid(null);
      if (gid) {
        const entry = stateMapRef.current[gid];
        if (entry) inferAndSetParentsFromEntry(entry);
      }
    },
    [inferAndSetParentsFromEntry],
  );

  const onCountyChange = React.useCallback(
    (gid: string | null) => {
      setSelectedCountyGid(gid);
      if (gid) {
        const entry = countyMapRef.current[gid];
        if (entry) inferAndSetParentsFromEntry(entry);
      }
    },
    [inferAndSetParentsFromEntry],
  );


  const filteredOccurrences = React.useMemo(() => occurrences, [occurrences]);

  return (
    <>
      <Head>
        <title>{`WhereWild | ${commonName}`}</title>
      </Head>
      <View
        style={[styles.screen, { backgroundColor: palette.background.default.default }]}
      >
        <PageHeader />

        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <SpeciesPageTitle
            commonName={commonName}
            scientificName={scientificName}
            onPressDownload={handleDownload}
          />

          <View style={styles.centeredSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}>
              <View style={styles.overviewSection}>
                <View style={styles.overviewText}>
                  <ThemedText variant="heading">Overview</ThemedText>
                  <ThemedText variant="body">{overview.description}</ThemedText>
                </View>
                <View style={styles.featuredImageWrapper}>
                  <Image
                    source={overview.imageSource}
                    style={[styles.featuredImage]}
                    resizeMode="cover"
                    accessibilityLabel={`${commonName} featured image`}
                  />
                </View>
              </View>
            </View>
          </View>

          <SpeciesEnvironmentSection
            taxonId={taxonId}
            onHighlightChange={setHighlightedCatalogs}
            locationGid={finalLocationGid}
          />

          {shouldRenderOccurrenceMap && (
            <View style={styles.centeredSection}>
              <View style={[styles.sectionContent,{ maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}>
                <ThemedText variant="heading">Observation Map</ThemedText>
                                 <View style={styles.filterContainer}>
                  <ThemedText variant="body" style={styles.filterHeader}>Filter</ThemedText>

                  <View style={styles.filterRow}>
                    <View style={styles.filterItem}>
                      <SelectField
                        label="Country"
                        placeholder={countryLoading ? 'Loading…' : 'Select'}
                        options={[{ label: 'All countries', value: '' }, ...countryOptions]}
                        value={selectedCountryGid ?? ''}
                        onValueChange={(v) => onCountryChange(v ? String(v) : null)}
                        disabled={countryLoading || countryOptions.length === 0}
                      />
                    </View>

                    <View style={styles.filterItem}>
                      <SelectField
                        label="State"
                        placeholder={stateLoading ? 'Loading…' : 'Select'}
                        options={[{ label: 'All states', value: '' }, ...stateOptions]}
                        value={selectedStateGid ?? ''}
                        onValueChange={(v) => onStateChange(v ? String(v) : null)}
                        disabled={!selectedCountryGid || stateLoading || stateOptions.length === 0}
                      />
                    </View>

                    <View style={styles.filterItem}>
                      <SelectField
                        label="County"
                        placeholder={countyLoading ? 'Loading…' : 'Select'}
                        options={[{ label: 'All counties', value: '' }, ...countyOptions]}
                        value={selectedCountyGid ?? ''}
                        onValueChange={(v) => onCountyChange(v ? String(v) : null)}
                        disabled={!selectedStateGid || countyLoading || countyOptions.length === 0}
                      />
                    </View>
                  </View>
                </View>

                <SpeciesOccurrenceMap
                  occurrences={filteredOccurrences}
                  loading={occurrenceLoading}
                  error={occurrenceError}
                  highlightedCatalogs={highlightedCatalogs}
                />
              </View>
            </View>
          )}

          <NearbySpeciesCarousel species={nearbySpecies} />

          <View style={styles.heatMapSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}>
              <ThemedText variant="heading">Heat Map</ThemedText>
            </View>
            <Image
              source={heatmap.imageSource}
              resizeMode="cover"
              style={styles.heatmap}
              accessibilityLabel="Predicted sightings heat map"
            />
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    paddingTop: Size.space['800'],
    gap: Size.space['800'],
  },
  centeredSection: {
    width: '100%',
    alignItems: 'center',
  },
  sectionContent: {
    width: '100%',
    gap: Size.space['800'],

  },
  overviewSection: {
    flexDirection: 'row',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
  overviewText: {
    flex: 1,
    minWidth: 280,
    gap: Size.space['200'],
  },
  featuredImageWrapper: {
    flex: 1,
    minWidth: 280,
    maxWidth: 600,
  },
  featuredImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Size.radius['400'],
  },
  heatMapSection: {
    gap: Size.space['400'],
  },
  heatmap: {
    width: '100%',
    aspectRatio: 1440 / 810,
  },
  filterContainer: {
    marginTop: Size.space['200'],
    marginBottom: Size.space['300'],
  },
  filterHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Size.space['200'],
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Size.space?.['200'] ?? 8,
    flexWrap: 'wrap',
  },
  filterItem: {
    flex: 1,
    minWidth: 140,
    marginRight: Size.space['200'],
    marginBottom: Size.space['200'],
  },
});

