// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  SpeciesEnvironmentSection,
  SpeciesOccurrenceMap,
  ThemedText,
} from '@/components';
import { SpeciesLocationFilters } from '@/components/sections/SpeciesLocationFilters';
import { SpeciesObservationGallery } from '@/components/sections/SpeciesObservationGallery';
import type { ObservationGalleryPoint } from '@/components/sections/SpeciesObservationGallery';
import {
  DEFAULT_IMAGE_SIZE as OBSERVATION_CARD_WIDTH,
  COMPACT_IMAGE_SIZE as OBSERVATION_CARD_COMPACT_WIDTH,
  type ObservationCardSize,
} from '@/components/cards/ObservationCard';
import { Size } from '@/constants/theme';
import { SpeciesInformationSection } from '@/components/sections/SpeciesInformationSection';
import type { SpeciesOverview } from '@/data/types';
import { SpeciesDataSourceProvider } from '@/context/SpeciesDataSourceContext';
import { useLayoutChrome } from '@/context/LayoutChromeContext';
import { useAutoAdaptRange } from '@/hooks/useAutoAdaptRange';
import { useResponsive } from '@/hooks/useResponsive';
import { useSpeciesLocationFilters } from '@/hooks/species/useSpeciesLocationFilters';
import { anchorScrollMarginStyle } from '@/utils/anchors';
import type { SpeciesDataSource } from '@/data/speciesDataSource';
import type { UploadedParquetBundle } from '@/data/uploadLocalSpeciesDataSource';
import { UPLOAD_PREVIEW_TAXON_ID } from '@/hooks/upload/useUploadWorkflow';
import {
  isVariableCategorical,
  isVariableCircular,
  type EnvironmentVariableOption,
} from '@/components/sections/speciesEnvironment/model';
import { MapVariableLegend } from '@/components/sections/speciesOccurrenceMap/MapVariableLegend';
import { MapCircularLegend } from '@/components/sections/speciesOccurrenceMap/MapCircularLegend';
import { MapCategoricalLegend } from '@/components/sections/speciesOccurrenceMap/MapCategoricalLegend';
import { MapColormapPicker } from '@/components/sections/speciesOccurrenceMap/MapColormapPicker';
import { MapCircularColormapPicker } from '@/components/sections/speciesOccurrenceMap/MapCircularColormapPicker';
import { MapCbModePicker } from '@/components/sections/speciesOccurrenceMap/MapCbModePicker';
import {
  toggleFullscreenElement,
  resolveObservationVarFields,
  type ObservationVarFieldsInputs,
} from '@/components/sections/speciesOccurrenceMap/speciesOccurrenceMapHelpers';
import {
  COLORMAPS,
  CIRCULAR_COLORMAPS,
} from '@/components/sections/speciesOccurrenceMap/variableColors';
import { getCbShape } from '@/components/sections/speciesOccurrenceMap/cbColors';
import {
  isVariableOrdinal,
  resolveClassDisplayColor,
  resolveColorMode,
  useOrdinalFallbackColor,
} from '@/components/sections/speciesOccurrenceMap/ordinalColorMode';
import type { MapBounds } from '@/components/sections/SpeciesOccurrenceMap';
import { BACKEND_BASE } from '@/data/api';
import { useOptionalSettings } from '@/context/SettingsContext';
import { applyConv, getMetricToImperial } from '@/data/unitConversions';
import { encodePolygonsParam, isPointInPolygon } from '@/utils/geoPolygon';

// Same paging-by-full-rows sizing as app/_species.tsx's observation gallery.
const GALLERY_ROWS = 3;
const GALLERY_CARD_GAP = Size.space['300'];

// SpeciesInformationSection always renders an image — this stands in for an
// uploaded dataset that opted into a description but not an image.
const PLACEHOLDER_IMAGE = require('@/assets/images/placeholder.png');

type UploadPreviewProps = {
  highlightedCatalogs: (number | string)[];
  height: number;
  uploadedBundle: UploadedParquetBundle;
  uploadedDataSource: SpeciesDataSource;
  onHighlightChange: (catalogNumbers: (number | string)[]) => void;
};

type PinnedObservation = {
  catalogNumber: string;
  lat: number;
  lon: number;
};

