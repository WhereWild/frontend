import { IconFilter } from '@/assets/icons';
import { Button, PageHeader, SpeciesCard } from '@/components';
import type { SpeciesCardProps } from '@/components';
import { Colors, Size, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import { usePathname, useRouter } from 'expo-router';

const HEAT_MAP_IMAGE = {
  uri: 'https://www.figma.com/api/mcp/asset/4e7b085b-6b57-4286-82e1-c07d7c8391be',
} as const;

const MAP_CONTROLS_IMAGE = {
  uri: 'https://www.figma.com/api/mcp/asset/d2af09b0-a6bf-4d77-8a1b-1f1341e2b4dd',
} as const;

const MAP_HEIGHT = 640;
const SIDEBAR_WIDTH = 400;

type AppRoute = '/' | '/about';

type SpeciesRecommendation = SpeciesCardProps & {
  id: string;
  disc: string;
};

const SPECIES_RECOMMENDATIONS: SpeciesRecommendation[] = [
  {
    id: 'mojave-kingcup',
    commonName: 'Mojave Kingcup',
    scientificName: 'Echinocereus triglochidiatus',
    description: 'Flowering now',
    imageSource: { uri: 'https://www.figma.com/api/mcp/asset/b0db2a27-6bd5-4152-88ae-951ffa2af365' },
    disc: `
    Echinocereus triglochidiatus is a species of hedgehog cactus known by several common names, 
    including kingcup cactus, claret cup cactus, red-flowered hedgehog cactus and Mojave mound cactus. 
    This cactus is native to the southwestern United States and northern Mexico, where it is a resident of varied 
    habitats from low desert to rocky slopes, scrub, and mountain woodland. E. triglochidiatus is the official state 
    cactus of Colorado.`
  },
  {
    id: 'golden-eagle',
    commonName: 'Golden Eagle',
    scientificName: 'Aquila chrysaetos',
    description: 'Migrating nearby',
    imageSource: { uri: 'https://www.figma.com/api/mcp/asset/91018ef5-59f5-4ac3-9b3f-eeb6a66a2707' },
    disc: `
    The golden eagle (Aquila chrysaetos) is a bird of prey living in the Northern Hemisphere. It is the most widely 
    distributed species of eagle. Like all eagles, it belongs to the family Accipitridae. They are one of the best-known 
    birds of prey in the Northern Hemisphere. These birds are dark brown, with lighter golden-brown plumage on their napes.
    Immature eagles of this species typically have white on the tail and often have white markings on the wings. 
    Golden eagles use their agility and speed combined with powerful feet and large, sharp talons to hunt a variety of prey,
    mainly hares, rabbits, and marmots and other ground squirrels.`
  },
  {
    id: 'great-basin-spadefoot',
    commonName: 'Great Basin Spadefoot',
    scientificName: 'Spea intermontana',
    description: 'Common after rain',
    imageSource: { uri: 'https://www.figma.com/api/mcp/asset/aed3792b-f433-4a76-ba84-a59af8d5df5c' },
    disc: `
    The Great Basin spadefoot (Spea intermontana) is an amphibian in the family Scaphiopodidae. 
    It is 3.8 to 6.3 centimetres (1.5 to 2.5 in) long and is usually colored gray, olive or brown. Great Basin spadefoot 
    toads have adapted to life in dry habitats. They use the hard, keratinized spade on each foot to dig a burrow, 
    where they spend long periods during cold and dry weather. They are opportunistic hunters and will eat anything they 
    can subdue. While their tadpoles have numerous predators, adults are able to produce skin secretions that deter enemies.`
  },
  {
    id: 'colorado-hairstreak',
    commonName: 'Colorado Hairstreak',
    scientificName: 'Hypaurotis crysalus',
    description: 'Frequent in your area',
    imageSource: { uri: 'https://www.figma.com/api/mcp/asset/f5f75794-49c6-4880-8e97-e4f919219986' },
    disc: `
    The Colorado hairstreak (Hypaurotis crysalus) is a montane butterfly native to oak
    scrubland in the southwestern United States and northern Mexico. It was designated the
    state insect of Colorado in 1996. It is the only species in the genus Hypaurotis.
    The upperside of the Colorado hairstreak's wings is dark purple with a broad black or dark border. 
    Each wing has orange spots at the lower outer edge, and each hindwing has a thin hairlike tail. 
    The lower side of the wings is pale to dark gray with white and dark markings, an orange patch 
    on the margin of each forewing, and an orange spot with a black center on the hindwing near the 
    tail. It has a wingspan of 3.1–3.8 cm (1.2–1.5 in). The thin hair-like tails that extend from its rear 
    wings is likely the source of the "hairstreak" part of its name.`,

  },
];

export default function Index() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();

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
            <Text
              style={[
                Typography[mode].heading,
              ]}
            >
              Local Map
            </Text>

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
            <View style={styles.sidebarHeader}>
              <Text
                style={[
                  Typography[mode].heading,
                ]}
              >
                Active Near You
              </Text>
              <Button variant="neutral" size="small" iconStart={<IconFilter />} onPress={() => { }} disabled>
                Filter
              </Button>
            </View>

            <View style={styles.recommendations}>
              {SPECIES_RECOMMENDATIONS.map((species) => (
                <SpeciesCard
                  key={species.id}
                  {...species}
                  style={styles.speciesCard}
                  onPress={() => {
                    const uri = (species.imageSource as any)?.uri ?? '';
                    const encoded = encodeURIComponent(uri);
                    const url = `/species/${species.id}${encoded ? `?image=${encoded}` : ''}`;
                    console.log('[INDEX] pushing url =>', url, 'original uri =>', uri);
                    router.push({
                        pathname: '/species/[id]',
                        params: { id: species.id, image: uri, name: species.commonName, sciName: species.scientificName, discription: species.disc },
                      });;
                  }
                  }
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
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recommendations: {
    gap: Size.space['400'],
    width: '100%',
  },
  speciesCard: {
    maxWidth: '100%',
  },
});
