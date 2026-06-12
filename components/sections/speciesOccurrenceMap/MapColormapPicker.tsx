// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { COLORMAP_ORDER, COLORMAPS, type ColormapId } from './variableColors';

type MapColormapPickerProps = {
  selected: ColormapId;
  onChange: (id: ColormapId) => void;
};

export function MapColormapPicker({
  selected,
  onChange,
}: MapColormapPickerProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      {COLORMAP_ORDER.map((id) => {
        const cm = COLORMAPS[id];
        const isSelected = id === selected;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
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
                    id={`sg-${id}`}
                    x1='1'
                    y1='0.5'
                    x2='0'
                    y2='0.5'
                  >
                    {cm.barSvgStops.map(({ offset, color }) => (
                      <Stop key={offset} offset={offset} stopColor={color} />
                    ))}
                  </LinearGradient>
                </Defs>
                <Rect
                  x={0}
                  y={0}
                  width={44}
                  height={10}
                  fill={`url(#sg-${id})`}
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
});
