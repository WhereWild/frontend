import { Colors, Size } from '@/constants/theme';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SpeciesCard } from '../cards/SpeciesCard';
import { ThemedText } from '../text/ThemedText';
import { NavigationPillList } from '../navigation/NavigationPillList';

type SpeciesSummary = HomePageData['recommendations']['items'][number];

const GROUP_LABELS: Record<string, string> = {
  all: 'All',
  plants: 'Plants',
  animals: 'Animals',
  birds: 'Birds',
  fungi: 'Fungi',
  arthropods: 'Arthropods',
};

const GROUP_ORDER = [
  'all',
  'plants',
  'animals',
  'birds',
  'fungi',
  'arthropods',
];

export type ActiveNearYouSectionProps = {
  recommendations: SpeciesSummary[];
  allRecommendations: SpeciesSummary[];
  loading?: boolean;
  showHeading?: boolean;
  activeGroup?: string;
  onGroupChange?: (group: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function ActiveNearYouSection({
  recommendations,
  allRecommendations,
  loading = false,
  showHeading = true,
  activeGroup: activeGroupProp,
  onGroupChange,
  style,
}: ActiveNearYouSectionProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [activeGroupInternal, setActiveGroupInternal] = React.useState('all');
  const activeGroup = activeGroupProp ?? activeGroupInternal;
  const setActiveGroup = onGroupChange ?? setActiveGroupInternal;

  const availableGroups = React.useMemo(() => {
    const present = new Set(
      allRecommendations.map((s) => s.taxonGroup).filter(Boolean),
    );
    return GROUP_ORDER.filter((g) => g === 'all' || present.has(g));
  }, [allRecommendations]);

  const pills = React.useMemo(
    () => availableGroups.map((g) => ({ key: g, label: GROUP_LABELS[g] ?? g })),
    [availableGroups],
  );

  // Reset to 'all' if the active group disappears from the available list
  React.useEffect(() => {
    if (!availableGroups.includes(activeGroup)) {
      setActiveGroup('all');
    }
  }, [availableGroups, activeGroup, setActiveGroup]);

  const displayed = React.useMemo(() => {
    if (activeGroup === 'all') return recommendations;
    return allRecommendations.filter((s) => s.taxonGroup === activeGroup);
  }, [activeGroup, recommendations, allRecommendations]);

  return (
    <View style={[styles.section, style]}>
      <View style={styles.headingRow}>
        {showHeading ? (
          <ThemedText variant='heading'>Active Near You</ThemedText>
        ) : null}
        {loading ? (
          <ActivityIndicator
            size='small'
            color={palette.icon.brand.default}
            style={styles.spinner}
          />
        ) : null}
      </View>

      <NavigationPillList
        pills={pills}
        selectedKey={activeGroup}
        onSelectionChange={setActiveGroup}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        {displayed.map((species) => (
          <SpeciesCard
            key={species.taxonId}
            {...species}
            style={styles.speciesCard}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Size.space['300'],
    width: '100%',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  spinner: {
    marginLeft: Size.space['100'],
  },
  scroll: {
    maxHeight: 600,
  },
  scrollContent: {
    gap: Size.space['400'],
    paddingBottom: Size.space['200'],
  },
  speciesCard: {
    maxWidth: '100%',
  },
});
