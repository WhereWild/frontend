import { Colors, Size } from '@/constants/theme';
import type { HomePageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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

const formatFallbackGroupLabel = (group: string) =>
  group
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const isTaxonGroupDefined = (
  group: string | null | undefined,
): group is string => Boolean(group);

export type HomeRecommendationFilterProps = {
  allRecommendations: SpeciesSummary[];
  activeGroup: string;
  onGroupChange: (group: string) => void;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function HomeRecommendationFilter({
  allRecommendations,
  activeGroup,
  onGroupChange,
  loading = false,
  style,
}: HomeRecommendationFilterProps) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const availableGroups = React.useMemo(() => {
    const present = new Set(
      allRecommendations
        .map((species) => species.taxonGroup)
        .filter(isTaxonGroupDefined),
    );
    const orderedKnownGroups = GROUP_ORDER.filter(
      (group) => group === 'all' || present.has(group),
    );
    const unknownGroups = Array.from(present)
      .filter((group) => !GROUP_ORDER.includes(group))
      .sort((left, right) => left.localeCompare(right));

    return [...orderedKnownGroups, ...unknownGroups];
  }, [allRecommendations]);

  const pills = React.useMemo(
    () =>
      availableGroups.map((group) => ({
        key: group,
        label: GROUP_LABELS[group] ?? formatFallbackGroupLabel(group),
      })),
    [availableGroups],
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <View style={styles.pillListSlot}>
          <NavigationPillList
            pills={pills}
            selectedKey={activeGroup}
            onSelectionChange={onGroupChange}
            accessibilityLabel='Species group filter'
          />
        </View>
        <View
          collapsable={false}
          accessibilityElementsHidden={!loading}
          importantForAccessibility={loading ? 'auto' : 'no-hide-descendants'}
          style={[styles.spinnerSlot, !loading && styles.hiddenSpinnerSlot]}
        >
          <ActivityIndicator
            size='small'
            color={palette.icon.brand.default}
            style={styles.spinner}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    width: '100%',
    position: 'relative',
  },
  pillListSlot: {
    width: '100%',
    paddingRight: Size.control.dimension.medium + Size.space['300'],
  },
  spinner: {
    marginLeft: 0,
  },
  spinnerSlot: {
    minWidth: Size.control.dimension.medium,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  hiddenSpinnerSlot: {
    opacity: 0,
  },
});
