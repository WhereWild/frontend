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
  /** Currently selected classes — empty/null means no filter (all shown).
   * Clicking a class toggles its membership, so multiple can be active at
   * once; onClassClick reports which id was clicked, toggling is the
   * caller's job (see maps.tsx). */
  selectedClassIds?: number[] | null;
  onClassClick?: (id: number) => void;
};

export function MapCategoricalLegend({
  classes,
  variableId,
  cbMode,
  shapesEnabled = false,
  markerOutlineEnabled = false,
  selectedClassIds = null,
  onClassClick,
}: MapCategoricalLegendProps) {
  const useShapes =
    (cbMode === 'achromatopsia' || shapesEnabled) && variableId != null;
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const { breakpoint } = useResponsive();
  const isPhone = breakpoint === 'phone';
  const [collapsed, setCollapsed] = React.useState(isPhone);
  const selectedSet = React.useMemo(
    () => new Set(selectedClassIds ?? []),
    [selectedClassIds],
  );

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
    <View style={styles.boundingBox} pointerEvents='box-none'>
      <Pressable
        testID='map-categorical-legend'
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
          {classes.map((cls) => {
            const clsId = cls.id as number;
            const isSelected = selectedSet.has(clsId);
            const rowContent = (
              <>
                {useShapes ? (
                  <ShapeMarker
                    shape={getCbShape(variableId!, clsId)}
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
                      isSelected && styles.dotSelected,
                    ]}
                  />
                )}
                <ThemedText
                  variant='bodyTiny'
                  numberOfLines={1}
                  style={[styles.label, isSelected && styles.labelSelected]}
                >
                  {cls.name}
                </ThemedText>
              </>
            );
            // A row's own Pressable claims the touch before it can bubble to
            // the outer legend's collapse-toggle Pressable — on phone, a
            // plain tap needs to still collapse the legend (most of the
            // legend's area IS row content, so if rows swallowed a plain
            // tap and did nothing with it, the legend would become nearly
            // impossible to collapse), so a row's onPress there re-invokes
            // the same toggle instead of leaving it unhandled, and class
            // selection instead requires a deliberate long-press. Desktop
            // keeps the original immediate tap-to-select (no press-and-hold
            // needed there, no competing collapse gesture on the same tap).
            return onClassClick && isPhone ? (
              <Pressable
                key={clsId}
                style={styles.row}
                onPress={toggle}
                onLongPress={() => onClassClick(clsId)}
                hitSlop={4}
              >
                {rowContent}
              </Pressable>
            ) : onClassClick ? (
              <Pressable
                key={clsId}
                style={styles.row}
                onPress={() => onClassClick(clsId)}
                hitSlop={4}
              >
                {rowContent}
              </Pressable>
            ) : (
              <View key={clsId} style={styles.row}>
                {rowContent}
              </View>
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
  dotSelected: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    flexShrink: 1,
  },
  labelSelected: {
    fontWeight: '600' as const,
  },
});
