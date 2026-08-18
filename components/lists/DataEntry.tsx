// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IconChevronDown, IconChevronUp } from '@/assets/icons';
import { Colors, Size, type ColorPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { ThemedText } from '../text/ThemedText';

export type DataEntryDetail = {
  label: string;
  value: string;
};

export type DataEntryProps = {
  dataName: string;
  dataPoint: string;
  details?: DataEntryDetail[];
  showGraph?: boolean;
  graph?: React.ReactNode;
  expandable?: boolean;
  onToggle?: (expanded: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

const MIN_GRAPH_HEIGHT = Size.space['1600'];
const MAX_GRAPH_HEIGHT = Size.space['8000'];

export function DataEntry({
  dataName,
  dataPoint,
  details = [],
  showGraph = true,
  graph,
  expandable = true,
  onToggle,
  style,
}: DataEntryProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const hasDetails = details.length > 0;
  const isExpandable = expandable && hasDetails;
  const [expanded, setExpanded] = React.useState(!isExpandable);
  const showDetails = isExpandable ? expanded : hasDetails;

  const handleToggle = React.useCallback(() => {
    if (!isExpandable) {
      return;
    }
    setExpanded((prev) => {
      const next = !prev;
      onToggle?.(next);
      return next;
    });
  }, [isExpandable, onToggle]);

  React.useEffect(() => {
    setExpanded(!isExpandable);
  }, [isExpandable]);

  return (
    <View style={[styles.container, style]}>
      {isExpandable ? (
        <Pressable
          style={({ hovered, pressed }) => [
            styles.labelRow,
            {
              backgroundColor: resolveLabelRowBackground(palette, {
                hovered: hovered ?? false,
                pressed: pressed ?? false,
              }),
            },
          ]}
          onPress={handleToggle}
          accessibilityRole='button'
          accessibilityLabel={`${dataName} ${expanded ? 'collapse' : 'expand'}`}
          accessibilityState={{ expanded }}
        >
          <ThemedText variant='body'>
            {dataName}: {dataPoint}
          </ThemedText>
          <View style={styles.iconSlot} collapsable={false}>
            <View
              collapsable={false}
              style={!expanded ? styles.hiddenIcon : undefined}
            >
              <IconChevronUp />
            </View>
            <View
              collapsable={false}
              style={expanded ? styles.hiddenIcon : undefined}
            >
              <IconChevronDown />
            </View>
          </View>
        </Pressable>
      ) : (
        <View style={styles.labelRow} accessibilityRole='text'>
          <ThemedText variant='body'>
            {dataName}: {dataPoint}
          </ThemedText>
        </View>
      )}
      <View
        style={[
          styles.details,
          !showDetails ? styles.detailsHidden : undefined,
          { pointerEvents: showDetails ? 'auto' : 'none' },
        ]}
        collapsable={false}
        accessibilityElementsHidden={!showDetails}
        importantForAccessibility={showDetails ? 'auto' : 'no-hide-descendants'}
      >
        {showGraph ? (
          <View
            style={[
              styles.graphContainer,
              !graph && styles.graphPlaceholderBounds,
            ]}
            testID='data-entry-graph'
          >
            {graph ?? (
              <View
                style={[
                  styles.graphPlaceholder,
                  { backgroundColor: palette.background.default.tertiary },
                  { pointerEvents: 'none' },
                ]}
                testID='data-entry-graph-placeholder'
              />
            )}
          </View>
        ) : null}
        {details.map(({ label, value }, index) => (
          <ThemedText key={`${label}-${value}-${index}`} variant='body'>
            {label}: {value}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Size.space['200'],
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Size.space['100'],
    borderRadius: Size.radius['100'],
  },
  iconSlot: {
    width: Size.space['400'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenIcon: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  details: {
    gap: Size.space['050'],
    width: '100%',
    paddingLeft: Size.space['800'],
  },
  detailsHidden: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
  },
  graphContainer: {
    width: '100%',
    borderRadius: Size.radius['200'],
    overflow: 'hidden',
  },
  graphPlaceholderBounds: {
    minHeight: MIN_GRAPH_HEIGHT,
    maxHeight: MAX_GRAPH_HEIGHT,
    height: MAX_GRAPH_HEIGHT,
  },
  graphPlaceholder: {
    flex: 1,
    height: '100%',
  },
});

function resolveLabelRowBackground(
  palette: ColorPalette,
  state: { hovered: boolean; pressed: boolean },
) {
  if (state.pressed) {
    return palette.background.default.secondaryPressed;
  }
  if (state.hovered) {
    return palette.background.default.secondaryHover;
  }
  return 'transparent';
}

export const __DATA_ENTRY_TESTING__ = {
  resolveLabelRowBackground,
};
