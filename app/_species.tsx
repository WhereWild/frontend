import {
  NearbySpeciesCarousel,
  SpeciesPageTitle,
  SwitchField,
  ThemedText,
  SpeciesEnvironmentSection,
  SpeciesInformationSection,
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
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
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

export default function Species({ data = mountainBallCactusData }: SpeciesScreenProps) {
  const { taxonId, commonName, commonNames, scientificName, overview, nearbySpecies, heatmap } =
    data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  const { units } = useSettings();

  const shouldRenderOccurrenceMap = Boolean(taxonId);
  const hasLiveHeatmap = heatmap.liveAvailable === true && typeof heatmap.liveTileUrl === 'string';
  const hasAnyHeatmap = hasLiveHeatmap || Boolean(heatmap.imageSource);
  const [showObservations, setShowObservations] = React.useState<boolean>(true);
  const [showLiveHeatmap, setShowLiveHeatmap] = React.useState<boolean>(hasLiveHeatmap);
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

  React.useEffect(() => {
    setShowLiveHeatmap(hasLiveHeatmap);
  }, [hasLiveHeatmap, heatmap.liveTileUrl]);

  const handleDownload = React.useCallback(() => {
    Alert.alert('Download started', `Preparing ${commonName} data…`);
  }, [commonName]);

  const displayCommonNames = React.useMemo(() => {
    return buildCommonNamesWithPrimary(commonName, commonNames);
  }, [commonName, commonNames]);

  return (
    <>
      {Platform.OS === 'web' ? (
        <Head>
          <title>{`WhereWild | ${commonName}`}</title>
        </Head>
      ) : null}
      <View
        style={[styles.screen, { backgroundColor: palette.background.default.default }]}
      >
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
            <SpeciesInformationSection
              commonName={commonName}
              commonNames={displayCommonNames}
              overview={overview}
            />
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
              <View style={styles.mapControls}>
                <SwitchField
                  label="Show observations"
                  value={showObservations}
                  onValueChange={setShowObservations}
                />
                <SwitchField
                  label="Show predictive heatmap"
                  value={showLiveHeatmap}
                  disabled={!hasLiveHeatmap}
                  description={
                    hasLiveHeatmap
                      ? undefined
                      : hasAnyHeatmap
                        ? 'Live heatmap overlay is unavailable for this model right now.'
                        : 'No heatmap is available for this species right now.'
                  }
                  onValueChange={setShowLiveHeatmap}
                />
              </View>

              <SpeciesOccurrenceMap
                occurrences={occurrences}
                loading={occurrenceLoading}
                error={occurrenceError}
                highlightedCatalogs={highlightedCatalogs}
                showMarkers={showObservations}
                heatmapTileUrl={showLiveHeatmap ? heatmap.liveTileUrl : null}
                heatmapOpacity={0.72}
              />
              <View style={styles.mapBottomSpacing} />
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
  mapControls: {
    width: '100%',
    gap: Size.space['200'],
  },
  mapBottomSpacing: {
    height: Size.space['300'],
  },
});
