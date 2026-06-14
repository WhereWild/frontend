// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LegendClass } from '@/data/types';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { getCbShape, type CbMode } from './cbColors';
import { ShapeMarker } from './ShapeMarker';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { useResponsive } from '@/hooks/useResponsive';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const DOTS_PREVIEW = 3;

type MapCategoricalLegendProps = {
  classes: LegendClass[];
  variableId?: string;
  cbMode?: CbMode | null;
  shapesEnabled?: boolean;
  markerOutlineEnabled?: boolean;
};

export function MapCategoricalLegend({
  classes,
  variableId,
  cbMode,
  shapesEnabled = false,
  markerOutlineEnabled = false,
}: MapCategoricalLegendProps) {
  const useShapes =
    (cbMode === 'achromatopsia' || shapesEnabled) && variableId != null;
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const { breakpoint } = useResponsive();
  const [collapsed, setCollapsed] = React.useState(breakpoint === 'phone');

  const hasAutoCollapsed = React.useRef(breakpoint === 'phone');
  React.useEffect(() => {
    if (!hasAutoCollapsed.current && breakpoint === 'phone') {
      hasAutoCollapsed.current = true;
      setCollapsed(true);
    }
  }, [breakpoint]);

  if (classes.length === 0) return null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => !c);
  };

  return (
    // Bounding box: defines the maximum space the legend can occupy.
    // The inner Pressable shrinks to content but never exceeds this height.
    <View style={styles.boundingBox}>
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
          {classes
            .slice(0, DOTS_PREVIEW)
            .map((cls) =>
              useShapes ? (
                <ShapeMarker
                  key={cls.id}
                  shape={getCbShape(variableId!, cls.id as number)}
                  color={cls.color ?? '#888888'}
                  size={8}
                  outline={markerOutlineEnabled}
                />
              ) : (
                <View
                  key={cls.id}
                  style={[
                    styles.dot,
                    { backgroundColor: cls.color ?? '#888888' },
                    markerOutlineEnabled && styles.dotOutline,
                  ]}
                />
              ),
            )}
          {classes.length > DOTS_PREVIEW && (
            <ThemedText variant='bodyTiny' style={styles.previewCount}>
              +{classes.length - DOTS_PREVIEW}
            </ThemedText>
          )}
        </View>

        {/* Full list — always mounted, hidden when collapsed */}
        <View
          collapsable={false}
          style={collapsed ? styles.hidden : styles.list}
        >
          {classes.map((cls) => (
            <View key={cls.id} style={styles.row}>
              {useShapes ? (
                <ShapeMarker
                  shape={getCbShape(variableId!, cls.id as number)}
                  color={cls.color ?? '#888888'}
                  size={8}
                  outline={markerOutlineEnabled}
                />
              ) : (
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: cls.color ?? '#888888' },
                    markerOutlineEnabled && styles.dotOutline,
                  ]}
                />
              )}
              <ThemedText
                variant='bodyTiny'
                numberOfLines={1}
                style={styles.label}
              >
                {cls.name}
              </ThemedText>
            </View>
          ))}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  boundingBox: {
    position: 'absolute',
    left: 8,
    top: 82,
    bottom: 10,
    zIndex: 1000,
    justifyContent: 'flex-start',
  },
  overlay: {
    maxHeight: '100%' as unknown as number,
    borderRadius: Size.radius['400'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['200'],
    maxWidth: 140,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['100'],
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
  label: {
    flexShrink: 1,
  },
});
