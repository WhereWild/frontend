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
import { ReinforcementDemoSection } from '@/components/sections/ReinforcementDemoSection';
import { Colors, Size } from '@/constants/theme';
import { buildCommonNamesWithPrimary } from '@/data/commonNames';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useReinforcementDemo } from '@/hooks/species/useReinforcementDemo';
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

type HeatmapTemporalMode = 'current' | 'missing';
type HeatmapWeatherOption =
  | 'no_weather'
  | 'no_forecast'
  | 'forecast_8h'
  | 'forecast_24h'
  | 'forecast_3d'
  | 'forecast_7d';

const FORECAST_OPTIONS: {
  accessibilityLabel: string;
  label: string;
  value: HeatmapWeatherOption;
  temporalMode: HeatmapTemporalMode;
  forecastHours?: number;
}[] = [
  {
    accessibilityLabel: 'Off',
    label: 'Off',
    value: 'no_weather',
    temporalMode: 'missing',
  },
  {
    accessibilityLabel: 'Current',
    label: 'Current',
    value: 'no_forecast',
    temporalMode: 'current',
    forecastHours: 0,
  },
  {
    accessibilityLabel: 'Forecast +8h',
    label: '+8h',
    value: 'forecast_8h',
    temporalMode: 'current',
    forecastHours: 8,
  },
  {
    accessibilityLabel: 'Forecast +24h',
    label: '+24h',
    value: 'forecast_24h',
    temporalMode: 'current',
    forecastHours: 24,
  },
  {
    accessibilityLabel: 'Forecast +3d',
    label: '+3d',
    value: 'forecast_3d',
    temporalMode: 'current',
    forecastHours: 72,
  },
  {
    accessibilityLabel: 'Forecast +7d',
    label: '+7d',
    value: 'forecast_7d',
    temporalMode: 'current',
    forecastHours: 168,
  },
];
type HeatmapMode = 'habitat' | 'combined' | 'phenology_only';
type HeatmapSource = 'inference' | 'classic';
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
  hasClassicHeatmap: boolean,
  hasAnyHeatmap: boolean,
) => {
  const selectedSourceAvailable =
    selectedSource === 'inference' ? hasInferenceHeatmap : hasClassicHeatmap;

  if (selectedSourceAvailable) {
    return undefined;
  }

  if (selectedSource === 'inference' && hasClassicHeatmap) {
    return 'Experimental heatmap is unavailable right now. Select Classic to use the older model-backed tiles.';
  }

  if (selectedSource === 'classic' && hasInferenceHeatmap) {
    return 'Classic heatmap is unavailable right now. Switch to Experimental to use the newer tile renderer.';
  }

  return hasAnyHeatmap
    ? 'Predictive heatmap tiles are unavailable for this species right now.'
    : 'No heatmap is available for this species right now.';
};

const appendPredictiveHeatmapParams = (
  tileUrl: string,
  params: URLSearchParams,
  keysToRemove: string[] = [],
) => {
  const additions = Array.from(params.entries());
  if (additions.length === 0 && keysToRemove.length === 0) {
    return tileUrl;
  }

  const [pathAndQuery, hash = ''] = tileUrl.split('#', 2);
  const [path, existingQuery = ''] = pathAndQuery.split('?', 2);
  const mergedParams = new URLSearchParams(existingQuery);
  keysToRemove.forEach((key) => {
    mergedParams.delete(key);
  });
  additions.forEach(([key, value]) => {
    mergedParams.set(key, value);
  });

  const query = mergedParams.toString();
  const suffix = hash.length > 0 ? `#${hash}` : '';
  return query.length > 0 ? `${path}?${query}${suffix}` : `${path}${suffix}`;
};

const resolveHeatmapWeatherOption = (value: HeatmapWeatherOption) =>
  FORECAST_OPTIONS.find((option) => option.value === value) ??
  FORECAST_OPTIONS[1];

const normalizeWeatherOptionForSource = (
  heatmapSource: HeatmapSource,
  weatherOption: HeatmapWeatherOption,
): HeatmapWeatherOption =>
  heatmapSource === 'classic' && weatherOption === 'no_weather'
    ? 'no_forecast'
    : weatherOption;

