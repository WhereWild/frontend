// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  CIRCULAR_COLORMAP_ORDER,
  CIRCULAR_COLORMAPS,
  type CircularColormapId,
} from './variableColors';
import { ShapeMarker } from './ShapeMarker';
import type { ShapeKey, CbMode } from './cbColors';

const NSWE_SHAPES: ShapeKey[] = [
  'triangle',
  'arrow',
  'triangle-down',
  'diamond',
];

type MapCircularColormapPickerProps = {
  selected: CircularColormapId;
  onChange: (id: CircularColormapId) => void;
  cbMode?: CbMode | null;
  onCbModeChange?: (mode: CbMode | null) => void;
  markerOutlineEnabled?: boolean;
};

export function MapCircularColormapPicker({
  selected,
  onChange,
  cbMode,
  onCbModeChange,
  markerOutlineEnabled = false,
}: MapCircularColormapPickerProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const isMono = cbMode === 'achromatopsia';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      {CIRCULAR_COLORMAP_ORDER.map((id) => {
        const cm = CIRCULAR_COLORMAPS[id];
        const isSelected = !isMono && id === selected;
        return (
          <Pressable
            key={id}
            onPress={() => {
              onChange(id);
              onCbModeChange?.(null);
            }}
            style={[styles.swatch, isSelected && styles.swatchSelected]}
            accessibilityLabel={cm.label}
            accessibilityRole='radio'
            accessibilityState={{ selected: isSelected }}
          >
            {Platform.OS === 'web' ? (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  { borderRadius: 3, backgroundImage: cm.swatchCss } as object,
                ]}
              />
            ) : (
              <Svg width={44} height={10}>
                <Defs>
                  <LinearGradient
                    id={`cg-${id}`}
                    x1='0'
                    y1='0.5'
                    x2='1'
                    y2='0.5'
                  >
                    {cm.stops.map((s, i) => (
                      <Stop
                        key={i}
                        offset={`${Math.round((i / cm.stops.length) * 100)}%`}
                        stopColor={`rgb(${s[0]},${s[1]},${s[2]})`}
                      />
                    ))}
                    <Stop
                      offset='100%'
                      stopColor={`rgb(${cm.stops[0][0]},${cm.stops[0][1]},${cm.stops[0][2]})`}
                    />
                  </LinearGradient>
                </Defs>
                <Rect
                  x={0}
                  y={0}
                  width={44}
                  height={10}
                  fill={`url(#cg-${id})`}
                  rx={3}
                />
                {isSelected && (
                  <Rect
                    x={0.75}
                    y={0.75}
                    width={42.5}
                    height={8.5}
                    fill='none'
                    stroke='#ffffff'
                    strokeWidth={1.5}
                    rx={2.5}
                  />
                )}
              </Svg>
            )}
          </Pressable>
        );
      })}
      {onCbModeChange && (
        <Pressable
          onPress={() => onCbModeChange(isMono ? null : 'achromatopsia')}
          style={[styles.shapesRow, isMono && styles.swatchSelected]}
          accessibilityLabel='Monochrome'
          accessibilityRole='radio'
          accessibilityState={{ selected: isMono }}
        >
          {NSWE_SHAPES.map((shape, i) => (
            <ShapeMarker
              key={i}
              shape={shape}
              color='#999999'
              size={8}
              outline={markerOutlineEnabled}
            />
          ))}
        </Pressable>
      )}
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
  swatch: {
    width: 44,
    height: 10,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
    opacity: 0.7,
  },
  swatchSelected: {
    opacity: 1,
  },
  shapesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 1,
    borderRadius: 3,
    opacity: 0.7,
    minWidth: 44,
  },
});
