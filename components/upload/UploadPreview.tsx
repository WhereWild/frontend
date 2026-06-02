import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SpeciesEnvironmentSection, SpeciesOccurrenceMap } from '@/components';
import { Size } from '@/constants/theme';
import { SpeciesDataSourceProvider } from '@/context/SpeciesDataSourceContext';
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
import type { MapBounds } from '@/components/sections/SpeciesOccurrenceMap';
import { BACKEND_BASE } from '@/data/api';

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
}: {
  onHighlightChange: (catalogNumbers: (number | string)[]) => void;
  pinnedObservation: PinnedObservation | null;
  onVariableMetaChange: (meta: EnvironmentVariableOption | null) => void;
}) {
  return (
    <View style={styles.previewSection}>
      <SpeciesEnvironmentSection
        taxonId={UPLOAD_PREVIEW_TAXON_ID}
        onHighlightChange={onHighlightChange}
        pinnedObservation={pinnedObservation}
        onVariableMetaChange={onVariableMetaChange}
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
  }, [uploadedBundle, uploadedDataSource]);

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
        for (const id of row.observationIds) {
          result.set(String(id), midpoint);
        }
      }
    }
    return result.size > 0 ? result : null;
  }, [
    selectedVariableMeta,
    uploadedBundle.occurrenceIndex,
    metricToCodeByVariable,
  ]);

  const classColors = React.useMemo((): Map<string, string> | null => {
    if (!selectedVariableMeta || !isVariableCategorical(selectedVariableMeta))
      return null;
    const map = new Map<string, string>();
    for (const cls of selectedVariableMeta.legendClasses ?? []) {
      if (cls.color) map.set(String(cls.id), cls.color);
    }
    return map.size > 0 ? map : null;
  }, [selectedVariableMeta]);

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
    ? `${BACKEND_BASE}/gis/point?variable=${encodeURIComponent(selectedVariableMeta.id)}`
    : null;

  return (
    <SpeciesDataSourceProvider value={uploadedDataSource}>
      <UploadSpeciesPreviewSection
        onHighlightChange={onHighlightChange}
        pinnedObservation={pinnedObservation}
        onVariableMetaChange={setSelectedVariableMeta}
      />
      {uploadedBundle.occurrences.length > 0 ? (
        <View style={styles.mapContainer}>
          <SpeciesOccurrenceMap
            occurrences={uploadedBundle.occurrences.map((row) => ({
              catalogNumber: row.catalogNumber,
              latitude: row.latitude,
              longitude: row.longitude,
            }))}
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
            observationValues={observationValues}
            classColors={classColors}
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
              />
            )}
          {selectedVariableMeta && isCircular && (
            <MapCircularLegend pinnedValue={pinnedValue} />
          )}
          {visibleCategoricalClasses && (
            <MapCategoricalLegend classes={visibleCategoricalClasses} />
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
