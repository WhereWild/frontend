// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The shapefile counterpart of MetadataPanel.tsx + MetadataEditor.tsx
// combined into one panel: read-only file metadata, then the editable
// styling (single flat color, or categorical by an attribute field —
// same "one row per class, always a color, only nominal-equivalent lets
// you rename" shape as the raster nominal legend editor).

import React from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components';
import {
  SelectField,
  type SelectOption,
} from '@/components/inputs/SelectField';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type {
  GeoJsonFeatureCollection,
  VectorMetadata,
} from './shapefileMetadata';
import {
  withCategoricalField,
  withClassColor,
  withClassName,
  withSingleColor,
  type VectorEditableMeta,
} from './vectorEditableMeta';

const MODE_OPTIONS: SelectOption[] = [
  { label: 'Single color', value: 'single' },
  { label: 'Categorical (by field)', value: 'categorical' },
];

const ColorInput = ({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) =>
  Platform.OS === 'web'
    ? React.createElement('input', {
        type: 'color',
        value,
        onChange: (e: { target: { value: string } }) =>
          onChange(e.target.value),
        style: {
          width: 32,
          height: 32,
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
        },
        'aria-label': label,
      })
    : null;

export function VectorEditor({
  metadata,
  editable,
  geojson,
  onChange,
}: {
  metadata: VectorMetadata;
  editable: VectorEditableMeta;
  geojson: GeoJsonFeatureCollection;
  onChange: (next: VectorEditableMeta) => void;
}) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const textInputStyle = {
    color: palette.text.default.default,
    borderColor: palette.border.default.secondary,
  };

  const fieldOptions: SelectOption[] = metadata.fields.map((f) => ({
    label: f.name,
    value: f.name,
  }));

  const rows: [string, string][] = [
    ['Features', String(metadata.featureCount)],
    ['Geometry', metadata.geometryType ?? 'Empty'],
    ['Vertices', metadata.vertexCount.toLocaleString()],
    ['CRS', metadata.crsLabel],
    [
      'Extent',
      metadata.bbox ? metadata.bbox.map((v) => v.toFixed(4)).join(', ') : '—',
    ],
    [
      'Fields',
      metadata.fields.length > 0
        ? metadata.fields.map((f) => f.name).join(', ')
        : 'None',
    ],
  ];

  return (
    <View style={styles.container} testID='gis-vector-editor'>
      <ThemedText variant='subheading'>File metadata</ThemedText>
      <View style={styles.table}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <ThemedText variant='bodySmall' style={styles.rowLabel}>
              {label}
            </ThemedText>
            <ThemedText variant='bodySmall' style={styles.rowValue}>
              {value}
            </ThemedText>
          </View>
        ))}
      </View>

      {metadata.additionalLayersInZip > 0 ? (
        <View
          style={[
            styles.callout,
            {
              backgroundColor: palette.background.warning.secondary,
              borderColor: palette.border.warning.default,
            },
          ]}
        >
          <ThemedText
            variant='bodySmall'
            style={{ color: palette.text.warning.default }}
          >
            {`This bundle has ${metadata.additionalLayersInZip} more layer${
              metadata.additionalLayersInZip === 1 ? '' : 's'
            } — only the first is previewed here.`}
          </ThemedText>
        </View>
      ) : null}

      <ThemedText variant='subheading'>Style</ThemedText>
      <SelectField
        label='Color by'
        options={MODE_OPTIONS}
        value={editable.mode}
        onValueChange={(v) => {
          if (v === 'single') {
            onChange(withSingleColor(editable, editable.color));
          } else if (fieldOptions.length > 0) {
            onChange(
              withCategoricalField(
                editable,
                editable.field ?? fieldOptions[0].value,
                geojson.features,
              ),
            );
          }
        }}
      />

      {editable.mode === 'single' ? (
        <View style={styles.classRow}>
          <ThemedText variant='bodySmall'>Color</ThemedText>
          <ColorInput
            value={editable.color}
            onChange={(color) => onChange(withSingleColor(editable, color))}
            label='Feature color'
          />
        </View>
      ) : fieldOptions.length === 0 ? (
        <ThemedText
          variant='bodySmall'
          style={{ color: palette.text.default.secondary }}
        >
          This file has no attribute fields to color by.
        </ThemedText>
      ) : (
        <>
          <SelectField
            label='Field'
            options={fieldOptions}
            value={editable.field ?? ''}
            onValueChange={(field) =>
              onChange(withCategoricalField(editable, field, geojson.features))
            }
          />
          <View style={styles.classList} testID='gis-vector-class-list'>
            {editable.classes.map((cls) => (
              <View key={cls.value} style={styles.classRow}>
                <TextInput
                  style={[textInputStyle, styles.classNameInput]}
                  value={cls.name}
                  onChangeText={(t) =>
                    onChange(withClassName(editable, cls.value, t))
                  }
                  placeholder='Class name'
                  placeholderTextColor={palette.text.default.secondary}
                />
                <ColorInput
                  value={cls.color}
                  onChange={(color) =>
                    onChange(withClassColor(editable, cls.value, color))
                  }
                  label={`Color for ${cls.value}`}
                />
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Size.space['300'] },
  table: { gap: Size.space['100'] },
  row: {
    flexDirection: 'row',
    gap: Size.space['200'],
    alignItems: 'flex-start',
  },
  rowLabel: { width: 108, flexShrink: 0, opacity: 0.7 },
  rowValue: { flex: 1 },
  callout: {
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    padding: Size.space['300'],
    gap: Size.space['200'],
  },
  classList: { gap: Size.space['200'] },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  classNameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Size.radius['100'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
  },
});
