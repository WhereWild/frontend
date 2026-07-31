// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

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
import type { MapBounds } from '@/components/sections/SpeciesOccurrenceMap';
import { MapCircularLegend } from '@/components/sections/speciesOccurrenceMap/MapCircularLegend';
import { MapCategoricalLegend } from '@/components/sections/speciesOccurrenceMap/MapCategoricalLegend';
import { MapColormapPicker } from '@/components/sections/speciesOccurrenceMap/MapColormapPicker';
import { MapCircularColormapPicker } from '@/components/sections/speciesOccurrenceMap/MapCircularColormapPicker';
import { MapCbModePicker } from '@/components/sections/speciesOccurrenceMap/MapCbModePicker';
import { toggleFullscreenElement } from '@/components/sections/speciesOccurrenceMap/speciesOccurrenceMapHelpers';
import {
  COLORMAPS,
  CIRCULAR_COLORMAPS,
} from '@/components/sections/speciesOccurrenceMap/variableColors';
import {
  getCbColor,
  getCbShape,
} from '@/components/sections/speciesOccurrenceMap/cbColors';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import {
  isVariableCategorical,
  isVariableCircular,
} from '@/components/sections/speciesEnvironment/model';
import { useScrollLock } from '@/context/ScrollLockContext';
import { BACKEND_BASE, parseFilenameFromContentDisposition } from '@/data/api';
import { Colors, Size } from '@/constants/theme';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesPageData } from '@/data/types';
import {
  deliverProcessedZip,
  getProcessedZipDeliveryStatusMessage,
} from '@/hooks/upload/uploadWorkflowHelpers';
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
  | 'overview'
  | 'nearbySpecies'
  | 'heatmap'
  | 'allObscured'
  | 'taxonRank'
  | 'largeTaxon'
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

// Rendered inside PageScrollContainer so useScrollLock sees the provider.
const MapScrollLockWrapper = React.forwardRef<
  View,
  {
    children: React.ReactNode;
    style?: object;
  }
