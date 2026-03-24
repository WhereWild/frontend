import { ActiveNearYouSection, LocalMapSection } from '@/components';
import { Colors } from '@/constants/theme';
import { fetchSpeciesByTaxonId } from '@/data/api';
import { mockHomePageData } from '@/data/homeSample';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle, getResponsiveGapStyle } from '@/constants/responsiveStyles';
import { useSettings } from '@/context/SettingsContext';
import Head from 'expo-router/head';
import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

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
  const { units } = useSettings();
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
            const payload = await fetchSpeciesByTaxonId(item.taxonId, { units });
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
  }, [recommendations.items, units]);

  return (
    <>
      <Head>
        <title>WhereWild | Home</title>
      </Head>
      <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
        <ScrollView
          contentContainerStyle={getResponsiveContentContainerStyle(responsive)}
          bounces={false}
        >
          <View style={[styles.layout, getResponsiveGapStyle(responsive)]}>
            <LocalMapSection
              heatmapImage={map.heatmapImage}
              controlsImage={map.controlsImage}
              style={styles.mapSection}
            />

            <ActiveNearYouSection
              recommendations={resolvedRecommendations}
              style={styles.sidebar}
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
  layout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
  },
  mapSection: {
    flex: 1,
    minWidth: 320,
  },
  sidebar: {
    flexBasis: SIDEBAR_WIDTH,
    maxWidth: SIDEBAR_WIDTH,
  },
});
