import { Colors, Size } from '@/constants/theme';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import type { SpeciesSummary } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
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
  const responsive = useResponsive();

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
      <View
        style={getResponsiveContentContainerStyle(responsive, {
          includeWidth: false,
          includeTopPadding: false,
        })}
      >
        <ThemedText variant="heading">Nearby Species</ThemedText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.row,
          getResponsiveContentContainerStyle(responsive, {
            includeWidth: false,
            includeTopPadding: false,
          }),
          contentContainerStyle,
        ]}
      >
        {species.map((item) => (
          <SpeciesCard
            key={item.taxonId}
            taxonId={item.taxonId}
            commonName={item.commonName}
            scientificName={item.scientificName}
            description={item.description}
            imageSource={item.imageSource}
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
  row: {
    flexDirection: 'row',
    paddingVertical: Size.space['400'],
    gap: Size.space['800'],
  },
  card: {
    maxWidth: 440,
  },
});