const buildInferencePredictiveHeatmapTileUrl = ({
  inferenceClientKey,
  inferenceHeadVariant,
  inferenceTileUrl,
  temporalMode,
  forecastHours,
}: {
  inferenceClientKey: string;
  inferenceHeadVariant: 'original' | 'reinforced';
  inferenceTileUrl?: string | null;
  temporalMode: HeatmapTemporalMode;
  forecastHours?: number;
}) => {
  if (!inferenceTileUrl) {
    return null;
  }

  const params = new URLSearchParams();
  params.set('client_key', inferenceClientKey);
  params.set('head_variant', inferenceHeadVariant);
  if (temporalMode === 'missing') {
    params.set('temporal_mode', 'missing');
    return appendPredictiveHeatmapParams(inferenceTileUrl, params, [
      'forecast_hours',
    ]);
  } else {
    params.set('forecast_hours', String(forecastHours ?? 0));
    return appendPredictiveHeatmapParams(inferenceTileUrl, params, [
      'temporal_mode',
    ]);
  }
};

const buildClassicPredictiveHeatmapTileUrl = ({
  forecastHours,
  classicModelId,
  classicTileUrl,
  phenologyMode,
  temporalMode,
}: {
  forecastHours?: number;
  classicModelId?: string | null;
  classicTileUrl?: string | null;
  phenologyMode: HeatmapMode;
  temporalMode: HeatmapTemporalMode;
}) => {
  if (!classicTileUrl) {
    return null;
  }

  const params = new URLSearchParams();
  params.set('forecast_hours', String(forecastHours ?? 0));

  const effectivePhenologyMode =
    temporalMode === 'missing' ? 'habitat' : phenologyMode;
  const applyPhenology = effectivePhenologyMode !== 'habitat';
  const phenologyOnly = effectivePhenologyMode === 'phenology_only';
  if (classicModelId) {
    params.set('model_id', classicModelId);
  }
  params.set('apply_phenology', applyPhenology ? 'true' : 'false');
  params.set('phenology_only', phenologyOnly ? 'true' : 'false');
  return appendPredictiveHeatmapParams(classicTileUrl, params, [
    'temporal_mode',
  ]);
};

const buildPredictiveHeatmapTileUrl = ({
  heatmapSource,
  inferenceClientKey,
  inferenceHeadVariant,
  inferenceTileUrl,
  classicModelId,
  classicTileUrl,
  phenologyMode,
  showPredictiveHeatmap,
  weatherOption,
}: {
  heatmapSource: HeatmapSource;
  inferenceClientKey: string;
  inferenceHeadVariant: 'original' | 'reinforced';
  inferenceTileUrl?: string | null;
  classicModelId?: string | null;
  classicTileUrl?: string | null;
  phenologyMode: HeatmapMode;
  showPredictiveHeatmap: boolean;
  weatherOption: HeatmapWeatherOption;
}) => {
  if (!showPredictiveHeatmap) {
    return null;
  }

  const normalizedWeatherOption = normalizeWeatherOptionForSource(
    heatmapSource,
    weatherOption,
  );
  const { forecastHours, temporalMode } = resolveHeatmapWeatherOption(
    normalizedWeatherOption,
  );

  if (heatmapSource === 'inference') {
    return buildInferencePredictiveHeatmapTileUrl({
      inferenceClientKey,
      inferenceHeadVariant,
      inferenceTileUrl,
      temporalMode,
      forecastHours,
    });
  }

  return buildClassicPredictiveHeatmapTileUrl({
    forecastHours,
    classicModelId,
    classicTileUrl,
    phenologyMode,
    temporalMode,
  });
};

