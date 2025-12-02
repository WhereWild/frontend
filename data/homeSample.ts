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
        common_name: 'Spinystar',
        scientific_name: 'Escobaria vivipara',
        description: 'Flowering now',
        image_source: escobaria_vivipara,
      },
      {
        id: 'bald-eagle',
        common_name: 'Bald Eagle',
        scientific_name: 'Haliaeetus leucocephalus',
        description: 'Migrating nearby',
        image_source: haliaeetus_leucocephalus,
      },
      {
        id: 'great-basin-spadefoot',
        common_name: 'Great Basin Spadefoot',
        scientific_name: 'Spea intermontana',
        description: 'Common after rain',
        image_source: spea_intermontana,
      },
      {
        id: 'colorado-hairstreak',
        common_name: 'Colorado Hairstreak',
        scientific_name: 'Hypaurotis crysalus',
        description: 'Frequent in your area',
        image_source: Hypaurotis_crysalus,
      },
    ],
  },
};
