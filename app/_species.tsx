import {
  NearbySpeciesCarousel,
  PageHeader,
  SpeciesPageTitle,
  ThemedText,
} from '@/components';
import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { Colors, Size } from '@/constants/theme';
import { fetchSpeciesOccurrences } from '@/data/api';
import { buildCommonNamesWithPrimary } from '@/data/commonNames';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesOccurrence, SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import Head from 'expo-router/head';
import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { SelectField } from '@/components/inputs/SelectField';
import { useSpeciesLocationFilters } from '@/hooks/species/useSpeciesLocationFilters';

type SpeciesScreenProps = {
  data?: SpeciesScreenData;
};

export type SpeciesScreenData = Pick<
  SpeciesPageData,
  'taxonId' | 'scientificName' | 'commonName' | 'commonNames' | 'overview' | 'nearbySpecies' | 'heatmap'
>;

export const LOCATION_SEARCH_LIMIT = 500;
const LOCATION_OCCURRENCE_CHECK_CONCURRENCY = 8;


export default function Species({ data = mountainBallCactusData }: SpeciesScreenProps) {
  const { taxonId, commonName, commonNames, scientificName, overview, nearbySpecies, heatmap } =
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
  const occurrenceLoadRequestRef = React.useRef(0);

  const {
    countryOptions,
    stateOptions,
    countyOptions,
    countryLoading,
    stateLoading,
    countyLoading,
    selectedCountryGid,
    selectedStateGid,
    selectedCountyGid,
    finalLocationGid,
    onCountryChange,
    onStateChange,
    onCountyChange,
  } = useSpeciesLocationFilters({
    taxonId,
    locationSearchLimit: LOCATION_SEARCH_LIMIT,
    occurrenceCheckConcurrency: LOCATION_OCCURRENCE_CHECK_CONCURRENCY,
  });

  React.useEffect(() => {
    setHighlightedCatalogs([]);
  }, [taxonId]);

  React.useEffect(() => {
    return () => {
      occurrenceLoadRequestRef.current += 1;
    };
  }, []);

  // Clear highlights when selection changes
  React.useEffect(() => {
    setHighlightedCatalogs([]);
  }, [finalLocationGid]);

  // Fetch occurrences using effectiveLocationGid
  React.useEffect(() => {
    const requestId = ++occurrenceLoadRequestRef.current;
    if (!taxonId) {
      setOccurrences([]);
      setOccurrenceError('No taxon ID supplied.');
      setOccurrenceLoading(false);
      return;
    }
    setOccurrenceLoading(true);
    setOccurrenceError(null);
    (async () => {
      try {
        const rows = await fetchSpeciesOccurrences(taxonId, {
          location: finalLocationGid ?? undefined,
        });
        if (occurrenceLoadRequestRef.current === requestId) {
          setOccurrences(rows);
        }
      } catch (err) {
        if (occurrenceLoadRequestRef.current === requestId) {
          const message = err instanceof Error ? err.message : 'Failed to load observations.';
          setOccurrenceError(message);
          setOccurrences([]);
        }
      } finally {
        if (occurrenceLoadRequestRef.current === requestId) {
          setOccurrenceLoading(false);
        }
      }
    })();
  }, [taxonId, finalLocationGid]);

  const handleDownload = React.useCallback(() => {
    Alert.alert('Download started', `Preparing ${commonName} data…`);
  }, [commonName]);

  const displayCommonNames = React.useMemo(() => {
    return buildCommonNamesWithPrimary(commonName, commonNames);
  }, [commonName, commonNames]);

  return (
    <>
      <Head>
        <title>{`WhereWild | ${commonName}`}</title>
      </Head>
      <View
        style={[styles.screen, { backgroundColor: palette.background.default.default }]}
      >
        <PageHeader />

        <ScrollView
          contentContainerStyle={getResponsiveContentContainerStyle(responsive, {
            includeHorizontalPadding: false,
            includeGap: true,
          })}
          bounces={false}
        >
          <SpeciesPageTitle
            commonName={commonName}
            scientificName={scientificName}
            onPressDownload={handleDownload}
          />

          <View style={styles.centeredSection}>
            <View
              style={[
                styles.sectionContent,
                getResponsiveContentContainerStyle(responsive, {
                  includeTopPadding: false,
                }),
                { maxWidth: responsive.contentWidth },
              ]}
            >
              <View style={styles.overviewSection}>
                <View style={styles.featuredImageWrapper}>
                  <Image
                    source={overview.imageSource}
                    style={[styles.featuredImage]}
                    resizeMode="cover"
                    accessibilityLabel={`${commonName} featured image`}
                  />
                </View>
                <View style={[styles.overviewText, { maxWidth: responsive.textWidth }]}>
                  <ThemedText variant="heading">Overview</ThemedText>
                  <ThemedText variant="body">{overview.description}</ThemedText>
                </View>
              </View>

              <View style={styles.commonNamesSection}>
                <ThemedText variant="heading">Common Names</ThemedText>
                <View>
                  {displayCommonNames.map((name) => (
                    <View key={name} style={styles.commonNameRow}>
                      <ThemedText
                        variant="body"
                        style={styles.commonNameBullet}
                        accessible={false}
                        importantForAccessibility="no"
                        accessibilityElementsHidden
                      >
                        •
                      </ThemedText>
                      <ThemedText variant="body">
                        {name}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <NearbySpeciesCarousel species={nearbySpecies} />

          {shouldRenderOccurrenceMap && (
            <View style={styles.centeredSection}>
              <View
                style={[
                  styles.sectionContent,
                  getResponsiveContentContainerStyle(responsive, {
                    includeTopPadding: false,
                  }),
                  { maxWidth: responsive.contentWidth },
                ]}
              >
                <ThemedText variant="heading">Observation Map</ThemedText>

                <View style={styles.filterContainer}>
                  <ThemedText variant="subheading">Filter Observations by Location</ThemedText>

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
                  occurrences={occurrences}
                  loading={occurrenceLoading}
                  error={occurrenceError}
                  highlightedCatalogs={highlightedCatalogs}
                />
              </View>
            </View>
          )}

          <View style={styles.heatMapSection}>
            <View
              style={[
                styles.sectionContent,
                getResponsiveContentContainerStyle(responsive, {
                  includeTopPadding: false,
                }),
                { maxWidth: responsive.contentWidth },
              ]}
            >
              <ThemedText variant="heading">Heat Map</ThemedText>
            </View>
            <Image
              source={heatmap.imageSource}
              resizeMode="cover"
              style={styles.heatmap}
              accessibilityLabel="Predicted sightings heat map"
            />
          </View>
        </ScrollView >
      </View >
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centeredSection: {
    width: '100%',
    alignItems: 'center',
  },
  sectionContent: {
    width: '100%',
    gap: Size.space['400'],
  },
  overviewSection: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'center',
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
    minWidth: 240,
  },
  featuredImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Size.radius['400'],
  },
  commonNamesSection: {
    gap: Size.space['200'],
  },
  commonNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Size.space['100'],
  },
  commonNameBullet: {
    minWidth: Size.space['200'],
  },
  heatMapSection: {
    gap: Size.space['400'],
  },
  heatmap: {
    width: '100%',
    aspectRatio: 1440 / 810,
  },
  filterContainer: {
    gap: Size.space['200'],
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: Size.space['200'],
    flexWrap: 'wrap',
  },
  filterItem: {
    flexGrow: 1,
    maxWidth: 720,
  }
});

