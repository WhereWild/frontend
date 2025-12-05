import { SpeciesCard, ThemedText } from '@/components';
import { usePageHeaderConfig } from '@/components/sections/PageHeaderPortal';
import { Colors, Responsive, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

const SIDEBAR_WIDTH = 400;

function normalize(imageFile: string) {
    const updated = imageFile.replace('images/', 'http://127.0.0.1:8000/static/species_images/');
    console.log(updated);
    return updated;
}

export default function Search() {
    const [searchResults, setSearchResults] = useState([]);
    const [query, setQuery] = useState(useLocalSearchParams<{query: string}>().query);
    const headerConfig = useMemo(() => ({
      searchValue: query,
      onSearchChange: setQuery,
    }), [query]);

    usePageHeaderConfig(headerConfig);

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
        <View
          style={[styles.screen, { backgroundColor: palette.background.default.default }]}
          testID="search-screen"
        >
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
                                    imageSource={{uri: normalize(species['image_file'])}}
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
    paddingHorizontal: Responsive.marginHorizontal,
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
