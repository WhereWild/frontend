import {
  ContentImage,
  IconButton,
  PageTitle,
  PageScrollContainer,
  ThemedText,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { IconGithub, IconLinkedin, IconMail } from '@/assets/icons';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, Linking, Platform, StyleSheet, View } from 'react-native';

const OPUNTIA_IMAGE =
  require('@/assets/images/about_opuntia_distribution.png') as ImageSourcePropType;
const LANDCOVER_IMAGE =
  require('@/assets/images/about_landcover.png') as ImageSourcePropType;
const DENSITY_IMAGE =
  require('@/assets/images/about_mojavensis_density.png') as ImageSourcePropType;
const LUCAS_IMAGE =
  require('@/assets/images/about_lucas.png') as ImageSourcePropType;
const DRAEDEN_IMAGE =
  require('@/assets/images/about_draeden.png') as ImageSourcePropType;
const LUKE_IMAGE =
  require('@/assets/images/about_luke.png') as ImageSourcePropType;
const KELLY_IMAGE =
  require('@/assets/images/about_kelly.png') as ImageSourcePropType;

const TEAM_MEMBER_IMAGE_SIZE_DESKTOP = 256;
const TEAM_MEMBER_IMAGE_SIZE_COMPACT = 192;
const TEAM_MEMBER_MIN_TEXT_WIDTH = 260;
const TEAM_MEMBER_GAP = Size.space['400'];
const TEAM_MEMBER_PADDING = Size.space['400'];

type TeamMemberProps = {
  name: string;
  image: ImageSourcePropType;
  imageSize: number;
  imageOnRight?: boolean;
  isStacked: boolean;
  palette: (typeof Colors)['light'] | (typeof Colors)['dark'];
  children: ReactNode;
};

