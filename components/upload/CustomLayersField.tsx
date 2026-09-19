// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { StyleSheet, View } from 'react-native';
import type * as DocumentPicker from 'expo-document-picker';
import { Button, ThemedText } from '@/components';
import { Markdown } from '@/components/markdown/Markdown';
import { findCustomLayersMissingMetadata } from '@/components/upload/customLayers';
import { Size, type Colors } from '@/constants/theme';
import {
  CUSTOM_LAYER_ACCEPTED_EXTENSIONS,
  selectFilesFromPicker,
} from '@/hooks/upload/uploadWorkflowHelpers';

type CustomLayersFieldProps = {
  value: DocumentPicker.DocumentPickerAsset[];
  onChange: (value: DocumentPicker.DocumentPickerAsset[]) => void;
  disabled?: boolean;
  palette: (typeof Colors)['light'] | (typeof Colors)['dark'];
};

export function CustomLayersField({
  value,
  onChange,
  disabled = false,
  palette,
}: CustomLayersFieldProps) {
  const [pickerError, setPickerError] = React.useState<string | null>(null);
  const [missingMetadataNames, setMissingMetadataNames] = React.useState<
    string[]
  >([]);

  React.useEffect(() => {
    let cancelled = false;
    if (value.length === 0) {
      setMissingMetadataNames([]);
      return;
    }
    findCustomLayersMissingMetadata(value).then((names) => {
      if (!cancelled) setMissingMetadataNames(names);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const handleAddLayer = async () => {
    setPickerError(null);
    const { files, errorMessage } = await selectFilesFromPicker({
      // '*/*', not a MIME allowlist: .geojson/.json/.tif often don't carry
      // a MIME type an OS file picker recognizes, so filtering by MIME
      // here can silently hide everything but the one it does recognize
      // (matches RAW_UPLOAD's own '*/*' + allowedExtensions pattern) --
      // the real filtering happens below via allowedExtensions instead.
      pickerType: '*/*',
      allowedExtensions: CUSTOM_LAYER_ACCEPTED_EXTENSIONS,
      invalidSelectionMessage:
        'Unsupported file type. Please select GeoTIFF (.tif/.tiff) or GeoJSON (.geojson/.json) files.',
    });
    if (errorMessage) {
      setPickerError(errorMessage);
      return;
    }
    if (files && files.length > 0) {
      // Re-picking the same name replaces the existing entry instead of
      // duplicating it, matching handleRemove's name-keyed identity.
      const deduped = value.filter(
        (asset) => !files.some((file) => file.name === asset.name),
      );
      onChange([...deduped, ...files]);
    }
  };

  const handleRemove = (name: string) => {
    onChange(value.filter((asset) => asset.name !== name));
  };

  const warningMessage =
    missingMetadataNames.length > 0
      ? `Warning: metadata not detected for the following layers: ${missingMetadataNames.join(', ')}. Please consider filling out their metadata in the [GIS Editor](/gis-editor) before exporting said files, and use the result here instead.`
      : null;

  return (
    <View style={styles.container}>
      <Button
        variant='subtle'
        label='Add custom layer'
        disabled={disabled}
        onPress={() => void handleAddLayer()}
      />
      {value.map((asset) => (
        <View key={asset.name} style={styles.layerRow}>
          <ThemedText
            variant='body'
            style={{ color: palette.text.default.default }}
          >
            {asset.name}
          </ThemedText>
          <Button
            variant='subtle'
            label='Remove'
            disabled={disabled}
            onPress={() => handleRemove(asset.name)}
          />
        </View>
      ))}
      {pickerError ? (
        <ThemedText
          variant='bodySmall'
          style={{ color: palette.text.warning.default }}
        >
          {pickerError}
        </ThemedText>
      ) : null}
      {warningMessage ? (
        <View
          style={[
            styles.warningBox,
            { backgroundColor: palette.background.default.secondary },
          ]}
        >
          <Markdown>{warningMessage}</Markdown>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Size.space['150'],
  },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
    flexWrap: 'wrap',
  },
  warningBox: {
    width: '100%',
    borderRadius: Size.radius['200'],
    padding: Size.space['200'],
  },
});
