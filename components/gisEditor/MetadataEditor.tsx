// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The user-editable half of the /gis-editor metadata panel — data type,
// units, render bounds, and (for nominal/ordinal) one row per legend class.
// Purely a view over RasterEditableMeta (rasterEditableMeta.ts); every edit
// goes back through onChange so GisEditorScreen can both display it and feed
// it to the map preview.

import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ThemedText } from '@/components';
import { NumberSpinner } from '@/components/inputs/NumberSpinner';
import {
  SelectField,
  type SelectOption,
} from '@/components/inputs/SelectField';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { DetectedValueType, ValueTypeGuess } from './dataTypeDetection';
import type { RenderBounds } from './rasterMetadata';
import { withScaleOffset, type RasterEditableMeta } from './rasterEditableMeta';

const VALUE_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Nominal (unordered categories)', value: 'nominal' },
  { label: 'Ordinal (ranked categories)', value: 'ordinal' },
  { label: 'Interval (no true zero)', value: 'interval' },
  { label: 'Ratio (true zero)', value: 'ratio' },
  { label: 'Circular (angle/bearing)', value: 'circular' },
];

const VALUE_TYPE_LABELS: Record<ValueTypeGuess, string> = {
  nominal: 'Nominal',
  ordinal: 'Ordinal',
  interval: 'Interval',
  ratio: 'Ratio',
  circular: 'Circular',
};

