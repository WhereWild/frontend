import type { HomePageData } from './types';

const escobariaViviparaImage = require('@/assets/images/escobaria_vivipara.jpg');
const hypaurotisCrysalusImage = require('@/assets/images/Hypaurotis_crysalus.jpg');
const speaIntermontanaImage = require('@/assets/images/Spea_intermontana.jpg');
const haliaeetusLeucocephalusImage = require('@/assets/images/Haliaeetus_leucocephalus.jpg');
const localMapImage = require('@/assets/images/Local_Map.png');
const mapControlsImage = require('@/assets/images/Map_Controls.png');


export const mockHomePageData: HomePageData = {
  map: {
    heatmapImage: localMapImage,
    controlsImage: mapControlsImage,
  },
  recommendations: {
    items: [
      {
        taxonId: 6378250,
        commonName: 'Common Spinystar',
        scientificName: 'Escobaria vivipara var. vivipara',
        description: 'Flowering now',
        imageSource: escobariaViviparaImage,
      },
      {
        taxonId: 2480446,
        commonName: 'Bald Eagle',
        scientificName: 'Haliaeetus leucocephalus',
        description: 'Migrating nearby',
        imageSource: haliaeetusLeucocephalusImage,
      },
      {
        taxonId: 2429791,
        commonName: 'Great Basin Spadefoot',
        scientificName: 'Spea intermontana',
        description: 'Common after rain',
        imageSource: speaIntermontanaImage,
      },
      {
        taxonId: 1933998,
        commonName: 'Colorado Hairstreak',
        scientificName: 'Hypaurotis crysalus',
        description: 'Frequent in your area',
        imageSource: hypaurotisCrysalusImage,
      },
    ],
  },
};
