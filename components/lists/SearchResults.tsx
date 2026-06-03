// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Colors, Shadows, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '../text/ThemedText';
import type { SpeciesSummary } from '@/data/types';
import { SpeciesCard } from '../cards/SpeciesCard';

type SearchResultsScrollRef = ScrollView;

type ResultLayout = {
  y: number;
  height: number;
};

type ScrollMetrics = {
  height: number;
  offset: number;
};

type StableResultSlot = SpeciesSummary | null;

const VISIBILITY_BOTTOM_BUFFER = Size.space['600'];
const VISIBILITY_PADDING = Size.space['400'];
const LOADING_CARD_COUNT = 5;

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
  listRef: React.RefObject<SearchResultsScrollRef | null>,
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

  listRef.current?.scrollTo({
    animated: true,
    y: nextOffset,
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
  const isPanelHidden = !isVisible;
  const showLoadingState = isLoading;
  const showEmptyState = !isLoading && results.length === 0;
  const showResultsState = !isLoading && results.length > 0;
  const isInlineLayout = layout === 'inline';
  const showInlineResults = showResultsState && isInlineLayout;
  const showFloatingResults = showResultsState && !isInlineLayout;
  const isNativeInlineLayout = isInlineLayout && Platform.OS !== 'web';
  const listRef = React.useRef<SearchResultsScrollRef | null>(null);
  const resultLayoutsRef = React.useRef<Record<number, ResultLayout>>({});
  const scrollMetricsRef = React.useRef<ScrollMetrics>({
    height: 0,
    offset: 0,
  });
  const [layoutVersion, setLayoutVersion] = React.useState(0);
  const [stableResultSlotCount, setStableResultSlotCount] = React.useState(
    results.length,
  );
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
  const contentInteractionProps = {
    onPointerEnter,
    onPointerLeave,
    onTouchStart,
    onTouchEnd,
    onFocus,
    onBlur,
  };

  React.useEffect(() => {
    if (results.length > stableResultSlotCount) {
      setStableResultSlotCount(results.length);
    }
  }, [results.length, stableResultSlotCount]);

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

  const renderResultCard = React.useCallback(
    (item: SpeciesSummary, index: number) => (
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
        interactionMode='press-only'
        size='compact'
        onPress={() => {
          if (!onSelectResult) {
            return;
          }

          if (Platform.OS === 'web' || !isInlineLayout) {
            onSelectResult(item);
            return;
          }

          // Native inline selection can synchronously collapse the panel while the
          // press interaction is still settling. Waiting two frames avoids tearing
          // down the row subtree during the same native press/update cycle.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              onSelectResult(item);
            });
          });
        }}
        testID={`search-result-${item.taxonId}`}
      />
    ),
    [
      activeResultIndex,
      isInlineLayout,
      onSelectResult,
      palette.background.default.secondaryHover,
    ],
  );

  const stableResultSlots = React.useMemo<StableResultSlot[]>(
    () =>
      Array.from({ length: stableResultSlotCount }, (_, index) =>
        index < results.length ? results[index] : null,
      ),
    [results, stableResultSlotCount],
  );

  const loadingCards = React.useMemo(
    () =>
      Array.from({ length: LOADING_CARD_COUNT }, (_, index) => (
        <SpeciesCard
          key={`loading-${index}`}
          loading
          loadingPatternSeed={index}
          taxonId={0}
          commonName=''
          scientificName=''
          interactionMode='press-only'
          size='compact'
          style={styles.speciesCard}
        />
      )),
    [],
  );

  if (isInlineLayout && !isNativeInlineLayout && isPanelHidden) {
    return null;
  }

  return (
    <View
      collapsable={false}
      style={[
        panelStyles,
        { maxHeight },
        isPanelHidden ? styles.hiddenPanel : null,
      ]}
      accessibilityElementsHidden={isPanelHidden}
      importantForAccessibility={isPanelHidden ? 'no-hide-descendants' : 'auto'}
      testID={testID}
    >
      <View
        accessibilityElementsHidden={!showLoadingState}
        importantForAccessibility={
          showLoadingState ? 'auto' : 'no-hide-descendants'
        }
        {...contentInteractionProps}
        style={!showLoadingState ? styles.hiddenContentSlot : undefined}
        testID={showLoadingState && testID ? `${testID}-loading` : undefined}
      >
        <View style={styles.listContent}>{loadingCards}</View>
      </View>

      <View
        accessibilityElementsHidden={!showEmptyState}
        importantForAccessibility={
          showEmptyState ? 'auto' : 'no-hide-descendants'
        }
        {...contentInteractionProps}
        style={!showEmptyState ? styles.hiddenContentSlot : undefined}
        testID={showEmptyState && testID ? `${testID}-empty` : undefined}
      >
        <View style={styles.centerContent}>
          <ThemedText variant='body'>{emptyMessage}</ThemedText>
        </View>
      </View>

      {isInlineLayout ? (
        showInlineResults ? (
          <View
            accessibilityElementsHidden={false}
            importantForAccessibility='auto'
            {...contentInteractionProps}
          >
            <View
              style={styles.listContent}
              testID={testID ? `${testID}-list` : undefined}
            >
              {stableResultSlots.map((item, index) => {
                const isVisible = item != null;

                return (
                  <View
                    key={`inline-slot-${index}`}
                    collapsable={false}
                    testID={
                      testID
                        ? `${testID}-inline-result-slot-${index}`
                        : undefined
                    }
                    accessibilityElementsHidden={!isVisible}
                    importantForAccessibility={
                      isVisible ? 'auto' : 'no-hide-descendants'
                    }
                    style={!isVisible ? styles.hiddenResultSlot : undefined}
                  >
                    {item == null ? (
                      <View style={styles.resultPlaceholder} />
                    ) : (
                      renderResultCard(item, index)
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null
      ) : (
        <View
          accessibilityElementsHidden={!showFloatingResults}
          importantForAccessibility={
            showFloatingResults ? 'auto' : 'no-hide-descendants'
          }
          {...contentInteractionProps}
          style={
            !showFloatingResults
              ? styles.hiddenContentSlot
              : styles.floatingListSlot
          }
        >
          <ScrollView
            ref={listRef}
            nativeID={listElementId}
            onLayout={handleListLayout}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
            scrollEnabled
            nestedScrollEnabled
            keyboardShouldPersistTaps='always'
            keyboardDismissMode='none'
            contentContainerStyle={styles.listContent}
            // Floating search results are intentionally small, so a plain ScrollView
            // avoids VirtualizedList's deferred cell updates while keeping behavior simple.
            testID={
              showFloatingResults && testID ? `${testID}-list` : undefined
            }
          >
            {stableResultSlots.map((item, index) => {
              const isVisible = item != null;

              return (
                <View
                  key={`floating-slot-${index}`}
                  collapsable={false}
                  testID={
                    testID
                      ? `${testID}-floating-result-slot-${index}`
                      : undefined
                  }
                  nativeID={
                    isVisible
                      ? getSearchResultsResultElementId(instanceId, index)
                      : undefined
                  }
                  accessibilityElementsHidden={!isVisible}
                  importantForAccessibility={
                    isVisible ? 'auto' : 'no-hide-descendants'
                  }
                  onLayout={
                    isVisible
                      ? (event) => updateResultLayout(index, event)
                      : undefined
                  }
                  style={!isVisible ? styles.hiddenResultSlot : undefined}
                >
                  {item == null ? (
                    <View style={styles.resultPlaceholder} />
                  ) : (
                    renderResultCard(item, index)
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
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
  hiddenPanel: {
    opacity: 0,
    height: 0,
    maxHeight: 0,
    borderWidth: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  hiddenContentSlot: {
    opacity: 0,
    height: 0,
    maxHeight: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  hiddenResultSlot: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  resultPlaceholder: {
    height: 0,
    opacity: 0,
  },
  floatingListSlot: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
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
