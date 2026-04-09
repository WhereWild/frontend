import { Colors, Size } from '@/constants/theme';
import { parseOverviewSectionsFromDescriptionText } from '@/data/speciesOverviewParser';
import type { SpeciesOverview, SpeciesOverviewLine } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import React from 'react';
import {
  Image,
  Linking,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { ThemedText } from '../text/ThemedText';

export type SpeciesInformationSectionProps = {
  commonName: string;
  commonNames: string[];
  overview: SpeciesOverview;
  style?: StyleProp<ViewStyle>;
};

function CommonNamesList({ names }: { names: string[] }) {
  return (
    <View style={styles.textBody}>
      {names.map((name) => (
        <View key={name} style={styles.commonNameRow}>
          <ThemedText
            variant='body'
            style={styles.commonNameBullet}
            accessible={false}
            importantForAccessibility='no'
            accessibilityElementsHidden
          >
            •
          </ThemedText>
          <ThemedText variant='body'>{name}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const renderOverviewLineText = (line: SpeciesOverviewLine) => {
  const body = line.body?.trim();
  if (!body) {
    return null;
  }

  const prefix = line.prefix?.trim();
  if (!prefix) {
    return <ThemedText variant='body'>{body}</ThemedText>;
  }

  return <ThemedText variant='body'>{`${prefix} ${body}`}</ThemedText>;
};

export function SpeciesInformationSection({
  commonName,
  commonNames,
  overview,
  style,
}: SpeciesInformationSectionProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  const hasImageAttribution = Boolean(
    overview.imageLicense ||
    overview.imageCreator ||
    overview.imageRightsHolder ||
    overview.imageReferences,
  );

  const normalizedCreator = overview.imageCreator?.trim() || '';
  const normalizedRightsHolder = overview.imageRightsHolder?.trim() || '';
  const photoBy = normalizedCreator || normalizedRightsHolder;

  const imageReferenceUrl = React.useMemo(() => {
    const raw = overview.imageReferences?.trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://www.inaturalist.org/${raw.replace(/^\/+/, '')}`;
  }, [overview.imageReferences]);

  const overviewSections = React.useMemo(() => {
    if (overview.sections && overview.sections.length > 0) {
      return overview.sections;
    }
    return parseOverviewSectionsFromDescriptionText(overview.description);
  }, [overview.description, overview.sections]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.featuredImageWrapper}>
        <Image
          source={overview.imageSource}
          style={styles.featuredImage}
          resizeMode='cover'
          accessibilityLabel={`${commonName} featured image`}
        />
        {hasImageAttribution && (
          <View style={styles.imageAttribution}>
            {photoBy && (
              <ThemedText
                variant='bodySmall'
                style={{ color: palette.text.default.secondary }}
              >
                Photo by {photoBy}
              </ThemedText>
            )}
            {imageReferenceUrl && (
              <ThemedText
                variant='bodySmallLink'
                onPress={() => Linking.openURL(imageReferenceUrl)}
              >
                View on iNaturalist
              </ThemedText>
            )}
            {overview.imageLicense && (
              <ThemedText
                variant='bodySmall'
                style={{ color: palette.text.default.secondary }}
              >
                {overview.imageLicense}
              </ThemedText>
            )}
          </View>
        )}
      </View>

      <View
        style={[
          styles.textColumn,
          {
            maxWidth: responsive.textWidth,
          },
        ]}
      >
        <View style={styles.textSection}>
          <ThemedText variant='heading'>Overview</ThemedText>
          {overviewSections.length > 0 ? (
            <View style={styles.textSubsectionContainer}>
              {overviewSections.map((section) => (
                <View key={section.id} style={styles.textSubsection}>
                  <ThemedText variant='subheading'>{section.title}</ThemedText>
                  <View style={styles.textBody}>
                    {section.lines.map((line, index) => {
                      const lineNode = renderOverviewLineText(line);
                      if (!lineNode) {
                        return null;
                      }

                      return (
                        <View key={`${section.id}-line-${index}`}>
                          {lineNode}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText variant='body'>{overview.description}</ThemedText>
          )}
        </View>

        <View style={styles.textSection}>
          <ThemedText variant='heading'>Common Names</ThemedText>
          <CommonNamesList names={commonNames} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
  textColumn: {
    flex: 1,
    minWidth: 360,
    gap: Size.space['400'],
  },
  textSection: {
    gap: Size.space.text.section,
  },
  textSubsectionContainer: {
    gap: Size.space.text.subsection,
  },
  textSubsection: {
    gap: Size.space.text.paragraph,
  },
  textBody: {
    gap: Size.space.text.paragraph,
  },
  featuredImageWrapper: {
    flex: 1,
    minWidth: 240,
  },
  featuredImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Size.radius['400'],
  },
  imageAttribution: {
    marginTop: Size.space['100'],
    gap: Size.space.text.line,
  },
  commonNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Size.space.text.line,
  },
  commonNameBullet: {
    minWidth: Size.space['200'],
  },
});
