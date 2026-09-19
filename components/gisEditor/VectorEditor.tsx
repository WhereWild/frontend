// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The GeoJSON counterpart of MetadataPanel.tsx + MetadataEditor.tsx
// combined into one panel: read-only file metadata, then the editable
// styling. There's no field or mode picker — a vector file's attribute
// table is always treated as categorical (nominal/ordinal) data here, with
// the coloring field auto-picked (see vectorEditableMeta.ts's
// autoPickField()) rather than exposed as a choice. A dropped GeoJSON's
// column names (OBJECTID, US_L4CODE, Shape_Area, ...) aren't meaningful to
// someone who didn't produce the file, so the only thing left to edit is
// the resulting class list itself — each distinct value's display name and
// color, same "one row per class, always a color" shape as the raster
// nominal legend editor. The one exception: a file with no categorical-
// looking field at all falls back to a single flat color, since there's
// nothing to build a class list from.

import React from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { VectorMetadata } from './shapefileMetadata';
import {
  withClassColor,
  withClassName,
  withSingleColor,
  type VectorEditableMeta,
} from './vectorEditableMeta';

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
  onChange,
}: {
  metadata: VectorMetadata;
  editable: VectorEditableMeta;
  onChange: (next: VectorEditableMeta) => void;
}) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const textInputStyle = {
    color: palette.text.default.default,
    borderColor: palette.border.default.secondary,
  };

  const rows: [string, string][] = [
    ['Features', String(metadata.featureCount)],
    ['Geometry', metadata.geometryType ?? 'Empty'],
    ['Vertices', metadata.vertexCount.toLocaleString()],
    ['CRS', metadata.crsLabel],
    [
      'Extent',
      metadata.bbox ? metadata.bbox.map((v) => v.toFixed(4)).join(', ') : '—',
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

      <TextInput
        style={[textInputStyle, styles.displayNameInput]}
        value={editable.displayName}
        onChangeText={(t) => onChange({ ...editable, displayName: t })}
        placeholder='Display name (defaults to the file name)'
        placeholderTextColor={palette.text.default.secondary}
        accessibilityLabel='Display name'
        testID='gis-vector-display-name'
      />

      <ThemedText variant='subheading'>Style</ThemedText>
      {editable.mode === 'single' ? (
        <View style={styles.classRow}>
          <ThemedText
            variant='bodySmall'
            style={{ color: palette.text.default.secondary }}
          >
            This file has no attribute that looks like a category — using one
            flat color.
          </ThemedText>
          <ColorInput
            value={editable.color}
            onChange={(color) => onChange(withSingleColor(editable, color))}
            label='Feature color'
          />
        </View>
      ) : (
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
  displayNameInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Size.radius['100'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
  },
});
