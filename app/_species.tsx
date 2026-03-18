import {
  NearbySpeciesCarousel,
  SpeciesPageTitle,
  ThemedText,
  SpeciesEnvironmentSection,
  SpeciesInformationSection,
} from '@/components';
import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { Colors, Size } from '@/constants/theme';
import { buildCommonNamesWithPrimary } from '@/data/commonNames';
import { mockHomePageData } from '@/data/homeSample';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import Head from 'expo-router/head';
import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SpeciesLocationFilters } from '@/components/sections/SpeciesLocationFilters';
import { useSpeciesOccurrences } from '@/hooks/species/useSpeciesOccurrences';
import { useSpeciesLocationFilters } from '@/hooks/species/useSpeciesLocationFilters';
import { useSettings } from '@/context/SettingsContext';

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
    <View
      style={[
        styles.centeredSection,
        getResponsiveContentContainerStyle(responsive, {
          includeWidth: false,
          includeTopPadding: false,
        }),
      ]}
    >
      <View style={[styles.sectionContent, { maxWidth: responsive.contentWidth }]}>
        {children}
      </View>
    </View>
  );
}

export default function Species({ data = mountainBallCactusData }: SpeciesScreenProps) {
  const { taxonId, commonName, commonNames, scientificName, overview } =
    data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  const { units } = useSettings();
  const { height: viewportHeight } = useWindowDimensions();
  const observationMapHeight = Math.round(viewportHeight * 0.75);

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

  const displayCommonNames = React.useMemo(() => {
    return buildCommonNamesWithPrimary(commonName, commonNames);
  }, [commonName, commonNames]);

  return (
    <>
      <Head>
        <title>{`WhereWild | ${commonName}`}</title>
      </Head>
      <View
        style={[styles.screen, { backgroundColor: palette.background.default.default }]}
      >
        <ScrollView
          contentContainerStyle={getResponsiveContentContainerStyle(responsive, {
            includeHorizontalPadding: false,
            includeTopPadding: false,
          })}
          bounces={false}
        >
          <View
            style={{
              height: responsive.gap,
              backgroundColor: palette.background.default.default,
            }}
          />

          <View
            style={[
              styles.overlayContent,
              { backgroundColor: palette.background.default.default },
            ]}
          >
            <SpeciesPageTitle
              commonName={commonName}
              scientificName={scientificName}
              />

            <SectionShell responsive={responsive}>
              <SpeciesInformationSection
                commonName={commonName}
                commonNames={displayCommonNames}
                overview={overview}
              />
            </SectionShell>

          <NearbySpeciesCarousel species={mockHomePageData.recommendations.items} />

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
              </SectionShell>
            )}
          </View>

          {shouldRenderOccurrenceMap && (
            <SpeciesOccurrenceMap
              occurrences={occurrences}
              loading={occurrenceLoading}
              error={occurrenceError}
              highlightedCatalogs={highlightedCatalogs}
              height={observationMapHeight}
            />
          )}
        </ScrollView>

      </View >
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  overlayContent: {
    width: '100%',
    gap: Size.space['400'],
    paddingBottom: Size.space['400'],
  },
  centeredSection: {
    width: '100%',
    alignItems: 'center',
  },
  sectionContent: {
    width: '100%',
    gap: Size.space['400'],
  },
});
