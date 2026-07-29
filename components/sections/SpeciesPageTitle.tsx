// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IconDownload } from '@/assets/icons';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Button } from '../buttons/Button';
import { ThemedText } from '../text/ThemedText';

export type SpeciesPageTitleProps = {
  commonName: string;
  scientificName: string;
  onPressDownload?: () => void;
  downloadLabel?: string;
  isDownloading?: boolean;
  /** Disables the download button for a reason other than an in-flight
   * download — e.g. a taxon too large to download, matching the map and
   * location filters' existing large-taxon disable behavior. */
  downloadDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SpeciesPageTitle({
  commonName,
  scientificName,
  downloadLabel = 'Download',
  isDownloading = false,
  downloadDisabled = false,
  onPressDownload,
  style,
}: SpeciesPageTitleProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background.default.default,
        },
        getResponsiveContentContainerStyle(responsive, {
          includeWidth: false,
          includeTopPadding: false,
        }),
        style,
      ]}
    >
      <View style={[styles.content, { maxWidth: responsive.contentWidth }]}>
        <View style={styles.titleRow}>
          <View style={styles.nameColumn}>
            <ThemedText variant='titlePage'>{commonName}</ThemedText>
            <ThemedText variant='bodyEmphasis'>{scientificName}</ThemedText>
          </View>
          <View style={styles.downloadRow}>
            {isDownloading && (
              <ActivityIndicator
                color={palette.icon.brand.default}
                testID='species-page-title-download-spinner'
              />
            )}
            <Button
              variant='neutral'
              iconStart={<IconDownload />}
              disabled={isDownloading || downloadDisabled}
              onPress={onPressDownload}
              accessibilityLabel={`${downloadLabel} ${commonName}`}
              style={styles.downloadButton}
            >
              {downloadLabel}
            </Button>
          </View>
        </View>
        <View
          style={[
            styles.divider,
            {
              backgroundColor: palette.border.brand.secondary,
            },
          ]}
          testID='species-page-title-divider'
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    gap: Size.space['200'],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Size.space['200'],
    flexWrap: 'wrap',
  },
  nameColumn: {
    flexDirection: 'column',
    flexShrink: 0,
    maxWidth: '100%',
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['100'],
    flexShrink: 0,
  },
  downloadButton: {
    flexShrink: 0,
  },
  divider: {
    height: Size.stroke.border,
    width: '100%',
  },
});
