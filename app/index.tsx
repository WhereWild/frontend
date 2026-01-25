import { PageHeader, SpeciesCard, ThemedText } from '@/components';
import { Colors, Responsive, Size } from '@/constants/theme';
import { fetchSpeciesList } from '@/data/api';
import { mockHomePageData } from '@/data/homeSample';
import type { HomePageData, SpeciesSummary } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

const MAP_HEIGHT = 640;
const SIDEBAR_WIDTH = 400;
const SEARCH_RESULT_LIMIT = 8;

const mapSearchResultToSummary = (entry: any): SpeciesSummary | null => {
  const rawId = typeof entry?.taxon_id === 'number' ? entry?.taxon_id : Number(entry?.taxon_id ?? NaN);
  if (!Number.isFinite(rawId)) {
    return null;
  }
  const scientificName =
    (typeof entry?.scientific_name === 'string' && entry.scientific_name.length > 0)
      ? entry.scientific_name
      : `Taxon #${rawId}`;
  const normalizeName = (value?: string) =>
    typeof value === 'string' && value.length > 0 ? value.replace(/_/g, ' ') : value;
  const matchedCommonName = normalizeName(entry?.matched_common_name);
  const commonName = matchedCommonName ?? normalizeName(entry?.common_name) ?? scientificName;
  const description =
    (typeof entry?.description === 'string' && entry.description.length > 0)
      ? entry.description
      : (typeof entry?._raw?.description === 'string' && entry._raw.description.length > 0)
        ? entry._raw.description
        : 'Tap to view species details';
  const imageSource =
    typeof entry?.image_source === 'string'
      ? { uri: entry.image_source }
      : entry?.image_source;
  const commonNames =
    Array.isArray(entry?.common_names)
      ? entry.common_names.filter((name: unknown) => typeof name === 'string' && name.length > 0)
      : undefined;

  return {
    taxonId: rawId,
    commonName,
    scientificName: normalizeName(scientificName),
    description,
    imageSource,
    commonNames,
  };
};

type HomeScreenProps = {
  data?: HomePageData;
};

export default function HomeScreen({ data = mockHomePageData }: HomeScreenProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const { map, recommendations } = data;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpeciesSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    if (!debouncedQuery) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return () => {
        cancelled = true;
      };
    }

    setSearching(true);
    setSearchError(null);
    (async () => {
      try {
        const payload = await fetchSpeciesList(SEARCH_RESULT_LIMIT * 2, debouncedQuery);
        if (cancelled) {
          return;
        }
        const mapped = payload
          .map(mapSearchResultToSummary)
          .filter((entry): entry is SpeciesSummary => Boolean(entry))
          .slice(0, SEARCH_RESULT_LIMIT);
        setSearchResults(mapped);
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Search failed';
        setSearchError(message);
        setSearchResults([]);
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hasQuery = debouncedQuery.length > 0;
  const searchStatusColor = palette.text.default.secondary;
  const showResults = searchResults.length > 0;

  return (
    <>
      <Head>
        <title>WhereWild | Home</title>
      </Head>
      <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
        <PageHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          onSubmitSearch={setSearchQuery}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          bounces={false}
        >
          <View style={styles.layout}>
            <View style={styles.mapSection}>
              <ThemedText variant="heading">Local Map</ThemedText>

              <View>
                <Image source={map.heatmapImage} style={styles.mapImage} resizeMode="cover" />
                <Image source={map.controlsImage} style={styles.mapControls} resizeMode="contain" />
              </View>
            </View>

            <View
              style={[
                styles.sidebar,
              ]}
            >
              <View style={styles.searchSection}>
                <ThemedText variant="heading">Search Results</ThemedText>
                <View
                  style={[
                    styles.searchResultsPanel,
                    { backgroundColor: palette.background.default.secondary },
                  ]}
                >
                  {!hasQuery ? (
                    <ThemedText
                      variant="bodySmall"
                      style={[styles.searchStatusText, { color: searchStatusColor }]}
                    >
                      Start typing to explore species by name or taxon ID.
                    </ThemedText>
                  ) : (
                    <>
                      {searching ? (
                        <ThemedText
                          variant="bodySmall"
                          style={[styles.searchStatusText, { color: searchStatusColor }]}
                        >
                          Searching…
                        </ThemedText>
                      ) : null}
                      {searchError ? (
                        <ThemedText
                          variant="bodySmall"
                          style={[styles.searchStatusText, { color: searchStatusColor }]}
                        >
                          {searchError}
                        </ThemedText>
                      ) : null}
                      {!searching && !searchError && !showResults ? (
                        <ThemedText
                          variant="bodySmall"
                          style={[styles.searchStatusText, { color: searchStatusColor }]}
                        >
                          No species found for “{debouncedQuery}”.
                        </ThemedText>
                      ) : null}
                      {showResults ? (
                        <View style={styles.searchResultList}>
                          {searchResults.map((species) => (
                            <SpeciesCard
                              key={species.taxonId}
                              {...species}
                              style={styles.searchSpeciesCard}
                              variant="tertiary"
                            />
                          ))}
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              </View>

              <ThemedText variant="heading">Active Near You</ThemedText>

              <View style={styles.recommendations}>
                {recommendations.items.map((species) => (
                  <SpeciesCard
                    key={species.taxonId}
                    {...species}
                    style={styles.speciesCard}
                  />
                ))}
              </View>
            </View>
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
    paddingTop: Size.space['800'],
    paddingHorizontal: Responsive.marginHorizontal,
    width: '100%',
  },
  layout: {
    flexDirection: 'row',
    gap: Size.space['800'],
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
  },
  mapSection: {
    flex: 1,
    minWidth: 320,
    gap: Size.space['400'],
  },
  mapContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: MAP_HEIGHT,
  },
  mapControls: {
    position: 'absolute',
    top: Size.space['200'],
    left: Size.space['200'],
    width: 26,
    height: 52,
  },
  sidebar: {
    gap: Size.space['400'],
    flexBasis: SIDEBAR_WIDTH,
    maxWidth: SIDEBAR_WIDTH,
  },
  searchSection: {
    gap: Size.space['200'],
  },
  searchResultsPanel: {
    gap: Size.space['200'],
    padding: Size.space['300'],
    borderRadius: Size.radius['200'],
  },
  searchStatusText: {},
  searchResultList: {
    gap: Size.space['200'],
  },
  searchSpeciesCard: {
    maxWidth: '100%',
  },
  recommendations: {
    gap: Size.space['400'],
    width: '100%',
  },
  speciesCard: {
    maxWidth: '100%',
  },
});
