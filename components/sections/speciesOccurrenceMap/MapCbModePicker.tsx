// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { getCbColor, getCbShape, type CbMode, type ShapeKey } from './cbColors';
import { ShapeMarker } from './ShapeMarker';
import { CIRCULAR_COLORMAPS } from './variableColors';
import type { LegendClass } from '@/data/types';

const NSWE_SHAPES: ShapeKey[] = [
  'triangle',
  'arrow',
  'triangle-down',
  'diamond',
];
const BASE_CIRCULAR_STOPS = CIRCULAR_COLORMAPS['twilight'].stops;
const BASE_CIRCULAR_SWATCH_CSS = CIRCULAR_COLORMAPS['twilight'].swatchCss;

const MODES: { id: CbMode | null; label: string }[] = [
  { id: null, label: 'Default' },
  { id: 'colorblind', label: 'Colorblind friendly' },
  { id: 'achromatopsia', label: 'Monochrome' },
];

const DOTS = 3;

type MapCbModePickerProps = {
  selected: CbMode | null;
  onChange: (mode: CbMode | null) => void;
  topClasses: LegendClass[];
  variableId: string;
  shapesEnabled?: boolean;
  markerOutlineEnabled?: boolean;
  isCircular?: boolean;
  nsweColors?: [string, string, string, string];
};

export function MapCbModePicker({
  selected,
  onChange,
  topClasses,
  variableId,
  shapesEnabled = false,
  markerOutlineEnabled = false,
  isCircular = false,
  nsweColors: _nsweColors,
}: MapCbModePickerProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const preview = topClasses.slice(0, DOTS);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      {MODES.map((entry) => {
        const isSelected = entry.id === selected;
        const isMono = entry.id === 'achromatopsia';
        return (
          <Pressable
            key={entry.id ?? 'original'}
            onPress={() => onChange(entry.id)}
            style={[styles.row, isSelected && styles.rowSelected]}
            accessibilityLabel={entry.label}
            accessibilityRole='radio'
            accessibilityState={{ selected: isSelected }}
          >
            {isCircular ? (
              isMono ? (
                NSWE_SHAPES.map((shape, i) => (
                  <ShapeMarker
                    key={i}
                    shape={shape}
                    color='#999999'
                    size={8}
                    outline={markerOutlineEnabled}
                  />
                ))
              ) : Platform.OS === 'web' ? (
                <View
                  style={[
                    styles.circularSwatch,
                    { backgroundImage: BASE_CIRCULAR_SWATCH_CSS } as object,
                  ]}
                />
              ) : (
                <View style={[styles.circularSwatch, { flexDirection: 'row' }]}>
                  {[...BASE_CIRCULAR_STOPS, BASE_CIRCULAR_STOPS[0]].map(
                    (s, i) => (
                      <View
                        key={i}
                        style={{
                          flex: 1,
                          backgroundColor: `rgb(${s[0]},${s[1]},${s[2]})`,
                        }}
                      />
                    ),
                  )}
                </View>
              )
            ) : (
              <>
                {preview.map((cls) => {
                  const color = getCbColor(
                    variableId,
                    cls.id as number,
                    entry.id,
                    cls.color ?? '#888888',
                  );
                  if (shapesEnabled || entry.id === 'achromatopsia') {
                    return (
                      <ShapeMarker
                        key={cls.id}
                        shape={getCbShape(variableId, cls.id as number)}
                        color={color}
                        size={8}
                        outline={markerOutlineEnabled}
                      />
                    );
                  }
                  return (
                    <View
                      key={cls.id}
                      style={[
                        styles.dot,
                        { backgroundColor: color },
                        markerOutlineEnabled && styles.dotOutline,
                      ]}
                    />
                  );
                })}
                {preview.length === 0 && (
                  <View style={[styles.dot, { backgroundColor: '#888888' }]} />
                )}
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 8,
    bottom: 10,
    zIndex: 1000,
    borderRadius: Size.radius['400'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['200'],
    gap: Size.space['100'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 3,
    opacity: 0.7,
    minWidth: 44,
  },
  rowSelected: {
    opacity: 1,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  dotOutline: {
    borderWidth: 1,
    borderColor: 'rgba(176,176,176,0.65)',
  },
  circularSwatch: {
    width: 44,
    height: 10,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
