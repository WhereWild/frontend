// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  SpeciesCard,
  type SelectOption,
  ThemedText,
  Filters,
  PageScrollContainer,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { Size } from '@/constants/theme';
import { useNativeSearchSession } from '@/context/NativeSearchSessionContext';
import { useResponsive } from '@/hooks/useResponsive';
import {
  getResponsiveContentContainerStyle,
  getResponsiveGapStyle,
} from '@/constants/responsiveStyles';
import { useSearchFilters } from '@/hooks/search/filters/useSearchFilters';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import {
  useSearchRouteInitialState,
  useSearchRouteSync,
} from '@/hooks/search/useSearchRouteState';
import {
  pickSearchRouteParams,
  type SearchRouteParams,
  toCurrentSearchRouteParams,
  toInitialSearchFilterState,
} from '@/hooks/search/searchRouteState';
import { useSearchController } from '@/hooks/search/useSearchController';
import { useSearchFilterAnimation } from '@/hooks/search/useSearchFilterAnimation';
import { useSearchPageChrome } from '@/hooks/search/useSearchPageChrome';
import { useSearchRouteLocationHydration } from '../hooks/search/useSearchRouteLocationHydration';
import { WebMetadata } from '@/utils/webMetadata';
import type { UseSearchFiltersInitialState } from '@/hooks/search/filters/useSearchFilters';
import type { FilterPredicate } from '@/hooks/search/filters/useSearchFilters.state';

const FILTERS_COLUMN_MAX_WIDTH = 480;
const FILTERS_COLUMN_MIN_WIDTH = 240;
const RESULTS_COLUMN_MIN_WIDTH = 300;
const FILTER_SLIDE_OFFSET = FILTERS_COLUMN_MAX_WIDTH;

type PersistedSearchFiltersStateInput = {
  ancestorTaxonId: string | null;
  baseTaxonQuery: string;
  countryOptions: SelectOption[];
  countryValue: string;
  countyOptions: SelectOption[];
  countyValue: string;
  includeSubspecies: boolean;
  minimumSamples: number;
  numberOfResults: number;
  rankValue: string;
  sortMetricValue: string;
  sortOrder: 'ascending' | 'descending';
  sortReference: number;
  listOffset: number;
  minRbar: number;
  predicates: FilterPredicate[];
  sortVariableValue: string;
  stateOptions: SelectOption[];
  stateValue: string;
};

const hasExplicitSearchRouteState = (params: SearchRouteParams) =>
  Object.keys(toCurrentSearchRouteParams(params)).length > 0;

const toPersistedSearchFiltersState = ({
  ancestorTaxonId,
  baseTaxonQuery,
  countryOptions,
  countryValue,
  countyOptions,
  countyValue,
  includeSubspecies,
  minimumSamples,
  numberOfResults,
  rankValue,
  sortMetricValue,
  sortOrder,
  sortReference,
  listOffset,
  minRbar,
  predicates,
  sortVariableValue,
  stateOptions,
  stateValue,
}: PersistedSearchFiltersStateInput): UseSearchFiltersInitialState => ({
  location: {
    countryValue,
    stateValue,
    countyValue,
    countryOptions,
    stateOptions,
    countyOptions,
  },
  taxon: {
    ancestorTaxonId,
    baseTaxonQuery,
  },
  ranking: {
    rankValue,
    includeSubspecies,
    sortVariableValue,
    sortMetricValue,
    sortOrder,
    sortReference,
    listOffset,
    minRbar,
    predicates,
  },
  quantity: {
    numberOfResults,
    minimumSamples,
  },
});

