import type { SpeciesPageData } from './types';

const FEATURED_IMAGE = require('@/assets/images/placeholder.png');
const HEATMAP = { uri: 'https://www.figma.com/api/mcp/asset/7d50c2fc-2baf-4a64-a4e7-562ccf20b239' };

export const mountainBallCactusData: SpeciesPageData = {
  taxonId: 999001,
  commonName: 'Mountain Ball Cactus',
  commonNames: ['Mountain cactus', 'Snowball cactus', 'Mountain ball cactus'],
  scientificName: 'Pediocactus simpsonii',
  taxonomyPath: 'Plantae_6/Tracheophyta_7707728/Magnoliopsida_220/Caryophyllales_422/Cactaceae_2519/Pediocactus_3231951/Pediocactus_simpsonii_999001',
  description:
    'Pediocactus simpsonii, known by the common names mountain cactus, snowball cactus, and mountain ball cactus, is a relatively common cactus that has adapted to survive in cold and dry environments in high elevation areas of the western United States.',
  overview: {
    description:
      'Pediocactus simpsonii, known by the common names mountain cactus, snowball cactus, and mountain ball cactus, is a relatively common cactus that has adapted to survive in cold and dry environments in high elevation areas of the western United States. It can be found at higher elevations than any other cactus in North America. While not a landscape dominating plant, it is a relatively common species and the most common member of the genus Pediocactus. Because of its beauty and adaptation to cold environments it is sometimes grown by gardeners in areas that have few other choices due to the limited number of cactuses with cold adaptations. Like many cactuses its populations are sometimes threatened by this desirability due to the theft or removal of plants from the wild by collectors.',
    imageSource: FEATURED_IMAGE,
  },
  dataSections: [
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
  ],
  nearbySpecies: [
    {
      taxonId: 200101,
      commonName: 'Utah Juniper',
      scientificName: 'Juniperus osteosperma',
      description: 'Evergreen shrub or small tree adapted to high desert plateaus.',
    },
    {
      taxonId: 200102,
      commonName: 'Sagebrush',
      scientificName: 'Artemisia tridentata',
      description: 'Shrub with aromatic foliage often co-occurring with alpine cacti.',
    },
    {
      taxonId: 200103,
      commonName: 'Colorado Pinyon',
      scientificName: 'Pinus edulis',
      description: 'Slow-growing pine producing edible nuts favored by wildlife.',
    },
    {
      taxonId: 200104,
      commonName: 'Sweat Bees',
      scientificName: 'Halictidae',
      description: 'Important pollinators that frequent cactus blooms in early summer.',
    },
  ],
  heatmap: {
    imageSource: HEATMAP,
  },
};
