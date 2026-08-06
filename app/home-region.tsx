// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  PageScrollContainer,
  PageTitle,
  ThemedText,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { IconMapPin } from '@/assets/icons';
import { Colors, Size } from '@/constants/theme';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useSettings } from '@/context/SettingsContext';
import { useIsOnline } from '@/hooks/useIsOnline';
import { WebMetadata } from '@/utils/webMetadata';

const MAP_HEIGHT = 480;
const DESCRIPTION_MAIN =
  'Set the location of an area you want to compare to the distribution of species, e.g. an area near where you live to see how suitable your location is for the species. It will automatically be highlighted on the density graph of any species page you visit.';

const DESCRIPTION_PRIVACY =
  'Your location is stored in your local browser and not shared with WhereWild, but do note that any such requests that rely on this feature must go through the API. WhereWild does not store or analyze API request logs in the long-term, but if you are still worried about this, you can consider choosing a location near, but not at your home, or ignore this feature entirely.';

export default function HomeRegion() {
  const responsive = useResponsive();
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const { localLat, setLocalLat, localLon, setLocalLon } = useSettings();
  const isOnline = useIsOnline();

  const handleLocationPicked = useCallback(
    (lat: number, lon: number) => {
      setLocalLat(lat);
      setLocalLon(lon);
    },
    [setLocalLat, setLocalLon],
  );

  const handleClear = useCallback(() => {
    setLocalLat(null);
    setLocalLon(null);
  }, [setLocalLat, setLocalLon]);

  const hasLocation = localLat != null && localLon != null;

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Local comparison location'
          description='Set a home region to compare against species distributions.'
          path='/home-region'
        />
      ) : null}

      <PageSurface>
        <PageScrollContainer
          contentContainerStyle={[
            getResponsiveContentContainerStyle(responsive, {
              includeHorizontalPadding: false,
              includeBottomPadding: true,
              includeGap: true,
            }),
          ]}
        >
          {Platform.OS === 'web' ? (
            <PageTitle
              title='Local comparison location'
              contentMaxWidth={responsive.contentWidth}
            />
          ) : null}

          <View
            style={[
              styles.content,
              getResponsiveContentContainerStyle(responsive, {
                includeWidth: false,
                includeTopPadding: false,
              }),
            ]}
          >
            <ThemedText variant='body' style={styles.description}>
              {DESCRIPTION_MAIN}
            </ThemedText>
            <ThemedText variant='bodySmall' style={styles.descriptionPrivacy}>
              {DESCRIPTION_PRIVACY}
            </ThemedText>

            <SpeciesOccurrenceMap
              occurrences={[]}
              loading={false}
              error={null}
              height={MAP_HEIGHT}
              showMarkers={false}
              locationPickerMode
              enableOfflineFallback={!isOnline}
              localLat={localLat}
              localLon={localLon}
              onLocationPicked={handleLocationPicked}
            />

            <View style={styles.status}>
              <IconMapPin
                size='16'
                color={
                  hasLocation
                    ? palette.background.brand.default
                    : palette.text.default.secondary
                }
              />
              <ThemedText
                variant='bodySmall'
                style={hasLocation ? styles.coordsSet : styles.coordsUnset}
              >
                {hasLocation
                  ? `${localLat!.toFixed(5)}, ${localLon!.toFixed(5)}`
                  : 'No location set'}
              </ThemedText>
            </View>

            {hasLocation && (
              <Button
                variant='neutral'
                label='Clear'
                onPress={handleClear}
                style={styles.clearButton}
              />
            )}
          </View>
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Size.space['300'],
    paddingHorizontal: Size.space['400'],
  },
  description: {
    opacity: 0.75,
  },
  descriptionPrivacy: {
    opacity: 0.5,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['150'],
  },
  coordsSet: {
    fontVariant: ['tabular-nums'],
  },
  coordsUnset: {
    opacity: 0.5,
  },
  clearButton: {
    alignSelf: 'flex-start',
  },
});
