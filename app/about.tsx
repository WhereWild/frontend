// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  ContentImage,
  IconButton,
  Markdown,
  PageTitle,
  PageScrollContainer,
  ThemedText,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { IconGithub, IconLinkedin, IconMail } from '@/assets/icons';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Colors, Size } from '@/constants/theme';
import { useLayoutChrome } from '@/context/LayoutChromeContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { type ReactNode } from 'react';
import type { ImageSourcePropType, ViewStyle } from 'react-native';
import { Image, Linking, Platform, StyleSheet, View } from 'react-native';
import { anchorScrollMarginStyle } from '@/utils/anchors';
import { toKebabCase } from '@/utils/string';
import { WebMetadata } from '@/utils/webMetadata';
import ABOUT_CONTENT from '@/content/about.md';

const OPUNTIA_IMAGE =
  require('@/assets/images/about_opuntia_distribution.png') as ImageSourcePropType;
const LANDCOVER_IMAGE =
  require('@/assets/images/about_landcover.png') as ImageSourcePropType;
const DENSITY_IMAGE =
  require('@/assets/images/about_opuntia_density.png') as ImageSourcePropType;
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
  // Lets links to this page target a specific member, e.g.
  // /about#lucas-pearce — undefined on native, where anchors don't apply.
  scrollMarginStyle: ViewStyle | undefined;
  children: ReactNode;
};

function TeamMember({
  name,
  image,
  imageSize,
  imageOnRight = false,
  isStacked,
  palette,
  scrollMarginStyle,
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
        scrollMarginStyle,
      ]}
      {...(Platform.OS === 'web' ? { nativeID: toKebabCase(name) } : {})}
    >
      {layoutChildren}
    </View>
  );
}

// about.md interleaves prose with images via `<!-- image: name -->` marker
// lines; split on those markers so each text chunk renders as Markdown and
// each marker renders the matching image + caption as plain JSX.
const IMAGE_MARKER_PATTERN = /<!--\s*image:\s*(\w+)\s*-->/g;

type AboutSegment = { text: string; imageAfter?: string };

function splitAboutContent(content: string): AboutSegment[] {
  const segments: AboutSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = IMAGE_MARKER_PATTERN.exec(content))) {
    segments.push({
      text: content.slice(lastIndex, match.index).trim(),
      imageAfter: match[1],
    });
    lastIndex = match.index + match[0].length;
  }
  segments.push({ text: content.slice(lastIndex).trim() });

  return segments;
}

const ABOUT_SEGMENTS = splitAboutContent(ABOUT_CONTENT);

function AboutImageBlock({
  name,
  secondaryStyle,
}: {
  name: string;
  secondaryStyle: { color: string };
}) {
  if (name === 'opuntia') {
    return (
      <>
        <ContentImage
          source={OPUNTIA_IMAGE}
          label='Map of Opuntia fragilis observations across North America'
        />
        <ThemedText variant='bodySmall' style={secondaryStyle}>
          {
            'The color of each dot reflects the average annual precipitation at that observation, per the legend on the left of the image.'
          }
        </ThemedText>
        <ThemedText variant='bodySmall' style={secondaryStyle}>
          {'Occurrence data: '}
          <ThemedText
            variant='bodySmallLink'
            onPress={() => Linking.openURL('https://www.gbif.org/')}
          >
            {'GBIF'}
          </ThemedText>
          {' / '}
          <ThemedText
            variant='bodySmallLink'
            onPress={() => Linking.openURL('https://www.inaturalist.org/')}
          >
            {'iNaturalist'}
          </ThemedText>
        </ThemedText>
      </>
    );
  }

  if (name === 'landcover') {
    return (
      <>
        <ContentImage
          source={LANDCOVER_IMAGE}
          label='Landcover raster map of the United States'
        />
        <ThemedText variant='bodySmall' style={secondaryStyle}>
          {'Source: GLC_FCS30-2020 '}
          <ThemedText
            variant='bodySmallLink'
            onPress={() =>
              Linking.openURL('https://doi.org/10.5281/zenodo.4280923')
            }
          >
            {'DOI'}
          </ThemedText>
          {' · '}
          <ThemedText
            variant='bodySmallLink'
            onPress={() =>
              Linking.openURL('https://zenodo.org/records/4280923')
            }
          >
            {'Data page'}
          </ThemedText>
        </ThemedText>
      </>
    );
  }

  if (name === 'density') {
    return (
      <>
        <ContentImage
          source={DENSITY_IMAGE}
          label='Density graph of Opuntia fragilis observations by annual precipitation'
        />
        <ThemedText
          variant='bodySmall'
          style={[secondaryStyle, styles.captionTextCenter]}
        >
          {'A density graph of all observations of '}
          <ThemedText
            variant='bodySmallLink'
            onPress={() =>
              Linking.openURL(
                'https://wherewild.net/species/6SRLS/opuntia-fragilis?variable=bio12#species-environment',
              )
            }
          >
            {'Opuntia fragilis'}
          </ThemedText>
          {', showing a preferred annual precipitation of ~18 inches. The '}
          <ThemedText
            variant='bodySmallLink'
            onPress={() =>
              Linking.openURL(
                'https://wherewild.net/species/6SRLS/opuntia-fragilis?variable=bio12&slice=%5B%7B%22variableId%22%3A%22bio12%22%2C%22min%22%3A33.442782152230976%2C%22max%22%3A79.23228346456693%7D%5D#species-occurrence-map',
              )
            }
          >
            {'long tail distribution'}
          </ThemedText>
          {
            ' to the right indicates a population of plants that receive much more rainfall than average, and correspond to the population of this plant in the surprising location of coastal British Columbia, Canada.'
          }
        </ThemedText>
      </>
    );
  }

  return null;
}

