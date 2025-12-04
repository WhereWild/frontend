import { PageHeader, SpeciesCard, ThemedText } from '@/components';
import type { SpeciesCardProps } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';

const SIDEBAR_WIDTH = 400;

export default function Search() {
    const [searchResults, setSearchResults] = useState([]);
    const [query, setQuery] = useState(useLocalSearchParams<{query: string}>().query);

    useEffect(() => {
        async function getSearchResults() {
            const apiRequest = "http://127.0.0.1:8000/search/" + query;

            const response = await fetch(apiRequest);
            if (response.ok) {
                setSearchResults(await response.json())
            }
        }
        getSearchResults();
    }, [query])

    const colorScheme = useColorScheme();
    const mode = colorScheme === 'dark' ? 'dark' : 'light';
    const palette = Colors[mode];

    return (
        <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
            <PageHeader
                searchValue={query}
                onSearchChange={setQuery}
            />

            <ScrollView
                contentContainerStyle={styles.content}
                bounces={false}
            >
                <View style={styles.layout}>
                    <View style={styles.main}>
                        <ThemedText variant="heading">Results</ThemedText>
                        <View style={styles.results}>
                            {searchResults.map((species) => (
                                <SpeciesCard
                                    key={species['taxon_id']}
                                    taxonId={species['taxon_id']}
                                    commonName={species['common_name']}
                                    scientificName={species['scientific_name']}
                                    description=''
                                    style={styles.speciesCard} />
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
  content: {
    paddingHorizontal: Size.space['1600'],
    paddingTop: Size.space['800'],
    width: '100%',
  },
  layout: {
    flexDirection: 'row',
    gap: Size.space['800'],
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
