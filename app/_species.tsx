// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { usePathname, useLocalSearchParams } from 'expo-router';
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
import {
  toggleFullscreenElement,
  resolveObservationVarFields,
  isPointInPolygon,
  encodePolygonsParam,
} from '@/components/sections/speciesOccurrenceMap/speciesOccurrenceMapHelpers';
import type { ObservationVarFieldsInputs } from '@/components/sections/speciesOccurrenceMap/speciesOccurrenceMapHelpers';
import { SpeciesObservationGallery } from '@/components/sections/SpeciesObservationGallery';
import type { ObservationGalleryPoint } from '@/components/sections/SpeciesObservationGallery';
import {
  DEFAULT_IMAGE_SIZE as OBSERVATION_CARD_WIDTH,
  COMPACT_IMAGE_SIZE as OBSERVATION_CARD_COMPACT_WIDTH,
  type ObservationCardSize,
} from '@/components/cards/ObservationCard';
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
import {
  BACKEND_BASE,
  fetchOccurrenceLookup,
  parseFilenameFromContentDisposition,
} from '@/data/api';
import { Colors, Size } from '@/constants/theme';
import { mountainBallCactusData } from '@/data/speciesSample';
import type {
  SpeciesPageData,
  SpeciesOccurrence,
  OccurrenceLookup,
} from '@/data/types';
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
const GALLERY_ROWS = 3;
const GALLERY_CARD_GAP = Size.space['300'];

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
  const searchParams = useLocalSearchParams<{
    highlightObservation?: string;
  }>();
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
  const { height: viewportHeight, width: viewportWidth } =
    useWindowDimensions();
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
  const [fetchedObservationValues, setFetchedObservationValues] =
    React.useState<Map<string, number> | null>(null);
  const [obsDotMin, setObsDotMin] = React.useState<number | null>(null);
  const [obsDotMax, setObsDotMax] = React.useState<number | null>(null);
  const [obsLabelMin, setObsLabelMin] = React.useState<number | null>(null);
  const [obsLabelMax, setObsLabelMax] = React.useState<number | null>(null);
  const [variableValuesLoading, setVariableValuesLoading] =
    React.useState(false);
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
    occurrences: fetchedOccurrences,
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

  // highlightObservation: deep-linked from /occurrence/{id} (see
  // app/occurrence/[id].tsx) — resolves the observation via the same
  // endpoint that redirect used, and when it's not part of this taxon's
  // normal occurrence set (not yet ingested by GBIF), injects it as a
  // synthetic occurrence below so the existing map/gallery/popup pipeline
  // renders it exactly like any other point, with no separate rendering path.
  const highlightObservationId = React.useMemo(() => {
    const raw = searchParams.highlightObservation;
    return typeof raw === 'string' ? raw.trim() : '';
  }, [searchParams.highlightObservation]);

  const [highlightedOccurrenceLookup, setHighlightedOccurrenceLookup] =
    React.useState<OccurrenceLookup | null>(null);

  React.useEffect(() => {
    setHighlightedOccurrenceLookup(null);
    if (!highlightObservationId) {
      return;
    }
    let cancelled = false;
    fetchOccurrenceLookup(highlightObservationId)
      .then((result) => {
        if (!cancelled) setHighlightedOccurrenceLookup(result);
      })
      .catch(() => {
        if (!cancelled) setHighlightedOccurrenceLookup(null);
      });
    return () => {
      cancelled = true;
    };
  }, [highlightObservationId]);

  // Only injected when NOT ingested — an already-ingested highlighted
  // observation is already part of fetchedOccurrences, so adding it again
  // here would just duplicate it.
  const highlightedSyntheticOccurrence =
    React.useMemo<SpeciesOccurrence | null>(() => {
      if (
        !highlightedOccurrenceLookup ||
        highlightedOccurrenceLookup.ingested ||
        highlightedOccurrenceLookup.latitude == null ||
        highlightedOccurrenceLookup.longitude == null ||
        highlightedOccurrenceLookup.taxonId !== taxonId
      ) {
        return null;
      }
      return {
        catalogNumber: highlightedOccurrenceLookup.catalogNumber,
        latitude: highlightedOccurrenceLookup.latitude,
        longitude: highlightedOccurrenceLookup.longitude,
        mediaUrl: highlightedOccurrenceLookup.mediaUrl,
        mediaAttribution: highlightedOccurrenceLookup.mediaAttribution,
        mediaLicense: highlightedOccurrenceLookup.mediaLicense,
        mediaLicenseUrl: highlightedOccurrenceLookup.mediaLicenseUrl,
      };
    }, [highlightedOccurrenceLookup, taxonId]);

  const occurrencesBeforeRegionFilter = React.useMemo(() => {
    if (!highlightedSyntheticOccurrence) {
      return fetchedOccurrences;
    }
    const alreadyPresent = fetchedOccurrences.some(
      (occ) =>
        String(occ.catalogNumber) ===
        highlightedSyntheticOccurrence.catalogNumber,
    );
    return alreadyPresent
      ? fetchedOccurrences
      : [...fetchedOccurrences, highlightedSyntheticOccurrence];
  }, [fetchedOccurrences, highlightedSyntheticOccurrence]);

  // Hand-drawn region filter — client-side only, against whatever's
  // already been fetched. The draw/cancel/erase buttons themselves live
  // inside the map (SpeciesOccurrenceMap.html's DrawPolygonControl/
  // EraserControl); this side only ever hears the end result via
  // onPolygonDrawn/onPolygonCleared. Each entry is one region's ring
  // vertices as [latitude, longitude] pairs; multiple regions filter as a
  // union (a point counts if it's inside ANY of them); null when none are
  // active.
  const [drawnPolygons, setDrawnPolygons] = React.useState<
    [number, number][][] | null
  >(null);
  const handlePolygonDrawn = React.useCallback(
    (polygons: [number, number][][]) => setDrawnPolygons(polygons),
    [],
  );
  const handlePolygonCleared = React.useCallback(
    () => setDrawnPolygons(null),
    [],
  );

  const occurrences = React.useMemo(() => {
    const activePolygons = drawnPolygons?.filter((ring) => ring.length >= 3);
    if (!activePolygons || activePolygons.length === 0) {
      return occurrencesBeforeRegionFilter;
    }
    return occurrencesBeforeRegionFilter.filter((occ) =>
      activePolygons.some((ring) =>
        isPointInPolygon(occ.latitude, occ.longitude, ring),
      ),
    );
  }, [occurrencesBeforeRegionFilter, drawnPolygons]);

  // Same drawnPolygons a drawn region filters the map/gallery by
  // client-side (see `occurrences` above), encoded for the backend's
  // `polygon` query param — this is what lets the density graphs/
  // histograms in SpeciesEnvironmentSection reflect the drawn region too,
  // the one thing the client-side filter above can't reach on its own.
  // Deliberately NOT gated on isDrawingRegion: while a new shape is being
  // drawn, the already-committed region set here hasn't changed, so the
  // stats should keep reflecting it the whole time, same as `occurrences`
  // does for the gallery.
  const encodedRegionPolygon = React.useMemo(() => {
    const activePolygons = drawnPolygons?.filter((ring) => ring.length >= 3);
    if (!activePolygons || activePolygons.length === 0) {
      return null;
    }
    return encodePolygonsParam(activePolygons);
  }, [drawnPolygons]);

  // While a new region is actively being drawn, show the unfiltered set on
  // the map instead of `occurrences` — otherwise, once one region already
  // filters the map down, there'd be no way to see (or draw around) the
  // other, currently-hidden observations. Bracketed by the map's own
  // in-iframe DrawPolygonControl via onPolygonDrawStart/onPolygonDrawEnd;
  // only affects what the MAP renders, not the gallery/stats below it,
  // which keep using the real (filtered) `occurrences`.
  const [isDrawingRegion, setIsDrawingRegion] = React.useState(false);
  const handlePolygonDrawStart = React.useCallback(
    () => setIsDrawingRegion(true),
    [],
  );
  const handlePolygonDrawEnd = React.useCallback(
    () => setIsDrawingRegion(false),
    [],
  );
  const mapOccurrences = isDrawingRegion
    ? occurrencesBeforeRegionFilter
    : occurrences;

  React.useEffect(() => {
    if (phenologyNoData && selectedPhenology) {
      setSelectedPhenology(null);
    }
  }, [phenologyNoData, selectedPhenology]);

  React.useEffect(() => {
    setHighlightedCatalogs([]);
  }, [finalLocationGid, taxonId]);

  React.useEffect(() => {
    // Don't clear a pin that matches the active highlightObservation deep
    // link — finalLocationGid can still settle (undefined -> resolved) a
    // tick after the auto-pin effect below fires, which used to wipe the
    // pin/popup right back out moments after it appeared.
    setPinnedObservation((prev) => {
      const preserved =
        prev &&
        highlightObservationId &&
        String(prev.catalogNumber) === highlightObservationId;
      return preserved ? prev : null;
    });
  }, [finalLocationGid, taxonId, highlightObservationId]);

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
      setFetchedObservationValues(null);
      setObsDotMin(null);
      setObsDotMax(null);
      setObsLabelMin(null);
      setObsLabelMax(null);
      // Not false: classColors/isCircular/gradientStops recompute to the
      // NEW variable in this exact same render (they're useMemo'd off
      // selectedVariableMeta, set just above) while observationValues/
      // dotMin/dotMax are being cleared to null right here — if
      // variableDataLoading were false for even one render in between, the
      // gated effect in SpeciesOccurrenceMap.tsx would see "new scale, no
      // values yet" and ship that mismatched combo immediately. Setting it
      // true in the SAME call closes the gap completely; the fetch effect
      // below flips it true again redundantly once it starts, which is
      // harmless.
      setVariableValuesLoading(true);
    },
    [],
  );

  React.useEffect(() => {
    if (!taxonId || !selectedVariableMeta?.id || !shouldRenderOccurrenceMap) {
      setFetchedObservationValues(null);
      setVariableValuesLoading(false);
      return;
    }
    const variableId = selectedVariableMeta.id;
    let cancelled = false;
    setVariableValuesLoading(true);
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
          setFetchedObservationValues(map);
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
          setVariableValuesLoading(false);
        },
      )
      .catch(() => {
        if (cancelled) return;
        setFetchedObservationValues(null);
        setVariableValuesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taxonId, selectedVariableMeta, units, shouldRenderOccurrenceMap]);

  // fetchedObservationValues (above) only covers this taxon's normal
  // ingested occurrences — a not-ingested highlighted observation
  // (highlightedSyntheticOccurrence) never has an entry there, which is
  // why its map dot/popup showed as nodata. Look its value up individually
  // via the same /gis/point endpoint the empty-map click-to-query flow
  // uses, passing event_ts when we have one (from the iNat fallback
  // lookup's observation timestamp) so a temporal variable resolves to the
  // value AT THE TIME the observation was made, not the current live
  // window — matching how an ingested observation's value is already
  // historically correct. event_ts is a harmless no-op for non-temporal
  // variables (main.py only consults it when a matching temporal layer
  // exists for the requested variable id), so this doesn't need its own
  // "is this a temporal variable" check on the frontend.
  const [highlightedPointValue, setHighlightedPointValue] = React.useState<
    number | null
  >(null);

  React.useEffect(() => {
    setHighlightedPointValue(null);
    if (
      !highlightedSyntheticOccurrence ||
      !selectedVariableMeta?.id ||
      highlightedSyntheticOccurrence.latitude == null ||
      highlightedSyntheticOccurrence.longitude == null
    ) {
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      lat: String(highlightedSyntheticOccurrence.latitude),
      lon: String(highlightedSyntheticOccurrence.longitude),
      variable: selectedVariableMeta.id,
    });
    if (units) {
      params.set('unit_system', units);
    }
    if (highlightedOccurrenceLookup?.eventTimestamp != null) {
      params.set(
        'event_ts',
        String(highlightedOccurrenceLookup.eventTimestamp),
      );
    }
    fetch(`${BACKEND_BASE}/gis/point?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { value?: number | null }) => {
        if (!cancelled && typeof data.value === 'number') {
          setHighlightedPointValue(data.value);
          // Also drives the legend bar's pinned-value marker
          // (MapVariableLegend/MapCircularLegend) — otherwise it only
          // updates on an explicit marker click (via the map's own
          // event_ts-unaware point-query flow), leaving it blank/stale
          // right after auto-selecting a not-ingested observation on load.
          setPinnedPointValue(data.value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlightedPointValue(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    highlightedSyntheticOccurrence,
    selectedVariableMeta,
    units,
    highlightedOccurrenceLookup,
  ]);

  const observationValues = React.useMemo(() => {
    if (!highlightedSyntheticOccurrence || highlightedPointValue == null) {
      return fetchedObservationValues;
    }
    const merged = new Map(fetchedObservationValues ?? []);
    merged.set(
      String(highlightedSyntheticOccurrence.catalogNumber),
      highlightedPointValue,
    );
    return merged;
  }, [
    fetchedObservationValues,
    highlightedSyntheticOccurrence,
    highlightedPointValue,
  ]);

  // Ordinal variables have no separate accessibility variant — the
  // selected continuous colormap IS their coloring mechanism, always on
  // (unlike cbMode, which is an opt-in accessibility toggle for nominal
  // variables). See util/tiles.py's matching branch for the raster side.
  const isOrdinalVariable =
    selectedVariableMeta?.valueType?.toLowerCase() === 'ordinal';
  const colorMode = isOrdinalVariable ? selectedColormap : cbMode;

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
          getCbColor(variableId, cls.id as number, colorMode, cls.color),
        );
    }
    return map.size > 0 ? map : null;
  }, [selectedVariableMeta, colorMode]);

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
    if (!isVariableCategorical(selectedVariableMeta) || !observationValues) {
      return null;
    }
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
    if (!colorMode) return visibleCategoricalClasses;
    const variableId = selectedVariableMeta?.id ?? '';
    return visibleCategoricalClasses.map((cls) => ({
      ...cls,
      color: getCbColor(
        variableId,
        cls.id as number,
        colorMode,
        cls.color ?? '#888888',
      ),
    }));
  }, [visibleCategoricalClasses, colorMode, selectedVariableMeta]);

  const circularShapesEnabled =
    (shapesEnabled || cbMode === 'achromatopsia') &&
    isVariableCircular(selectedVariableMeta);

  // This map never had a raster overlay for the selected variable at all —
  // only the occurrence markers themselves were colored by it. That's also
  // why the globe/Leaflet templates' "variable" basemap-mode toggle looked
  // like a no-op 2-way toggle in practice: with heatmapTileUrl always null,
  // it had nothing to fall back to but the standard tiles. Mirrors
  // maps.tsx's tileUrl builder — /api/variables/... (not /api/layers/...)
  // since it's resolution-tolerant of either an old variable_id or a real
  // layer_id (_resolve_variable_id on the backend), same as selectedVariableMeta.id
  // already gets used for elsewhere (pointQueryUrl, classShapes lookups).
  const heatmapTileUrl = React.useMemo(() => {
    if (!selectedVariableMeta?.id) return null;
    const isCircular = isVariableCircular(selectedVariableMeta);
    const colormap = isCircular ? selectedCircularColormap : selectedColormap;
    const cbParam = cbMode ? `&cb_mode=${encodeURIComponent(cbMode)}` : '';
    return (
      `${BACKEND_BASE}/api/variables/${encodeURIComponent(selectedVariableMeta.id)}/tiles/{z}/{x}/{y}.png` +
      `?colormap=${encodeURIComponent(colormap)}${cbParam}&unit_system=${encodeURIComponent(units ?? 'metric')}`
    );
  }, [
    selectedVariableMeta,
    selectedColormap,
    selectedCircularColormap,
    cbMode,
    units,
  ]);

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

  // A slice (a histogram-bucket highlight from the environment chart) is a
  // more specific signal than "in view" — when one is active, show exactly
  // what's sliced instead of whatever the map viewport happens to contain.
  const gallerySourceCatalogs = React.useMemo(() => {
    if (highlightedCatalogs.length > 0) {
      return highlightedCatalogs.map((catalog) => String(catalog));
    }
    return occurrences
      .filter((occ) => {
        if (!mapBounds) return true;
        return !(
          occ.latitude < mapBounds.south ||
          occ.latitude > mapBounds.north ||
          occ.longitude < mapBounds.west ||
          occ.longitude > mapBounds.east
        );
      })
      .map((occ) => String(occ.catalogNumber));
  }, [occurrences, highlightedCatalogs, mapBounds]);

  // responsive.contentWidth is a fixed 75rem cap shared by every breakpoint
  // (see wdsResponsiveTokens) — not the actual on-screen width, which on
  // phone is the real device width. Use whichever is smaller so the column
  // math reflects what's actually visible, not the desktop-sized cap.
  const galleryAvailableWidth = Math.min(
    responsive.contentWidth,
    viewportWidth - responsive.marginHorizontal * 2,
  );
  const galleryCardSize: ObservationCardSize =
    responsive.breakpoint === 'phone' ? 'compact' : 'default';
  const galleryCardWidth =
    galleryCardSize === 'compact'
      ? OBSERVATION_CARD_COMPACT_WIDTH
      : OBSERVATION_CARD_WIDTH;
  // How many cards fit per row at the current width, times 3 rows — the
  // gallery always shows exactly 3 rows' worth per page, however many cards
  // that ends up being for the viewport.
  const galleryColumns = Math.max(
    1,
    Math.floor(
      (galleryAvailableWidth + GALLERY_CARD_GAP) /
        (galleryCardWidth + GALLERY_CARD_GAP),
    ),
  );
  const galleryPageSize = galleryColumns * GALLERY_ROWS;

  const [galleryPage, setGalleryPage] = React.useState(0);

  React.useEffect(() => {
    setGalleryPage(0);
  }, [gallerySourceCatalogs]);

  const occurrenceByCatalog = React.useMemo(
    () =>
      new Map(
        occurrences.map((occ) => [String(occ.catalogNumber), occ] as const),
      ),
    [occurrences],
  );

  const handleGalleryCardPress = React.useCallback(
    (catalogNumber: string) => {
      const occ = occurrenceByCatalog.get(catalogNumber);
      if (!occ) return;
      handlePinObservation(catalogNumber, occ.latitude, occ.longitude);
    },
    [occurrenceByCatalog, handlePinObservation],
  );

  // Auto-pin the deep-linked observation once it's available in
  // occurrenceByCatalog — true immediately for an ingested observation
  // (already part of fetchedOccurrences) and once the live lookup resolves
  // for a not-ingested one (highlightedSyntheticOccurrence above). Mirrors
  // handleGalleryCardPress exactly, just triggered on load instead of a
  // click. Guarded by a ref (not state) so it fires once per id and never
  // re-fires just because occurrenceByCatalog gets a new identity.
  //
  // Deliberately does NOT reset the ref when highlightObservationId goes
  // falsy — useLocalSearchParams can report the query param as briefly
  // absent then present again while the route settles (seen on web), and
  // resetting here let this effect re-run handlePinObservation a second
  // time for the same id — which TOGGLES, so the second call silently
  // un-pinned the observation moments after the first call pinned it. The
  // ref now only ever moves forward to a new (different) id.
  const autoPinnedObservationRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!highlightObservationId) {
      return;
    }
    if (autoPinnedObservationRef.current === highlightObservationId) {
      return;
    }
    const occ = occurrenceByCatalog.get(highlightObservationId);
    if (!occ) {
      return;
    }
    autoPinnedObservationRef.current = highlightObservationId;
    handlePinObservation(highlightObservationId, occ.latitude, occ.longitude);
  }, [highlightObservationId, occurrenceByCatalog, handlePinObservation]);

  const galleryPoints = React.useMemo<ObservationGalleryPoint[]>(() => {
    const isCategorical = isVariableCategorical(selectedVariableMeta);
    const isCircular = isVariableCircular(selectedVariableMeta);
    const inputs: ObservationVarFieldsInputs = {
      observationValues,
      classColors,
      classLabels,
      classShapes,
      circularShapesEnabled,
      isCircular,
      dotMin: obsDotMin,
      dotMax: obsDotMax,
      gradientStops:
        selectedVariableMeta && !isCategorical && !isCircular
          ? COLORMAPS[selectedColormap].stops
          : null,
      aspectStops:
        selectedVariableMeta && isCircular
          ? CIRCULAR_COLORMAPS[selectedCircularColormap].stops
          : null,
      varUnits:
        selectedVariableMeta && !isCategorical && !isCircular
          ? (selectedVariableMeta.units ?? null)
          : null,
    };

    const start = galleryPage * galleryPageSize;
    return gallerySourceCatalogs
      .slice(start, start + galleryPageSize)
      .map((catalogNumber) => {
        const { varValue, varColor, varLabel, varShape } =
          resolveObservationVarFields(catalogNumber, inputs);
        const occ = occurrenceByCatalog.get(catalogNumber);
        return {
          catalogNumber,
          catalogAutoGenerated: occ?.catalogAutoGenerated,
          varValue,
          varColor,
          varLabel,
          varShape,
          imageUrl: occ?.mediaUrl,
          license: occ?.mediaLicense,
          licenseUrl: occ?.mediaLicenseUrl,
          attribution: occ?.mediaAttribution,
        };
      });
  }, [
    gallerySourceCatalogs,
    galleryPage,
    galleryPageSize,
    occurrenceByCatalog,
    selectedVariableMeta,
    observationValues,
    classColors,
    classLabels,
    classShapes,
    circularShapesEnabled,
    obsDotMin,
    obsDotMax,
    selectedColormap,
    selectedCircularColormap,
  ]);

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
        ? {
            lat: pinnedObservation.lat,
            lon: pinnedObservation.lon,
            catalogNumber: pinnedObservation.catalogNumber,
          }
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
                  polygon={encodedRegionPolygon}
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
                  occurrences={mapOccurrences}
                  refitOnOccurrencesChange={occurrencesBeforeRegionFilter}
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
                  heatmapTileUrl={heatmapTileUrl}
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
                  variableDataLoading={variableValuesLoading}
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
                  onPolygonDrawn={handlePolygonDrawn}
                  onPolygonCleared={handlePolygonCleared}
                  onPolygonDrawStart={handlePolygonDrawStart}
                  onPolygonDrawEnd={handlePolygonDrawEnd}
                  initialDrawnPolygons={drawnPolygons}
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
                {visibleCategoricalClasses &&
                  selectedVariableMeta &&
                  (isOrdinalVariable ? (
                    // Ordinal has no accessibility-mode picker — the
                    // continuous colormap picker IS its coloring control,
                    // same widget continuous variables use above.
                    <MapColormapPicker
                      selected={selectedColormap}
                      onChange={setSelectedColormap}
                    />
                  ) : (
                    <MapCbModePicker
                      selected={cbMode ?? null}
                      onChange={setCbMode}
                      topClasses={visibleCategoricalClasses.slice(0, 3)}
                      variableId={selectedVariableMeta.id ?? ''}
                      shapesEnabled={shapesEnabled}
                      markerOutlineEnabled={effectiveOutline}
                    />
                  ))}
              </MapScrollLockWrapper>
            )}
          </View>

          {shouldRenderOccurrenceMap && (
            <SectionShell responsive={responsive}>
              <SpeciesObservationGallery
                points={galleryPoints}
                loading={occurrenceLoading}
                onCardPress={handleGalleryCardPress}
                cardSize={galleryCardSize}
                page={galleryPage}
                onPageChange={setGalleryPage}
                pageSize={galleryPageSize}
                totalCount={gallerySourceCatalogs.length}
              />
            </SectionShell>
          )}
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
