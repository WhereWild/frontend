// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components';
import { Size, type Colors } from '@/constants/theme';
import type { UploadedDescriptionImage } from '@/data/uploadLocalSpeciesDataSource';
import type { SpeciesOverviewLine } from '@/data/types';

const renderOverviewLineText = (line: SpeciesOverviewLine, key: string) => {
  const body = line.body?.trim();
  if (!body) return null;
  const prefix = line.prefix?.trim();
  return (
    <ThemedText key={key} variant='body'>
      {prefix ? `${prefix} ${body}` : body}
    </ThemedText>
  );
};

type UploadDescriptionImageProps = {
  descriptionImage: UploadedDescriptionImage;
  palette: (typeof Colors)['light'] | (typeof Colors)['dark'];
};

/** Same description-section rendering app/_species.tsx's
 * SpeciesInformationSection uses, simplified for a custom upload (no common
 * name, no data-source attribution list, no iNaturalist "view on" link —
 * none of those apply to an arbitrary uploaded dataset or its own
 * user-provided image). */
export function UploadDescriptionImage({
  descriptionImage,
  palette,
}: UploadDescriptionImageProps) {
  const sections = descriptionImage.descriptionSections ?? [];
  const hasImage = Boolean(descriptionImage.imageUrl);
  const hasAttribution = Boolean(
    descriptionImage.imageLicense ||
    descriptionImage.imageCreator ||
    descriptionImage.imageRightsHolder,
  );
  if (sections.length === 0 && !hasImage) {
    return null;
  }

  const photoBy =
    descriptionImage.imageCreator?.trim() ||
    descriptionImage.imageRightsHolder?.trim() ||
    '';

  return (
    <View style={styles.container}>
      {hasImage ? (
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: descriptionImage.imageUrl! }}
            style={styles.image}
            resizeMode='cover'
            accessibilityLabel='Dataset image'
          />
          {hasAttribution ? (
            <View style={styles.attribution}>
              {photoBy ? (
                <ThemedText
                  variant='bodySmall'
                  style={{ color: palette.text.default.secondary }}
                >
                  Photo by {photoBy}
                </ThemedText>
              ) : null}
              {descriptionImage.imageLicense ? (
                descriptionImage.imageLicenseUrl ? (
                  <ThemedText
                    variant='bodySmallLink'
                    onPress={() =>
                      Linking.openURL(descriptionImage.imageLicenseUrl!)
                    }
                  >
                    {descriptionImage.imageLicense}
                  </ThemedText>
                ) : (
                  <ThemedText
                    variant='bodySmall'
                    style={{ color: palette.text.default.secondary }}
                  >
                    {descriptionImage.imageLicense}
                  </ThemedText>
                )
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {sections.length > 0 ? (
        <View style={styles.textColumn}>
          {sections.map((section) => (
            <View key={section.id} style={styles.subsection}>
              <ThemedText variant='subheading'>{section.title}</ThemedText>
              <View style={styles.textBody}>
                {section.lines.map((line, index) =>
                  renderOverviewLineText(line, `${section.id}-${index}`),
                )}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['400'],
  },
  imageWrapper: {
    width: 200,
    gap: Size.space['100'],
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: Size.radius['200'],
  },
  attribution: {
    gap: Size.space['100'],
  },
  textColumn: {
    flex: 1,
    minWidth: 240,
    gap: Size.space['300'],
  },
  subsection: {
    gap: Size.space['100'],
  },
  textBody: {
    gap: Size.space['100'],
  },
});
