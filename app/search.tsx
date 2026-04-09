import { SpeciesCard, ThemedText, Filters } from '@/components';
import { Colors, Size, Time, getReactNativeEasing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import {
  getResponsiveContentContainerStyle,
  getResponsiveGapStyle,
} from '@/constants/responsiveStyles';
import { useSearchFilters } from '@/hooks/useSearchFilters';
import { useWebPageHeaderSearch } from '@/components/sections/webPageHeader/useWebPageHeaderSearch';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { SpeciesSummary } from '@/data/types';
import { useWebPageHeaderConfig } from '@/context/WebPageHeaderContext';
import { useNativeTopAppBarConfig } from '@/context/NativeTopAppBarContext';

const FILTERS_COLUMN_MAX_WIDTH = 480;
const FILTERS_COLUMN_MIN_WIDTH = 240;
const RESULTS_COLUMN_MIN_WIDTH = 300;
const FILTER_SLIDE_OFFSET = FILTERS_COLUMN_MAX_WIDTH;
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export default function Search() {
  const isWeb = Platform.OS === 'web';
  const isNative = !isWeb;
  const responsive = useResponsive();
  const isSmallDisplay = responsive.breakpoint === 'phone';
  const { setConfig, resetConfig } = useWebPageHeaderConfig();
  const {
    setConfig: setNativeTopAppBarConfig,
    resetConfig: resetNativeTopAppBarConfig,
  } = useNativeTopAppBarConfig();
  const [searchResults, setSearchResults] = useState<SpeciesSummary[]>([]);
  const initialQuery = useLocalSearchParams<{ query?: string }>().query;
  const [searching, setSearching] = useState(false);
  const [searchContext, setSearchContext] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const filterTranslateX = useRef(new Animated.Value(0));
  const filterTranslateY = useRef(new Animated.Value(0));
  const filterOpacity = useRef(new Animated.Value(1));
  const filterShouldStackRef = useRef(false);

  const filters = useSearchFilters();
  const { ancestorTaxonId } = filters.filterParams;
  const isBaseTaxonSelected = ancestorTaxonId != null;
  const canFitColumnsSideBySide =
    layoutWidth > 0 &&
    layoutWidth >=
      FILTERS_COLUMN_MIN_WIDTH + RESULTS_COLUMN_MIN_WIDTH + responsive.gap;
  const shouldExpandFilters = layoutWidth > 0 && !canFitColumnsSideBySide;

  /** Receives search rows from the shared header search controller. */
  const onSearchResultsChanged = useCallback((results: SpeciesSummary[]) => {
    setSearchResults(results);
  }, []);

  /** Mirrors header search loading state for results-area feedback. */
  const onSearchingChanged = useCallback((isSearching: boolean) => {
    setSearching(isSearching);
  }, []);

  /** Displays contextual search messages (fallbacks/errors) in the results intro block. */
  const onSearchContextChanged = useCallback((message: string | null) => {
    setSearchContext(message);
  }, []);

  /** Toggles filter panel visibility from the global header filter action. */
  const onFilterPress = useCallback(() => {
    setFilterVisible((visible) => {
      filterShouldStackRef.current =
        shouldExpandFilters || (layoutWidth === 0 && isSmallDisplay);

      return !visible;
    });
  }, [isSmallDisplay, layoutWidth, shouldExpandFilters]);

  const nativeSearch = useWebPageHeaderSearch({
    enabled: isNative,
    initialQuery:
      isNative && typeof initialQuery === 'string' ? initialQuery : undefined,
    filterParams: isNative ? filters.filterParams : undefined,
    onSearchResultsChanged: isNative ? onSearchResultsChanged : undefined,
    onSearchingChanged: isNative ? onSearchingChanged : undefined,
    onSearchContextChanged: isNative ? onSearchContextChanged : undefined,
  });

  useEffect(() => {
    setConfig({
      showSearchResultsDropdown: false,
      showFilterButton: true,
      onFilterPress,
      filterLabel: filterVisible ? 'Hide Filter' : 'Filter',
      showResetFilterButton: filters.hasActiveFilters,
      onResetFilterPress: filters.onResetFilters,
      initialQuery: typeof initialQuery === 'string' ? initialQuery : undefined,
      filterParams: filters.filterParams,
      onSearchResultsChanged,
      onSearchingChanged,
      onSearchContextChanged,
    });

    return () => {
      resetConfig();
    };
  }, [
    filterVisible,
    filters.filterParams,
    filters.hasActiveFilters,
    filters.onResetFilters,
    initialQuery,
    onFilterPress,
    onSearchResultsChanged,
    onSearchContextChanged,
    onSearchingChanged,
    resetConfig,
    setConfig,
  ]);

  useEffect(() => {
    if (!isNative) {
      return;
    }

    setNativeTopAppBarConfig({
      searchValue: nativeSearch.searchQuery,
      onSearchValueChange: nativeSearch.setSearchQuery,
      onSubmitSearch: nativeSearch.setSearchQuery,
      primaryAction: {
        onPress: onFilterPress,
        buttonLabel: filterVisible ? 'Hide Filter' : 'Filter',
        buttonAccessibilityLabel: filterVisible ? 'Hide Filter' : 'Filter',
        iconAccessibilityLabel: filterVisible
          ? 'Hide filter panel'
          : 'Show filter panel',
      },
      secondaryAction: {
        isVisible: filters.hasActiveFilters,
        onPress: filters.onResetFilters,
        accessibilityLabel: 'Reset filters',
      },
    });

    return () => {
      resetNativeTopAppBarConfig();
    };
  }, [
    filterVisible,
    filters.hasActiveFilters,
    filters.onResetFilters,
    isNative,
    nativeSearch.searchQuery,
    nativeSearch.setSearchQuery,
    onFilterPress,
    resetNativeTopAppBarConfig,
    setNativeTopAppBarConfig,
  ]);

  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  useEffect(() => {
    const translateX = filterTranslateX.current;
    const translateY = filterTranslateY.current;
    const opacity = filterOpacity.current;
    let showAnimation: Animated.CompositeAnimation | null = null;
    let hideAnimation: Animated.CompositeAnimation | null = null;

    const shouldStack = filterShouldStackRef.current;
    const hiddenTranslateX = shouldStack ? 0 : FILTER_SLIDE_OFFSET;
    const hiddenTranslateY = shouldStack ? -FILTER_SLIDE_OFFSET : 0;

    if (filterVisible) {
      translateX.setValue(hiddenTranslateX);
      translateY.setValue(hiddenTranslateY);
      opacity.setValue(0);

      showAnimation = Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: Time.duration.medium,
          easing: getReactNativeEasing('out'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: Time.duration.medium,
          easing: getReactNativeEasing('out'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: Time.duration.medium,
          easing: getReactNativeEasing('out'),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]);

      showAnimation.start();

      return () => {
        showAnimation?.stop();
      };
    }

    hideAnimation = Animated.parallel([
      Animated.timing(translateX, {
        toValue: hiddenTranslateX,
        duration: Time.duration.medium,
        easing: getReactNativeEasing('in'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: hiddenTranslateY,
        duration: Time.duration.medium,
        easing: getReactNativeEasing('in'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: Time.duration.medium,
        easing: getReactNativeEasing('in'),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    hideAnimation.start();

    return () => {
      hideAnimation?.stop();
    };
  }, [filterVisible]);

  const animatedFilterStyle = {
    opacity: filterOpacity.current,
    transform: [
      { translateX: filterTranslateX.current },
      { translateY: filterTranslateY.current },
    ],
  };

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
      style={[
        styles.filters,
        shouldExpandFilters && styles.filtersFullWidth,
        animatedFilterStyle,
        { pointerEvents: filterVisible ? 'auto' : 'none' },
        !filterVisible ? styles.filtersHidden : undefined,
      ]}
    >
      <Filters
        {...filters}
        style={styles.filtersContent}
        hasBaseTaxonSelection={isBaseTaxonSelected}
      />
    </Animated.View>
  );

  const resultsColumn = (
    <View style={styles.main}>
      <View style={styles.resultsTextBlock}>
        <View style={styles.resultsHeader}>
          <ThemedText variant='heading'>Results</ThemedText>
        </View>
        {searchContext ? (
          <ThemedText variant='body'>{searchContext}</ThemedText>
        ) : null}
        {searchResults.length === 0 && !searching && (
          <ThemedText variant='body'>
            Enter a search term to see results.
          </ThemedText>
        )}
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
    <View
      style={[
        styles.screen,
        { backgroundColor: palette.background.default.default },
      ]}
    >
      <ScrollView
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
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
