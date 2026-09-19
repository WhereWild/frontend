// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type * as DocumentPicker from 'expo-document-picker';
import { Button, ThemedText } from '@/components';
import { SwitchField } from '@/components/inputs/SwitchField';
import { Size, type Colors } from '@/constants/theme';
import {
  IMAGE_UPLOAD_ACCEPTED_EXTENSIONS,
  IMAGE_UPLOAD_PICKER_MIME_TYPES,
  selectFileFromPicker,
} from '@/hooks/upload/uploadWorkflowHelpers';
import { CustomLayersField } from './CustomLayersField';
import {
  ParentTaxonSearchField,
  type ParentTaxonSelection,
} from './ParentTaxonSearchField';

export type UploadExtraOptionsValue = {
  generateDescription: boolean;
  image: DocumentPicker.DocumentPickerAsset | null;
  imageUrl: string;
  /** Ranks this upload's own computed stats against this taxon's real
   * precomputed sibling index -- see main.py's upload_raw_observations. */
  parentTaxon: ParentTaxonSelection | null;
  /** Raster/vector file(s) authored or edited via /gis-editor -- sampled
   * entirely client-side, never uploaded as raw files themselves. See
   * components/upload/customLayers.ts. */
  customLayers: DocumentPicker.DocumentPickerAsset[];
};

export const EMPTY_UPLOAD_EXTRA_OPTIONS: UploadExtraOptionsValue = {
  generateDescription: false,
  image: null,
  imageUrl: '',
  parentTaxon: null,
  customLayers: [],
};

type UploadExtraOptionsProps = {
  value: UploadExtraOptionsValue;
  onChange: (value: UploadExtraOptionsValue) => void;
  disabled?: boolean;
  palette: (typeof Colors)['light'] | (typeof Colors)['dark'];
};

export function UploadExtraOptions({
  value,
  onChange,
  disabled = false,
  palette,
}: UploadExtraOptionsProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [pickerError, setPickerError] = React.useState<string | null>(null);

  const handlePickImage = async () => {
    setPickerError(null);
    const { file, errorMessage } = await selectFileFromPicker({
      pickerType: [...IMAGE_UPLOAD_PICKER_MIME_TYPES],
      allowedExtensions: IMAGE_UPLOAD_ACCEPTED_EXTENSIONS,
      invalidSelectionMessage:
        'Unsupported image type. Please select a JPG, PNG, GIF, or WebP file.',
    });
    if (errorMessage) {
      setPickerError(errorMessage);
      return;
    }
    if (file) {
      onChange({ ...value, image: file });
    }
  };

  const textInputStyle = [
    styles.textInput,
    {
      borderColor: palette.border.default.secondary,
      backgroundColor: palette.background.default.default,
      color: palette.text.default.default,
    },
  ];

  return (
    <View style={styles.container}>
      <Button
        variant='subtle'
        label={expanded ? 'Hide extra options' : 'Extra options'}
        onPress={() => setExpanded((prev) => !prev)}
      />
      {expanded ? (
        <View
          style={[
            styles.panel,
            { borderColor: palette.border.default.secondary },
          ]}
        >
          <SwitchField
            label='Generate description'
            value={value.generateDescription}
            disabled={disabled}
            onValueChange={(generateDescription) =>
              onChange({ ...value, generateDescription })
            }
          />
          <ThemedText
            variant='bodyEmphasis'
            style={{ color: palette.text.default.default }}
          >
            Image
          </ThemedText>
          <View style={styles.imageRow}>
            <Button
              variant='subtle'
              label={value.image ? value.image.name : 'Choose an image'}
              disabled={disabled}
              onPress={() => void handlePickImage()}
            />
            {value.image ? (
              <Button
                variant='subtle'
                label='Clear'
                disabled={disabled}
                onPress={() => onChange({ ...value, image: null })}
              />
            ) : null}
          </View>
          {pickerError ? (
            <ThemedText
              variant='bodySmall'
              style={{ color: palette.text.warning.default }}
            >
              {pickerError}
            </ThemedText>
          ) : null}
          <TextInput
            style={textInputStyle}
            value={value.imageUrl}
            onChangeText={(imageUrl) => onChange({ ...value, imageUrl })}
            placeholder='Or paste an image URL'
            placeholderTextColor={palette.text.default.secondary}
            editable={!disabled}
          />
          <ThemedText
            variant='bodyEmphasis'
            style={{ color: palette.text.default.default }}
          >
            Parent taxon
          </ThemedText>
          <ParentTaxonSearchField
            value={value.parentTaxon}
            onChange={(parentTaxon) => onChange({ ...value, parentTaxon })}
            disabled={disabled}
            palette={palette}
          />
          <ThemedText
            variant='bodyEmphasis'
            style={{ color: palette.text.default.default }}
          >
            Custom layers
          </ThemedText>
          <CustomLayersField
            value={value.customLayers}
            onChange={(customLayers) => onChange({ ...value, customLayers })}
            disabled={disabled}
            palette={palette}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Size.space['200'],
    marginBottom: Size.space['300'],
  },
  panel: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    padding: Size.space['300'],
    gap: Size.space['200'],
  },
  imageRow: {
    flexDirection: 'row',
    gap: Size.space['200'],
    flexWrap: 'wrap',
  },
  textInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    paddingVertical: Size.space['150'],
    paddingHorizontal: Size.space['200'],
  },
});
