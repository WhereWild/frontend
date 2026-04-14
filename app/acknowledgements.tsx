import { PageScrollContainer, PageTitle, ThemedText } from '@/components';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import { Linking, Platform, StyleSheet, View } from 'react-native';

export type Reference = {
  authors: string;
  year: number;
  title: string;
  journal?: string;
  volume_issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
};

export type DataSource = {
  name: string;
  url: string;
  license: string;
  license_url?: string;
  notes?: string;
  references: Reference[];
};

const SOURCES: DataSource[] = [
  {
    name: 'GBIF / iNaturalist',
    url: 'https://www.gbif.org/',
    license: 'Varies by record (CC BY, CC BY-NC, or CC0)',
    license_url: 'https://www.gbif.org/terms',
    notes:
      'Occurrence data sourced from GBIF, iNaturalist Research-grade Observations. Two downloads: occurrence records (DWCA) and species list (SPECIES_LIST).',
    references: [
      {
        authors: 'GBIF.org',
        year: 2025,
        title:
          'GBIF Occurrence Download \u2014 iNaturalist Research-grade Observations (occurrences, DWCA)',
        doi: 'https://doi.org/10.15468/dl.n8r5qv',
      },
      {
        authors: 'GBIF.org',
        year: 2025,
        title:
          'GBIF Occurrence Download \u2014 iNaturalist Research-grade Observations (species list)',
        doi: 'https://doi.org/10.15468/dl.qs9hn5',
      },
    ],
  },
  {
    name: 'WorldClim 2.1',
    url: 'https://worldclim.org/data/worldclim21.html',
    license: 'CC BY 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    references: [
      {
        authors: 'Fick, S.E. and R.J. Hijmans',
        year: 2017,
        title:
          'WorldClim 2: new 1km spatial resolution climate surfaces for global land areas',
        journal: 'International Journal of Climatology',
        volume_issue: '37(12)',
        pages: '4302\u20134315',
        doi: 'https://doi.org/10.1002/joc.5086',
      },
    ],
  },
  {
    name: 'CHELSA-BIOCLIM+',
    url: 'https://www.chelsa-climate.org/datasets/chelsa_bioclim',
    license: 'CC0 1.0',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    references: [
      {
        authors:
          'Brun, P., Zimmermann, N.E., Hari, C., Pellissier, L., and Karger, D.N.',
        year: 2022,
        title:
          'Global climate-related predictors at kilometer resolution for the past and future',
        journal: 'Earth System Science Data',
        volume_issue: '14(12)',
        pages: '5573\u20135603',
        doi: 'https://doi.org/10.5194/essd-14-5573-2022',
      },
      {
        authors:
          'Brun, P., Zimmermann, N.E., Hari, C., Pellissier, L., and Karger, D.N.',
        year: 2022,
        title:
          'CHELSA-BIOCLIM+ A novel set of global climate-related predictors at kilometre-resolution',
        journal: 'EnviDat',
        doi: 'https://doi.org/10.16904/envidat.332',
      },
    ],
  },
  {
    name: 'K\u00f6ppen-Geiger Climate Classification',
    url: 'https://www.gloh2o.org/koppen/',
    license: 'CC BY 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    references: [
      {
        authors:
          'Beck, H.E., McVicar, T.R., Vergopolan, N., Berg, A., Lutsko, N.J., Dufour, A., Zeng, Z., Jiang, X., van Dijk, A.I.J.M., and Miralles, D.G.',
        year: 2023,
        title:
          'High-resolution (1 km) K\u00f6ppen-Geiger maps for 1901\u20132099 based on constrained CMIP6 projections',
        journal: 'Scientific Data',
        volume_issue: '10',
        pages: '724',
        doi: 'https://doi.org/10.1038/s41597-023-02549-6',
      },
    ],
  },
  {
    name: 'Open-Meteo (ERA5 / ERA5-Land)',
    url: 'https://open-meteo.com/',
    license: 'CC BY 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    references: [
      {
        authors: 'Zippenfenig, P.',
        year: 2023,
        title: 'Open-Meteo.com Weather API',
        journal: 'Zenodo',
        doi: 'https://doi.org/10.5281/ZENODO.7970649',
      },
      {
        authors:
          'Hersbach, H., Bell, B., Berrisford, P., Biavati, G., Hor\u00e1nyi, A., Mu\u00f1oz Sabater, J., Nicolas, J., Peubey, C., Radu, R., Rozum, I., Schepers, D., Simmons, A., Soci, C., Dee, D., and Th\u00e9paut, J-N.',
        year: 2023,
        title: 'ERA5 hourly data on single levels from 1940 to present',
        journal: 'ECMWF',
        doi: 'https://doi.org/10.24381/cds.adbb2d47',
      },
      {
        authors: 'Mu\u00f1oz Sabater, J.',
        year: 2019,
        title: 'ERA5-Land hourly data from 2001 to present',
        journal: 'ECMWF',
        doi: 'https://doi.org/10.24381/CDS.E2161BAC',
      },
    ],
  },
  {
    name: 'NCEP GFS 0.13\u00b0 via Open-Meteo',
    url: 'https://open-meteo.com/',
    license: 'Public Domain',
    license_url: 'https://www.weather.gov/disclaimer',
    references: [
      {
        authors: 'Zippenfenig, P.',
        year: 2023,
        title: 'Open-Meteo.com Weather API',
        journal: 'Zenodo',
        doi: 'https://doi.org/10.5281/ZENODO.7970649',
      },
    ],
  },
  {
    name: 'SoilGrids 2.0',
    url: 'https://soilgrids.org/',
    license: 'CC BY 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    references: [
      {
        authors:
          'Poggio, L., de Sousa, L.M., Batjes, N.H., Heuvelink, G.B.M., Kempen, B., Ribeiro, E., and Rossiter, D.',
        year: 2021,
        title:
          'SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty',
        journal: 'SOIL',
        volume_issue: '7',
        pages: '217\u2013240',
        doi: 'https://doi.org/10.5194/soil-7-217-2021',
      },
      {
        authors:
          'Turek, M.E., Poggio, L., Batjes, N.H., Armindo, R.A., de Jong van Lier, Q., de Sousa, L.M., and Heuvelink, G.B.M.',
        year: 2023,
        title:
          'Global mapping of volumetric water retention at 100, 330 and 15 000 cm suction using the WoSIS database',
        journal: 'International Soil and Water Conservation Research',
        volume_issue: '11(2)',
        pages: '225\u2013239',
        doi: 'https://doi.org/10.1016/j.iswcr.2022.08.001',
      },
    ],
  },
  {
    name: 'Global Landform and Lithology',
    url: 'https://zenodo.org/records/1464846',
    license: 'CC BY 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    references: [
      {
        authors: 'Hengl, T.',
        year: 2018,
        title:
          'Global landform and lithology class at 250 m based on the USGS global ecosystem map (1.0)',
        journal: 'Zenodo',
        doi: 'https://doi.org/10.5281/zenodo.1464846',
      },
    ],
  },
  {
    name: 'GLC_FCS30-2020',
    url: 'https://zenodo.org/records/4280923',
    license: 'CC BY 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    references: [
      {
        authors: 'Liu, L., Zhang, X., Chen, X., Gao, Y., and Mi, J.',
        year: 2020,
        title:
          'GLC_FCS30-2020: Global Land Cover with Fine Classification System at 30m in 2020 (v1.2)',
        journal: 'Zenodo',
        doi: 'https://doi.org/10.5281/zenodo.4280923',
      },
    ],
  },
  {
    name: 'FABDEM V1-2',
    url: 'https://data.bris.ac.uk/data/dataset/s5hqmjcdj8yo2ibzi9b4ew3sn',
    license: 'CC BY-NC-SA 4.0',
    license_url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    references: [
      {
        authors:
          'Hawker, L., Neal, J., Uhe, P.F., Paulo, L., Sosa Moreno, J.E., Savage, J.T.S., and Sampson, C.',
        year: 2021,
        title: 'FABDEM',
        journal: 'University of Bristol',
        doi: 'https://doi.org/10.5523/bris.25wfy0f9ukoge2gs7a5mqpq2j7',
      },
    ],
  },
  {
    name: 'GADM (Global Administrative Areas)',
    url: 'https://gadm.org/',
    license:
      'Free for academic, research, and teaching use. Redistribution and commercial use not permitted without prior permission.',
    license_url: 'https://gadm.org/license.html',
    notes:
      'The University of California, Berkeley, Museum of Vertebrate Zoology, and the International Rice Research Institute must be acknowledged on any derivative product.',
    references: [
      {
        authors:
          'Hijmans, R.J., Garcia, N., Kapoor, J., Rala, A., Maunahan, A., and Wieczorek, J.',
        year: 2012,
        title:
          'Global Administrative Areas (GADM database of Global Administrative Areas)',
        url: 'https://gadm.org/data.html',
      },
    ],
  },
];

