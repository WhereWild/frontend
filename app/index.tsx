import { PageHeader, SpeciesCard, SpeciesOccurrenceMap, ThemedText } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { BACKEND_BASE } from '@/data/api';
import { mockHomePageData } from '@/data/homeSample';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const MAP_HEIGHT = 640;
const SIDEBAR_WIDTH = 400;
const HOME_HEATMAP_TEST_TAXON_ID = 0;

const LAYER_OPTIONS = [
  { id: 'all', label: 'All Layers' },
  { id: 'elevation', label: 'Elevation' },
  { id: 'slope', label: 'Slope' },
  { id: 'aspect', label: 'Aspect' },
  { id: 'landcover', label: 'Landcover' },
  { id: 'koppen_geiger', label: 'Köppen Climate' },
  { id: 'bio_1', label: 'Mean Temp' },
  { id: 'bio_4', label: 'Temp Seasonality' },
  { id: 'bio_12', label: 'Annual Precip' },
  { id: 'bio_15', label: 'Precip Seasonality' },
] as const;

type LayerId = typeof LAYER_OPTIONS[number]['id'];

type HomeScreenProps = {
  data?: HomePageData;
};

export default function HomeScreen({ data = mockHomePageData }: HomeScreenProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const { recommendations } = data;
  const [selectedLayer, setSelectedLayer] = React.useState<LayerId>('all');

  const heatmapTileUrl = React.useMemo(() => {
    const layerParam = selectedLayer === 'all' ? '' : `&layers=${selectedLayer}`;
    return `${BACKEND_BASE}/sdm/tiles/${HOME_HEATMAP_TEST_TAXON_ID}/{z}/{x}/{y}.png?model_id=stub_sum&reproject=true&max_native_zoom=12${layerParam}&_cb=${Date.now()}`;
  }, [selectedLayer]);
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

              <View style={styles.layerPicker}>
                {LAYER_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => setSelectedLayer(option.id)}
                    style={[
                      styles.layerButton,
                      {
                        backgroundColor: selectedLayer === option.id
                          ? palette.background.brand.default
                          : palette.background.default.secondary,
                        borderColor: palette.border.default.default,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="bodySmall"
                      style={{
                        color: selectedLayer === option.id
                          ? '#ffffff'
                          : palette.text.default.default,
                      }}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

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
  layerPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['200'],
  },
  layerButton: {
    paddingHorizontal: Size.space['300'],
    paddingVertical: Size.space['150'],
    borderRadius: Size.radius['200'],
    borderWidth: 1,
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
