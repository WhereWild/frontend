import React from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  ListRenderItem,
  ActivityIndicator,
} from 'react-native';
import { Colors, Shadows, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '../text/ThemedText';
import type { SpeciesSummary } from '@/data/types';
import { SpeciesCard } from '../cards/SpeciesCard';

type SearchResultsListRef = FlatList<SpeciesSummary>;

type ResultLayout = {
  y: number;
  height: number;
};

type ScrollMetrics = {
  height: number;
  offset: number;
};

const VISIBILITY_BOTTOM_BUFFER = Size.space['600'];
const VISIBILITY_PADDING = Size.space['400'];

const getSearchResultsListElementId = (instanceId: string) =>
  `${instanceId}-list`;

const getSearchResultsResultElementId = (instanceId: string, index: number) => {
  return `${instanceId}-result-${index}`;
};

const getScrollOffsetForActiveResult = (
  resultLayout: ResultLayout | undefined,
  scrollMetrics: ScrollMetrics,
) => {
  if (!resultLayout || !scrollMetrics.height) {
    return null;
  }

  const resultTop = resultLayout.y;
  const resultBottom = resultLayout.y + resultLayout.height;
  const visibleTop = scrollMetrics.offset;
  const visibleBottom = scrollMetrics.offset + scrollMetrics.height;

  if (resultTop + VISIBILITY_BOTTOM_BUFFER >= visibleBottom) {
    return Math.max(
      0,
      resultBottom - scrollMetrics.height + VISIBILITY_PADDING,
    );
  }

  if (resultBottom <= visibleTop) {
    return Math.max(0, resultTop - VISIBILITY_PADDING);
  }

  return null;
};

const keepActiveResultVisible = (
  listRef: React.RefObject<SearchResultsListRef | null>,
  resultLayout: ResultLayout | undefined,
  scrollMetrics: ScrollMetrics,
) => {
  const nextOffset = getScrollOffsetForActiveResult(
    resultLayout,
    scrollMetrics,
  );
  if (nextOffset === null) {
    return;
  }

  listRef.current?.scrollToOffset({
    animated: true,
    offset: nextOffset,
  });
};

const keepActiveWebResultVisible = (
  listElementId: string | undefined,
  activeResultElementId: string | undefined,
) => {
  if (
    !listElementId ||
    !activeResultElementId ||
    typeof document === 'undefined'
  ) {
    return;
  }

  const listElement = document.getElementById(listElementId);
  const resultElement = document.getElementById(activeResultElementId);

  if (
    !(listElement instanceof HTMLElement) ||
    !(resultElement instanceof HTMLElement)
  ) {
    return;
  }

  const listRect = listElement.getBoundingClientRect();
  const resultRect = resultElement.getBoundingClientRect();

  if (resultRect.top <= listRect.top) {
    listElement.scrollTop = Math.max(
      0,
      listElement.scrollTop -
        (listRect.top - resultRect.top) -
        VISIBILITY_PADDING,
    );
    return;
  }

  if (resultRect.bottom + VISIBILITY_BOTTOM_BUFFER >= listRect.bottom) {
    listElement.scrollTop = Math.max(
      0,
      listElement.scrollTop +
        (resultRect.bottom - listRect.bottom) +
        VISIBILITY_PADDING,
    );
  }
};

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
  onFocus?: () => void;
  onBlur?: () => void;

  /**
   * Maximum height of the results list.
   * Defaults to 400.
   */
  maxHeight?: number;

  /**
   * Test ID for testing.
   */
  testID?: string;

  /**
   * Zero-based index of the result that is currently highlighted for keyboard navigation.
   * In `inline` layout this only affects the visual highlight state.
   * In `floating` layout it also keeps the active result scrolled into view.
   */
  activeResultIndex?: number;

  /**
   * Layout mode for the results panel.
   * - `floating`: absolute-positioned dropdown panel (default)
   *   and enables active-result scroll management when `activeResultIndex` is provided.
   * - `inline`: in-flow panel used inside scrollable page content
   *   and does not perform active-result auto-scrolling.
   */
  layout?: 'floating' | 'inline';
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
  onFocus,
  onBlur,
  layout = 'floating',
  activeResultIndex = -1,
}: SearchResultsProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const listRef = React.useRef<SearchResultsListRef | null>(null);
  const resultLayoutsRef = React.useRef<Record<number, ResultLayout>>({});
  const scrollMetricsRef = React.useRef<ScrollMetrics>({
    height: 0,
    offset: 0,
  });
  const [layoutVersion, setLayoutVersion] = React.useState(0);
  const reactId = React.useId();
  // React.useId() may include characters such as ':' that are awkward for DOM lookups,
  // so normalize the suffix before using it in nativeID-backed web element ids.
  const instanceId = React.useMemo(
    () => `search-results-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [reactId],
  );
  const listElementId = getSearchResultsListElementId(instanceId);
  const panelStyles: StyleProp<ViewStyle> = [
    layout === 'inline' ? styles.containerInline : styles.container,
    styles.panel,
    {
      backgroundColor: palette.background.default.tertiary,
      borderColor: palette.border.default.tertiary,
    },
    Shadows.dropShadow400.style,
    style,
  ];

  React.useEffect(() => {
    if (!isVisible || isLoading || layout !== 'floating') {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (Platform.OS === 'web') {
        keepActiveWebResultVisible(
          listElementId,
          activeResultIndex >= 0
            ? getSearchResultsResultElementId(instanceId, activeResultIndex)
            : undefined,
        );
        return;
      }

      keepActiveResultVisible(
        listRef,
        resultLayoutsRef.current[activeResultIndex],
        {
          ...scrollMetricsRef.current,
          height: scrollMetricsRef.current.height || maxHeight,
        },
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [
    activeResultIndex,
    instanceId,
    isLoading,
    isVisible,
    layout,
    layoutVersion,
    listElementId,
    maxHeight,
  ]);

  const updateResultLayout = React.useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const nextLayout = {
        y: event.nativeEvent.layout.y,
        height: event.nativeEvent.layout.height,
      };

      const previousLayout = resultLayoutsRef.current[index];
      if (
        previousLayout?.y === nextLayout.y &&
        previousLayout?.height === nextLayout.height
      ) {
        return;
      }

      resultLayoutsRef.current[index] = nextLayout;
      setLayoutVersion((currentValue) => currentValue + 1);
    },
    [],
  );

  const handleListLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (scrollMetricsRef.current.height === nextHeight) {
      return;
    }

    scrollMetricsRef.current.height = nextHeight;
    setLayoutVersion((currentValue) => currentValue + 1);
  }, []);

  const handleListScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollMetricsRef.current.offset = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  if (!isVisible) {
    return null;
  }

  if (isLoading) {
    return (
      <View
        style={[panelStyles]}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onFocus={onFocus}
        onBlur={onBlur}
        testID={testID ? `${testID}-loading` : undefined}
      >
        <View style={[styles.centerContent, styles.loading]}>
          <ActivityIndicator color={palette.icon.brand.default} />
          <ThemedText variant='body'>Loading results...</ThemedText>
        </View>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View
        style={[panelStyles]}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onFocus={onFocus}
        onBlur={onBlur}
        testID={testID ? `${testID}-empty` : undefined}
      >
        <View style={styles.centerContent}>
          <ThemedText variant='body'>{emptyMessage}</ThemedText>
        </View>
      </View>
    );
  }

  if (layout === 'inline') {
    return (
      <View
        style={[panelStyles, { maxHeight }]}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onFocus={onFocus}
        onBlur={onBlur}
        testID={testID}
      >
        <View
          style={styles.listContent}
          testID={testID ? `${testID}-list` : undefined}
        >
          {results.map((item, index) => (
            <SpeciesCard
              key={item.taxonId}
              style={[
                styles.speciesCard,
                activeResultIndex === index
                  ? {
                      backgroundColor:
                        palette.background.default.secondaryHover,
                    }
                  : null,
              ]}
              taxonId={item.taxonId}
              commonName={item.commonName}
              scientificName={item.scientificName}
              description={item.description}
              imageSource={item.imageSource}
              size='compact'
              onPress={() => onSelectResult?.(item)}
              testID={`search-result-${item.taxonId}`}
            />
          ))}
        </View>
      </View>
    );
  }

  const renderResult: ListRenderItem<SpeciesSummary> = ({ item, index }) => (
    <View
      nativeID={getSearchResultsResultElementId(instanceId, index)}
      onLayout={(event) => updateResultLayout(index, event)}
    >
      <SpeciesCard
        style={[
          styles.speciesCard,
          activeResultIndex === index
            ? { backgroundColor: palette.background.default.secondaryHover }
            : null,
        ]}
        taxonId={item.taxonId}
        commonName={item.commonName}
        scientificName={item.scientificName}
        description={item.description}
        imageSource={item.imageSource}
        size='compact'
        onPress={() => onSelectResult?.(item)}
        testID={`search-result-${item.taxonId}`}
      />
    </View>
  );

  return (
    <View
      style={[panelStyles, { maxHeight }]}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onFocus={onFocus}
      onBlur={onBlur}
      testID={testID}
    >
      <FlatList
        ref={listRef}
        nativeID={listElementId}
        data={results}
        renderItem={renderResult}
        keyExtractor={(item) => item.taxonId.toString()}
        onLayout={handleListLayout}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
        scrollEnabled
        nestedScrollEnabled
        keyboardShouldPersistTaps='always'
        keyboardDismissMode='none'
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
  containerInline: {
    position: 'relative',
    width: '100%',
    zIndex: 1,
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
  loading: {
    gap: Size.space['200'],
  },
  speciesCard: {
    maxWidth: '100%',
  },
});

export const __SEARCH_RESULTS_TESTING__ = {
  getScrollOffsetForActiveResult,
  keepActiveResultVisible,
  keepActiveWebResultVisible,
  getSearchResultsListElementId,
  getSearchResultsResultElementId,
};
