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
import { COLORMAP_ORDER, COLORMAPS, type ColormapId } from './variableColors';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

type MapColormapPickerProps = {
  selected: ColormapId;
  onChange: (id: ColormapId) => void;
};

function Swatch({ id, isSelected }: { id: ColormapId; isSelected: boolean }) {
  const cm = COLORMAPS[id];
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
        <LinearGradient id={`sg-${id}`} x1='1' y1='0.5' x2='0' y2='0.5'>
          {cm.barSvgStops.map(({ offset, color }) => (
            <Stop key={offset} offset={offset} stopColor={color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={44} height={10} fill={`url(#sg-${id})`} rx={3} />
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

export function MapColormapPicker({
  selected,
  onChange,
}: MapColormapPickerProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
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
    // pointerEvents="box-none" so the (mostly empty, flex-end-aligned) box
    // doesn't itself swallow clicks meant for the map's controls underneath
    // it — only the actual visible Pressable below should be clickable.
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
          <View style={styles.swatch}>
            <Swatch id={selected} isSelected />
          </View>
          <ThemedText variant='bodyTiny' style={styles.previewCount}>
            {COLORMAPS[selected].label}
          </ThemedText>
        </View>

        {/* Full list — always mounted, hidden when collapsed */}
        <View
          collapsable={false}
          style={collapsed ? styles.hidden : styles.list}
        >
          {COLORMAP_ORDER.map((id) => {
            const isSelected = id === selected;
            return (
              <Pressable
                key={id}
                onPress={() => onChange(id)}
                style={[styles.swatch, isSelected && styles.swatchSelected]}
                accessibilityLabel={COLORMAPS[id].label}
                accessibilityRole='radio'
                accessibilityState={{ selected: isSelected }}
              >
                <Swatch id={id} isSelected={isSelected} />
              </Pressable>
            );
          })}
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
});