export default function AboutScreen() {
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
  const { webHeaderHeight } = useLayoutChrome();
  // Lets links to this page target a specific team member, e.g.
  // /about#lucas-pearce.
  const scrollMarginStyle =
    Platform.OS === 'web'
      ? anchorScrollMarginStyle(webHeaderHeight, responsive.breakpoint)
      : undefined;
  useScrollToHash([]);

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | About'
          description='Read the project background behind WhereWild and meet the team that built it.'
          path='/about'
        />
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
          {Platform.OS === 'web' ? <PageTitle title='About' /> : null}

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
              {/* ── About content (from content/about.md) ────────────────── */}
              {ABOUT_SEGMENTS.map((segment, index) => (
                <View key={index} style={styles.section}>
                  {segment.text ? <Markdown>{segment.text}</Markdown> : null}
                  {segment.imageAfter ? (
                    <AboutImageBlock
                      name={segment.imageAfter}
                      secondaryStyle={secondaryStyle}
                    />
                  ) : null}
                </View>
              ))}

              {/* ── Team Members ─────────────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>{'Team Members'}</ThemedText>

                <TeamMember
                  name='Lucas Pearce'
                  image={LUCAS_IMAGE}
                  imageSize={teamMemberImageSize}
                  isStacked={areTeamCardsStacked}
                  palette={palette}
                  scrollMarginStyle={scrollMarginStyle}
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
                      href='https://github.com/MtGambelOak'
                      onPress={() =>
                        Linking.openURL('https://github.com/MtGambelOak')
                      }
                    />
                    <IconButton
                      variant='subtle'
                      icon={<IconLinkedin />}
                      accessibilityLabel='Lucas Pearce on LinkedIn'
                      href='https://www.linkedin.com/in/lucaspearce/'
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
                      href='mailto:lucas@lpearce.dev'
                      onPress={() =>
                        Linking.openURL('mailto:lucas@lpearce.dev')
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
                  scrollMarginStyle={scrollMarginStyle}
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
                      href='https://github.com/kellynyanbinary'
                      onPress={() =>
                        Linking.openURL('https://github.com/kellynyanbinary')
                      }
                    />
                    <IconButton
                      variant='subtle'
                      icon={<IconLinkedin />}
                      accessibilityLabel='Kelly Wu on LinkedIn'
                      href='https://www.linkedin.com/in/kellyhanwu/'
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
                  scrollMarginStyle={scrollMarginStyle}
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
                      href='https://github.com/lukeallen7467'
                      onPress={() =>
                        Linking.openURL('https://github.com/lukeallen7467')
                      }
                    />
                    <IconButton
                      variant='subtle'
                      icon={<IconMail />}
                      accessibilityLabel='Email Luke Allen'
                      href='mailto:lukeallen159111@gmail.com'
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
                  scrollMarginStyle={scrollMarginStyle}
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
                      href='https://github.com/DraedenJensen'
                      onPress={() =>
                        Linking.openURL('https://github.com/DraedenJensen')
                      }
                    />
                    <IconButton
                      variant='subtle'
                      icon={<IconLinkedin />}
                      accessibilityLabel='Draeden Jensen on LinkedIn'
                      href='https://www.linkedin.com/in/denmark-jensen-228b7626b'
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
  captionTextCenter: {
    textAlign: 'center',
  },
  teamMember: {
    width: '100%',
    borderRadius: Size.radius['400'],
    padding: TEAM_MEMBER_PADDING,
    gap: TEAM_MEMBER_GAP,
  },
  teamMemberHorizontal: {
    flexDirection: 'row',
    // 'stretch' (not 'flex-start') so teamMemberText matches the row's
    // height — driven by the photo, its tallest sibling — instead of only
    // being as tall as its own bio text. Without that, there's no leftover
    // space in the text column for socialLinks' marginTop: 'auto' to push
    // into, so the icon row just sits right after the bio text with a gap
    // of empty card below it instead of flush with the photo's bottom.
    alignItems: 'stretch',
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
    // Pushes the icon row to the bottom of the card instead of sitting
    // right after the bio text with the same gap as every other
    // paragraph — only has room to matter in the non-stacked (desktop)
    // layout, where teamMemberText is flex:1 alongside the fixed-height
    // photo; teamMemberTextStacked is flex:0 (content-sized) so there's no
    // leftover space for this to consume there, a harmless no-op.
    marginTop: 'auto',
  },
});
