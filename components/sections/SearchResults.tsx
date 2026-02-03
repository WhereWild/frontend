import React from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  ListRenderItem,
} from 'react-native';
import { Colors, Shadows, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '../text/ThemedText';
import type { SpeciesSummary } from '@/data/types';
import { SpeciesCard } from '../cards/SpeciesCard';

export type SearchResultsProps = {
  /**
   * Array of species to display as search results.
   */
  results: SpeciesSummary[];

  /**
   * Whether the results container should be visible. Renders nothing if false.
   */
  isVisible: boolean;

  /**
   * Optional loading state. When true, displays a loading message instead of results.
   */
  isLoading?: boolean;

  /**
   * Optional message to display when results are empty.
   * Defaults to "No species found"
   */
  emptyMessage?: string;

  /**
   * Callback fired when a result is selected.
   * Can be used to close the search UI or trigger navigation.
   */
  onSelectResult?: (species: SpeciesSummary) => void;

  /**
   * Optional custom style for the container.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Optional pointer handlers for web hover support.
   */
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;

  /**
   * Maximum height of the results list.
   * Defaults to 400.
   */
  maxHeight?: number;

  /**
   * Test ID for testing.
   */
  testID?: string;
};

/**
 * SearchResults displays a list of species as search results below a search input.
 * Renders compact SpeciesCard components for each result, with support for loading
 * and empty states.
 */
export function SearchResults({
  results,
  isVisible,
  isLoading = false,
  emptyMessage = 'No species found',
  onSelectResult,
  style,
  maxHeight = 400,
  testID,
  onPointerEnter,
  onPointerLeave,
  onTouchStart,
  onTouchEnd,
}: SearchResultsProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const panelStyles: StyleProp<ViewStyle> = [
    styles.panel,
    {
      backgroundColor: palette.background.default.tertiary,
      borderColor: palette.border.default.tertiary,
    },
    Shadows.dropShadow400.style,
    style,
  ];

  if (!isVisible) {
    return null;
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          panelStyles,
        ]}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        testID={testID ? `${testID}-loading` : undefined}
      >
        <View style={styles.centerContent}>
          <ThemedText variant="body">Loading results...</ThemedText>
        </View>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View
        style={[
          styles.container,
          panelStyles,
        ]}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        testID={testID ? `${testID}-empty` : undefined}
      >
        <View style={styles.centerContent}>
          <ThemedText variant="body">{emptyMessage}</ThemedText>
        </View>
      </View>
    );
  }

  const renderResult: ListRenderItem<SpeciesSummary> = ({ item }) => (
    <SpeciesCard
      style={styles.speciesCard}
      taxonId={item.taxonId}
      commonName={item.commonName}
      scientificName={item.scientificName}
      imageSource={item.imageSource}
      size="compact"
      onPress={() => onSelectResult?.(item)}
      testID={`search-result-${item.taxonId}`}
    />
  );

  return (
    <View
      style={[
        styles.container,
        panelStyles,
        { maxHeight },
      ]}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      testID={testID}
    >
      <FlatList
        data={results}
        renderItem={renderResult}
        keyExtractor={(item) => item.taxonId.toString()}
        scrollEnabled
        nestedScrollEnabled
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        contentContainerStyle={styles.listContent}
        testID={testID ? `${testID}-list` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  panel: {
    borderRadius: Size.radius['400'],
    borderWidth: Size.stroke.border,
    overflow: 'hidden',
  },
  listContent: {
    padding: Size.space['200'],
    gap: Size.space['200'],
  },
  centerContent: {
    paddingVertical: Size.space['600'],
    paddingHorizontal: Size.space['400'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  speciesCard: {
    maxWidth: '100%',
  },
});