export function MetadataEditor({
  editable,
  detectedType,
  rawBounds,
  onChange,
  onValueTypeChange,
  isScanningClasses = false,
}: {
  editable: RasterEditableMeta;
  detectedType: DetectedValueType | null;
  /** Unscaled sampled min/max, straight from deriveRenderBounds() — used to
   * re-derive render bounds whenever scale/offset changes. */
  rawBounds: RenderBounds;
  onChange: (next: RasterEditableMeta) => void;
  /** Fires with the raw new type on a "Data type" selection, instead of
   * onChange getting the already-computed RasterEditableMeta directly —
   * the caller (GisEditorScreen) needs to see the raw before/after to know
   * whether a manual switch into nominal/ordinal needs an on-demand class
   * scan (see rasterMetadata.ts's scanForCategoricalClasses), which
   * withValueType() alone has no way to trigger since it's a synchronous,
   * blob-less function. */
  onValueTypeChange: (next: ValueTypeGuess) => void;
  /** True while GisEditorScreen is running that on-demand scan. */
  isScanningClasses?: boolean;
}) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const isNominal = editable.valueType === 'nominal';
  const isOrdinal = editable.valueType === 'ordinal';
  const isCategorical = isNominal || isOrdinal;
  const isScaled =
    editable.valueType === 'ratio' || editable.valueType === 'interval';

  const textInputStyle = [
    styles.textInput,
    {
      borderColor: palette.border.default.secondary,
      backgroundColor: palette.background.default.default,
      color: palette.text.default.default,
    },
  ];

  const setClassName = (value: number, name: string) =>
    onChange({
      ...editable,
      classes: editable.classes.map((c) =>
        c.value === value ? { ...c, name } : c,
      ),
    });

  const setClassColor = (value: number, color: string) =>
    onChange({
      ...editable,
      classes: editable.classes.map((c) =>
        c.value === value ? { ...c, color } : c,
      ),
    });

  return (
    <View style={styles.container} testID='gis-metadata-editor'>
      <ThemedText variant='subheading'>Configure for use</ThemedText>
      <ThemedText
        variant='bodyTiny'
        style={{ color: palette.text.default.secondary }}
      >
        Change the metadata of the file.
      </ThemedText>

      <SelectField
        label='Data type'
        value={editable.valueType}
        options={VALUE_TYPE_OPTIONS}
        onValueChange={(v) => onValueTypeChange(v as ValueTypeGuess)}
      />
      {detectedType ? (
        <ThemedText
          variant='bodyTiny'
          style={{ color: palette.text.default.secondary }}
        >
          {`Auto-detected: ${VALUE_TYPE_LABELS[detectedType.guess]} (${detectedType.confidence} confidence)`}
        </ThemedText>
      ) : null}

      {isScanningClasses ? (
        <View style={styles.scanRow}>
          <ActivityIndicator
            color={palette.icon.brand.default}
            testID='gis-metadata-scan-spinner'
          />
          <ThemedText
            variant='bodySmall'
            style={{ color: palette.text.default.secondary }}
          >
            Scanning the file for classes…
          </ThemedText>
        </View>
      ) : null}

      {isCategorical ? (
        editable.classes.length > 0 ? (
          <View style={styles.classList} testID='gis-metadata-class-list'>
            {editable.classes.map((cls) => (
              <View key={cls.value} style={styles.classRow}>
                <ThemedText variant='bodySmall' style={styles.classValue}>
                  {cls.value}
                </ThemedText>
                <TextInput
                  style={[textInputStyle, styles.classNameInput]}
                  value={cls.name}
                  onChangeText={(t) => setClassName(cls.value, t)}
                  placeholder='Class name'
                  placeholderTextColor={palette.text.default.secondary}
                />
                {isNominal && Platform.OS === 'web'
                  ? React.createElement('input', {
                      type: 'color',
                      value: cls.color ?? '#888888',
                      onChange: (e: { target: { value: string } }) =>
                        setClassColor(cls.value, e.target.value),
                      style: {
                        width: 32,
                        height: 32,
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                      },
                      'aria-label': `Color for class ${cls.value}`,
                    })
                  : null}
              </View>
            ))}
          </View>
        ) : !isScanningClasses ? (
          <ThemedText
            variant='bodySmall'
            style={{ color: palette.text.default.secondary }}
          >
            No discrete classes were found in the sampled pixels for this file,
            so legend classes can’t be pre-filled. This data type may not be the
            best fit — check the auto-detected suggestion above.
          </ThemedText>
        ) : null
      ) : (
        <>
          {isScaled ? (
            <>
              <View style={styles.boundsRow}>
                <NumberSpinner
                  label='Scale'
                  value={editable.scale}
                  min={-Infinity}
                  precision={6}
                  onValueChange={(v) =>
                    onChange(
                      withScaleOffset(editable, rawBounds, v, editable.offset),
                    )
                  }
                  style={styles.boundInput}
                />
                <NumberSpinner
                  label='Offset'
                  value={editable.offset}
                  min={-Infinity}
                  precision={4}
                  onValueChange={(v) =>
                    onChange(
                      withScaleOffset(editable, rawBounds, editable.scale, v),
                    )
                  }
                  style={styles.boundInput}
                />
              </View>
              <ThemedText
                variant='bodyTiny'
                style={{ color: palette.text.default.secondary }}
              >
                Edit the scale and offset of the data.
              </ThemedText>
            </>
          ) : null}
          <View style={styles.boundsRow}>
            <NumberSpinner
              label='Render min'
              value={editable.renderMin}
              min={-Infinity}
              precision={4}
              onValueChange={(v) => onChange({ ...editable, renderMin: v })}
              style={styles.boundInput}
            />
            <NumberSpinner
              label='Render max'
              value={editable.renderMax}
              min={-Infinity}
              precision={4}
              onValueChange={(v) => onChange({ ...editable, renderMax: v })}
              style={styles.boundInput}
            />
          </View>
          <TextInput
            style={textInputStyle}
            value={editable.units}
            onChangeText={(t) => onChange({ ...editable, units: t })}
            placeholder='Units (e.g. °C, mm, m)'
            placeholderTextColor={palette.text.default.secondary}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Size.space['200'] },
  boundsRow: { flexDirection: 'row', gap: Size.space['200'] },
  boundInput: { flex: 1 },
  textInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    paddingVertical: Size.space['150'],
    paddingHorizontal: Size.space['200'],
  },
  classList: { gap: Size.space['150'] },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['150'],
  },
  classValue: { width: 56, flexShrink: 0, opacity: 0.7 },
  classNameInput: { flex: 1 },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['150'],
  },
});
