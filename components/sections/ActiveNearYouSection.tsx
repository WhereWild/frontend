import { Size } from '@/constants/theme';
import type { HomePageData } from '@/data/types';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { SpeciesCard } from '../cards/SpeciesCard';
import { ThemedText } from '../text/ThemedText';

export type ActiveNearYouSectionProps = {
  recommendations: HomePageData['recommendations']['items'];
  showHeading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ActiveNearYouSection({
  recommendations,
  showHeading = true,
  style,
}: ActiveNearYouSectionProps) {
  return (
    <View style={[styles.section, style]}>
      {showHeading ? <ThemedText variant="heading">Active Near You</ThemedText> : null}

      {recommendations.map((species) => (
        <SpeciesCard key={species.taxonId} {...species} style={styles.speciesCard} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Size.space['400'],
    width: '100%',
  },
  speciesCard: {
    maxWidth: '100%',
  },
});