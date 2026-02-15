import { PageHeader, SpeciesCard, SpeciesOccurrenceMap, ThemedText } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { BACKEND_BASE } from '@/data/api';
import { mockHomePageData } from '@/data/homeSample';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import { ScrollView, StyleSheet, View } from 'react-native';

const MAP_HEIGHT = 640;
const SIDEBAR_WIDTH = 400;
const HOME_HEATMAP_TEST_TAXON_ID = 0;

type HomeScreenProps = {
  data?: HomePageData;
};

export default function HomeScreen({ data = mockHomePageData }: HomeScreenProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const { recommendations } = data;
  const heatmapTileUrl = React.useMemo(
    // Added cache buster for debugging - remove for production
    () => `${BACKEND_BASE}/sdm/tiles/${HOME_HEATMAP_TEST_TAXON_ID}/{z}/{x}/{y}.png?model_id=stub_sum&reproject=true&layers=elevation&_cb=${Date.now()}`,
    [],
  );
  return (
    <>
      <Head>
        <title>WhereWild | Home</title>
      </Head>
      <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
        <PageHeader/>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingHorizontal: responsive.marginHorizontal }]}
          bounces={false}
        >
          <View style={styles.layout}>
            <View style={styles.mapSection}>
              <ThemedText variant="heading">Local Map</ThemedText>

              <SpeciesOccurrenceMap
                occurrences={[]}
                loading={false}
                error={null}
                height={MAP_HEIGHT}
                heatmapTileUrl={heatmapTileUrl}
                heatmapOpacity={0.85}
                showMarkers={false}
              />
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
