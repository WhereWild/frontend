import {
  InlineExpandableRows,
  NearbySpeciesCarousel,
  PageHeader,
  SpeciesPageHeader,
  ThemedText,
} from '@/components';
import { Colors, Size } from '@/constants/theme';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';

type SpeciesSampleScreenProps = {
  data?: SpeciesPageData;
};

export default function SpeciesPage({ data = mountainBallCactusData }: SpeciesSampleScreenProps) {
  const { commonName, scientificName, overview, dataSections, nearbySpecies, heatmap } =
    data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  // Placeholder for future search/filter functionality. Currently unused in this demo screen.
  const [searchQuery, setSearchQuery] = React.useState('');

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
          onFilterPress={() => Alert.alert('Filter coming soon')}
        />

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
