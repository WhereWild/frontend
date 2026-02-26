import { PageHeader, SpeciesCard, ThemedText } from '@/components';
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
            <PageHeader
                showSearchResultsDropdown={false}
                initialQuery={initialQuery}
                onSearchResultsChanged={onSearchResultsChanged} 
                onSearchingChanged={onSearchingChanged}
            />
            <ScrollView
                contentContainerStyle={getResponsiveContentContainerStyle(responsive)}
                bounces={false}
            >
                <View style={[styles.layout, getResponsiveGapStyle(responsive)]}> 
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
                                    testID={`search-result-${item.taxonId}`}
                                />
                            ))}
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
