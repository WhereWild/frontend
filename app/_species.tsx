import {
  NearbySpeciesCarousel,
  PageHeader,
  SpeciesPageTitle,
  SwitchField,
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
import { useSpeciesHeatmap } from '@/hooks/species/useSpeciesHeatmap';
import { useSpeciesLocationFilters } from '@/hooks/species/useSpeciesLocationFilters';

type SpeciesScreenProps = {
  data?: SpeciesScreenData;
};

export type SpeciesScreenData = Pick<
  SpeciesPageData,
  'taxonId' | 'scientificName' | 'commonName' | 'commonNames' | 'overview' | 'nearbySpecies'
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
  const { taxonId, commonName, commonNames, scientificName, overview, nearbySpecies } =
    data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  const shouldRenderOccurrenceMap = Boolean(taxonId);
  const [highlightedCatalogs, setHighlightedCatalogs] = React.useState<(number | string)[]>([]);
  const [showHeatmap, setShowHeatmap] = React.useState(true);
  const [heatmapZoom, setHeatmapZoom] = React.useState(5);
  const [heatmapBbox, setHeatmapBbox] = React.useState<string | null>(null);

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

  const {
    cells: heatmapCells,
  } = useSpeciesHeatmap({
    taxonId,
    locationGid: finalLocationGid,
    zoom: heatmapZoom,
    bbox: heatmapBbox,
    maxCells: Math.max(3000, Math.min(16000, heatmapZoom * 1200)),
    enabled: showHeatmap,
  });

  const viewportDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setHighlightedCatalogs([]);
  }, [finalLocationGid, taxonId]);

  React.useEffect(() => {
    setHeatmapZoom(5);
    setHeatmapBbox(null);
  }, [finalLocationGid, taxonId]);

  const handleViewportChange = React.useCallback((zoom: number, bbox: string) => {
    const backendZoom = Math.max(1, Math.min(12, Math.round(zoom) + 4));
    if (viewportDebounceRef.current) {
      clearTimeout(viewportDebounceRef.current);
    }
    viewportDebounceRef.current = setTimeout(() => {
      setHeatmapZoom((prev) => (prev === backendZoom ? prev : backendZoom));
      setHeatmapBbox((prev) => (prev === bbox ? prev : bbox));
    }, 250);
  }, []);

  React.useEffect(() => {
    return () => {
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
    };
  }, []);

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
                        <ThemedText variant="body" style={{ color: palette.text.default.secondary }}>
                          Photo by {photoBy}
                        </ThemedText>
                      )}
                      {imageReferenceUrl && (
                        <ThemedText
                          variant="link"
                          onPress={() => Linking.openURL(imageReferenceUrl)}
                        >
                          View on iNaturalist
                        </ThemedText>
                      )}
                      {overview.imageLicense && (
                        <ThemedText variant="body" style={{ color: palette.text.default.secondary }}>
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
                />

                <SwitchField
                  label="Show heatmap overlay"
                  description="Overlay density heatmap on top of occurrence points."
                  value={showHeatmap}
                  onValueChange={setShowHeatmap}
                />

                <SpeciesOccurrenceMap
                  occurrences={occurrences}
                  heatmapCells={showHeatmap ? heatmapCells : []}
                  showHeatmap={showHeatmap}
                  loading={occurrenceLoading}
                  error={occurrenceError}
                  height={'80%'}
                  highlightedCatalogs={highlightedCatalogs}
                  onViewportChange={handleViewportChange}
                />
            </SectionShell>
          )}
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
});