const usePersistedSearchFiltersState = (
  filters: ReturnType<typeof useSearchFilters>,
) => {
  const ancestorTaxonId = filters.filterParams.withinTaxonId ?? null;
  const baseTaxonQuery = filters.baseTaxonQuery;
  const countryOptions = filters.countryOptions;
  const countryValue = filters.countryValue;
  const countyOptions = filters.countyOptions;
  const countyValue = filters.countyValue;
  const includeSubspecies = filters.includeSubspecies;
  const minimumSamples = filters.minimumSamples;
  const numberOfResults = filters.numberOfResults;
  const rankValue = filters.rankValue;
  const sortMetricValue = filters.sortMetricValue;
  const sortOrder = filters.sortOrder;
  const sortReference = filters.sortReference;
  const listOffset = filters.listOffset;
  const minRbar = filters.minRbar;
  const predicates = filters.predicates;
  const sortVariableValue = filters.sortVariableValue;
  const stateOptions = filters.stateOptions;
  const stateValue = filters.stateValue;

  return useMemo(
    () =>
      toPersistedSearchFiltersState({
        ancestorTaxonId,
        baseTaxonQuery,
        countryOptions,
        countryValue,
        countyOptions,
        countyValue,
        includeSubspecies,
        minimumSamples,
        numberOfResults,
        rankValue,
        sortMetricValue,
        sortOrder,
        sortReference,
        listOffset,
        minRbar,
        predicates,
        sortVariableValue,
        stateOptions,
        stateValue,
      }),
    [
      ancestorTaxonId,
      baseTaxonQuery,
      countryOptions,
      countryValue,
      countyOptions,
      countyValue,
      includeSubspecies,
      minimumSamples,
      listOffset,
      minRbar,
      predicates,
      numberOfResults,
      rankValue,
      sortMetricValue,
      sortOrder,
      sortReference,
      sortVariableValue,
      stateOptions,
      stateValue,
    ],
  );
};

