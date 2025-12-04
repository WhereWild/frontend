import type { HomePageData } from './types';

const escobariaViviparaImage = require('@/assets/images/escobaria_vivipara.jpg');
const hypaurotisCrysalusImage = require('@/assets/images/Hypaurotis_crysalus.jpg');
const speaIntermontanaImage = require('@/assets/images/Spea_intermontana.jpg');
const haliaeetusLeucocephalusImage = require('@/assets/images/Haliaeetus_leucocephalus.jpg');
const demoSpeciesImage = require('@/assets/images/placeholder.png');
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
        taxonId: 999000000,
        commonName: 'Sample Species (Demo)',
        scientificName: 'Demo sample data',
        description: 'Opens the built-in sample species page',
        imageSource: demoSpeciesImage,
      },
      {
        taxonId: 148405,
        commonName: 'Spinystar',
        scientificName: 'Escobaria vivipara',
        description: 'Flowering now',
        imageSource: escobariaViviparaImage,
      },
      {
        taxonId: 5305,
        commonName: 'Bald Eagle',
        scientificName: 'Haliaeetus leucocephalus',
        description: 'Migrating nearby',
        imageSource: haliaeetusLeucocephalusImage,
      },
      {
        taxonId: 26704,
        commonName: 'Great Basin Spadefoot',
        scientificName: 'Spea intermontana',
        description: 'Common after rain',
        imageSource: speaIntermontanaImage,
      },
      {
        taxonId: 221964,
        commonName: 'Colorado Hairstreak',
        scientificName: 'Hypaurotis crysalus',
        description: 'Frequent in your area',
        imageSource: hypaurotisCrysalusImage,
      },
    ],
  },
};
