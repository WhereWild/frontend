import { PageHeader, SpeciesCard, ThemedText } from '@/components';
import type { SpeciesCardProps } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

const HEAT_MAP_IMAGE = {
  uri: 'https://www.figma.com/api/mcp/asset/4e7b085b-6b57-4286-82e1-c07d7c8391be',
} as const;

const MAP_CONTROLS_IMAGE = {
  uri: 'https://www.figma.com/api/mcp/asset/d2af09b0-a6bf-4d77-8a1b-1f1341e2b4dd',
} as const;

const MAP_HEIGHT = 640;
const SIDEBAR_WIDTH = 400;

type AppRoute = '/' | '/about' | '/search';

type SpeciesRecommendation = SpeciesCardProps & {
  id: string;
};

const SPECIES_RECOMMENDATIONS: SpeciesRecommendation[] = [
  {
    id: 'mojave-kingcup',
    commonName: 'Mojave Kingcup',
    scientificName: 'Echinocereus triglochidiatus',
    description: 'Flowering now',
    imageSource: { uri: 'https://www.figma.com/api/mcp/asset/b0db2a27-6bd5-4152-88ae-951ffa2af365' },
  },
  {
    id: 'golden-eagle',
    commonName: 'Golden Eagle',
    scientificName: 'Aquila chrysaetos',
    description: 'Migrating nearby',
    imageSource: { uri: 'https://www.figma.com/api/mcp/asset/91018ef5-59f5-4ac3-9b3f-eeb6a66a2707' },
  },
  {
    id: 'great-basin-spadefoot',
    commonName: 'Great Basin Spadefoot',
    scientificName: 'Spea intermontana',
    description: 'Common after rain',
    imageSource: { uri: 'https://www.figma.com/api/mcp/asset/aed3792b-f433-4a76-ba84-a59af8d5df5c' },
  },
  {
    id: 'colorado-hairstreak',
    commonName: 'Colorado Hairstreak',
    scientificName: 'Hypaurotis crysalus',
    description: 'Frequent in your area',
    imageSource: { uri: 'https://www.figma.com/api/mcp/asset/f5f75794-49c6-4880-8e97-e4f919219986' },
  },
];

export default function Index() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  const submitSearchQuery = (query: string) => {
    if (pathname !== '/search') {
      router.push('/search');
    }
  };

  const navigateTo = (path: AppRoute) => {
    if (pathname !== path) {
      router.push(path);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
      <PageHeader
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onLogoPress={() => navigateTo('/')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        bounces={false}
      >
        <View style={styles.layout}>
          <View style={styles.mapSection}>
            <ThemedText variant="heading">
              Local Map
            </ThemedText>

            <View>
              <Image source={HEAT_MAP_IMAGE} style={styles.mapImage} resizeMode="cover" />
              <Image source={MAP_CONTROLS_IMAGE} style={styles.mapControls} resizeMode="contain" />
            </View>
          </View>

          <View
            style={[
              styles.sidebar,
            ]}
          >
            <ThemedText variant="heading">
              Active Near You
            </ThemedText>

            <View style={styles.recommendations}>
              {SPECIES_RECOMMENDATIONS.map((species) => (
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
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Size.space['1600'],
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
