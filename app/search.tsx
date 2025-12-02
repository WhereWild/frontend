import { PageHeader, SpeciesCard, ThemedText } from '@/components';
import type { SpeciesCardProps } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

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

export default function Search() {
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
            <View style={styles.filters}>
                <ThemedText variant="heading">Filters</ThemedText>
            </View>

            <View style={styles.main}>
                <ThemedText variant="heading">Results</ThemedText>

                <View style={styles.results}>
                {SPECIES_RECOMMENDATIONS.map((species) => (
                    <SpeciesCard key={species.id} {...species} style={styles.speciesCard} />
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
  filters: {
    gap: Size.space['400'],
    height: '100%',
    flexBasis: SIDEBAR_WIDTH,
    maxWidth: SIDEBAR_WIDTH,
  },
  main: {
    flex: 1,         
    flexDirection: 'column',
    gap: Size.space['400'],
  },
  results: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['400'],
    width: '100%',
  },
  speciesCard: {
    flexBasis: '48%',
    maxWidth: '48%',
  },
});
