// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SpeciesEnvironmentSection, SpeciesOccurrenceMap } from '@/components';
import { SpeciesLocationFilters } from '@/components/sections/SpeciesLocationFilters';
import { Size } from '@/constants/theme';
import { SpeciesDataSourceProvider } from '@/context/SpeciesDataSourceContext';
import { useSpeciesLocationFilters } from '@/hooks/species/useSpeciesLocationFilters';
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
  COLORMAPS,
  CIRCULAR_COLORMAPS,
} from '@/components/sections/speciesOccurrenceMap/variableColors';
import {
  getCbColor,
  getCbShape,
} from '@/components/sections/speciesOccurrenceMap/cbColors';
import type { MapBounds } from '@/components/sections/SpeciesOccurrenceMap';
import { BACKEND_BASE } from '@/data/api';
import { useOptionalSettings } from '@/context/SettingsContext';
import { applyConv, getMetricToImperial } from '@/data/unitConversions';

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
}: {
  onHighlightChange: (catalogNumbers: (number | string)[]) => void;
  pinnedObservation: PinnedObservation | null;
  onVariableMetaChange: (meta: EnvironmentVariableOption | null) => void;
  onLocationChange: (gid: string | null) => void;
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
    taxonId: UPLOAD_PREVIEW_TAXON_ID,
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
        taxonId={UPLOAD_PREVIEW_TAXON_ID}
        onHighlightChange={onHighlightChange}
        pinnedObservation={pinnedObservation}
        onVariableMetaChange={onVariableMetaChange}
        units={units}
        locationGid={finalLocationGid}
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
  const settings = useOptionalSettings();
  const units = settings?.units;
  const selectedColormap = settings?.colormap ?? 'viridis';
  const setSelectedColormap = settings?.setColormap;
  const selectedCircularColormap = settings?.circularColormap ?? 'twilight_90';
  const setSelectedCircularColormap = settings?.setCircularColormap;

  const [finalLocationGid, setFinalLocationGid] = React.useState<string | null>(
    null,
  );
  const [mapOccurrences, setMapOccurrences] = React.useState(() =>
    uploadedBundle.occurrences.map((row) => ({
      catalogNumber: row.catalogNumber,
      latitude: row.latitude,
      longitude: row.longitude,
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

  const selectedMapPoint = React.useMemo(
    () =>
      pinnedObservation
        ? { lat: pinnedObservation.lat, lon: pinnedObservation.lon }
        : null,
    [pinnedObservation],
  );

  React.useEffect(() => {
    setPinnedObservation(null);
    setFinalLocationGid(null);
  }, [uploadedBundle, uploadedDataSource]);

  React.useEffect(() => {
    let cancelled = false;
    uploadedDataSource
      .fetchSpeciesOccurrences(UPLOAD_PREVIEW_TAXON_ID, {
        location: finalLocationGid ?? undefined,
      })
      .then((result) => {
        if (!cancelled) {
          setMapOccurrences(
            result.occurrences.map((occ) => ({
              catalogNumber: occ.catalogNumber,
              latitude: occ.latitude,
              longitude: occ.longitude,
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
  const shapesEnabled = settings?.shapesEnabled ?? false;
  const markerOutlineEnabled =
    (settings?.markerOutlineEnabled ?? false) || cbMode === 'achromatopsia';
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
  const classColors = React.useMemo((): Map<string, string> | null => {
    if (!selectedVariableMeta || !isVariableCategorical(selectedVariableMeta))
      return null;
    const variableId = selectedVariableMeta.id ?? '';
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta.legendClasses ?? []) {
      if (cls.color)
        map.set(
          String(cls.id),
          getCbColor(variableId, cls.id as number, cbMode, cls.color),
        );
    }
    return map.size > 0 ? map : null;
  }, [selectedVariableMeta, cbMode]);

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
    let mn = Infinity;
    let mx = -Infinity;
    for (const v of observationValues.values()) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
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
    ? `${BACKEND_BASE}/gis/point?variable=${encodeURIComponent(selectedVariableMeta.id)}${units ? `&unit_system=${encodeURIComponent(units)}` : ''}`
    : null;

  return (
    <SpeciesDataSourceProvider value={uploadedDataSource}>
      <UploadSpeciesPreviewSection
        onHighlightChange={onHighlightChange}
        pinnedObservation={pinnedObservation}
        onVariableMetaChange={setSelectedVariableMeta}
        onLocationChange={setFinalLocationGid}
      />
      {uploadedBundle.occurrences.length > 0 ? (
        <View style={styles.mapContainer}>
          <SpeciesOccurrenceMap
            occurrences={mapOccurrences}
            loading={false}
            error={null}
            highlightedCatalogs={highlightedCatalogs}
            height={height}
            linkObservations={false}
            onPinObservation={handlePinObservation}
            selectedPoint={selectedMapPoint}
            onMapBounds={setMapBounds}
            onPointValue={setPinnedPointValue}
            pointQueryUrl={pointQueryUrl}
            disableObservationQuery={true}
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
            renderMin={
              !isCategorical && !isCircular
                ? (selectedVariableMeta?.renderMin ?? null)
                : null
            }
            renderMax={
              !isCategorical && !isCircular
                ? (selectedVariableMeta?.renderMax ?? null)
                : null
            }
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
            settings?.setCbMode && (
              <MapCbModePicker
                selected={cbMode ?? null}
                onChange={settings.setCbMode}
                topClasses={visibleCategoricalClasses.slice(0, 3)}
                variableId={selectedVariableMeta.id ?? ''}
                shapesEnabled={shapesEnabled}
                markerOutlineEnabled={markerOutlineEnabled}
              />
            )}
        </View>
      ) : null}
    </SpeciesDataSourceProvider>
  );
}

const styles = StyleSheet.create({
  previewSection: {
    width: '100%',
    gap: Size.space['400'],
  },
  mapContainer: {
    position: 'relative',
  },
});
