import type { HomePageData } from './types';
const escobaria_vivipara = require('@/assets/images/escobaria_vivipara.jpg')
const Hypaurotis_crysalus = require('@/assets/images/Hypaurotis_crysalus.jpg')
const spea_intermontana = require('@/assets/images/Spea_intermontana.jpg')
const haliaeetus_leucocephalus = require('@/assets/images/Haliaeetus_leucocephalus.jpg')
const local = require('@/assets/images/Local_Map.png')
const controls = require('@/assets/images/Map_Controls.png')


export const mockHomePageData: HomePageData = {
  map: {
    heatmapImage: local,
    controlsImage: controls,
  },
  recommendations: {
    items: [
      {
        id: 'spinystar',
        commonName: 'Spinystar',
        scientificName: 'Escobaria vivipara',
        description: 'Flowering now',
        imageSource: escobaria_vivipara,
      },
      {
        id: 'bald-eagle',
        commonName: 'Bald Eagle',
        scientificName: 'Haliaeetus leucocephalus',
        description: 'Migrating nearby',
        imageSource: haliaeetus_leucocephalus,
      },
      {
        id: 'great-basin-spadefoot',
        commonName: 'Great Basin Spadefoot',
        scientificName: 'Spea intermontana',
        description: 'Common after rain',
        imageSource: spea_intermontana,
      },
      {
        id: 'colorado-hairstreak',
        commonName: 'Colorado Hairstreak',
        scientificName: 'Hypaurotis crysalus',
        description: 'Frequent in your area',
        imageSource: Hypaurotis_crysalus,
      },
    ],
  },
};
