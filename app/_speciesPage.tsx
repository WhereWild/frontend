import {
  InlineExpandableRows,
  NearbySpeciesCarousel,
  PageHeader,
  SpeciesPageHeader,
  ThemedText,
} from '@/components';
import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { Colors, Size } from '@/constants/theme';
import { fetchSpeciesOccurrences } from '@/data/api';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { LocationSearchResult, SpeciesOccurrence, SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';

type SpeciesSampleScreenProps = {
  data?: SpeciesPageData;
};

export default function SpeciesPage({ data = mountainBallCactusData }: SpeciesSampleScreenProps) {
  const { taxonId, commonName, scientificName, overview, dataSections, nearbySpecies, heatmap } =
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
  const [selectedLocation] = React.useState<LocationSearchResult | null>(null);
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

          <View style={styles.centeredSection}>
            <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}>
              <InlineExpandableRows sections={dataSections} />
            </View>
          </View>
          <NearbySpeciesCarousel species={nearbySpecies} />

          {shouldRenderOccurrenceMap && (
            <View style={styles.centeredSection}>
              <View style={[styles.sectionContent,{ maxWidth: responsive.contentWidth, paddingHorizontal: responsive.marginHorizontal }]}>
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
});
