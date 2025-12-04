import {
  InlineExpandableRows,
  NearbySpeciesCarousel,
  PageHeader,
  SpeciesPageHeader,
  ThemedText,
} from '@/components';
import { Colors, Responsive, Size } from '@/constants/theme';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import Head from 'expo-router/head';
import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';

type SpeciesSampleScreenProps = {
  data?: SpeciesPageData;
};

export default function SpeciesPage({ data = mountainBallCactusData }: SpeciesSampleScreenProps) {
  const {
    taxonId,
    commonName,
    scientificName,
    overview,
    dataSections: rawDataSections,
    nearbySpecies: rawNearbySpecies,
    heatmap,
  } = data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  // Placeholder for future search/filter functionality. Currently unused in this demo screen.
  const [searchQuery, setSearchQuery] = React.useState('');

  const dataSections = React.useMemo(() => rawDataSections ?? [], [rawDataSections]);
  const nearbySpecies = React.useMemo(() => rawNearbySpecies ?? [], [rawNearbySpecies]);
  const resolvedNearbySpecies = React.useMemo(() => {
    if (nearbySpecies.length > 0) {
      return nearbySpecies;
    }
    // Always show placeholder nearby species for the prototype demo so this section is never empty.
    return mountainBallCactusData.nearbySpecies ?? [];
  }, [nearbySpecies]);

  const emptyCardTone = React.useMemo(
    () => ({
      borderColor: palette.border.default.default,
      backgroundColor: palette.background.default.secondary,
    }),
    [palette.border.default.default, palette.background.default.secondary],
  );

  const overviewDescription = overview?.description?.trim() ?? '';
  const overviewImage = overview?.imageSource;
  const shouldRenderOverview = Boolean(overviewDescription || overviewImage);
  const heatmapImage = heatmap?.imageSource;
  const shouldRenderHeatmap = Boolean(heatmapImage);
  const hasSections = dataSections.length > 0;

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
        <PageHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterPress={() => Alert.alert('Filter coming soon')}
        />

        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          <SpeciesPageHeader
            commonName={commonName}
            scientificName={scientificName}
            onPressDownload={handleDownload}
          />

          <View style={styles.centeredSection}>
            <View style={styles.sectionContent}>
              <View style={styles.overviewSection}>
                {shouldRenderOverview ? (
                  <>
                    {overviewDescription ? (
                      <View style={styles.overviewText}>
                        <ThemedText variant="heading">Overview</ThemedText>
                        <ThemedText variant="body">{overviewDescription}</ThemedText>
                      </View>
                    ) : null}
                    {overviewImage ? (
                      <View style={styles.featuredImageWrapper}>
                        <Image
                          source={overviewImage}
                          style={styles.featuredImage}
                          resizeMode="cover"
                          accessibilityLabel={`${commonName} featured image`}
                        />
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={[styles.emptyStateCard, emptyCardTone]}>
                    <ThemedText variant="body">
                      Overview data is unavailable for this species.
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.centeredSection}>
            <View style={styles.sectionContent}>
              {hasSections ? (
                <InlineExpandableRows sections={dataSections} taxonId={taxonId} />
              ) : (
                <View style={[styles.emptyStateCard, emptyCardTone]}>
                  <ThemedText variant="body">
                    Environmental breakdowns are not yet available.
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
          <NearbySpeciesCarousel species={resolvedNearbySpecies} />

          <View style={styles.heatMapSection}>
            <View style={styles.sectionContent}>
              <ThemedText variant="heading">Heat Map</ThemedText>
            </View>
            {shouldRenderHeatmap ? (
              <Image
                source={heatmapImage!}
                resizeMode="cover"
                style={styles.heatmap}
                accessibilityLabel="Predicted sightings heat map"
              />
            ) : (
              <View style={[styles.emptyStateCard, styles.heatmapPlaceholder, emptyCardTone]}>
                <ThemedText variant="body">
                  Heat map data is still processing for this species.
                </ThemedText>
              </View>
            )}
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
    maxWidth: Responsive.contentWidth,
    gap: Size.space['800'],
    paddingHorizontal: Responsive.marginHorizontal,
  },
  overviewSection: {
    flexDirection: 'row',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
  emptyStateCard: {
    width: '100%',
    padding: Size.space['400'],
    borderRadius: Size.radius['200'],
    borderWidth: Size.stroke.border,
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
  heatmapPlaceholder: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Size.space['4000'],
    paddingVertical: Size.space['600'],
  },
});