const buildHeatmapSourceOptions = ({
  hasInferenceHeatmap,
  hasClassicHeatmap,
}: {
  hasInferenceHeatmap: boolean;
  hasClassicHeatmap: boolean;
}): SelectionChipOption<HeatmapSource>[] => {
  const options: SelectionChipOption<HeatmapSource>[] = [];
  if (hasInferenceHeatmap) {
    options.push({
      accessibilityLabel: 'Experimental heatmap',
      label: 'Experimental',
      value: 'inference',
    });
  }
  if (hasClassicHeatmap) {
    options.push({
      accessibilityLabel: 'Classic heatmap',
      label: 'Classic',
      value: 'classic',
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
      accessibilityLabel: 'Season only',
      label: 'Season only',
      value: 'phenology_only',
    },
  ];
};

const buildWeatherOptions = (
  heatmapSource: HeatmapSource,
): SelectionChipOption<HeatmapWeatherOption>[] =>
  FORECAST_OPTIONS.filter(
    (option) => heatmapSource === 'inference' || option.value !== 'no_weather',
  ).map((option) => ({
    accessibilityLabel: option.accessibilityLabel,
    label: option.label,
    value: option.value,
  }));

const getWeatherInputsDescription = (
  heatmapSource: HeatmapSource,
  weatherOption: HeatmapWeatherOption,
) => {
  if (heatmapSource === 'inference') {
    if (weatherOption === 'no_weather') {
      return 'Off removes weather inputs entirely.';
    }
    if (weatherOption === 'no_forecast') {
      return 'Current uses live weather inputs.';
    }
    return 'Forecast offsets use predicted weather inputs.';
  }

  return 'Current and forecast use weather-aware layers in the classic model.';
};

const getClassicOverlayDescription = (hasPhenology: boolean) =>
  hasPhenology
    ? 'Habitat shows base suitability. Habitat + season adds seasonal fit. Season only shows the seasonal layer.'
    : 'Habitat shows base suitability. Habitat + season adds seasonal fit.';

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
  const reinforcement = useReinforcementDemo(
    typeof taxonId === 'number' ? taxonId : undefined,
  );
  const hasInferenceHeatmap =
    typeof heatmap.inferenceTileUrl === 'string' &&
    heatmap.inferenceTileUrl.length > 0;
  const hasClassicHeatmap =
    typeof heatmap.classicTileUrl === 'string' &&
    heatmap.classicTileUrl.length > 0;
  const hasAnyHeatmap =
    hasInferenceHeatmap || hasClassicHeatmap || Boolean(heatmap.imageSource);
  const hasPhenology = heatmap.phenologyAvailable === true;
  const hasConditions = hasPhenology || heatmap.fullAvailable === true;
  const conditionsLabel = 'Habitat + season';
  const [showObservations, setShowObservations] = React.useState<boolean>(true);
  const [showPredictiveHeatmap, setShowPredictiveHeatmap] =
    React.useState<boolean>(false);
  const [heatmapSource, setHeatmapSource] = React.useState<HeatmapSource>(
    hasInferenceHeatmap ? 'inference' : 'classic',
  );
  const [phenologyMode, setPhenologyMode] =
    React.useState<HeatmapMode>('combined');
  const [weatherOption, setWeatherOption] =
    React.useState<HeatmapWeatherOption>('no_forecast');
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
        hasClassicHeatmap,
        hasAnyHeatmap,
      ),
    [hasAnyHeatmap, hasClassicHeatmap, hasInferenceHeatmap, heatmapSource],
  );
  const heatmapSourceOptions = React.useMemo(
    () =>
      buildHeatmapSourceOptions({
        hasInferenceHeatmap,
        hasClassicHeatmap,
      }),
    [hasClassicHeatmap, hasInferenceHeatmap],
  );
  const modelOptions = React.useMemo(
    () => buildHeatmapModelOptions(hasPhenology, conditionsLabel),
    [conditionsLabel, hasPhenology],
  );
  const effectiveWeatherOption = React.useMemo(
    () => normalizeWeatherOptionForSource(heatmapSource, weatherOption),
    [heatmapSource, weatherOption],
  );
  const forecastOptions = React.useMemo<
    SelectionChipOption<HeatmapWeatherOption>[]
  >(() => buildWeatherOptions(heatmapSource), [heatmapSource]);
  const weatherInputsDescription = React.useMemo(
    () => getWeatherInputsDescription(heatmapSource, effectiveWeatherOption),
    [effectiveWeatherOption, heatmapSource],
  );
  const classicOverlayDescription = React.useMemo(
    () => getClassicOverlayDescription(hasPhenology),
    [hasPhenology],
  );
  const activeTileUrl = React.useMemo(
    () =>
      buildPredictiveHeatmapTileUrl({
        heatmapSource,
        inferenceClientKey: reinforcement.clientKey,
        inferenceHeadVariant: reinforcement.headVariant,
        inferenceTileUrl: heatmap.inferenceTileUrl,
        classicModelId: heatmap.classicModelId,
        classicTileUrl: heatmap.classicTileUrl,
        phenologyMode,
        showPredictiveHeatmap,
        weatherOption: effectiveWeatherOption,
      }),
    [
      heatmap.inferenceTileUrl,
      heatmap.classicModelId,
      heatmap.classicTileUrl,
      heatmapSource,
      reinforcement.clientKey,
      reinforcement.headVariant,
      phenologyMode,
      showPredictiveHeatmap,
      effectiveWeatherOption,
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
    if (hasInferenceHeatmap || hasClassicHeatmap) {
      return;
    }
    setShowPredictiveHeatmap(false);
  }, [hasClassicHeatmap, hasInferenceHeatmap]);

  React.useEffect(() => {
    setHeatmapStatus(null);
  }, [activeTileUrl, showPredictiveHeatmap]);

  React.useEffect(() => {
    if (!reinforcement.enabled || !hasInferenceHeatmap) {
      return;
    }
    setHeatmapSource('inference');
    setShowPredictiveHeatmap(true);
  }, [hasInferenceHeatmap, reinforcement.enabled]);

  React.useEffect(() => {
    if (heatmapSource === 'inference' && hasInferenceHeatmap) {
      return;
    }
    if (heatmapSource === 'classic' && hasClassicHeatmap) {
      return;
    }
    setHeatmapSource(hasInferenceHeatmap ? 'inference' : 'classic');
  }, [hasClassicHeatmap, hasInferenceHeatmap, heatmapSource]);

  const handleHeatmapSourceChange = React.useCallback(
    (nextSource: HeatmapSource) => {
      setHeatmapSource(nextSource);
      setWeatherOption((current) =>
        normalizeWeatherOptionForSource(nextSource, current),
      );
    },
    [],
  );

  const handleDownload = React.useCallback(() => {
    Alert.alert('Download started', `Preparing ${commonName} data…`);
  }, [commonName]);

  const handlePinObservation = React.useCallback(
    (catalogNumber: string, lat: number, lon: number) => {
      const nextPinnedObservation =
        pinnedObservation?.catalogNumber === catalogNumber
          ? null
          : { catalogNumber, lat, lon };

      setPinnedObservation(nextPinnedObservation);

      if (
        nextPinnedObservation != null &&
        reinforcement.enabled &&
        hasInferenceHeatmap &&
        typeof taxonId === 'number'
      ) {
        setHeatmapSource('inference');
        setShowPredictiveHeatmap(true);
        void reinforcement.submitFeedback(lat, lon);
      }
    },
    [hasInferenceHeatmap, pinnedObservation, reinforcement, taxonId],
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
                    disabled={!hasInferenceHeatmap && !hasClassicHeatmap}
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
                      onSelect={handleHeatmapSourceChange}
                    />
                  )}
                  {showPredictiveHeatmap &&
                    ((heatmapSource === 'classic' && hasClassicHeatmap) ||
                      (heatmapSource === 'inference' &&
                        hasInferenceHeatmap)) && (
                      <>
                        <SelectionChipGroup
                          options={forecastOptions}
                          selectedValue={effectiveWeatherOption}
                          title='Weather inputs'
                          onSelect={setWeatherOption}
                        />
                        <ThemedText variant='bodySmall'>
                          {weatherInputsDescription}
                        </ThemedText>
                      </>
                    )}
                  {showPredictiveHeatmap &&
                    heatmapSource === 'classic' &&
                    hasClassicHeatmap &&
                    hasConditions && (
                      <>
                        <SelectionChipGroup
                          options={modelOptions}
                          selectedValue={phenologyMode}
                          title='Classic overlay'
                          onSelect={setPhenologyMode}
                        />
                        <ThemedText variant='bodySmall'>
                          {classicOverlayDescription}
                        </ThemedText>
                      </>
                    )}
                  <ReinforcementDemoSection
                    reinforcement={reinforcement}
                    disabled={!hasInferenceHeatmap}
                  />
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
                feedbackPoints={reinforcement.feedbackPoints}
                loading={occurrenceLoading}
                error={occurrenceError}
                highlightedCatalogs={highlightedCatalogs}
                selectedPoint={selectedMapPoint}
                height={observationMapHeight}
                showMarkers={showObservations}
                pinObservationLabel={
                  reinforcement.enabled
                    ? 'Submit Feedback Point'
                    : 'Highlight in Environmental Features'
                }
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