export default function Search() {
  const isWeb = Platform.OS === 'web';
  const isNative = !isWeb;
  const {
    filterVisible: persistedFilterVisible,
    filtersState: persistedFiltersState,
    searchQuery: persistedSearchQuery,
    setFilterVisible: setPersistedFilterVisible,
    setFiltersState: setPersistedFiltersState,
    setSearchQuery: setPersistedSearchQuery,
  } = useNativeSearchSession();
  const responsive = useResponsive();
  const isSmallDisplay = responsive.breakpoint === 'phone';
  const {
    routeSearchQuery,
    initialFilterVisible,
    initialSearchFiltersState,
    searchRouteParams,
  } = useSearchRouteInitialState(isWeb);
  const nativeRouteHasExplicitState =
    hasExplicitSearchRouteState(searchRouteParams);
  const shouldRestoreNativeSearchSession =
    isNative && !nativeRouteHasExplicitState;
  const resolvedInitialFilterVisible = shouldRestoreNativeSearchSession
    ? persistedFilterVisible
    : initialFilterVisible;
  const resolvedInitialSearchFiltersState =
    shouldRestoreNativeSearchSession && persistedFiltersState != null
      ? persistedFiltersState
      : initialSearchFiltersState;
  const resolvedInitialSearchQuery = shouldRestoreNativeSearchSession
    ? persistedSearchQuery
    : routeSearchQuery;
  const [layoutWidth, setLayoutWidth] = useState(0);
  const filters = useSearchFilters(resolvedInitialSearchFiltersState);
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
    initialFilterVisible: resolvedInitialFilterVisible,
    initialSearchQuery: resolvedInitialSearchQuery,
    filterParams: filters.filterParams,
  });
  const { routeFiltersState, routeLocation } = useMemo(() => {
    const currentRouteParams = toCurrentSearchRouteParams(
      pickSearchRouteParams(searchRouteParams),
    );

    return {
      routeFiltersState: toInitialSearchFilterState(currentRouteParams),
      routeLocation: currentRouteParams.location,
    };
  }, [searchRouteParams]);
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
    searchTotal,
    searching,
  } = useSearchController({
    filterParams: filters.filterParams,
    nativeInitialQuery: resolvedInitialSearchQuery,
    isNative,
    isWeb,
    searchEnabled: !routeStateHydrationPending,
    searchQuery,
  });
  const persistedSearchFiltersState = usePersistedSearchFiltersState(filters);

  useEffect(() => {
    if (!isNative) {
      return;
    }

    setPersistedSearchQuery(nativeSearchQuery);
    setPersistedFilterVisible(filterVisible);
    setPersistedFiltersState(persistedSearchFiltersState);
  }, [
    filterVisible,
    isNative,
    nativeSearchQuery,
    persistedSearchFiltersState,
    setPersistedFilterVisible,
    setPersistedFiltersState,
    setPersistedSearchQuery,
  ]);

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

  const resultsMessage = searchContext
    ? searchContext
    : !searching && searchResults.length === 0
      ? 'Enter a search term to see results.'
      : '';
  const resultSlotCount = filters.numberOfResults;
  const loadingResults = useMemo(
    () => Array.from({ length: resultSlotCount }, (_, index) => index),
    [resultSlotCount],
  );
  const renderedResults = loadingResults.map((index) => {
    const item = searchResults[index];
    const isVisible = searching || Boolean(item);

    return (
      <View
        key={`result-slot-${index}`}
        collapsable={false}
        accessibilityElementsHidden={!isVisible}
        importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
        pointerEvents={isVisible ? 'auto' : 'none'}
        style={[
          styles.resultSlot,
          isVisible && index > 0 ? styles.resultSlotSpaced : undefined,
          !isVisible ? styles.resultSlotHidden : undefined,
        ]}
      >
        {searching ? (
          <SpeciesCard
            loading
            loadingPatternSeed={index}
            taxonId=''
            commonName=''
            scientificName=''
            interactionMode='press-only'
            size={isSmallDisplay ? 'compact' : 'default'}
            style={styles.resultCard}
          />
        ) : item ? (
          <SpeciesCard
            taxonId={item.taxonId}
            commonName={item.commonName}
            scientificName={item.scientificName}
            description={item.description}
            imageSource={item.imageSource}
            size={isSmallDisplay ? 'compact' : 'default'}
            style={styles.resultCard}
            testID={`search-result-${item.taxonId}`}
          />
        ) : (
          <View collapsable={false} style={styles.resultSlotPlaceholder} />
        )}
      </View>
    );
  });

  const contentStyle = [
    styles.content,
    {
      marginTop: responsive.gap,
      marginBottom: responsive.gap,
      paddingHorizontal: responsive.marginHorizontal,
      maxWidth: responsive.contentWidth + responsive.marginHorizontal * 2,
    },
  ];

  return (
    <PageSurface>
      {isWeb ? (
        <WebMetadata
          title='WhereWild | Search'
          description='Search species by common or scientific name and refine results with filters.'
          path='/search'
        />
      ) : null}
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
            <Animated.View
              accessibilityElementsHidden={!filterVisible}
              importantForAccessibility={
                filterVisible ? 'auto' : 'no-hide-descendants'
              }
              testID='search-filter-panel'
              style={[
                styles.filters,
                shouldExpandFilters && styles.filtersFullWidth,
                animatedFilterStyle,
                { pointerEvents: filterVisible ? 'auto' : 'none' },
                isFilterCollapsed ? styles.filtersHidden : undefined,
              ]}
            >
              <Filters
                {...filters.panelProps}
                totalResults={searchTotal}
                style={styles.filtersContent}
              />
            </Animated.View>

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
              <View style={styles.results}>{renderedResults}</View>
            </View>
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
  results: {
    flexDirection: 'column',
    minWidth: RESULTS_COLUMN_MIN_WIDTH,
    width: '100%',
  },
  resultSlot: {
    width: '100%',
  },
  resultSlotSpaced: {
    marginTop: Size.space['400'],
  },
  resultSlotHidden: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
    height: 0,
    overflow: 'hidden',
  },
  resultSlotPlaceholder: {
    height: 0,
  },
  resultCard: {
    width: '100%',
    maxWidth: '100%',
  },
});
