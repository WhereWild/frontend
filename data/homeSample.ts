import type { HomePageData } from './types';

export const mockHomePageData: HomePageData = {
  map: {
    heatmapImage: {
      uri: 'https://www.figma.com/api/mcp/asset/4e7b085b-6b57-4286-82e1-c07d7c8391be',
    },
    controlsImage: {
      uri: 'https://www.figma.com/api/mcp/asset/d2af09b0-a6bf-4d77-8a1b-1f1341e2b4dd',
    },
  },
  recommendations: {
    items: [
      {
        id: 'mojave-kingcup',
        commonName: 'Mojave Kingcup',
        scientificName: 'Echinocereus triglochidiatus',
        description: 'Flowering now',
        imageSource: {
          uri: 'https://www.figma.com/api/mcp/asset/b0db2a27-6bd5-4152-88ae-951ffa2af365',
        },
      },
      {
        id: 'golden-eagle',
        commonName: 'Golden Eagle',
        scientificName: 'Aquila chrysaetos',
        description: 'Migrating nearby',
        imageSource: {
          uri: 'https://www.figma.com/api/mcp/asset/91018ef5-59f5-4ac3-9b3f-eeb6a66a2707',
        },
      },
      {
        id: 'great-basin-spadefoot',
        commonName: 'Great Basin Spadefoot',
        scientificName: 'Spea intermontana',
        description: 'Common after rain',
        imageSource: {
          uri: 'https://www.figma.com/api/mcp/asset/aed3792b-f433-4a76-ba84-a59af8d5df5c',
        },
      },
      {
        id: 'colorado-hairstreak',
        commonName: 'Colorado Hairstreak',
        scientificName: 'Hypaurotis crysalus',
        description: 'Frequent in your area',
        imageSource: {
          uri: 'https://www.figma.com/api/mcp/asset/f5f75794-49c6-4880-8e97-e4f919219986',
        },
      },
    ],
  },
};
