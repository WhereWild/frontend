import { IconChevronDown, IconChevronUp } from '@/assets/icons';
import { Colors, Size } from '@/constants/theme';
import type { EnvironmentalGraphConfig } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SpeciesEnvironmentSection } from '../sections/SpeciesEnvironmentSection';
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
  environmentGraph?: EnvironmentalGraphConfig;
  expandable?: boolean;
  onToggle?: (expanded: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

export function DataEntry({
  dataName,
  dataPoint,
  details = [],
  showGraph = true,
  graph,
  environmentGraph,
  expandable = true,
  onToggle,
  style,
  taxonId,
}: DataEntryProps & { taxonId?: number }) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const hasDetails = details.length > 0;
  const isExpandable = expandable && hasDetails;
  const [expanded, setExpanded] = React.useState(!isExpandable);
  const shouldShowGraph = showGraph && (isExpandable ? expanded : true);
  const shouldRenderDetails = isExpandable ? expanded : hasDetails || shouldShowGraph;

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

  const resolvedGraph = React.useMemo(() => {
    if (!shouldShowGraph) {
      return null;
    }
    if (graph) {
      return graph;
    }
    if (!environmentGraph || !taxonId) {
      return null;
    }
    return (
      <SpeciesEnvironmentSection
        taxonId={taxonId}
        variableId={environmentGraph.variableId}
        initialStats={environmentGraph.initialStats}
        title={dataName}
      />
    );
  }, [environmentGraph, graph, shouldShowGraph, taxonId, dataName]);

  const shouldShowPlaceholder = shouldShowGraph && !resolvedGraph && hasDetails;
  const graphPlaceholder = shouldShowPlaceholder ? (
    <View
      testID="data-entry-graph"
      style={[styles.graphContainer, styles.graphPlaceholderContainer]}
    >
      <View
        testID="data-entry-graph-placeholder"
        style={[
          styles.graphPlaceholderSurface,
          { backgroundColor: palette.background.default.tertiary },
        ]}
      >
        <ThemedText variant="bodySmall">
          Environmental graph available once data loads.
        </ThemedText>
      </View>
    </View>
  ) : null;

  const dataSummaryText = `${dataName}: ${dataPoint}`;
  const accessibilityHint = isExpandable
    ? expanded ? 'Will collapse additional details' : 'Will expand to reveal additional details'
    : undefined;

  return (
    <View style={[styles.container, style]}>
      {isExpandable ? (
        <Pressable
          style={({ hovered, pressed }) => [
            styles.labelRow,
            {
              backgroundColor: resolveLabelRowBackground(
                palette,
                { hovered: hovered ?? false, pressed: pressed ?? false },
              ),
            },
          ]}
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityLabel={dataSummaryText}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ expanded }}
        >
          <ThemedText variant="body" style={{ flex: 1 }}>
            {dataSummaryText}
          </ThemedText>
          {expanded ? <IconChevronUp /> : <IconChevronDown />}
        </Pressable>
      ) : (
        <View
          style={styles.labelRow}
          accessibilityRole="text"
        >
          <ThemedText variant="body">
            {dataSummaryText}
          </ThemedText>
        </View>
      )}
      {shouldRenderDetails ? (
        <View style={styles.details}>
          {shouldShowGraph && resolvedGraph ? (
            <View
              style={[styles.graphContainer, styles.graphContainerWithContent]}
              testID="data-entry-graph"
            >
              {resolvedGraph}
            </View>
          ) : null}
          {graphPlaceholder}
          {details.map(({ label, value }, index) => (
            <ThemedText key={`${label}-${value}-${index}`} variant="body">
              {label}: {value}
            </ThemedText>
          ))}
        </View>
      ) : null}
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
  details: {
    gap: Size.space['050'],
    width: '100%',
    paddingLeft: Size.space['800'],
  },
  graphContainer: {
    width: '100%',
    borderRadius: Size.radius['200'],
    overflow: 'hidden',
  },
  graphContainerWithContent: {
    overflow: 'visible',
  },
  graphPlaceholderContainer: {
    height: Size.space['8000'],
    minHeight: Size.space['1600'],
    maxHeight: Size.space['8000'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  graphPlaceholderSurface: {
    width: '100%',
    height: '100%',
    borderRadius: Size.radius['200'],
    justifyContent: 'center',
    alignItems: 'center',
    padding: Size.space['400'],
  },
});

function resolveLabelRowBackground(
  palette: typeof Colors.light,
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