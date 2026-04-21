import { usePathname } from 'expo-router';
import {
  NavigationPillList,
  PageScrollContainer,
  SpeciesPageTitle,
  SwitchField,
  ThemedText,
  SpeciesEnvironmentSection,
  SpeciesInformationSection,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { SpeciesOccurrenceMap } from '@/components/sections/SpeciesOccurrenceMap';
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
import type { HeatmapStatusMessage } from '@/components/sections/speciesOccurrenceMap/speciesOccurrenceMapHelpers';
import { useSpeciesOccurrences } from '@/hooks/species/useSpeciesOccurrences';
import { useSpeciesLocationFilters } from '@/hooks/species/useSpeciesLocationFilters';
import { useSettings } from '@/context/SettingsContext';
import { useLayoutChrome } from '../context/LayoutChromeContext';
import { WebMetadata, resolveOpenGraphImageUrl } from '@/utils/webMetadata';
import { buildSpeciesPath } from '@/utils/speciesOpenGraph';

const SAFE_AREA_INSETS_FALLBACK = { top: 0, bottom: 0, left: 0, right: 0 };

const FORECAST_OPTIONS: { label: string; hours: number }[] = [
  { label: 'Now', hours: 0 },
  { label: '+8h', hours: 8 },
  { label: '+24h', hours: 24 },
  { label: '+3d', hours: 72 },
  { label: '+7d', hours: 168 },
];
type HeatmapMode = 'habitat' | 'combined' | 'phenology_only';
type HeatmapSource = 'inference' | 'legacy';
type SelectionChipOption<T extends string | number> = {
  accessibilityLabel: string;
  label: string;
  value: T;
};

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

const getPredictiveHeatmapDescription = (
  selectedSource: HeatmapSource,
  hasInferenceHeatmap: boolean,
  hasLegacyHeatmap: boolean,
  hasAnyHeatmap: boolean,
) => {
  const selectedSourceAvailable =
    selectedSource === 'inference' ? hasInferenceHeatmap : hasLegacyHeatmap;

  if (selectedSourceAvailable) {
    return undefined;
  }

  if (selectedSource === 'inference' && hasLegacyHeatmap) {
    return 'Inference heatmap is unavailable right now. Select Forecast-aware to use the legacy model-backed tiles.';
  }

  if (selectedSource === 'legacy' && hasInferenceHeatmap) {
    return 'Forecast-aware heatmap is unavailable right now. Switch to Inference to use the new tile renderer.';
  }

  return hasAnyHeatmap
    ? 'Predictive heatmap tiles are unavailable for this species right now.'
    : 'No heatmap is available for this species right now.';
};

const buildPredictiveHeatmapTileUrl = ({
  forecastHours,
  heatmapSource,
  inferenceTileUrl,
  legacyModelId,
  legacyTileUrl,
  phenologyMode,
  showPredictiveHeatmap,
}: {
  forecastHours: number;
  heatmapSource: HeatmapSource;
  inferenceTileUrl?: string | null;
  legacyModelId?: string | null;
  legacyTileUrl?: string | null;
  phenologyMode: HeatmapMode;
  showPredictiveHeatmap: boolean;
}) => {
  if (!showPredictiveHeatmap) {
    return null;
  }

  if (heatmapSource === 'inference') {
    return inferenceTileUrl ?? null;
  }

  if (!legacyTileUrl) {
    return null;
  }

  const applyPhenology = phenologyMode !== 'habitat';
  const phenologyOnly = phenologyMode === 'phenology_only';
  const params = new URLSearchParams();
  if (legacyModelId) {
    params.set('model_id', legacyModelId);
  }
  params.set('forecast_hours', String(forecastHours));
  params.set('apply_phenology', applyPhenology ? 'true' : 'false');
  params.set('phenology_only', phenologyOnly ? 'true' : 'false');
  return `${legacyTileUrl}?${params.toString()}`;
};

const buildHeatmapSourceOptions = ({
  hasInferenceHeatmap,
  hasLegacyHeatmap,
}: {
  hasInferenceHeatmap: boolean;
  hasLegacyHeatmap: boolean;
}): SelectionChipOption<HeatmapSource>[] => {
  const options: SelectionChipOption<HeatmapSource>[] = [];
  if (hasInferenceHeatmap) {
    options.push({
      accessibilityLabel: 'Inference heatmap',
      label: 'Inference',
      value: 'inference',
    });
  }
  if (hasLegacyHeatmap) {
    options.push({
      accessibilityLabel: 'Forecast-aware legacy heatmap',
      label: 'Forecast-aware',
      value: 'legacy',
    });
  }
  return options;
};

const buildHeatmapModelOptions = (
  hasPhenology: boolean,
  conditionsLabel: string,
): SelectionChipOption<HeatmapMode>[] => {
  if (!hasPhenology) {
    return [
      { accessibilityLabel: 'Habitat', label: 'Habitat', value: 'habitat' },
      {
        accessibilityLabel: conditionsLabel,
        label: conditionsLabel,
        value: 'combined',
      },
    ];
  }

  return [
    { accessibilityLabel: 'Habitat', label: 'Habitat', value: 'habitat' },
    {
      accessibilityLabel: conditionsLabel,
      label: conditionsLabel,
      value: 'combined',
    },
    {
      accessibilityLabel: 'Conditions only',
      label: 'Conditions only',
      value: 'phenology_only',
    },
  ];
};

function SelectionChipGroup<T extends string | number>({
  options,
  selectedValue,
  title,
  onSelect,
}: {
  options: SelectionChipOption<T>[];
  selectedValue: T;
  title: string;
  onSelect: (value: T) => void;
}) {
  const pills = React.useMemo(
    () =>
      options.map((option) => ({
        key: String(option.value),
        label: option.label,
        accessibilityLabel: option.accessibilityLabel,
      })),
    [options],
  );

  const optionByKey = React.useMemo(
    () =>
      new Map(
        options.map((option) => [String(option.value), option.value] as const),
      ),
    [options],
  );

  const handleSelectionChange = React.useCallback(
    (key: string) => {
      const nextValue = optionByKey.get(key);
      if (nextValue !== undefined) {
        onSelect(nextValue);
      }
    },
    [onSelect, optionByKey],
  );

  return (
    <View style={styles.forecastPicker}>
      <ThemedText variant='bodySmall'>{title}</ThemedText>
      <NavigationPillList
        pills={pills}
        selectedKey={String(selectedValue)}
        onSelectionChange={handleSelectionChange}
        accessibilityLabel={title}
      />
    </View>
  );
}

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
  const hasInferenceHeatmap =
    typeof heatmap.inferenceTileUrl === 'string' &&
    heatmap.inferenceTileUrl.length > 0;
  const hasLegacyHeatmap =
    typeof heatmap.legacyTileUrl === 'string' &&
    heatmap.legacyTileUrl.length > 0;
  const hasAnyHeatmap =
    hasInferenceHeatmap || hasLegacyHeatmap || Boolean(heatmap.imageSource);
  const hasPhenology = heatmap.phenologyAvailable === true;
  const hasConditions = hasPhenology || heatmap.fullAvailable === true;
  const conditionsLabel = hasPhenology
    ? 'Habitat + flowering'
    : 'Habitat + conditions';
  const [showObservations, setShowObservations] = React.useState<boolean>(true);
  const [showPredictiveHeatmap, setShowPredictiveHeatmap] =
    React.useState<boolean>(false);
  const [heatmapSource, setHeatmapSource] = React.useState<HeatmapSource>(
    hasInferenceHeatmap ? 'inference' : 'legacy',
  );
  const [phenologyMode, setPhenologyMode] =
    React.useState<HeatmapMode>('combined');
  const [forecastHours, setForecastHours] = React.useState<number>(0);
  const [heatmapStatus, setHeatmapStatus] =
    React.useState<HeatmapStatusMessage | null>(null);
  const [highlightedCatalogs, setHighlightedCatalogs] = React.useState<
    (number | string)[]
  >([]);
  const [pinnedObservation, setPinnedObservation] = React.useState<{
    catalogNumber: string;
    lat: number;
    lon: number;
  } | null>(null);

  const predictiveHeatmapDescription = React.useMemo(
    () =>
      getPredictiveHeatmapDescription(
        heatmapSource,
        hasInferenceHeatmap,
        hasLegacyHeatmap,
        hasAnyHeatmap,
      ),
    [hasAnyHeatmap, hasInferenceHeatmap, hasLegacyHeatmap, heatmapSource],
  );
  const heatmapSourceOptions = React.useMemo(
    () =>
      buildHeatmapSourceOptions({
        hasInferenceHeatmap,
        hasLegacyHeatmap,
      }),
    [hasInferenceHeatmap, hasLegacyHeatmap],
  );
  const modelOptions = React.useMemo(
    () => buildHeatmapModelOptions(hasPhenology, conditionsLabel),
    [conditionsLabel, hasPhenology],
  );
  const forecastOptions = React.useMemo<SelectionChipOption<number>[]>(
    () =>
      FORECAST_OPTIONS.map((option) => ({
        accessibilityLabel: `Forecast ${option.label}`,
        label: option.label,
        value: option.hours,
      })),
    [],
  );
  const activeTileUrl = React.useMemo(
    () =>
      buildPredictiveHeatmapTileUrl({
        forecastHours,
        heatmapSource,
        inferenceTileUrl: heatmap.inferenceTileUrl,
        legacyModelId: heatmap.legacyModelId,
        legacyTileUrl: heatmap.legacyTileUrl,
        phenologyMode,
        showPredictiveHeatmap,
      }),
    [
      forecastHours,
      heatmap.inferenceTileUrl,
      heatmap.legacyModelId,
      heatmap.legacyTileUrl,
      heatmapSource,
      phenologyMode,
      showPredictiveHeatmap,
    ],
  );
  const predictiveHeatmapWarning = React.useMemo(() => {
    if (!showPredictiveHeatmap || !activeTileUrl) {
      return null;
    }
    if (heatmapStatus?.status !== 'unavailable') {
      return null;
    }
    return 'Predictive heatmap tiles are timing out or failing to load right now. You can keep browsing observations while the overlay recovers.';
  }, [activeTileUrl, heatmapStatus?.status, showPredictiveHeatmap]);

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
    setPinnedObservation(null);
  }, [finalLocationGid, taxonId]);

  React.useEffect(() => {
    if (hasInferenceHeatmap || hasLegacyHeatmap) {
      return;
    }
    setShowPredictiveHeatmap(false);
  }, [hasInferenceHeatmap, hasLegacyHeatmap]);

  React.useEffect(() => {
    setHeatmapStatus(null);
  }, [activeTileUrl, showPredictiveHeatmap]);

  React.useEffect(() => {
    if (heatmapSource === 'inference' && hasInferenceHeatmap) {
      return;
    }
    if (heatmapSource === 'legacy' && hasLegacyHeatmap) {
      return;
    }
    setHeatmapSource(hasInferenceHeatmap ? 'inference' : 'legacy');
  }, [hasInferenceHeatmap, hasLegacyHeatmap, heatmapSource]);

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

                <SpeciesEnvironmentSection
                  taxonId={taxonId}
                  taxonRank={taxonRank}
                  onHighlightChange={setHighlightedCatalogs}
                  locationGid={finalLocationGid}
                  units={units}
                  pinnedObservation={pinnedObservation}
                />
                <View style={styles.mapControls}>
                  <SwitchField
                    label='Show observations'
                    value={showObservations}
                    onValueChange={setShowObservations}
                  />
                  <SwitchField
                    label='Show predictive heatmap'
                    value={showPredictiveHeatmap}
                    disabled={!hasInferenceHeatmap && !hasLegacyHeatmap}
                    description={predictiveHeatmapDescription}
                    onValueChange={setShowPredictiveHeatmap}
                  />
                  {predictiveHeatmapWarning ? (
                    <ThemedText variant='bodySmall'>
                      {predictiveHeatmapWarning}
                    </ThemedText>
                  ) : null}
                  {showPredictiveHeatmap && heatmapSourceOptions.length > 1 && (
                    <SelectionChipGroup
                      options={heatmapSourceOptions}
                      selectedValue={heatmapSource}
                      title='Heatmap source'
                      onSelect={setHeatmapSource}
                    />
                  )}
                  {showPredictiveHeatmap &&
                    heatmapSource === 'legacy' &&
                    hasLegacyHeatmap && (
                      <SelectionChipGroup
                        options={forecastOptions}
                        selectedValue={forecastHours}
                        title='Weather window'
                        onSelect={setForecastHours}
                      />
                    )}
                  {showPredictiveHeatmap &&
                    heatmapSource === 'legacy' &&
                    hasLegacyHeatmap &&
                    hasConditions && (
                      <SelectionChipGroup
                        options={modelOptions}
                        selectedValue={phenologyMode}
                        title='Model'
                        onSelect={setPhenologyMode}
                      />
                    )}
                </View>
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
              <SpeciesOccurrenceMap
                occurrences={occurrences}
                loading={occurrenceLoading}
                error={occurrenceError}
                highlightedCatalogs={highlightedCatalogs}
                selectedPoint={selectedMapPoint}
                height={observationMapHeight}
                showMarkers={showObservations}
                heatmapTileUrl={activeTileUrl}
                heatmapOpacity={0.72}
                onHeatmapStatusChange={setHeatmapStatus}
                onPinObservation={handlePinObservation}
              />
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
  mapControls: {
    width: '100%',
    gap: Size.space['200'],
  },
  forecastPicker: {
    gap: Size.space['100'],
  },
});