function TeamMember({
  name,
  image,
  imageSize,
  imageOnRight = false,
  isStacked,
  palette,
  children,
}: TeamMemberProps) {
  const media = (
    <View
      key='media'
      style={[
        styles.teamMemberMedia,
        { width: imageSize },
        isStacked && styles.teamMemberMediaStacked,
      ]}
    >
      <Image
        source={image}
        style={[
          styles.teamMemberImage,
          { width: imageSize, height: imageSize },
        ]}
        resizeMode='cover'
        accessibilityLabel={`${name} photo`}
      />
    </View>
  );

  const content = (
    <View
      key='content'
      style={[styles.teamMemberText, isStacked && styles.teamMemberTextStacked]}
    >
      <ThemedText variant='heading'>{name}</ThemedText>
      {children}
    </View>
  );

  const layoutChildren = isStacked
    ? [media, content]
    : imageOnRight
      ? [content, media]
      : [media, content];

  return (
    <View
      style={[
        styles.teamMember,
        !isStacked && styles.teamMemberHorizontal,
        isStacked && styles.teamMemberStacked,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      {layoutChildren}
    </View>
  );
}

// Inline link for use nested inside a parent ThemedText (body paragraph).
// Using nested Text renders truly inline without flex-row newline artifacts.
function L({ url, children }: { url: string; children: string }) {
  return (
    <ThemedText variant='link' onPress={() => Linking.openURL(url)}>
      {children}
    </ThemedText>
  );
}

export default function AboutScreen() {
  const router = useRouter();
  const responsive = useResponsive();
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const secondaryStyle = { color: palette.text.default.secondary };
  const areTeamCardsStacked = responsive.breakpoint !== 'desktop';
  const teamMemberImageSize =
    responsive.breakpoint === 'desktop'
      ? TEAM_MEMBER_IMAGE_SIZE_DESKTOP
      : TEAM_MEMBER_IMAGE_SIZE_COMPACT;

  return (
    <>
      {Platform.OS === 'web' ? (
        <Head>
          <title>WhereWild | About</title>
        </Head>
      ) : null}
      <PageSurface>
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
          <PageTitle title='About' />

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
              {/* ── Welcome ─────────────────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>
                  {'Welcome to WhereWild!'}
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    'WhereWild is a website and mobile application that combines '
                  }
                  <ThemedText variant='bodyEmphasis'>
                    {'occurrence and environmental data '}
                  </ThemedText>
                  {
                    'to generate a field guide and in-depth analytics on the habitat of over 400,000 species.'
                  }
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    'WhereWild was created for a Senior Capstone project by Computer Science students Lucas Pearce, Kelly Wu, Luke Allen, and Draeden Jensen at the University of Utah. This page gives a brief overview of the project and its team members.'
                  }
                </ThemedText>
              </View>

              {/* ── Acknowledgements ─────────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>{'Acknowledgements'}</ThemedText>
                <ThemedText variant='body'>
                  {
                    'We deeply appreciate all of the different sources of data we used to create this project. Learn more on our '
                  }
                  <ThemedText
                    variant='link'
                    onPress={() => router.push('/acknowledgements')}
                  >
                    {'acknowledgements page'}
                  </ThemedText>
                  {'.'}
                </ThemedText>
              </View>

              {/* ── What does it do ──────────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>
                  {'What does WhereWild do and how does it work?'}
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    'At a high level, WhereWild works by combining occurrence data with environmental data.'
                  }
                </ThemedText>

                <View style={styles.subsection}>
                  <ThemedText variant='subheading'>
                    {'Occurrence and environmental data: what do those mean?'}
                  </ThemedText>

                  {/* Occurrence data */}
                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Occurrence data'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {'Occurrence data is data that describes the '}
                      <ThemedText variant='bodyEmphasis'>{'where '}</ThemedText>
                      {'and '}
                      <ThemedText variant='bodyEmphasis'>{'when '}</ThemedText>
                      {
                        'a given species has been found. A single data point is often referred to as an '
                      }
                      <ThemedText variant='bodyEmphasis'>
                        {'observation'}
                      </ThemedText>
                      {
                        ', which includes the latitude/longitude and often timestamp of the observation, and optionally extra annotations. For example, if I saw '
                      }
                      <L url='https://www.inaturalist.org/observations/345543375'>
                        {'a cactus'}
                      </L>
                      {
                        ' on a hike, I could take a picture and upload it to iNaturalist as a single data point. We get our occurrence data from '
                      }
                      <L url='https://www.inaturalist.org/'>{'iNaturalist'}</L>
                      {'/'}
                      <L url='https://www.gbif.org/'>{'GBIF'}</L>
                      {' — view our citations for more.'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'Occurrence data is just a very large list of these data points, organized by taxonomy. The current data snapshot includes ~135 million '
                      }
                      <L url='https://help.inaturalist.org/en/support/solutions/articles/151000169936-what-is-the-data-quality-assessment-and-how-do-observations-qualify-to-become-research-grade-'>
                        {'Research Grade'}
                      </L>
                      {' observations.'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'Occurrence data is a great way to understand the distribution of a species. For example, we can view a map of all observations of '
                      }
                      <L url='https://wherewild.net/species/5384113/opuntia-fragilis'>
                        {'Opuntia fragilis'}
                      </L>
                      {
                        ', and observe a wide range across western North America. However, occurrence data alone struggles to explain the '
                      }
                      <ThemedText variant='bodyEmphasis'>
                        {'actual habitat and climate '}
                      </ThemedText>
                      {'of these locations, and '}
                      <ThemedText variant='bodyEmphasis'>{'why '}</ThemedText>
                      {'a species might have the range it does.'}
                    </ThemedText>

                    <ContentImage
                      source={OPUNTIA_IMAGE}
                      label='Map of Opuntia fragilis observations across North America'
                    />
                    <View style={styles.captionRow}>
                      <ThemedText variant='bodySmall' style={secondaryStyle}>
                        {'Occurrence data: '}
                      </ThemedText>
                      <ThemedText
                        variant='bodySmallLink'
                        onPress={() => Linking.openURL('https://www.gbif.org/')}
                      >
                        {'GBIF'}
                      </ThemedText>
                      <ThemedText variant='bodySmall' style={secondaryStyle}>
                        {' / '}
                      </ThemedText>
                      <ThemedText
                        variant='bodySmallLink'
                        onPress={() =>
                          Linking.openURL('https://www.inaturalist.org/')
                        }
                      >
                        {'iNaturalist'}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Environmental data */}
                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Environmental data'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        "Environmental data is what tells us about what the actual habitat and climate of a location is. Take Salt Lake City, for example. It's a high elevation city right next to the even higher elevation Wasatch Range. It's at the edge of the Great Basin, and is generally quite dry compared to the rest of the US; however, it (typically!) sees large amounts of snow in the winter. Due to these factors, the temperature can vary quite a lot, with hot summers and cold winters."
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'Altogether, these factors constrain the natural wildlife that can be observed around the area. Wildlife at lower elevations must be better adapted to hotter and drier conditions, while those at higher elevations must deal with steeper slopes and harsher winters. The valley is more of a scrubland while the mountains are more forested.'
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {'Our environmental data is stored in the form of '}
                      <ThemedText variant='bodyEmphasis'>
                        {'rasters'}
                      </ThemedText>
                      {
                        ', which is just a fancy way of saying the Earth is divided up into "cells" where each pixel covers some span of land and has some value. For example, here is a picture of part of the US for landcover data, classifying each area as to whether it\'s a forest, grassland, city, etc:'
                      }
                    </ThemedText>

                    <ContentImage
                      source={LANDCOVER_IMAGE}
                      label='Landcover raster map of the United States'
                    />
                    <View style={styles.captionRow}>
                      <ThemedText variant='bodySmall' style={secondaryStyle}>
                        {'Source: GLC_FCS30-2020 '}
                      </ThemedText>
                      <ThemedText
                        variant='bodySmallLink'
                        onPress={() =>
                          Linking.openURL(
                            'https://doi.org/10.5281/zenodo.4280923',
                          )
                        }
                      >
                        {'DOI'}
                      </ThemedText>
                      <ThemedText variant='bodySmall' style={secondaryStyle}>
                        {' · '}
                      </ThemedText>
                      <ThemedText
                        variant='bodySmallLink'
                        onPress={() =>
                          Linking.openURL('https://zenodo.org/records/4280923')
                        }
                      >
                        {'Data page'}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Putting it all together */}
                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Putting it all together'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'Combining the two, something amazing happens! We can get an idea of what the actual conditions are like at each location a given species has been observed. We can even use '
                      }
                      <L url='https://open-meteo.com/en/docs/historical-weather-api'>
                        {'historical weather data'}
                      </L>
                      {' to reconstruct what the '}
                      <ThemedText variant='bodyEmphasis'>
                        {'recent weather was at the time of observation'}
                      </ThemedText>
                      {
                        ', to reconstruct patterns in the weather conditions animals prefer to be active in, or plants prefer to flower in.'
                      }
                    </ThemedText>

                    <ContentImage
                      source={DENSITY_IMAGE}
                      label='Density graph of Mojave kingcup cactus observations by annual precipitation'
                    />
                    <View style={styles.captionRowCenter}>
                      <ThemedText variant='bodySmall' style={secondaryStyle}>
                        {'A density graph of all observations of the '}
                      </ThemedText>
                      <ThemedText
                        variant='bodySmallLink'
                        onPress={() =>
                          Linking.openURL(
                            'https://wherewild.net/species/3953823/echinocereus-triglochidiatus-subsp-mojavensis',
                          )
                        }
                      >
                        {'Mojave kingcup cactus'}
                      </ThemedText>
                      <ThemedText variant='bodySmall' style={secondaryStyle}>
                        {
                          ', showing a preferred annual precipitation of ~12 inches.'
                        }
                      </ThemedText>
                    </View>

                    <ThemedText variant='body'>
                      {'Try going to a '}
                      <L url='https://wherewild.net/species/3953823/echinocereus-triglochidiatus-subsp-mojavensis'>
                        {'species page'}
                      </L>
                      {
                        ' to check it out, or search up any type of creature you like!'
                      }
                    </ThemedText>
                  </View>
                </View>
              </View>

              {/* ── Team Members ─────────────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>{'Team Members'}</ThemedText>

                <TeamMember
                  name='Lucas Pearce'
                  image={LUCAS_IMAGE}
                  imageSize={teamMemberImageSize}
                  isStacked={areTeamCardsStacked}
                  palette={palette}
                >
                  <ThemedText variant='body'>
                    {
                      'Lucas is a double major in CS and Linguistics interested in all things NLP and GIS. He came up with the idea for WhereWild after having a hard time figuring out when and where to find cacti that would actually be flowering out in the desert. He architected and built the majority of the backend.'
                    }
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      'After graduation, he will be continuing at the University of Utah with an MS in Artificial Intelligence and doing NLP research. He also hopes to continue development of WhereWild as a free and open-source project. In his free time he likes going outside, sports, gardening, and finding cool plants. '
                    }
                  </ThemedText>
                  <View style={styles.socialLinks}>
                    <IconButton
                      variant='subtle'
                      icon={<IconGithub />}
                      accessibilityLabel='Lucas Pearce on GitHub'
                      onPress={() =>
                        Linking.openURL('https://github.com/MtGambelOak')
                      }
                    />
                    <IconButton
                      variant='subtle'
                      icon={<IconLinkedin />}
                      accessibilityLabel='Lucas Pearce on LinkedIn'
                      onPress={() =>
                        Linking.openURL(
                          'https://www.linkedin.com/in/lucaspearce/',
                        )
                      }
                    />
                    <IconButton
                      variant='subtle'
                      icon={<IconMail />}
                      accessibilityLabel='Email Lucas Pearce'
                      onPress={() =>
                        Linking.openURL('mailto:lucaspearce28@gmail.com')
                      }
                    />
                  </View>
                </TeamMember>

                <TeamMember
                  name='Kelly Wu'
                  image={KELLY_IMAGE}
                  imageSize={teamMemberImageSize}
                  imageOnRight
                  isStacked={areTeamCardsStacked}
                  palette={palette}
                >
                  <ThemedText variant='body'>
                    {
                      'Kelly is a computer science major with an interest in machine learning, but is also familiar with compilers, systems, and full-stack development. She designed and implemented the frontend and engineered machine learning in the backend. Her interests are broad and varied, spanning computer science, aerospace engineering, graphics design, and whichever rabbit hole she fell into in the evening.'
                    }
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      'After graduating, she will continue her studies in machine learning at the University of Utah. But, she is also searching for a full-time position in software engineering or machine learning engineering.'
                    }
                  </ThemedText>
                  <View style={styles.socialLinks}>
                    <IconButton
                      variant='subtle'
                      icon={<IconGithub />}
                      accessibilityLabel='Kelly Wu on GitHub'
                      onPress={() =>
                        Linking.openURL('https://github.com/kellynyanbinary')
                      }
                    />
                    <IconButton
                      variant='subtle'
                      icon={<IconLinkedin />}
                      accessibilityLabel='Kelly Wu on LinkedIn'
                      onPress={() =>
                        Linking.openURL(
                          'https://www.linkedin.com/in/kellyhanwu/',
                        )
                      }
                    />
                  </View>
                </TeamMember>

                <TeamMember
                  name='Luke Allen'
                  image={LUKE_IMAGE}
                  imageSize={teamMemberImageSize}
                  isStacked={areTeamCardsStacked}
                  palette={palette}
                >
                  <ThemedText variant='body'>
                    {
                      'Luke is a computer science major with an interest in full stack development and data science. He worked on both the front end and back end but focused mainly on the front end development for this project. He enjoys nature and hiking and so was eager to work on a project that focused on the outdoors.'
                    }
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      'After graduation, he will be searching for a full-time position in software engineering.'
                    }
                  </ThemedText>
                  <View style={styles.socialLinks}>
                    <IconButton
                      variant='subtle'
                      icon={<IconGithub />}
                      accessibilityLabel='Luke Allen on GitHub'
                      onPress={() =>
                        Linking.openURL('https://github.com/lukeallen7467')
                      }
                    />
                    <IconButton
                      variant='subtle'
                      icon={<IconMail />}
                      accessibilityLabel='Email Luke Allen'
                      onPress={() =>
                        Linking.openURL('mailto:lukeallen159111@gmail.com')
                      }
                    />
                  </View>
                </TeamMember>

                <TeamMember
                  name='Draeden Jensen'
                  image={DRAEDEN_IMAGE}
                  imageSize={teamMemberImageSize}
                  imageOnRight
                  isStacked={areTeamCardsStacked}
                  palette={palette}
                >
                  <ThemedText variant='body'>
                    {
                      'Draeden is completing a degree in computer science with a minor in mathematics. He enjoys going outside, riding his bike, and spending time in the mountains. He was excited to work on a project that helps people learn about the outdoors. He primarily worked on implementing the front end functionality.'
                    }
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      'After graduation, he will begin a full-time engineering position at Lucid Software.'
                    }
                  </ThemedText>
                  <View style={styles.socialLinks}>
                    <IconButton
                      variant='subtle'
                      icon={<IconGithub />}
                      accessibilityLabel='Draeden Jensen on GitHub'
                      onPress={() =>
                        Linking.openURL('https://github.com/DraedenJensen')
                      }
                    />
                    <IconButton
                      variant='subtle'
                      icon={<IconLinkedin />}
                      accessibilityLabel='Draeden Jensen on LinkedIn'
                      onPress={() =>
                        Linking.openURL(
                          'https://www.linkedin.com/in/denmark-jensen-228b7626b',
                        )
                      }
                    />
                  </View>
                </TeamMember>
              </View>
            </View>
          </View>
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
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
  subsection: {
    gap: Size.space.text.paragraph,
  },
  subsubsection: {
    gap: Size.space.text.paragraph,
  },
  captionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  captionRowCenter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  teamMember: {
    width: '100%',
    borderRadius: Size.radius['400'],
    padding: TEAM_MEMBER_PADDING,
    gap: TEAM_MEMBER_GAP,
  },
  teamMemberHorizontal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  teamMemberStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  teamMemberImage: {
    borderRadius: Size.radius['200'],
  },
  teamMemberMedia: {
    flexShrink: 0,
  },
  teamMemberMediaStacked: {
    width: '100%',
    alignItems: 'center',
  },
  teamMemberText: {
    flex: 1,
    minWidth: TEAM_MEMBER_MIN_TEXT_WIDTH,
    gap: Size.space.text.paragraph,
  },
  teamMemberTextStacked: {
    flex: 0,
    minWidth: 0,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: Size.space['100'],
  },
});