export function SourceEntry({ source }: { source: DataSource }) {
  return (
    <View style={styles.sourceEntry}>
      <View style={styles.sourceHeader}>
        <ThemedText variant='subheading'>
          <ThemedText
            variant='link'
            onPress={() => Linking.openURL(source.url)}
          >
            {source.name}
          </ThemedText>
        </ThemedText>
        <ThemedText variant='bodySmall'>
          {'License: '}
          {source.license_url ? (
            <ThemedText
              variant='bodySmallLink'
              onPress={() => Linking.openURL(source.license_url!)}
            >
              {source.license}
            </ThemedText>
          ) : (
            source.license
          )}
        </ThemedText>
        {source.notes ? (
          <ThemedText variant='bodySmall'>{source.notes}</ThemedText>
        ) : null}
      </View>
      <View style={styles.referenceList}>
        {source.references.map((ref, i) => (
          <ThemedText key={i} variant='bodySmall'>
            {`${ref.authors} (${ref.year}). \u201c${ref.title}.\u201d`}
            {ref.journal ? ` ${ref.journal}` : ''}
            {ref.volume_issue ? `, ${ref.volume_issue}` : ''}
            {ref.pages ? `, pp. ${ref.pages}` : ''}
            {ref.doi ? '. ' : ref.url ? '. ' : '.'}
            {ref.doi ? (
              <ThemedText
                variant='bodySmallLink'
                onPress={() => Linking.openURL(ref.doi!)}
              >
                {ref.doi}
              </ThemedText>
            ) : ref.url ? (
              <ThemedText
                variant='bodySmallLink'
                onPress={() => Linking.openURL(ref.url!)}
              >
                {ref.url}
              </ThemedText>
            ) : null}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

export default function AcknowledgementsScreen() {
  const responsive = useResponsive();

  return (
    <>
      {Platform.OS === 'web' ? (
        <Head>
          <title>WhereWild | Acknowledgements</title>
        </Head>
      ) : null}
      <View style={Platform.OS === 'web' ? styles.screenWeb : styles.screen}>
        <PageScrollContainer
          contentContainerStyle={getResponsiveContentContainerStyle(
            responsive,
            {
              includeHorizontalPadding: false,
              includeBottomPadding: true,
              includeGap: true,
            },
          )}
          bounces={false}
        >
          {Platform.OS === 'web' ? (
            <PageTitle title='Acknowledgements' />
          ) : null}

          <View
            style={[
              styles.contentShell,
              getResponsiveContentContainerStyle(responsive, {
                includeWidth: false,
                includeTopPadding: false,
              }),
            ]}
          >
            <View style={[styles.content, { maxWidth: responsive.textWidth }]}>
              <View style={styles.section}>
                <ThemedText variant='body'>
                  {
                    'WhereWild is built on top of a number of remarkable open datasets. We are deeply grateful to the researchers and organizations who made their work freely available. WhereWild is and will always be completely free and open source, in compliance with the non-commercial licenses of many of these datasets.'
                  }
                </ThemedText>
              </View>
              <View style={styles.section}>
                {SOURCES.map((source) => (
                  <SourceEntry key={source.name} source={source} />
                ))}
              </View>
            </View>
          </View>
        </PageScrollContainer>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenWeb: {
    width: '100%',
  },
  contentShell: {
    width: '100%',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    gap: Size.space.text.section,
  },
  section: {
    gap: Size.space.text.subsection,
  },
  sourceEntry: {
    gap: Size.space.text.paragraph,
  },
  sourceHeader: {
    gap: Size.space.text.line,
  },
  referenceList: {
    gap: Size.space.text.paragraph,
    paddingLeft: Size.space['400'],
  },
});
