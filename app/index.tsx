import { PageHeader, SpeciesCard, ThemedText } from '@/components';
import { Colors, Responsive, Size } from '@/constants/theme';
import { mockHomePageData } from '@/data/homeSample';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import Head from 'expo-router/head';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

const MAP_HEIGHT = 640;
const SIDEBAR_WIDTH = 400;

type HomeScreenProps = {
  data?: HomePageData;
};

export default function HomeScreen({ data = mockHomePageData }: HomeScreenProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const { map, recommendations } = data;
  const [searchQuery, setSearchQuery] = useState('');
  return (
    <>
      <Head>
        <title>WhereWild | Home</title>
      </Head>
      <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
        <PageHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
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
              <ThemedText variant="heading">Active Near You</ThemedText>

              <View style={styles.recommendations}>
                {recommendations.items.map((species) => (
                  <SpeciesCard
                    key={species.id}
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
  recommendations: {
    gap: Size.space['400'],
    width: '100%',
  },
  speciesCard: {
    maxWidth: '100%',
  },
});
