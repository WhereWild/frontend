import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SpeciesEnvironmentSection, SpeciesOccurrenceMap } from '@/components';
import { Size } from '@/constants/theme';
import { SpeciesDataSourceProvider } from '@/context/SpeciesDataSourceContext';
import type { SpeciesDataSource } from '@/data/speciesDataSource';
import type { UploadedParquetBundle } from '@/data/uploadLocalSpeciesDataSource';
import { UPLOAD_PREVIEW_TAXON_ID } from '@/hooks/upload/useUploadWorkflow';

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
}: {
  onHighlightChange: (catalogNumbers: (number | string)[]) => void;
  pinnedObservation: PinnedObservation | null;
}) {
  return (
    <View style={styles.previewSection}>
      <SpeciesEnvironmentSection
        taxonId={UPLOAD_PREVIEW_TAXON_ID}
        onHighlightChange={onHighlightChange}
        pinnedObservation={pinnedObservation}
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
  const [pinnedObservation, setPinnedObservation] = React.useState<PinnedObservation | null>(null);

  React.useEffect(() => {
    setPinnedObservation(null);
  }, [uploadedBundle, uploadedDataSource]);

  const handlePinObservation = React.useCallback((catalogNumber: string, lat: number, lon: number) => {
    setPinnedObservation((previous) => {
      if (
        previous
        && previous.catalogNumber === catalogNumber
        && previous.lat === lat
        && previous.lon === lon
      ) {
        return null;
      }

      return { catalogNumber, lat, lon };
    });
  }, []);

  return (
    <SpeciesDataSourceProvider value={uploadedDataSource}>
      <UploadSpeciesPreviewSection
        onHighlightChange={onHighlightChange}
        pinnedObservation={pinnedObservation}
      />
      {uploadedBundle.occurrences.length > 0 ? (
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
        />
      ) : null}
    </SpeciesDataSourceProvider>
  );
}

const styles = StyleSheet.create({
  previewSection: {
    width: '100%',
    gap: Size.space['400'],
  },
});
