import {
  NearbySpeciesCarousel,
  PageHeader,
  SpeciesEnvironmentSection,
  SpeciesLocationPicker,
  SpeciesOccurrenceMap,
  SpeciesPageHeader,
  ThemedText,
} from '@/components';
import { Colors, Size } from '@/constants/theme';
import { fetchSpeciesOccurrences } from '@/data/api';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { LocationSearchResult, SpeciesOccurrence, SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import React from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, View } from 'react-native';

type SpeciesSampleScreenProps = {
  data?: SpeciesPageData;
};

export default function SpeciesPage({ data = mountainBallCactusData }: SpeciesSampleScreenProps) {
  const {
    taxonId,
    commonName,
    commonNames,
    scientificName,
    overview,
    nearbySpecies,
    heatmap,
  } = data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  const [occurrences, setOccurrences] = React.useState<SpeciesOccurrence[]>([]);
  const [occurrenceLoading, setOccurrenceLoading] = React.useState(false);
  const [occurrenceError, setOccurrenceError] = React.useState<string | null>(null);
  const shouldRenderOccurrenceMap = Boolean(taxonId);
  const [highlightedCatalogs, setHighlightedCatalogs] = React.useState<(number | string)[]>([]);
  const [selectedLocation, setSelectedLocation] = React.useState<LocationSearchResult | null>(null);
  const locationGid = selectedLocation?.gid ?? null;

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
          location: locationGid ?? undefined,
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
  }, [taxonId, locationGid]);

  React.useEffect(() => {
    setHighlightedCatalogs([]);
  }, [locationGid]);

  const handleDownload = React.useCallback(() => {
    Alert.alert('Download started', `Preparing ${commonName} data…`);
  }, [commonName]);

  const handleHighlightsChange = React.useCallback((catalogNumbers: Array<number | string>) => {
    setHighlightedCatalogs(catalogNumbers);
  }, []);


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
          <SpeciesPageHeader
            commonName={commonName}
            commonNames={commonNames}
            scientificName={scientificName}
            onPressDownload={handleDownload}
          />

          <View style={styles.centeredSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}
            >
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
                  {(overview.imageCreator || overview.imageLicense || overview.imageReferences) && (
                    <View style={styles.imageAttribution}>
                      {overview.imageCreator && (
                        <ThemedText
                          variant="bodySmall"
                          style={styles.licenseText}
                        >
                          Photo by {overview.imageCreator}
                        </ThemedText>
                      )}
                      {overview.imageReferences && (
                        <ThemedText
                          variant="bodySmall"
                          style={styles.attributionLink}
                          onPress={() => Linking.openURL(overview.imageReferences)}
                        >
                          View on iNaturalist
                        </ThemedText>
                      )}
                      {overview.imageLicense && (
                        <ThemedText variant="bodySmall" style={styles.licenseText}>
                          {overview.imageLicense}
                        </ThemedText>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          <NearbySpeciesCarousel species={nearbySpecies} />

          <View style={styles.centeredSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}
            >
              <SpeciesLocationPicker
                value={selectedLocation}
                onChange={setSelectedLocation}
              />
            </View>
          </View>

          <View style={styles.centeredSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}
            >
              <SpeciesEnvironmentSection
                taxonId={taxonId}
                onHighlightChange={handleHighlightsChange}
                locationGid={locationGid}
                locationName={selectedLocation?.name ?? null}
              />
            </View>
          </View>

          {shouldRenderOccurrenceMap && (
            <View style={styles.centeredSection}>
              <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}
              >
                <ThemedText variant="heading">Observation Map</ThemedText>
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
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}
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
  imageAttribution: {
    marginTop: Size.space['100'],
    gap: Size.space['50'],
  },
  licenseText: {
    opacity: 0.7,
  },
  attributionLink: {
    color: Colors.light.tint,
    textDecorationLine: 'underline',
  },
  heatMapSection: {
    gap: Size.space['400'],
  },
  heatmap: {
    width: '100%',
    aspectRatio: 1440 / 810,
  },
});
