import {
  SpeciesCard,
  ThemedText,
  Filters,
  PageScrollContainer,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import {
  getResponsiveContentContainerStyle,
  getResponsiveGapStyle,
} from '@/constants/responsiveStyles';
import { useSearchFilters } from '@/hooks/search/filters/useSearchFilters';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import {
  useSearchRouteInitialState,
  useSearchRouteSync,
} from '@/hooks/search/useSearchRouteState';
import {
  pickSearchRouteParams,
  toCurrentSearchRouteParams,
  toInitialSearchFilterState,
} from '@/hooks/search/searchRouteState';
import { useSearchController } from '@/hooks/search/useSearchController';
import { useSearchFilterAnimation } from '@/hooks/search/useSearchFilterAnimation';
import { useSearchPageChrome } from '@/hooks/search/useSearchPageChrome';
import { useSearchRouteLocationHydration } from '../hooks/search/useSearchRouteLocationHydration';

const FILTERS_COLUMN_MAX_WIDTH = 480;
const FILTERS_COLUMN_MIN_WIDTH = 240;
const RESULTS_COLUMN_MIN_WIDTH = 300;
const FILTER_SLIDE_OFFSET = FILTERS_COLUMN_MAX_WIDTH;

export default function Search() {
  const isWeb = Platform.OS === 'web';
  const isNative = !isWeb;
  const responsive = useResponsive();
  const isSmallDisplay = responsive.breakpoint === 'phone';
  const {
    routeSearchQuery,
    initialFilterVisible,
    initialSearchFiltersState,
    searchRouteParams,
  } = useSearchRouteInitialState(isWeb);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const filters = useSearchFilters(initialSearchFiltersState);
  const {
    searchQuery,
    setSearchQuery,
    filterVisible,
    setFilterVisible,
    routeChangedExternally,
    routeStateHydrationPending,
  } = useSearchRouteSync({
    isWeb,
    searchRouteParams,
    initialFilterVisible,
    filterParams: filters.filterParams,
  });
  const {
    descendantRank,
    includeSpeciesLike,
    limit,
    location,
    minSamples,
    query,
    sortMetric,
    sortOrder,
    sortVariable,
    withinTaxonId,
  } = searchRouteParams;
  const stableSearchRouteParams = useMemo(
    () =>
      pickSearchRouteParams({
        query,
        location,
        withinTaxonId,
        descendantRank,
        includeSpeciesLike,
        sortVariable,
        sortMetric,
        sortOrder,
        minSamples,
        limit,
      }),
    [
      descendantRank,
      includeSpeciesLike,
      limit,
      location,
      minSamples,
      query,
      sortMetric,
      sortOrder,
      sortVariable,
      withinTaxonId,
    ],
  );
  const currentRouteParams = useMemo(
    () => toCurrentSearchRouteParams(stableSearchRouteParams),
    [stableSearchRouteParams],
  );
  const routeLocation = currentRouteParams.location;
  const routeFiltersState = useMemo(
    () => toInitialSearchFilterState(currentRouteParams),
    [currentRouteParams],
  );
  const {
    countryValue,
    countryOptions,
    stateValue,
    stateOptions,
    countyValue,
    countyOptions,
    onHydrateRouteLocation,
    onHydrateRouteState,
  } = filters;
  const canFitColumnsSideBySide =
    layoutWidth > 0 &&
    layoutWidth >=
      FILTERS_COLUMN_MIN_WIDTH + RESULTS_COLUMN_MIN_WIDTH + responsive.gap;
  const shouldExpandFilters = layoutWidth > 0 && !canFitColumnsSideBySide;
  const {
    animatedFilterStyle,
    isFilterCollapsed,
    prepareFilterVisibilityToggle,
  } = useSearchFilterAnimation({
    filterVisible,
    slideOffset: FILTER_SLIDE_OFFSET,
  });

  /** Toggles filter panel visibility from the global header filter action. */
  const onFilterPress = useCallback(() => {
    setFilterVisible((visible) => {
      prepareFilterVisibilityToggle(
        shouldExpandFilters || (layoutWidth === 0 && isSmallDisplay),
      );

      return !visible;
    });
  }, [
    isSmallDisplay,
    layoutWidth,
    prepareFilterVisibilityToggle,
    setFilterVisible,
    shouldExpandFilters,
  ]);

  const {
    nativeSearchQuery,
    setNativeSearchQuery,
    searchContext,
    searchResults,
    searching,
  } = useSearchController({
    filterParams: filters.filterParams,
    nativeInitialQuery: routeSearchQuery,
    isNative,
    isWeb,
    searchEnabled: !routeStateHydrationPending,
    searchQuery,
  });

  useSearchPageChrome({
    allowWebSearchControl: !routeStateHydrationPending,
    filterVisible,
    hasActiveFilters: filters.hasActiveFilters,
    isNative,
    isWeb,
    nativeSearchQuery,
    onFilterPress,
    onResetFilters: filters.onResetFilters,
    searchQuery,
    setNativeSearchQuery,
    setSearchQuery,
  });

  useEffect(() => {
    if (!routeChangedExternally) {
      return;
    }

    onHydrateRouteState(routeFiltersState);
  }, [onHydrateRouteState, routeChangedExternally, routeFiltersState]);

  useSearchRouteLocationHydration({
    routeLocation,
    countryValue,
    countryOptions,
    stateValue,
    stateOptions,
    countyValue,
    countyOptions,
    onHydrateRouteLocation,
  });

  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const resultsMessage = searchContext
    ? searchContext
    : !searching && searchResults.length === 0
      ? 'Enter a search term to see results.'
      : '';

  const contentStyle = [
    styles.content,
    {
      marginTop: responsive.gap,
      marginBottom: responsive.gap,
      paddingHorizontal: responsive.marginHorizontal,
      maxWidth: responsive.contentWidth + responsive.marginHorizontal * 2,
    },
  ];

  const filterPanel = (
    <Animated.View
      accessibilityElementsHidden={!filterVisible}
      importantForAccessibility={filterVisible ? 'auto' : 'no-hide-descendants'}
      testID='search-filter-panel'
      style={[
        styles.filters,
        shouldExpandFilters && styles.filtersFullWidth,
        animatedFilterStyle,
        { pointerEvents: filterVisible ? 'auto' : 'none' },
        isFilterCollapsed ? styles.filtersHidden : undefined,
      ]}
    >
      <Filters {...filters.panelProps} style={styles.filtersContent} />
    </Animated.View>
  );

  const resultsColumn = (
    <View style={styles.main}>
      <View style={styles.resultsTextBlock}>
        <View style={styles.resultsHeader}>
          <ThemedText variant='heading'>Results</ThemedText>
        </View>
        <View
          accessibilityElementsHidden={resultsMessage.length === 0}
          importantForAccessibility={
            resultsMessage.length === 0 ? 'no-hide-descendants' : 'auto'
          }
          style={
            resultsMessage.length === 0
              ? styles.resultsMessageHidden
              : undefined
          }
        >
          <ThemedText variant='body'>{resultsMessage}</ThemedText>
        </View>
      </View>
      <View style={styles.results}>
        <View
          collapsable={false}
          accessibilityElementsHidden={!searching}
          importantForAccessibility={searching ? 'auto' : 'no-hide-descendants'}
          style={[
            { pointerEvents: 'none' },
            !searching ? styles.resultsLoadingRowHidden : undefined,
          ]}
        >
          <View style={styles.resultsLoadingRow}>
            <ActivityIndicator color={palette.icon.brand.default} />
            <ThemedText variant='subheading'>Loading...</ThemedText>
          </View>
        </View>
        {searchResults.map((item) => (
          <SpeciesCard
            key={item.taxonId}
            taxonId={item.taxonId}
            commonName={item.commonName}
            scientificName={item.scientificName}
            description={item.description}
            imageSource={item.imageSource}
            size={isSmallDisplay ? 'compact' : 'default'}
            style={styles.resultCard}
            testID={`search-result-${item.taxonId}`}
          />
        ))}
      </View>
    </View>
  );

  return (
    <PageSurface>
      <PageScrollContainer
        contentContainerStyle={getResponsiveContentContainerStyle(responsive, {
          includeHorizontalPadding: false,
          includeTopPadding: false,
        })}
        bounces={true}
        keyboardShouldPersistTaps='handled'
      >
        <View style={contentStyle}>
          <View
            style={[styles.layout, getResponsiveGapStyle(responsive)]}
            onLayout={(event) => {
              setLayoutWidth(event.nativeEvent.layout.width);
            }}
          >
            {filterPanel}
            {resultsColumn}
          </View>
        </View>
      </PageScrollContainer>
    </PageSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignSelf: 'center',
  },
  layout: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
  },
  filters: {
    flexBasis: FILTERS_COLUMN_MIN_WIDTH,
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: FILTERS_COLUMN_MAX_WIDTH,
    minWidth: FILTERS_COLUMN_MIN_WIDTH,
  },
  filtersFullWidth: {
    flexBasis: '100%',
    maxWidth: '100%',
  },
  filtersHidden: {
    opacity: 0,
    maxHeight: 0,
    overflow: 'hidden',
  },
  filtersContent: {
    width: '100%',
  },
  main: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: RESULTS_COLUMN_MIN_WIDTH,
    minWidth: RESULTS_COLUMN_MIN_WIDTH,
    flexDirection: 'column',
    gap: Size.space['400'],
  },
  resultsTextBlock: {
    gap: Size.space.text.paragraph,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultsMessageHidden: {
    opacity: 0,
    maxHeight: 0,
    overflow: 'hidden',
  },
  resultsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['400'],
  },
  resultsLoadingRowHidden: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
  },
  results: {
    flexDirection: 'column',
    gap: Size.space['400'],
    minWidth: RESULTS_COLUMN_MIN_WIDTH,
    width: '100%',
  },
  resultCard: {
    width: '100%',
    maxWidth: '100%',
  },
});