>(function MapScrollLockWrapper({ children, style }, ref) {
  const { lockScroll, unlockScroll } = useScrollLock();
  return (
    <View
      ref={ref}
      collapsable={false}
      style={style}
      onTouchStart={Platform.OS !== 'web' ? lockScroll : undefined}
      onTouchEnd={Platform.OS !== 'web' ? unlockScroll : undefined}
      onTouchCancel={Platform.OS !== 'web' ? unlockScroll : undefined}
    >
      {children}
    </View>
  );
});

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
    scientificName,
    overview,
    allObscured,
    taxonRank,
    largeTaxon,
  } = data;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const pathname = usePathname();
  const responsive = useResponsive();
  const { webHeaderHeight } = useLayoutChrome();
  const safeAreaInsets = React.useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? SAFE_AREA_INSETS_FALLBACK;

  const {
    units,
    colormap: selectedColormap,
    setColormap: setSelectedColormap,
    circularColormap: selectedCircularColormap,
    setCircularColormap: setSelectedCircularColormap,
    cbMode,
    setCbMode,
    shapesEnabled,
    markerOutlineEnabled,
  } = useSettings();
  const effectiveOutline = markerOutlineEnabled || cbMode === 'achromatopsia';
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

  const shouldRenderOccurrenceMap = Boolean(taxonId) && !largeTaxon;
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
  // Fullscreens the map + its legend/colormap-picker overlays together —
  // see onFullscreenToggle's doc comment on SpeciesOccurrenceMapProps.
  const mapContainerRef = React.useRef<View | null>(null);
  const [pinnedPointValue, setPinnedPointValue] = React.useState<number | null>(
    null,
  );
  const [mapBounds, setMapBounds] = React.useState<MapBounds | null>(null);
  const [observationValues, setObservationValues] = React.useState<Map<
    string,
    number
  > | null>(null);
  const [obsDotMin, setObsDotMin] = React.useState<number | null>(null);
  const [obsDotMax, setObsDotMax] = React.useState<number | null>(null);
  const [obsLabelMin, setObsLabelMin] = React.useState<number | null>(null);
  const [obsLabelMax, setObsLabelMax] = React.useState<number | null>(null);
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
    taxonId: largeTaxon ? undefined : taxonId,
    locationSearchLimit: LOCATION_SEARCH_LIMIT,
  });

  const {
    occurrences,
    loading: occurrenceLoading,
    error: occurrenceError,
    phenologyCounts,
    phenologyNoData,
  } = useSpeciesOccurrences({
    taxonId: largeTaxon ? undefined : taxonId,
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

  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = React.useCallback(async () => {
    if (!taxonId || isDownloading || largeTaxon) {
      return;
    }
    setIsDownloading(true);
    Alert.alert('Download started', `Preparing ${commonName} data…`);
    try {
      const response = await fetch(
        `${BACKEND_BASE}/species/${encodeURIComponent(String(taxonId))}/download`,
      );
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(
          `Failed to download data: ${response.status}${errorBody ? ` ${errorBody}` : ''}`,
        );
      }
      const delivery = await deliverProcessedZip({
        blob: await response.blob(),
        contentType: response.headers.get('content-type'),
        filename:
          parseFilenameFromContentDisposition(
            response.headers.get('content-disposition'),
          ) ?? `${commonName || 'species'}.zip`,
      });
      Alert.alert(
        'Download complete',
        getProcessedZipDeliveryStatusMessage(delivery),
      );
    } catch (error) {
      console.error('Failed to download species data:', error);
      Alert.alert(
        'Download failed',
        error instanceof Error
          ? error.message
          : 'Failed to download species data.',
      );
    } finally {
      setIsDownloading(false);
    }
  }, [commonName, isDownloading, largeTaxon, taxonId]);

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

  const handleMapBounds = React.useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
  }, []);

  const handleVariableMetaChange = React.useCallback(
    (meta: EnvironmentVariableOption | null) => {
      setSelectedVariableMeta(meta);
      setPinnedPointValue(null);
      setObservationValues(null);
      setObsDotMin(null);
      setObsDotMax(null);
      setObsLabelMin(null);
      setObsLabelMax(null);
    },
    [],
  );

  React.useEffect(() => {
    if (!taxonId || !selectedVariableMeta?.id || !shouldRenderOccurrenceMap) {
      setObservationValues(null);
      return;
    }
    const variableId = selectedVariableMeta.id;
    let cancelled = false;
    const url =
      `${BACKEND_BASE}/species/${encodeURIComponent(String(taxonId))}` +
      `/environment/${encodeURIComponent(variableId)}/observation-values` +
      (units ? `?unit_system=${encodeURIComponent(units)}` : '');
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(
        (data: {
          observations?: { catalogNumber: string | number; value: number }[];
          min?: number | null;
          max?: number | null;
          q01?: number | null;
          q99?: number | null;
        }) => {
          if (cancelled) return;
          const map = new Map<string, number>();
          for (const obs of data.observations ?? []) {
            if (obs.catalogNumber != null && typeof obs.value === 'number') {
              map.set(String(obs.catalogNumber), obs.value);
            }
          }
          setObservationValues(map);
          setObsDotMin(
            typeof data.q01 === 'number'
              ? data.q01
              : typeof data.min === 'number'
                ? data.min
                : null,
          );
          setObsDotMax(
            typeof data.q99 === 'number'
              ? data.q99
              : typeof data.max === 'number'
                ? data.max
                : null,
          );
          setObsLabelMin(typeof data.min === 'number' ? data.min : null);
          setObsLabelMax(typeof data.max === 'number' ? data.max : null);
        },
      )
      .catch(() => {
        if (!cancelled) setObservationValues(null);
      });
    return () => {
      cancelled = true;
    };
  }, [taxonId, selectedVariableMeta, units, shouldRenderOccurrenceMap]);

  const classShapes = React.useMemo(() => {
    if (!shapesEnabled && cbMode !== 'achromatopsia') return null;
    if (!isVariableCategorical(selectedVariableMeta)) return null;
    const variableId = selectedVariableMeta?.id ?? '';
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta?.legendClasses ?? []) {
      map.set(String(cls.id), getCbShape(variableId, cls.id as number));
    }
    return map.size > 0 ? map : null;
  }, [selectedVariableMeta, cbMode, shapesEnabled]);

  const classColors = React.useMemo(() => {
    if (!isVariableCategorical(selectedVariableMeta)) return null;
    const isLandcover = selectedVariableMeta?.id === 'landcover';
    const variableId = selectedVariableMeta?.id ?? '';
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta?.legendClasses ?? []) {
      if (isLandcover && cls.id === 0) continue;
      if (cls.color)
        map.set(
          String(cls.id),
          getCbColor(variableId, cls.id as number, cbMode, cls.color),
        );
    }
    return map.size > 0 ? map : null;
  }, [selectedVariableMeta, cbMode]);

  const classLabels = React.useMemo(() => {
    if (!isVariableCategorical(selectedVariableMeta)) return null;
    const isLandcover = selectedVariableMeta?.id === 'landcover';
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta?.legendClasses ?? []) {
      if (isLandcover && cls.id === 0) continue;
      map.set(String(cls.id), cls.name);
    }
    return map.size > 0 ? map : null;
  }, [selectedVariableMeta]);

  const visibleCategoricalClasses = React.useMemo(() => {
    if (!isVariableCategorical(selectedVariableMeta) || !observationValues)
      return null;
    const isLandcover = selectedVariableMeta?.id === 'landcover';
    const counts = new Map<string, number>();
    for (const occ of occurrences) {
      if (
        mapBounds &&
        (occ.latitude < mapBounds.south ||
          occ.latitude > mapBounds.north ||
          occ.longitude < mapBounds.west ||
          occ.longitude > mapBounds.east)
      ) {
        continue;
      }
      const val = observationValues.get(String(occ.catalogNumber));
      if (val == null) continue;
      const key = String(Math.round(val));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const classes = (selectedVariableMeta?.legendClasses ?? [])
      .filter(
        (cls) => !(isLandcover && cls.id === 0) && counts.has(String(cls.id)),
      )
      .sort(
        (a, b) =>
          (counts.get(String(b.id)) ?? 0) - (counts.get(String(a.id)) ?? 0),
      );
    return classes.length > 0 ? classes : null;
  }, [selectedVariableMeta, observationValues, occurrences, mapBounds]);

  const cbVisibleCategoricalClasses = React.useMemo(() => {
    if (!visibleCategoricalClasses) return null;
    if (!cbMode) return visibleCategoricalClasses;
    const variableId = selectedVariableMeta?.id ?? '';
    return visibleCategoricalClasses.map((cls) => ({
      ...cls,
      color: getCbColor(
        variableId,
        cls.id as number,
        cbMode,
        cls.color ?? '#888888',
      ),
    }));
  }, [visibleCategoricalClasses, cbMode, selectedVariableMeta]);

  const circularShapesEnabled =
    (shapesEnabled || cbMode === 'achromatopsia') &&
    isVariableCircular(selectedVariableMeta);

  const nsweColors = React.useMemo((): [string, string, string, string] => {
    const stops = CIRCULAR_COLORMAPS[selectedCircularColormap].stops;
    const n = stops.length;
    return [0, 90, 180, 270].map((deg) => {
      const t = (((deg % 360) + 360) % 360) / 360;
      const fi = t * n;
      const i = Math.floor(fi) % n;
      const f = fi - Math.floor(fi);
      const c0 = stops[i],
        c1 = stops[(i + 1) % n];
      return `rgb(${Math.round(c0[0] + f * (c1[0] - c0[0]))},${Math.round(c0[1] + f * (c1[1] - c0[1]))},${Math.round(c0[2] + f * (c1[2] - c0[2]))})`;
    }) as [string, string, string, string];
  }, [selectedCircularColormap]);

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
              isDownloading={isDownloading}
              downloadDisabled={largeTaxon}
            />

            <SectionShell responsive={responsive}>
              <SpeciesInformationSection
                commonName={commonName}
                overview={overview}
                allObscured={allObscured}
              />
            </SectionShell>

            {Boolean(taxonId) && (
              <SectionShell responsive={responsive}>
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
                  disabled={largeTaxon}
                />

                <SpeciesObservationFilters
                  selectedPhenology={selectedPhenology}
                  onPhenologyChange={setSelectedPhenology}
                  phenologyCounts={phenologyCounts}
                  disabled={largeTaxon}
                />

                <SpeciesEnvironmentSection
                  taxonId={taxonId}
                  taxonRank={taxonRank}
                  largeTaxon={largeTaxon}
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

          {largeTaxon && Boolean(taxonId) && (
            <SectionShell responsive={responsive}>
              <View
                style={{
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 12,
                  backgroundColor: palette.background.warning.secondary,
                  borderColor: palette.border.warning.default,
                }}
              >
                <ThemedText
                  variant='bodySmall'
                  style={{ color: palette.text.warning.default }}
                >
                  Too many observations to display on map. Filters, slicing, and
                  downloading are disabled for this taxon.
                </ThemedText>
              </View>
            </SectionShell>
          )}

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
              <MapScrollLockWrapper
                ref={mapContainerRef}
                style={{ position: 'relative' }}
              >
                <SpeciesOccurrenceMap
                  preserveMapPosition
                  onFullscreenToggle={() =>
                    toggleFullscreenElement(
                      mapContainerRef.current as unknown as Element | null,
                    )
                  }
                  occurrences={occurrences}
                  loading={occurrenceLoading}
                  error={occurrenceError}
                  highlightedCatalogs={highlightedCatalogs}
                  selectedPoint={selectedMapPoint}
                  height={observationMapHeight}
                  minZoom={0}
                  onPinObservation={handlePinObservation}
                  onPointValue={handleMapPointValue}
                  onMapBounds={handleMapBounds}
                  pointQueryUrl={
                    selectedVariableMeta?.id
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
                  isCircular={isVariableCircular(selectedVariableMeta)}
                  observationValues={observationValues}
                  classColors={classColors}
                  classLabels={classLabels}
                  classShapes={classShapes}
                  markerOutlineEnabled={effectiveOutline}
                  circularShapesEnabled={circularShapesEnabled}
                  dotMin={obsDotMin}
                  dotMax={obsDotMax}
                  varUnits={
                    selectedVariableMeta &&
                    !isVariableCategorical(selectedVariableMeta) &&
                    !isVariableCircular(selectedVariableMeta)
                      ? (selectedVariableMeta.units ?? null)
                      : null
                  }
                  gradientStops={
                    selectedVariableMeta &&
                    !isVariableCategorical(selectedVariableMeta) &&
                    !isVariableCircular(selectedVariableMeta)
                      ? COLORMAPS[selectedColormap].stops
                      : null
                  }
                  aspectStops={
                    selectedVariableMeta &&
                    isVariableCircular(selectedVariableMeta)
                      ? CIRCULAR_COLORMAPS[selectedCircularColormap].stops
                      : null
                  }
                />
                {selectedVariableMeta &&
                  !isVariableCategorical(selectedVariableMeta) &&
                  !isVariableCircular(selectedVariableMeta) &&
                  obsLabelMin != null &&
                  obsLabelMax != null && (
                    <MapVariableLegend
                      min={obsLabelMin}
                      max={obsLabelMax}
                      units={selectedVariableMeta.units}
                      pinnedValue={pinnedPointValue}
                      barSvgStops={COLORMAPS[selectedColormap].barSvgStops}
                    />
                  )}
                {selectedVariableMeta &&
                  !isVariableCategorical(selectedVariableMeta) &&
                  !isVariableCircular(selectedVariableMeta) && (
                    <MapColormapPicker
                      selected={selectedColormap}
                      onChange={setSelectedColormap}
                    />
                  )}
                {selectedVariableMeta &&
                  isVariableCircular(selectedVariableMeta) && (
                    <MapCircularLegend
                      pinnedValue={pinnedPointValue}
                      conicCss={
                        CIRCULAR_COLORMAPS[selectedCircularColormap].conicCss
                      }
                      arcSegmentColors={
                        CIRCULAR_COLORMAPS[selectedCircularColormap]
                          .arcSegmentColors
                      }
                      shapesEnabled={circularShapesEnabled}
                      markerOutlineEnabled={effectiveOutline}
                      nsweColors={nsweColors}
                    />
                  )}
                {selectedVariableMeta &&
                  isVariableCircular(selectedVariableMeta) && (
                    <MapCircularColormapPicker
                      selected={selectedCircularColormap}
                      onChange={setSelectedCircularColormap}
                      cbMode={cbMode}
                      onCbModeChange={setCbMode}
                      markerOutlineEnabled={effectiveOutline}
                    />
                  )}
                {cbVisibleCategoricalClasses && (
                  <MapCategoricalLegend
                    classes={cbVisibleCategoricalClasses}
                    variableId={selectedVariableMeta?.id}
                    cbMode={cbMode}
                    shapesEnabled={shapesEnabled}
                    markerOutlineEnabled={effectiveOutline}
                  />
                )}
                {visibleCategoricalClasses && selectedVariableMeta && (
                  <MapCbModePicker
                    selected={cbMode ?? null}
                    onChange={setCbMode}
                    topClasses={visibleCategoricalClasses.slice(0, 3)}
                    variableId={selectedVariableMeta.id ?? ''}
                    shapesEnabled={shapesEnabled}
                    markerOutlineEnabled={effectiveOutline}
                  />
                )}
              </MapScrollLockWrapper>
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
