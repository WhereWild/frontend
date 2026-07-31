// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { ThemedText } from '@/components/text/ThemedText';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import React from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  CIRCULAR_COLORMAP_ORDER,
  CIRCULAR_COLORMAPS,
  type CircularColormapId,
} from './variableColors';
import { ShapeMarker } from './ShapeMarker';
import type { ShapeKey, CbMode } from './cbColors';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

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

function Swatch({
  id,
  isSelected,
}: {
  id: CircularColormapId;
  isSelected: boolean;
}) {
  const cm = CIRCULAR_COLORMAPS[id];
  return Platform.OS === 'web' ? (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: 3, backgroundImage: cm.swatchCss } as object,
      ]}
    />
  ) : (
    <Svg width={44} height={10}>
      <Defs>
        <LinearGradient id={`cg-${id}`} x1='0' y1='0.5' x2='1' y2='0.5'>
          {[...cm.stops, cm.stops[0]].map((s, i) => (
            <Stop
              key={i}
              offset={
                i < cm.stops.length
                  ? `${Math.round((i / cm.stops.length) * 100)}%`
                  : '100%'
              }
              stopColor={`rgb(${s[0]},${s[1]},${s[2]})`}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={44} height={10} fill={`url(#cg-${id})`} rx={3} />
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
  );
}

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
  const { breakpoint } = useResponsive();
  const isPhone = breakpoint === 'phone';
  const [collapsed, setCollapsed] = React.useState(isPhone);

  const hasAutoCollapsed = React.useRef(breakpoint === 'phone');
  React.useEffect(() => {
    if (!hasAutoCollapsed.current && breakpoint === 'phone') {
      hasAutoCollapsed.current = true;
      setCollapsed(true);
    }
  }, [breakpoint]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => !c);
  };

  return (
    // Bounding box: defines the maximum space this can occupy. The inner
    // Pressable shrinks to content but never exceeds this height, so it
    // can't grow into the map's top controls on a short viewport — instead
    // it starts (and can be toggled back to) a collapsed preview there.
    <View style={styles.boundingBox} pointerEvents='box-none'>
      <Pressable
        collapsable={false}
        style={[
          styles.overlay,
          { backgroundColor: palette.background.default.secondary },
        ]}
        onPress={toggle}
      >
        {/* Collapsed preview — always mounted, hidden when expanded */}
        <View
          collapsable={false}
          style={collapsed ? styles.previewRow : styles.hidden}
        >
          {isMono ? (
            <ThemedText variant='bodyTiny' style={styles.previewCount}>
              Monochrome
            </ThemedText>
          ) : (
            <>
              <View style={styles.swatch}>
                <Swatch id={selected} isSelected />
              </View>
              <ThemedText variant='bodyTiny' style={styles.previewCount}>
                {CIRCULAR_COLORMAPS[selected].label}
              </ThemedText>
            </>
          )}
        </View>

        {/* Full list — always mounted, hidden when collapsed */}
        <View
          collapsable={false}
          style={collapsed ? styles.hidden : styles.list}
        >
          {CIRCULAR_COLORMAP_ORDER.map((id) => {
            const isSelected = !isMono && id === selected;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  onChange(id);
                  onCbModeChange?.(null);
                }}
                style={[styles.swatch, isSelected && styles.swatchSelected]}
                accessibilityLabel={CIRCULAR_COLORMAPS[id].label}
                accessibilityRole='radio'
                accessibilityState={{ selected: isSelected }}
              >
                <Swatch id={id} isSelected={isSelected} />
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
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  boundingBox: {
    position: 'absolute',
    right: 8,
    top: 8,
    bottom: 10,
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  overlay: {
    maxHeight: '100%' as unknown as number,
    borderRadius: Size.radius['400'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['200'],
    overflow: 'hidden',
  },
  hidden: {
    display: 'none',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['100'],
  },
  previewCount: {
    opacity: 0.7,
  },
  list: {
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
