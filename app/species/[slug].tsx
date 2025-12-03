import React from 'react';
import { View, ScrollView, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PageHeader, InlineExpandableRows, NearbySpeciesCarousel, ThemedText, SpeciesPageHeader } from '@/components';
import { Colors, Size, Responsive } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fetchSpeciesBySlug } from '@/data/api';

type SpeciesBasics = {
  common_name: string;
  scientific_name: string;
  image_source?: any;
  image_url?: string; // require('...') or { uri: '...' }
  description?: string;
};


export default function SpeciesBasicsPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const [data, setData] = React.useState<SpeciesBasics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);


  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchSpeciesBySlug(String(slug));
        if (!mounted) return;
        setData(res ?? null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? 'Failed to load species');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug]);

  if(data == null)
    return;


  // Normalize image_source: allow require(...) or { uri }
  // If backend gives a raw string, convert to { uri: string }
  let imageSource: any = undefined;
  if (data.image_source) {
    if (typeof data.image_source === 'string') {
      imageSource = { uri: data.image_source };
    } else if (data?.image_url) {
        imageSource = { uri: data.image_url }; // <-- use backend-provided URL
        }
  }
    const dataSections = [
    {
      title: 'Overview',
      entries: [
        { dataName: 'Average elevation', dataPoint: '2000 m', expandable: false },
        {
          dataName: 'Average precipitation',
          dataPoint: '39.4 cm',
          details: [
            { label: 'Median rainfall (spring)', value: '32 cm' },
            { label: 'Median rainfall (summer)', value: '24 cm' },
            { label: 'Median rainfall (autumn)', value: '41 cm' },
            { label: 'Median rainfall (winter)', value: '61 cm' },
          ],
        },
      ],
    },
    {
      title: 'Habitat',
      entries: [
        { dataName: 'Common climate', dataPoint: 'desert', expandable: false },
        {
          dataName: 'Common soil',
          dataPoint: 'loose',
          details: [
            { label: 'Soil moisture', value: 'Low' },
            { label: 'Drainage', value: 'Fast' },
            { label: 'pH tolerance', value: 'Neutral to alkaline' },
            { label: 'Organic matter', value: 'Sparse' },
          ],
        },
      ],
    },
    {
      title: 'Phenology',
      entries: [
        {
          dataName: 'Flowering season',
          dataPoint: 'May to June',
          details: [
            { label: 'Flowering peak', value: 'Late May' },
            { label: 'Seed set', value: 'Early June' },
            { label: 'Dormancy', value: 'Late summer' },
          ],
        },
        { dataName: 'Fruiting season', dataPoint: 'varies', expandable: false },
      ],
    },
  ];

  const nearbySpecies = [
    {
      commonName: 'Utah Juniper',
      scientificName: 'Juniperus osteosperma',
      description: 'Evergreen shrub or small tree adapted to high desert plateaus.',
    },
    {
      commonName: 'Sagebrush',
      scientificName: 'Artemisia tridentata',
      description: 'Shrub with aromatic foliage often co-occurring with alpine cacti.',
    },
    {
      commonName: 'Colorado Pinyon',
      scientificName: 'Pinus edulis',
      description: 'Slow-growing pine producing edible nuts favored by wildlife.',
    },
    {
      commonName: 'Sweat Bees',
      scientificName: 'Halictidae',
      description: 'Important pollinators that frequent cactus blooms in early summer.',
    },
  ]
 const heatmapImage = require('@/assets/images/Local_Map.png');


  return (
    <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
              <PageHeader/>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
                <SpeciesPageHeader
                  commonName={data.common_name}
                  scientificName={data.scientific_name}
                />
      
<View style={styles.centeredSection}>
            <View style={styles.sectionContent}>
              <View style={styles.overviewSection}>
                <View style={styles.overviewText}>
                  <ThemedText variant="heading">Overview</ThemedText>
                  <ThemedText variant="body">{data.description}</ThemedText>
                </View>
                <View style={styles.featuredImageWrapper}>
                  <Image
                    source={imageSource}
                    style={[styles.featuredImage]}
                    resizeMode="cover"
                    accessibilityLabel={`${data.common_name} featured image`}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.centeredSection}>
            <View style={styles.sectionContent}>
              <InlineExpandableRows sections={dataSections} />
            </View>
          </View>
          <NearbySpeciesCarousel species={nearbySpecies} />

          <View style={styles.heatMapSection}>
            <View style={[styles.sectionContent]}>
              <ThemedText variant="heading">Heat Map</ThemedText>
            </View>
            <Image
              source={heatmapImage}
              resizeMode="cover"
              style={styles.heatmap}
              accessibilityLabel="Predicted sightings heat map"
            />
          </View>
        </ScrollView>
      </View>
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
    aspectRatio: 4 / 3,
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