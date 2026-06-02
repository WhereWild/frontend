import { usePathname } from 'expo-router';
import {
  PageScrollContainer,
  SpeciesPageTitle,
  ThemedText,
  SpeciesEnvironmentSection,
  SpeciesInformationSection,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
import { MapVariableLegend } from '@/components/sections/speciesOccurrenceMap/MapVariableLegend';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import {
  isVariableCategorical,
  isVariableCircular,
} from '@/components/sections/speciesEnvironment/model';
import { BACKEND_BASE } from '@/data/api';
import { Colors, Size } from '@/constants/theme';
import { buildCommonNamesWithPrimary } from '@/data/commonNames';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import React from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { SpeciesLocationFilters } from '@/components/sections/SpeciesLocationFilters';
import { SpeciesObservationFilters } from '@/components/sections/SpeciesObservationFilters';
import { useSpeciesOccurrences } from '@/hooks/species/useSpeciesOccurrences';
import { useSpeciesLocationFilters } from '@/hooks/species/useSpeciesLocationFilters';
import { useSettings } from '@/context/SettingsContext';
import { useLayoutChrome } from '../context/LayoutChromeContext';
import { WebMetadata, resolveOpenGraphImageUrl } from '@/utils/webMetadata';
import { buildSpeciesPath } from '@/utils/speciesOpenGraph';

const SAFE_AREA_INSETS_FALLBACK = { top: 0, bottom: 0, left: 0, right: 0 };

const WEB_HEADER_HEIGHT_DESKTOP = Size.space['1600'] + Size.space['200'] * 2;
const WEB_HEADER_HEIGHT_COMPACT =
  Size.control.dimension.large + Size.space['400'] * 2;

type SpeciesScreenProps = {
  data?: SpeciesScreenData;
};

export type SpeciesScreenData = Pick<
  SpeciesPageData,
  | 'taxonId'
  | 'scientificName'
  | 'commonName'
  | 'commonNames'
  | 'overview'
  | 'nearbySpecies'
  | 'heatmap'
  | 'allObscured'
  | 'taxonRank'
>;

export const LOCATION_SEARCH_LIMIT = 500;

type ResponsiveState = ReturnType<typeof useResponsive>;
type SpeciesMapBreakpoint = ResponsiveState['breakpoint'];

export const calculateObservationMapHeight = ({
  breakpoint,
  measuredWebHeaderHeight,
  platform,
  safeAreaBottom,
  safeAreaTop,
  viewportHeight,
}: {
  breakpoint: SpeciesMapBreakpoint;
  measuredWebHeaderHeight?: number;
  platform: string;
  safeAreaBottom: number;
  safeAreaTop: number;
  viewportHeight: number;
}) => {
  const excludedViewportHeight =
    platform === 'web'
      ? measuredWebHeaderHeight && measuredWebHeaderHeight > 0
        ? measuredWebHeaderHeight
        : breakpoint === 'desktop'
          ? WEB_HEADER_HEIGHT_DESKTOP
          : WEB_HEADER_HEIGHT_COMPACT
      : Size.bar.height.short +
        Size.bar.height.tall +
        safeAreaTop +
        safeAreaBottom;
  const availableViewportHeight = Math.max(
    0,
    viewportHeight - excludedViewportHeight,
  );
  return Math.round(availableViewportHeight * 0.75);
};

export const shouldRenderObservationMapFrame = ({
  measuredWebHeaderHeight,
  platform,
}: {
  measuredWebHeaderHeight: number;
  platform: string;
}) => platform !== 'web' || measuredWebHeaderHeight > 0;

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
      <View
        style={[styles.sectionContent, { maxWidth: responsive.contentWidth }]}
      >
        {children}
      </View>
    </View>
  );
}

