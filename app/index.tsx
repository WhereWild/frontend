import { PageHeader, SpeciesCard, ThemedText } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { fetchSpeciesByTaxonId } from '@/data/api';
import { mockHomePageData } from '@/data/homeSample';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle, getResponsiveGapStyle } from '@/constants/responsiveStyles';
import Head from 'expo-router/head';
import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

const MAP_HEIGHT = 640;
const SIDEBAR_WIDTH = 400;

type HomeScreenProps = {
  data?: HomePageData;
};

const toImageSource = (
  imageUrl: string | null,
  fallback?: ImageSourcePropType,
): ImageSourcePropType | undefined => (imageUrl ? { uri: imageUrl } : fallback);

export default function HomeScreen({ data = mockHomePageData }: HomeScreenProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const { map, recommendations } = data;
  const [resolvedRecommendations, setResolvedRecommendations] = React.useState(
    recommendations.items,
  );

  React.useEffect(() => {
    let mounted = true;
    setResolvedRecommendations(recommendations.items);

    (async () => {
      const hydrated = await Promise.all(
        recommendations.items.map(async (item) => {
          try {
            const payload = await fetchSpeciesByTaxonId(item.taxonId);
            const commonName = payload.common_name?.trim() || item.commonName;
            const commonNames = payload.common_names?.length ? payload.common_names : item.commonNames;

            return {
              ...item,
              taxonId: payload.taxon_id ?? item.taxonId,
              commonName,
              commonNames,
              scientificName: payload.scientific_name?.trim() || item.scientificName,
              description: payload.description?.trim() || item.description,
              imageSource: toImageSource(payload.image_source, item.imageSource),
            };
          } catch {
            return item;
          }
        }),
      );

      if (mounted) {
        setResolvedRecommendations(hydrated);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [recommendations.items]);

  return (
    <>
      <Head>
        <title>WhereWild | Home</title>
      </Head>
      <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
        <PageHeader/>

        <ScrollView
          contentContainerStyle={getResponsiveContentContainerStyle(responsive)}
          bounces={false}
        >
          <View style={[styles.layout, getResponsiveGapStyle(responsive)]}> 
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
              <ThemedText variant="heading">Active Near You</ThemedText>

              <View style={styles.recommendations}>
                {resolvedRecommendations.map((species) => (
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
  layout: {
    flexDirection: 'row',
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
  recommendations: {
    gap: Size.space['400'],
    width: '100%',
  },
  speciesCard: {
    maxWidth: '100%',
  },
});
