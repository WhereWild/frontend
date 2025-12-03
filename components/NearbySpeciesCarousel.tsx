import { Colors, Responsive, Size } from '@/constants/theme';
import type { SpeciesSummary } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SpeciesCard } from './cards/SpeciesCard';
import { ThemedText } from './text/ThemedText';

export type NearbySpeciesCarouselProps = {
  species: SpeciesSummary[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function NearbySpeciesCarousel({
  species,
  style,
  contentContainerStyle,
}: NearbySpeciesCarouselProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  if (!species.length) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
        style,
      ]}
    >
      <View style={styles.headingRow}>
        <ThemedText variant="heading">Nearby Species</ThemedText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, contentContainerStyle]}
      >
        {species.map((item) => (
          <SpeciesCard
            key={item.scientificName}
            commonName={item.commonName}
            scientificName={item.scientificName}
            description={item.description}
            style={styles.card}
            variant="tertiary"
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Size.space['400'],
  },
  headingRow: {
    paddingHorizontal: Responsive.marginHorizontal
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: Responsive.marginHorizontal,
    paddingVertical: Size.space['400'],
    gap: Size.space['800'],
  },
  card: {
    maxWidth: 440,
  },
});