export default function Species({
  data = mountainBallCactusData,
}: SpeciesScreenProps) {
  const {
    taxonId,
    commonName,
    commonNames,
    scientificName,
    overview,
    heatmap,
    allObscured,
    taxonRank,
  } = data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const pathname = usePathname();
  const responsive = useResponsive();
  const { webHeaderHeight } = useLayoutChrome();
  const safeAreaInsets = React.useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? SAFE_AREA_INSETS_FALLBACK;

  const { units } = useSettings();
  const { height: viewportHeight } = useWindowDimensions();
  const observationMapHeight = React.useMemo(() => {
    return calculateObservationMapHeight({
      breakpoint: responsive.breakpoint,
      measuredWebHeaderHeight: webHeaderHeight,
      platform: Platform.OS,
      safeAreaBottom: insets.bottom,
      safeAreaTop: insets.top,
      viewportHeight,
    });
  }, [
    insets.bottom,
    insets.top,
    responsive.breakpoint,
    viewportHeight,
    webHeaderHeight,
  ]);

  const shouldRenderOccurrenceMap = Boolean(taxonId);
  const isOccurrenceMapReadyToRender = shouldRenderObservationMapFrame({
    measuredWebHeaderHeight: webHeaderHeight,
    platform: Platform.OS,
  });
  const [highlightedCatalogs, setHighlightedCatalogs] = React.useState<
    (number | string)[]
  >([]);
  const [pinnedObservation, setPinnedObservation] = React.useState<{
    catalogNumber: string;
    lat: number;
    lon: number;
  } | null>(null);
  const [selectedVariableMeta, setSelectedVariableMeta] =
    React.useState<EnvironmentVariableOption | null>(null);
  const [pinnedPointValue, setPinnedPointValue] = React.useState<number | null>(
    null,
  );
  const [selectedPhenology, setSelectedPhenology] = React.useState<
    string | null
  >(null);
  const startTimestamp: number | null = null;
  const endTimestamp: number | null = null;

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
    phenologyCounts,
    phenologyNoData,
  } = useSpeciesOccurrences({
    taxonId,
    locationGid: finalLocationGid,
    phenology: selectedPhenology,
    startTimestamp,
    endTimestamp,
  });

  React.useEffect(() => {
    if (phenologyNoData && selectedPhenology) {
      setSelectedPhenology(null);
    }
  }, [phenologyNoData, selectedPhenology]);

  React.useEffect(() => {
    setHighlightedCatalogs([]);
  }, [finalLocationGid, taxonId]);

  React.useEffect(() => {
    setPinnedObservation(null);
  }, [finalLocationGid, taxonId]);

  const handleDownload = React.useCallback(() => {
    Alert.alert('Download started', `Preparing ${commonName} data…`);
  }, [commonName]);

  const handlePinObservation = React.useCallback(
    (catalogNumber: string, lat: number, lon: number) => {
      setPinnedObservation((prev) =>
        prev?.catalogNumber === catalogNumber
          ? null
          : { catalogNumber, lat, lon },
      );
    },
    [],
  );

  const handleMapPointValue = React.useCallback((value: number) => {
    setPinnedPointValue(value);
  }, []);

  const handleVariableMetaChange = React.useCallback(
    (meta: EnvironmentVariableOption | null) => {
      setSelectedVariableMeta(meta);
      setPinnedPointValue(null);
    },
    [],
  );

  const displayCommonNames = React.useMemo(() => {
    return buildCommonNamesWithPrimary(commonName, commonNames);
  }, [commonName, commonNames]);
  const speciesPath = React.useMemo(() => {
    if (Platform.OS === 'web' && pathname.startsWith('/species/')) {
      return pathname;
    }

    return buildSpeciesPath({
      commonName,
      scientificName,
      taxonId,
    });
  }, [commonName, pathname, scientificName, taxonId]);
  const speciesDescription = React.useMemo(() => {
    const trimmed = overview.description.trim();
    return trimmed.length > 0
      ? trimmed
      : `Explore habitat context, observations, and predictive maps for ${commonName}.`;
  }, [commonName, overview.description]);
  const speciesImageUrl = React.useMemo(
    () => resolveOpenGraphImageUrl(overview.imageSource),
    [overview.imageSource],
  );

  // Show the yellow selected-point dot for ANY pinned item — both real
  // observations and map-click "point:" entries — using the stored lat/lon.
  const selectedMapPoint = React.useMemo(
    () =>
      pinnedObservation != null
        ? { lat: pinnedObservation.lat, lon: pinnedObservation.lon }
        : null,
    [pinnedObservation],
  );

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title={`WhereWild | ${commonName}`}
          description={speciesDescription}
          path={speciesPath}
          imageUrl={speciesImageUrl}
          type='article'
        />
      ) : null}
      <PageSurface>
        <PageScrollContainer
          contentContainerStyle={getResponsiveContentContainerStyle(
            responsive,
            {
              includeHorizontalPadding: false,
              includeTopPadding: false,
            },
          )}
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
              onPressDownload={handleDownload}
            />

            <SectionShell responsive={responsive}>
              <SpeciesInformationSection
                commonName={commonName}
                commonNames={displayCommonNames}
                overview={overview}
                allObscured={allObscured}
              />
            </SectionShell>

            {shouldRenderOccurrenceMap && (
              <SectionShell responsive={responsive}>
                <ThemedText variant='heading'>Observation Map</ThemedText>
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

                <SpeciesObservationFilters
                  selectedPhenology={selectedPhenology}
                  onPhenologyChange={setSelectedPhenology}
                  phenologyCounts={phenologyCounts}
                />

                <SpeciesEnvironmentSection
                  taxonId={taxonId}
                  taxonRank={taxonRank}
                  onHighlightChange={setHighlightedCatalogs}
                  onVariableMetaChange={handleVariableMetaChange}
                  locationGid={finalLocationGid}
                  phenology={selectedPhenology}
                  startTimestamp={startTimestamp}
                  endTimestamp={endTimestamp}
                  units={units}
                  pinnedObservation={pinnedObservation}
                />
              </SectionShell>
            )}
          </View>

          {/* Always mount the map container to keep ScrollView child indices
              stable — toggling between a component and null shifts Fabric indices
              and causes unmount crashes on iPadOS with mouse/Pencil input. */}
          <View
            collapsable={false}
            style={
              shouldRenderOccurrenceMap && isOccurrenceMapReadyToRender
                ? undefined
                : styles.hiddenMapSlot
            }
          >
            {shouldRenderOccurrenceMap && isOccurrenceMapReadyToRender && (
              <View style={{ position: 'relative' }}>
                <SpeciesOccurrenceMap
                  occurrences={occurrences}
                  loading={occurrenceLoading}
                  error={occurrenceError}
                  highlightedCatalogs={highlightedCatalogs}
                  selectedPoint={selectedMapPoint}
                  height={observationMapHeight}
                  minZoom={2}
                  onPinObservation={handlePinObservation}
                  onPointValue={handleMapPointValue}
                  pointQueryUrl={
                    selectedVariableMeta?.id &&
                    !isVariableCategorical(selectedVariableMeta) &&
                    !isVariableCircular(selectedVariableMeta)
                      ? `${BACKEND_BASE}/gis/point?variable=${encodeURIComponent(selectedVariableMeta.id)}&unit_system=${encodeURIComponent(units ?? '')}`
                      : null
                  }
                  renderMin={
                    selectedVariableMeta &&
                    !isVariableCategorical(selectedVariableMeta) &&
                    !isVariableCircular(selectedVariableMeta)
                      ? (selectedVariableMeta.renderMin ?? null)
                      : null
                  }
                  renderMax={
                    selectedVariableMeta &&
                    !isVariableCategorical(selectedVariableMeta) &&
                    !isVariableCircular(selectedVariableMeta)
                      ? (selectedVariableMeta.renderMax ?? null)
                      : null
                  }
                  isCircular={false}
                />
                {selectedVariableMeta &&
                  !isVariableCategorical(selectedVariableMeta) &&
                  !isVariableCircular(selectedVariableMeta) &&
                  selectedVariableMeta.renderMin != null &&
                  selectedVariableMeta.renderMax != null && (
                    <MapVariableLegend
                      min={selectedVariableMeta.renderMin}
                      max={selectedVariableMeta.renderMax}
                      units={selectedVariableMeta.units}
                      pinnedValue={pinnedPointValue}
                    />
                  )}
              </View>
            )}
          </View>
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  overlayContent: {
    width: '100%',
    gap: Size.space['400'],
    paddingBottom: Size.space['400'],
  },
  hiddenMapSlot: {
    width: 0,
    height: 0,
    overflow: 'hidden' as const,
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
