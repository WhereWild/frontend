// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { CIRCULAR_COLORMAP_ORDER, CIRCULAR_COLORMAPS, type CircularColormapId } from './variableColors';

type MapCircularColormapPickerProps = {
  selected: CircularColormapId;
  onChange: (id: CircularColormapId) => void;
};

export function MapCircularColormapPicker({ selected, onChange }: MapCircularColormapPickerProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  return (
    <View style={[styles.container, { backgroundColor: palette.background.default.secondary }]}>
      {CIRCULAR_COLORMAP_ORDER.map((id) => {
        const cm = CIRCULAR_COLORMAPS[id];
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
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 3, flexDirection: 'row' }]}>
                {[...cm.stops, cm.stops[0]].map((s, i) => (
                  <View
                    key={i}
                    style={{ flex: 1, backgroundColor: `rgb(${s[0]},${s[1]},${s[2]})` }}
                  />
                ))}
              </View>
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
    borderWidth: 1.5,
    borderColor: '#ffffff',
    borderRadius: 3,
  },
});
