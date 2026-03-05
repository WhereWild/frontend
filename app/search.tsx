import { SpeciesCard, ThemedText, Filters } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle, getResponsiveGapStyle } from '@/constants/responsiveStyles';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SpeciesSummary } from '@/data/types';

const SIDEBAR_WIDTH = 400;

export default function Search() {
    const [searchResults, setSearchResults] = useState<SpeciesSummary[]>([]);
    const [initialQuery, setInitialQuery] = useState(useLocalSearchParams<{query: string}>().query);
    const [searching, setSearching] = useState(true);

    const onSearchResultsChanged = (results: SpeciesSummary[]) => {
        setSearchResults(results);
        // Clear initial query once results are received
        setInitialQuery('');
    }
    
    const onSearchingChanged = (searching: boolean) => {
        setSearching(searching);
    }

    const colorScheme = useColorScheme();
    const mode = colorScheme === 'dark' ? 'dark' : 'light';
    const palette = Colors[mode];
    const responsive = useResponsive();

  return (
    <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
      <ScrollView
        contentContainerStyle={getResponsiveContentContainerStyle(responsive, {
          includeHorizontalPadding: false,
        })}
        bounces={false}
      >
        {filters.rankingFilterHint ? (
          <View
            style={[
              styles.rankingHintWrapper,
              {
                paddingHorizontal: responsive.marginHorizontal,
                maxWidth: responsive.contentWidth + (responsive.marginHorizontal * 2),
              },
            ]}
          >
            <ThemedText variant="body">{filters.rankingFilterHint}</ThemedText>
          </View>
        ) : null}
        <View
          style={[
            styles.content,
            {
              marginTop: responsive.gap,
              paddingHorizontal: responsive.marginHorizontal,
              maxWidth: responsive.contentWidth + (responsive.marginHorizontal * 2),
            },
          ]}
        >
          <View
            style={[styles.layout, getResponsiveGapStyle(responsive)]}
            onLayout={(event) => {
              setLayoutWidth(event.nativeEvent.layout.width);
            }}
          >
            {filterVisible && (
              <Filters
                style={[styles.filters, shouldExpandFilters && styles.filtersFullWidth]}
                countryValue={filters.countryValue}
                countryOptions={filters.countryOptions}
                onCountryChange={filters.onCountryChange}
                stateValue={filters.stateValue}
                stateOptions={filters.stateOptions}
                onStateChange={filters.onStateChange}
                countyValue={filters.countyValue}
                countyOptions={filters.countyOptions}
                onCountyChange={filters.onCountyChange}
                baseTaxonQuery={filters.baseTaxonQuery}
                onBaseTaxonQueryChange={filters.onBaseTaxonQueryChange}
                onBaseTaxonSubmit={filters.onBaseTaxonSubmit}
                rankValue={filters.rankValue}
                rankOptions={filters.rankOptions}
                onRankChange={filters.onRankChange}
                includeSubspecies={filters.includeSubspecies}
                onIncludeSubspeciesChange={filters.onIncludeSubspeciesChange}
                sortVariableValue={filters.sortVariableValue}
                sortVariableOptions={filters.sortVariableOptions}
                onSortVariableChange={filters.onSortVariableChange}
                sortMetricValue={filters.sortMetricValue}
                sortMetricOptions={filters.sortMetricOptions}
                onSortMetricChange={filters.onSortMetricChange}
                sortOrder={filters.sortOrder}
                onSortOrderChange={filters.onSortOrderChange}
                numberOfResults={filters.numberOfResults}
                onNumberOfResultsChange={filters.onNumberOfResultsChange}
                minimumSamples={filters.minimumSamples}
                onMinimumSamplesChange={filters.onMinimumSamplesChange}
                onResetFilters={filters.onResetFilters}
              />
            )}
            <View style={styles.main}>
              <View style={styles.resultsHeader}>
                <ThemedText variant="heading">Results</ThemedText>
                {searching && (
                  <View style={styles.resultsHeader}>
                    <ActivityIndicator color={palette.icon.brand.default} />
                    <ThemedText variant="subheading">Loading...</ThemedText>
                  </View>
                )}
              </View>
              {searchResults.length === 0 && !searching && (
                <ThemedText variant="body">Enter a search term to see results.</ThemedText>
              )}
              <View style={styles.results}>
                {searchResults.map((item) => (
                  <SpeciesCard
                    key={item.taxonId}
                    taxonId={item.taxonId}
                    commonName={item.commonName}
                    scientificName={item.scientificName}
                    imageSource={item.imageSource}
                    size={isSmallDisplay ? 'compact' : 'default'}
                    style={styles.resultCard}
                    testID={`search-result-${item.taxonId}`}
                  />
                ))}
              </View>
            </View>
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
  layout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    width: '100%',
  },
  filters: {
    gap: Size.space['400'],
    height: '100%',
    flexBasis: SIDEBAR_WIDTH,
    maxWidth: SIDEBAR_WIDTH,
  },
  main: {
    flex: 1,         
    flexDirection: 'column',
    gap: Size.space['400'],
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['400'],
    marginBottom: Size.space['200'],
  },
  results: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space['400'],
    width: '100%',
  },
  speciesCard: {
    flexBasis: '48%',
    maxWidth: '48%',
  },
});