function UploadSpeciesPreviewSection({
  onHighlightChange,
  pinnedObservation,
  onVariableMetaChange,
  onLocationChange,
  polygon,
}: {
  onHighlightChange: (catalogNumbers: (number | string)[]) => void;
  pinnedObservation: PinnedObservation | null;
  onVariableMetaChange: (meta: EnvironmentVariableOption | null) => void;
  onLocationChange: (gid: string | null) => void;
  polygon: string | null;
}) {
  const settings = useOptionalSettings();
  const units = settings?.units;
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
    taxonId: String(UPLOAD_PREVIEW_TAXON_ID),
    locationSearchLimit: 500,
  });

  React.useEffect(() => {
    onLocationChange(finalLocationGid);
  }, [finalLocationGid, onLocationChange]);

  return (
    <View style={styles.previewSection}>
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
        taxonId={String(UPLOAD_PREVIEW_TAXON_ID)}
        onHighlightChange={onHighlightChange}
        pinnedObservation={pinnedObservation}
        onVariableMetaChange={onVariableMetaChange}
        units={units}
        locationGid={finalLocationGid}
        polygon={polygon}
      />
    </View>
  );
}

export function UploadPreview({
  highlightedCatalogs,
  height,
  uploadedBundle,
  uploadedDataSource,
  onHighlightChange,
}: UploadPreviewProps) {
  const responsive = useResponsive();
  const { webHeaderHeight } = useLayoutChrome();
  const settings = useOptionalSettings();
  const units = settings?.units;
  const selectedColormap = settings?.colormap ?? 'viridis';
  const setSelectedColormap = settings?.setColormap;
  const selectedCircularColormap = settings?.circularColormap ?? 'twilight_90';
  const setSelectedCircularColormap = settings?.setCircularColormap;

  const [finalLocationGid, setFinalLocationGid] = React.useState<string | null>(
    null,
  );
  // Fullscreens the map + its legend/colormap-picker overlays together —
  // see onFullscreenToggle's doc comment on SpeciesOccurrenceMapProps.
  const mapContainerRef = React.useRef<View | null>(null);
  // The location-filtered fetch result — NOT further restricted by a drawn
  // polygon region (that filter is applied client-side below, same as
  // _species.tsx, so it can be toggled off instantly while a new region is
  // being drawn without a re-fetch).
  const [fetchedMapOccurrences, setFetchedMapOccurrences] = React.useState(() =>
    uploadedBundle.occurrences.map((row) => ({
      catalogNumber: row.catalogNumber,
      latitude: row.latitude,
      longitude: row.longitude,
      catalogAutoGenerated: row.catalogAutoGenerated ?? false,
      mediaUrl: row.imageUrl ?? null,
      mediaAttribution: row.mediaAttribution ?? null,
      mediaLicense: row.mediaLicense ?? null,
      mediaLicenseUrl: row.mediaLicenseUrl ?? null,
    })),
  );
  const [pinnedObservation, setPinnedObservation] =
    React.useState<PinnedObservation | null>(null);
  const [selectedVariableMeta, setSelectedVariableMeta] =
    React.useState<EnvironmentVariableOption | null>(null);
  const [mapBounds, setMapBounds] = React.useState<MapBounds | null>(null);
  const [pinnedPointValue, setPinnedPointValue] = React.useState<number | null>(
    null,
  );

  // Hand-drawn region filter — client-side only, against whatever's already
  // been fetched. Mirrors _species.tsx's identical setup: the draw/cancel/
  // erase/upload buttons live inside the map itself (SpeciesOccurrenceMap.
  // html's DrawPolygonControl/EraserControl/UploadPolygonControl); this side
  // only ever hears the end result via onPolygonDrawn/onPolygonCleared.
  // Each entry is one region's ring vertices as [latitude, longitude]
  // pairs; multiple regions filter as a union (a point counts if it's
  // inside ANY of them); null when none are active.
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

  // While a new region is actively being drawn, show the unfiltered set on
  // the map instead of the polygon-filtered one — otherwise, once one
  // region already filters the map down, there'd be no way to see (or draw
  // around) the other, currently-hidden observations. Only affects what the
  // MAP renders, not the stats section below it.
  const [isDrawingRegion, setIsDrawingRegion] = React.useState(false);
  const handlePolygonDrawStart = React.useCallback(
    () => setIsDrawingRegion(true),
    [],
  );
  const handlePolygonDrawEnd = React.useCallback(
    () => setIsDrawingRegion(false),
    [],
  );

  const polygonFilteredOccurrences = React.useMemo(() => {
    const activePolygons = drawnPolygons?.filter((ring) => ring.length >= 3);
    if (!activePolygons || activePolygons.length === 0) {
      return fetchedMapOccurrences;
    }
    return fetchedMapOccurrences.filter((occ) =>
      activePolygons.some((ring) =>
        isPointInPolygon(occ.latitude, occ.longitude, ring),
      ),
    );
  }, [fetchedMapOccurrences, drawnPolygons]);
  const occurrencesForMap = isDrawingRegion
    ? fetchedMapOccurrences
    : polygonFilteredOccurrences;

  // Same drawnPolygons the map/stats-input filters by client-side, encoded
  // for the backend's `polygon` query param — lets the density graphs/
  // histograms in SpeciesEnvironmentSection (backed by the remote data
  // source when online) reflect the drawn region too. The offline data
  // source decodes and applies this same string itself (see
  // uploadLocalSpeciesDataSource.build.ts), so this one encoding covers
  // both online and offline without UploadPreview needing to know which is
  // active.
  const encodedRegionPolygon = React.useMemo(() => {
    const activePolygons = drawnPolygons?.filter((ring) => ring.length >= 3);
    if (!activePolygons || activePolygons.length === 0) {
      return null;
    }
    return encodePolygonsParam(activePolygons);
  }, [drawnPolygons]);

  // catalogNumber must be included here — without it, the map falls back to
  // matching this point by lat/lon float comparison against its own vector
  // tile-rendered coordinates (see SpeciesOccurrenceGlobeMap.html's
  // applySelectedPoint), which can legitimately fail from tile-quantized
  // precision loss and silently drops to a plain "point value only" popup
  // instead of the full observation (id + image) one. Same fix as
  // app/_species.tsx's own selectedMapPoint.
  const selectedMapPoint = React.useMemo(
    () =>
      pinnedObservation
        ? {
            lat: pinnedObservation.lat,
            lon: pinnedObservation.lon,
            catalogNumber: pinnedObservation.catalogNumber,
          }
        : null,
    [pinnedObservation],
  );

  React.useEffect(() => {
    setPinnedObservation(null);
    setFinalLocationGid(null);
    setDrawnPolygons(null);
  }, [uploadedBundle, uploadedDataSource]);

  React.useEffect(() => {
    let cancelled = false;
    uploadedDataSource
      .fetchSpeciesOccurrences(UPLOAD_PREVIEW_TAXON_ID, {
        location: finalLocationGid ?? undefined,
      })
      .then((result) => {
        if (!cancelled) {
          setFetchedMapOccurrences(
            result.occurrences.map((occ) => ({
              catalogNumber: occ.catalogNumber,
              latitude: occ.latitude,
              longitude: occ.longitude,
              catalogAutoGenerated: occ.catalogAutoGenerated ?? false,
              mediaUrl: occ.mediaUrl ?? null,
              mediaAttribution: occ.mediaAttribution ?? null,
              mediaLicense: occ.mediaLicense ?? null,
              mediaLicenseUrl: occ.mediaLicenseUrl ?? null,
            })),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uploadedDataSource, finalLocationGid]);

  React.useEffect(() => {
    setPinnedPointValue(null);
  }, [selectedVariableMeta]);

  const handlePinObservation = React.useCallback(
    (catalogNumber: string, lat: number, lon: number) => {
      setPinnedObservation((previous) => {
        if (
          previous &&
          previous.catalogNumber === catalogNumber &&
          previous.lat === lat &&
          previous.lon === lon
        ) {
          return null;
        }
        return { catalogNumber, lat, lon };
      });
    },
    [],
  );

  // metric name (e.g. "class_19") → numeric code string (e.g. "19") per variable,
  // built from categoricalValueLookup so we can resolve occurrenceIndex classValues.
  const metricToCodeByVariable = React.useMemo(() => {
    const byVar = new Map<string, Map<string, string>>();
    for (const row of uploadedBundle.categoricalValueLookup ?? []) {
      let m = byVar.get(row.variable);
      if (!m) {
        m = new Map();
        byVar.set(row.variable, m);
      }
      m.set(row.metric, row.code);
    }
    return byVar;
  }, [uploadedBundle.categoricalValueLookup]);

  // Build per-observation values from the occurrence index for the selected variable.
  // Categorical: numeric code resolved via lookup. Continuous/range: bin midpoint.
  const observationValues = React.useMemo((): Map<string, number> | null => {
    if (!selectedVariableMeta) return null;
    const variableId = selectedVariableMeta.id;
    const metricToCode = metricToCodeByVariable.get(variableId);

    // Look up the raw metric unit from the bundle (unchanged by display conversion).
    const rawUnit =
      uploadedBundle.variableDefinitions?.find((d) => d.id === variableId)
        ?.units ??
      uploadedBundle.summaryStats.find((s) => s.variable === variableId)
        ?.units ??
      null;
    const conversion =
      units === 'imperial' ? getMetricToImperial(rawUnit) : null;

    const result = new Map<string, number>();
    for (const row of uploadedBundle.occurrenceIndex) {
      if (row.variable !== variableId) continue;
      if (row.mode === 'category' && row.classValue != null) {
        const metric = String(row.classValue);
        const rawCode = metricToCode?.get(metric) ?? metric;
        const code = rawCode.startsWith('class_') ? rawCode.slice(6) : rawCode;
        const v = Number(code);
        if (Number.isFinite(v)) {
          for (const id of row.observationIds) {
            result.set(String(id), v);
          }
        }
      } else if (row.mode === 'range' && row.min != null && row.max != null) {
        const midpoint = (row.min + row.max) / 2;
        const v = conversion
          ? (applyConv(midpoint, conversion) ?? midpoint)
          : midpoint;
        for (const id of row.observationIds) {
          result.set(String(id), v);
        }
      }
    }
    return result.size > 0 ? result : null;
  }, [selectedVariableMeta, uploadedBundle, metricToCodeByVariable, units]);

  const cbMode = settings?.cbMode;
  const isOrdinalVariable = isVariableOrdinal(selectedVariableMeta);
  const colorMode = resolveColorMode(
    isOrdinalVariable,
    selectedColormap,
    cbMode,
  );
  const shapesEnabled = settings?.shapesEnabled ?? false;
  const markerOutlineEnabled =
    (settings?.markerOutlineEnabled ?? false) || cbMode === 'achromatopsia';
  const circularShapesEnabled =
    (shapesEnabled || cbMode === 'achromatopsia') &&
    isVariableCircular(selectedVariableMeta);

  // Same fix as _species.tsx's heatmapTileUrl — this map never had a
  // raster overlay for the selected variable at all, only the occurrence
  // markers themselves were colored by it, which meant the basemap-mode
  // toggle's 'variable' mode had nothing to show here either. Mirrors
  // maps.tsx's tileUrl builder.
  // Auto-adapt only makes sense for a plain numeric gradient — circular
  // (wraparound 0-360°) variables don't have a meaningful "observed
  // min/max" the same way, and categorical variables have no numeric range
  // at all. Mirrors maps.tsx's isAutoAdaptApplicable. Also requires the
  // 'variable' basemap mode actually be active — see _species.tsx's
  // identical addition for why (some variable can be selected without the
  // heatmap overlay itself being shown).
  const isAutoAdaptApplicable =
    settings?.basemapMode === 'variable' &&
    Boolean(selectedVariableMeta) &&
    !isVariableCategorical(selectedVariableMeta) &&
    !isVariableCircular(selectedVariableMeta);
  const {
    autoAdaptEnabled,
    toggleAutoAdapt,
    handleBoundsChange: handleAutoAdaptBoundsChange,
    renderRange: autoAdaptRenderRange,
    effectiveRenderMin,
    effectiveRenderMax,
  } = useAutoAdaptRange({
    selectedVariable: selectedVariableMeta?.id,
    isApplicable: isAutoAdaptApplicable,
    units,
    forecastH: 0,
    catalogRenderMin: selectedVariableMeta?.renderMin,
    catalogRenderMax: selectedVariableMeta?.renderMax,
  });

  const heatmapTileUrl = React.useMemo(() => {
    if (!selectedVariableMeta?.id) return null;
    const isCircular = isVariableCircular(selectedVariableMeta);
    const colormap = isCircular ? selectedCircularColormap : selectedColormap;
    const cbParam = cbMode ? `&cb_mode=${encodeURIComponent(cbMode)}` : '';
    const renderRangeParam = autoAdaptRenderRange
      ? `&render_range=${encodeURIComponent(JSON.stringify(autoAdaptRenderRange))}`
      : '';
    return (
      `${BACKEND_BASE}/api/variables/${encodeURIComponent(selectedVariableMeta.id)}/tiles/{z}/{x}/{y}.png` +
      `?colormap=${encodeURIComponent(colormap)}${cbParam}&unit_system=${encodeURIComponent(units ?? 'metric')}${renderRangeParam}`
    );
  }, [
    selectedVariableMeta,
    selectedColormap,
    selectedCircularColormap,
    cbMode,
    units,
    autoAdaptRenderRange,
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
  // See components/sections/speciesOccurrenceMap/ordinalColorMode.ts for
  // why this fallback exists (a custom layer's variable id was never
  // processed by scripts/gen_colors.py, so getCbColor's precomputed
  // CB_CLASS_COLORS lookup always misses for it, and without this it would
  // freeze on whatever color got baked into the legend when /gis-editor
  // first typed the file as ordinal instead of following the colormap
  // picker). Shared with app/_species.tsx and VariableHeatmapMap.tsx so
  // this logic lives in exactly one place.
  const ordinalFallbackColor = useOrdinalFallbackColor(
    isOrdinalVariable,
    selectedVariableMeta,
    selectedColormap,
  );

  const classColors = React.useMemo((): Map<string, string> | null => {
    if (!selectedVariableMeta || !isVariableCategorical(selectedVariableMeta))
      return null;
    const variableId = selectedVariableMeta.id ?? '';
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta.legendClasses ?? []) {
      // Ordinal classes intentionally carry no raw legend color — see the
      // matching comment in app/_species.tsx's classColors.
      if (cls.color || isOrdinalVariable) {
        map.set(
          String(cls.id),
          resolveClassDisplayColor(
            variableId,
            cls.id as number,
            colorMode,
            cls.color,
            ordinalFallbackColor,
          ),
        );
      }
    }
    return map.size > 0 ? map : null;
  }, [
    selectedVariableMeta,
    colorMode,
    isOrdinalVariable,
    ordinalFallbackColor,
  ]);

  const classShapes = React.useMemo((): Map<string, string> | null => {
    if (!shapesEnabled && cbMode !== 'achromatopsia') return null;
    if (!selectedVariableMeta || !isVariableCategorical(selectedVariableMeta))
      return null;
    const variableId = selectedVariableMeta.id ?? '';
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta.legendClasses ?? []) {
      map.set(String(cls.id), getCbShape(variableId, cls.id as number));
    }
    return map.size > 0 ? map : null;
  }, [selectedVariableMeta, cbMode, shapesEnabled]);

  const classLabels = React.useMemo((): Map<string, string> | null => {
    if (!selectedVariableMeta || !isVariableCategorical(selectedVariableMeta))
      return null;
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta.legendClasses ?? []) {
      map.set(String(cls.id), cls.name);
    }
    return map.size > 0 ? map : null;
  }, [selectedVariableMeta]);

  const { dotMin, dotMax } = React.useMemo(() => {
    if (
      !observationValues ||
      !selectedVariableMeta ||
      isVariableCategorical(selectedVariableMeta) ||
      isVariableCircular(selectedVariableMeta)
    ) {
      return { dotMin: null, dotMax: null };
    }
    const vals = Array.from(observationValues.values()).sort((a, b) => a - b);
    if (vals.length === 0) return { dotMin: null, dotMax: null };
    const pct = (p: number) => {
      const idx = (p / 100) * (vals.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.min(lo + 1, vals.length - 1);
      return vals[lo] + (idx - lo) * (vals[hi] - vals[lo]);
    };
    const mn = vals.length >= 2 ? pct(0.1) : vals[0];
    const mx = vals.length >= 2 ? pct(99.9) : vals[0];
    return Number.isFinite(mn) && Number.isFinite(mx)
      ? { dotMin: mn, dotMax: mx }
      : { dotMin: null, dotMax: null };
  }, [observationValues, selectedVariableMeta]);

  const visibleCategoricalClasses = React.useMemo(() => {
    if (
      !selectedVariableMeta ||
      !isVariableCategorical(selectedVariableMeta) ||
      !observationValues
    )
      return null;
    const classes = selectedVariableMeta.legendClasses;
    if (!classes || classes.length === 0) return null;

    const counts = new Map<string, number>();
    for (const occ of uploadedBundle.occurrences) {
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

    const filtered = classes
      .filter((cls) => counts.has(String(cls.id)))
      .sort(
        (a, b) =>
          (counts.get(String(b.id)) ?? 0) - (counts.get(String(a.id)) ?? 0),
      );

    return filtered.length > 0 ? filtered : null;
  }, [
    selectedVariableMeta,
    observationValues,
    uploadedBundle.occurrences,
    mapBounds,
  ]);

  const cbVisibleCategoricalClasses = React.useMemo(() => {
    if (!visibleCategoricalClasses) return null;
    if (!colorMode) return visibleCategoricalClasses;
    const variableId = selectedVariableMeta?.id ?? '';
    return visibleCategoricalClasses.map((cls) => ({
      ...cls,
      color: resolveClassDisplayColor(
        variableId,
        cls.id as number,
        colorMode,
        cls.color,
        ordinalFallbackColor,
      ),
    }));
  }, [
    visibleCategoricalClasses,
    colorMode,
    selectedVariableMeta,
    ordinalFallbackColor,
  ]);

  // Observation pins: prefer local value (offline-safe); fall back to pinnedPointValue
  // (set by the map's onPointValue when it fires varValue for the clicked dot, or via
  // the API point-query for background clicks).
  const pinnedValue = React.useMemo(() => {
    if (pinnedObservation && observationValues) {
      const v = observationValues.get(pinnedObservation.catalogNumber);
      if (v != null) return v;
    }
    return pinnedPointValue;
  }, [pinnedObservation, observationValues, pinnedPointValue]);

  const isCategorical = selectedVariableMeta
    ? isVariableCategorical(selectedVariableMeta)
    : false;
  const isCircular = selectedVariableMeta
    ? isVariableCircular(selectedVariableMeta)
    : false;

  const pointQueryUrl = selectedVariableMeta
    ? `${BACKEND_BASE}/gis/point?variable=${encodeURIComponent(selectedVariableMeta.id)}${units ? `&unit_system=${encodeURIComponent(units)}` : ''}&colormap=${encodeURIComponent(selectedColormap)}`
    : null;

  // Observation photo gallery — mirrors app/_species.tsx's identical setup
  // (same gallery component, same varValue/varColor resolution, same
  // full-rows-per-page sizing) so an uploaded dataset's occurrences with an
  // image column look and behave the same as real observations.
  const gallerySourceCatalogs = React.useMemo(() => {
    if (highlightedCatalogs.length > 0) {
      return highlightedCatalogs.map((catalog) => String(catalog));
    }
    return occurrencesForMap
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
  }, [occurrencesForMap, highlightedCatalogs, mapBounds]);

  const { width: viewportWidth } = useWindowDimensions();
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
  const galleryColumns = Math.max(
    1,
    Math.floor(
      (galleryAvailableWidth + GALLERY_CARD_GAP) /
        (galleryCardWidth + GALLERY_CARD_GAP),
    ),
  );
  const galleryPageSize = galleryColumns * GALLERY_ROWS;

  const [galleryPage, setGalleryPage] = React.useState(0);
  const gallerySourceCatalogsKey = React.useMemo(
    () => gallerySourceCatalogs.join(','),
    [gallerySourceCatalogs],
  );
  React.useEffect(() => {
    setGalleryPage(0);
  }, [gallerySourceCatalogsKey]);
  const galleryTotalPages = Math.max(
    1,
    Math.ceil(gallerySourceCatalogs.length / galleryPageSize),
  );
  React.useEffect(() => {
    setGalleryPage((page) => Math.min(page, galleryTotalPages - 1));
  }, [galleryTotalPages]);

  const occurrenceByCatalog = React.useMemo(
    () =>
      new Map(
        occurrencesForMap.map(
          (occ) => [String(occ.catalogNumber), occ] as const,
        ),
      ),
    [occurrencesForMap],
  );

  const handleGalleryCardPress = React.useCallback(
    (catalogNumber: string) => {
      const occ = occurrenceByCatalog.get(catalogNumber);
      if (!occ) return;
      handlePinObservation(catalogNumber, occ.latitude, occ.longitude);
    },
    [occurrenceByCatalog, handlePinObservation],
  );

  const galleryPoints = React.useMemo<ObservationGalleryPoint[]>(() => {
    const inputs: ObservationVarFieldsInputs = {
      observationValues,
      classColors,
      classLabels,
      classShapes,
      circularShapesEnabled,
      isCircular,
      dotMin,
      dotMax,
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
          attribution: occ?.mediaAttribution,
          license: occ?.mediaLicense,
          licenseUrl: occ?.mediaLicenseUrl,
        };
      });
  }, [
    gallerySourceCatalogs,
    galleryPage,
    galleryPageSize,
    occurrenceByCatalog,
    observationValues,
    classColors,
    classLabels,
    classShapes,
    circularShapesEnabled,
    dotMin,
    dotMax,
    selectedVariableMeta,
    isCategorical,
    isCircular,
    selectedColormap,
    selectedCircularColormap,
  ]);

  // Same component the real species page uses for its description + image,
  // rather than a separate one-off layout here — the description/image
  // shape (descriptionImage) already matches SpeciesOverview's own fields.
  const descriptionImage = uploadedBundle.descriptionImage;
  const hasDescriptionImage = Boolean(
    descriptionImage &&
    (descriptionImage.imageUrl ||
      (descriptionImage.descriptionSections?.length ?? 0) > 0),
  );
  const descriptionOverview: SpeciesOverview | null = hasDescriptionImage
    ? {
        description: '',
        sections: descriptionImage!.descriptionSections ?? undefined,
        imageSource: descriptionImage!.imageUrl
          ? { uri: descriptionImage!.imageUrl }
          : PLACEHOLDER_IMAGE,
        imageLicense: descriptionImage!.imageLicense ?? undefined,
        imageLicenseUrl: descriptionImage!.imageLicenseUrl ?? undefined,
        imageCreator: descriptionImage!.imageCreator ?? undefined,
        imageRightsHolder: descriptionImage!.imageRightsHolder ?? undefined,
      }
    : null;

  return (
    <SpeciesDataSourceProvider value={uploadedDataSource}>
      {descriptionOverview ? (
        <View
          style={[
            styles.constrainedSection,
            { maxWidth: responsive.contentWidth },
          ]}
        >
          <SpeciesInformationSection
            commonName='Uploaded dataset'
            overview={descriptionOverview}
          />
        </View>
      ) : null}
      <View
        style={[
          styles.constrainedSection,
          { maxWidth: responsive.contentWidth },
        ]}
      >
        <UploadSpeciesPreviewSection
          onHighlightChange={onHighlightChange}
          pinnedObservation={pinnedObservation}
          onVariableMetaChange={setSelectedVariableMeta}
          onLocationChange={setFinalLocationGid}
          polygon={encodedRegionPolygon}
        />
      </View>
      {uploadedBundle.occurrences.length > 0 ? (
        // Deliberately NOT wrapped in constrainedSection — the map goes
        // full-bleed edge to edge, matching the species page's occurrence
        // map (see app/_species.tsx: the map is the one section rendered
        // outside SectionShell's width constraint).
        <View style={styles.mapSection}>
          <ThemedText
            variant='subheading'
            {...(Platform.OS === 'web'
              ? {
                  nativeID: 'species-occurrence-map',
                  style: anchorScrollMarginStyle(
                    webHeaderHeight,
                    responsive.breakpoint,
                  ),
                }
              : {})}
          >
            Species Occurrence Map
          </ThemedText>
          <View ref={mapContainerRef} style={styles.mapContainer}>
            <SpeciesOccurrenceMap
              preserveMapPosition
              occurrences={occurrencesForMap}
              refitOnOccurrencesChange={fetchedMapOccurrences}
              loading={false}
              error={null}
              highlightedCatalogs={highlightedCatalogs}
              height={height}
              linkObservations={false}
              onFullscreenToggle={() =>
                toggleFullscreenElement(
                  mapContainerRef.current as unknown as Element | null,
                )
              }
              onPinObservation={handlePinObservation}
              selectedPoint={selectedMapPoint}
              onMapBounds={setMapBounds}
              onBoundsChange={handleAutoAdaptBoundsChange}
              enableAutoAdaptToggle
              autoAdaptApplicable={isAutoAdaptApplicable}
              autoAdaptEnabled={autoAdaptEnabled}
              onToggleAutoAdapt={toggleAutoAdapt}
              onPointValue={setPinnedPointValue}
              pointQueryUrl={pointQueryUrl}
              heatmapTileUrl={heatmapTileUrl}
              disableObservationQuery={true}
              onPolygonDrawn={handlePolygonDrawn}
              onPolygonCleared={handlePolygonCleared}
              onPolygonDrawStart={handlePolygonDrawStart}
              onPolygonDrawEnd={handlePolygonDrawEnd}
              initialDrawnPolygons={drawnPolygons}
              varUnits={
                !isCategorical && !isCircular
                  ? (selectedVariableMeta?.units ?? null)
                  : null
              }
              observationValues={observationValues}
              classColors={classColors}
              classShapes={classShapes}
              markerOutlineEnabled={markerOutlineEnabled}
              classLabels={classLabels}
              dotMin={dotMin}
              dotMax={dotMax}
              renderMin={isAutoAdaptApplicable ? effectiveRenderMin : null}
              renderMax={isAutoAdaptApplicable ? effectiveRenderMax : null}
              isCircular={isCircular}
              circularShapesEnabled={circularShapesEnabled}
              gradientStops={
                !isCategorical && !isCircular
                  ? COLORMAPS[selectedColormap].stops
                  : null
              }
              aspectStops={
                isCircular
                  ? CIRCULAR_COLORMAPS[selectedCircularColormap].stops
                  : null
              }
            />
            {selectedVariableMeta &&
              !isCategorical &&
              !isCircular &&
              dotMin != null &&
              dotMax != null && (
                <MapVariableLegend
                  min={dotMin}
                  max={dotMax}
                  units={selectedVariableMeta.units}
                  pinnedValue={pinnedValue}
                  barSvgStops={COLORMAPS[selectedColormap].barSvgStops}
                />
              )}
            {selectedVariableMeta &&
              !isCategorical &&
              !isCircular &&
              setSelectedColormap && (
                <MapColormapPicker
                  selected={selectedColormap}
                  onChange={setSelectedColormap}
                />
              )}
            {selectedVariableMeta && isCircular && (
              <MapCircularLegend
                pinnedValue={pinnedValue}
                conicCss={CIRCULAR_COLORMAPS[selectedCircularColormap].conicCss}
                arcSegmentColors={
                  CIRCULAR_COLORMAPS[selectedCircularColormap].arcSegmentColors
                }
                shapesEnabled={circularShapesEnabled}
                markerOutlineEnabled={markerOutlineEnabled}
                nsweColors={nsweColors}
              />
            )}
            {selectedVariableMeta &&
              isCircular &&
              setSelectedCircularColormap && (
                <MapCircularColormapPicker
                  selected={selectedCircularColormap}
                  onChange={setSelectedCircularColormap}
                  cbMode={cbMode}
                  onCbModeChange={settings?.setCbMode}
                  markerOutlineEnabled={markerOutlineEnabled}
                />
              )}
            {cbVisibleCategoricalClasses && (
              <MapCategoricalLegend
                classes={cbVisibleCategoricalClasses}
                variableId={selectedVariableMeta?.id}
                cbMode={cbMode}
                shapesEnabled={shapesEnabled}
                markerOutlineEnabled={markerOutlineEnabled}
              />
            )}
            {visibleCategoricalClasses &&
              selectedVariableMeta &&
              (isOrdinalVariable
                ? setSelectedColormap && (
                    // Ordinal has no accessibility-mode picker — the
                    // continuous colormap picker IS its coloring control,
                    // same widget continuous variables use above.
                    <MapColormapPicker
                      selected={selectedColormap}
                      onChange={setSelectedColormap}
                    />
                  )
                : settings?.setCbMode && (
                    <MapCbModePicker
                      selected={cbMode ?? null}
                      onChange={settings.setCbMode}
                      topClasses={visibleCategoricalClasses.slice(0, 3)}
                      variableId={selectedVariableMeta.id ?? ''}
                      shapesEnabled={shapesEnabled}
                      markerOutlineEnabled={markerOutlineEnabled}
                    />
                  ))}
          </View>
          <View
            style={[
              styles.constrainedSection,
              { maxWidth: responsive.contentWidth },
            ]}
          >
            <SpeciesObservationGallery
              points={galleryPoints}
              onCardPress={handleGalleryCardPress}
              cardSize={galleryCardSize}
              page={galleryPage}
              onPageChange={setGalleryPage}
              pageSize={galleryPageSize}
              totalCount={gallerySourceCatalogs.length}
            />
          </View>
        </View>
      ) : null}
    </SpeciesDataSourceProvider>
  );
}

const styles = StyleSheet.create({
  constrainedSection: {
    width: '100%',
    alignSelf: 'center',
  },
  previewSection: {
    width: '100%',
    gap: Size.space['400'],
  },
  mapSection: {
    width: '100%',
    gap: Size.space['200'],
  },
  mapContainer: {
    position: 'relative',
  },
});
