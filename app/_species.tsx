import {
  NearbySpeciesCarousel,
  PageHeader,
  SpeciesPageTitle,
  ThemedText,
  SpeciesEnvironmentSection
} from '@/components';
import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { Colors, Size } from '@/constants/theme';
import { buildCommonNamesWithPrimary } from '@/data/commonNames';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import Head from 'expo-router/head';
import React from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SpeciesLocationFilters } from '@/components/sections/SpeciesLocationFilters';
import { useSpeciesOccurrences } from '@/hooks/species/useSpeciesOccurrences';
import { useSpeciesLocationFilters } from '@/hooks/species/useSpeciesLocationFilters';
import { useSettings } from '@/context/SettingsContext';

type SpeciesScreenProps = {
  data?: SpeciesScreenData;
};

export type SpeciesScreenData = Pick<
  SpeciesPageData,
  'taxonId' | 'scientificName' | 'commonName' | 'commonNames' | 'overview' | 'nearbySpecies' | 'heatmap'
>;

export const LOCATION_SEARCH_LIMIT = 500;

type ResponsiveState = ReturnType<typeof useResponsive>;

function SectionShell({
  responsive,
  children,
}: {
  responsive: ResponsiveState;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.centeredSection}>
      <View
        style={[
          styles.sectionContent,
          getResponsiveContentContainerStyle(responsive, {
            includeTopPadding: false,
          }),
          { maxWidth: responsive.contentWidth },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function CommonNamesList({ names }: { names: string[] }) {
  return (
    <View>
      {names.map((name) => (
        <View key={name} style={styles.commonNameRow}>
          <ThemedText
            variant="body"
            style={styles.commonNameBullet}
            accessible={false}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            •
          </ThemedText>
          <ThemedText variant="body">{name}</ThemedText>
        </View>
      ))}
    </View>
  );
}


export default function Species({ data = mountainBallCactusData }: SpeciesScreenProps) {
  const { taxonId, commonName, commonNames, scientificName, overview, nearbySpecies, heatmap } =
    data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  // <- NEW: read units from settings and forward to environment section
  const { units } = useSettings();

  const shouldRenderOccurrenceMap = Boolean(taxonId);
  const [highlightedCatalogs, setHighlightedCatalogs] = React.useState<(number | string)[]>([]);

  const {
    countryOptions,
    stateOptions,
    countyOptions,
    countryLoading,
    stateLoading,
    countyLoading,
    selectedCountryGid,
    selectedStateGid,
    selectedCountyGid,
    finalLocationGid,
    onCountryChange,
    onStateChange,
    onCountyChange,
  } = useSpeciesLocationFilters({
    taxonId,
    locationSearchLimit: LOCATION_SEARCH_LIMIT,
  });

  const {
    occurrences,
    loading: occurrenceLoading,
    error: occurrenceError,
  } = useSpeciesOccurrences({
    taxonId,
    locationGid: finalLocationGid,
  });

  React.useEffect(() => {
    setHighlightedCatalogs([]);
  }, [finalLocationGid, taxonId]);

  const handleDownload = React.useCallback(() => {
    Alert.alert('Download started', `Preparing ${commonName} data…`);
  }, [commonName]);

  const displayCommonNames = React.useMemo(() => {
    return buildCommonNamesWithPrimary(commonName, commonNames);
  }, [commonName, commonNames]);

  const hasImageAttribution = Boolean(
    overview.imageLicense ||
    overview.imageCreator ||
    overview.imageRightsHolder ||
    overview.imageReferences
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

  return (
    <>
      <Head>
        <title>{`WhereWild | ${commonName}`}</title>
      </Head>
      <View
        style={[styles.screen, { backgroundColor: palette.background.default.default }]}
      >
        <PageHeader />

        <ScrollView
          contentContainerStyle={getResponsiveContentContainerStyle(responsive, {
            includeHorizontalPadding: false,
            includeGap: true,
          })}
          bounces={false}
        >
          <SpeciesPageTitle
            commonName={commonName}
            scientificName={scientificName}
            onPressDownload={handleDownload}
          />

          <SectionShell responsive={responsive}>
              <View style={styles.overviewSection}>
                <View style={styles.featuredImageWrapper}>
                  <Image
                    source={overview.imageSource}
                    style={[styles.featuredImage]}
                    resizeMode="cover"
                    accessibilityLabel={`${commonName} featured image`}
                  />
                  {hasImageAttribution && (
                    <View style={styles.imageAttribution}>
                      {photoBy && (
                        <ThemedText variant="bodySmall" style={{ color: palette.text.default.secondary }}>
                          Photo by {photoBy}
                        </ThemedText>
                      )}
                      {imageReferenceUrl && (
                        <ThemedText
                          variant="bodySmallLink"
                          onPress={() => Linking.openURL(imageReferenceUrl)}
                        >
                          View on iNaturalist
                        </ThemedText>
                      )}
                      {overview.imageLicense && (
                        <ThemedText variant="bodySmall" style={{ color: palette.text.default.secondary }}>
                          {overview.imageLicense}
                        </ThemedText>
                      )}
                    </View>
                  )}
                </View>
                <View style={[styles.overviewText, { maxWidth: responsive.textWidth }]}>
                  <ThemedText variant="heading">Overview</ThemedText>
                  <ThemedText variant="body">{overview.description}</ThemedText>
                </View>
              </View>

              <View style={styles.commonNamesSection}>
                <ThemedText variant="heading">Common Names</ThemedText>
                <CommonNamesList names={displayCommonNames} />
              </View>
          </SectionShell>

          <NearbySpeciesCarousel species={nearbySpecies} />

          {shouldRenderOccurrenceMap && (
            <SectionShell responsive={responsive}>
                <ThemedText variant="heading">Observation Map</ThemedText>
                <SpeciesLocationFilters
                  countryOptions={countryOptions}
                  stateOptions={stateOptions}
                  countyOptions={countyOptions}
                  countryLoading={countryLoading}
                  stateLoading={stateLoading}
                  countyLoading={countyLoading}
                  selectedCountryGid={selectedCountryGid}
                  selectedStateGid={selectedStateGid}
                  selectedCountyGid={selectedCountyGid}
                  onCountryChange={onCountryChange}
                  onStateChange={onStateChange}
                  onCountyChange={onCountyChange}
                />

                <SpeciesEnvironmentSection
                  taxonId={taxonId}
                  onHighlightChange={setHighlightedCatalogs}
                  locationGid={finalLocationGid}
                  units={units} // <- forward units preference
                />

                <SpeciesOccurrenceMap
                  occurrences={occurrences}
                  loading={occurrenceLoading}
                  error={occurrenceError}
                  highlightedCatalogs={highlightedCatalogs}
                />
            </SectionShell>
          )}

          <View style={styles.heatMapSection}>
            <View
              style={[styles.sectionContent, getResponsiveContentContainerStyle(responsive, {
                includeTopPadding: false,
              }), { maxWidth: responsive.contentWidth }]}
            >
              <ThemedText variant="heading">Heat Map</ThemedText>
            </View>
            <Image
              source={heatmap.imageSource}
              resizeMode="cover"
              style={styles.heatmap}
              accessibilityLabel="Predicted sightings heat map"
            />
          </View>
        </ScrollView >
      </View >
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centeredSection: {
    width: '100%',
    alignItems: 'center',
  },
  sectionContent: {
    width: '100%',
    gap: Size.space['400'],
  },
  overviewSection: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
  overviewText: {
    flex: 1,
    minWidth: 280,
    gap: Size.space['200'],
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
    gap: Size.space['50'],
  },
  commonNamesSection: {
    gap: Size.space['200'],
  },
  commonNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Size.space['100'],
  },
  commonNameBullet: {
    minWidth: Size.space['200'],
  },
  heatMapSection: {
    gap: Size.space['400'],
  },
  heatmap: {
    width: '100%',
    aspectRatio: 1440 / 810,
  },
});