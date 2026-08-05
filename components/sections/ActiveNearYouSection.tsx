// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Size } from '@/constants/theme';
import type { HomePageData } from '@/data/types';
import { useResponsive } from '@/hooks/useResponsive';
import React from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  NativeScrollEvent,
  ScrollView,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
  View,
} from 'react-native';
import { SpeciesCard } from '../cards/SpeciesCard';
import { ThemedText } from '../text/ThemedText';

type SpeciesSummary = HomePageData['recommendations']['items'][number];
type ActiveNearYouLoadingItem = {
  key: string;
  index: number;
};

type ActiveNearYouListItem = SpeciesSummary | ActiveNearYouLoadingItem;
type ActiveNearYouNativeSlotItem = ActiveNearYouListItem | null;

const LOADING_CARD_COUNT = 5;

export type ActiveNearYouSectionProps = {
  recommendations: SpeciesSummary[];
  allRecommendations: SpeciesSummary[];
  loading?: boolean;
  showHeading?: boolean;
  activeGroup?: string;
  style?: StyleProp<ViewStyle>;
  nativeFirstItemTopMargin?: number;
  onNativeScrolledChange?: (isScrolled: boolean) => void;
};

export function ActiveNearYouSection({
  recommendations,
  allRecommendations,
  loading = false,
  showHeading = true,
  activeGroup: activeGroupProp,
  style,
  nativeFirstItemTopMargin = 0,
  onNativeScrolledChange,
}: ActiveNearYouSectionProps) {
  const responsive = useResponsive();
  const cardSize = responsive.breakpoint === 'phone' ? 'compact' : 'default';
  const cardGap =
    cardSize === 'compact' ? Size.space['200'] : Size.space['400'];
  const activeGroup = activeGroupProp ?? 'all';
  const isNative = Platform.OS !== 'web';
  const isHeadingVisible = showHeading && !isNative;
  const isScrolledRef = React.useRef(false);

  const displayed = React.useMemo(() => {
    if (activeGroup === 'all') return recommendations;
    return allRecommendations.filter((s) => s.taxonGroup === activeGroup);
  }, [activeGroup, recommendations, allRecommendations]);
  const loadingItems = React.useMemo(
    () =>
      Array.from({ length: LOADING_CARD_COUNT }, (_, index) => ({
        key: `loading-${index}`,
        index,
      })),
    [],
  );
  const displayItems = loading ? loadingItems : displayed;
  const [nativeSlotCount, setNativeSlotCount] = React.useState(() =>
    Math.max(
      LOADING_CARD_COUNT,
      recommendations.length,
      allRecommendations.length,
    ),
  );

  React.useEffect(() => {
    const nextSlotCount = Math.max(
      LOADING_CARD_COUNT,
      recommendations.length,
      allRecommendations.length,
    );

    if (nextSlotCount > nativeSlotCount) {
      setNativeSlotCount(nextSlotCount);
    }
  }, [allRecommendations.length, nativeSlotCount, recommendations.length]);

  const getItemKey = React.useCallback((item: ActiveNearYouListItem) => {
    return 'taxonId' in item ? String(item.taxonId) : item.key;
  }, []);

  const renderSpeciesCard = React.useCallback(
    (item: ActiveNearYouListItem) => {
      if (!('taxonId' in item)) {
        return (
          <SpeciesCard
            loading
            loadingPatternSeed={item.index}
            taxonId=''
            commonName=''
            scientificName=''
            interactionMode='press-only'
            size={cardSize}
            style={styles.speciesCard}
          />
        );
      }

      return (
        <SpeciesCard {...item} size={cardSize} style={styles.speciesCard} />
      );
    },
    [cardSize],
  );

  const header = React.useMemo(
    () => (
      <View style={styles.header}>
        <View
          collapsable={false}
          testID='active-near-you-heading-slot'
          accessibilityElementsHidden={!isHeadingVisible}
          importantForAccessibility={
            isHeadingVisible ? 'auto' : 'no-hide-descendants'
          }
          style={[styles.headingRow, !isHeadingVisible && styles.hiddenSlot]}
        >
          <ThemedText variant='heading'>Active Near You</ThemedText>
        </View>
      </View>
    ),
    [isHeadingVisible],
  );

  const handleNativeScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIsScrolled = event.nativeEvent.contentOffset.y > 0;

      if (isScrolledRef.current === nextIsScrolled) {
        return;
      }

      isScrolledRef.current = nextIsScrolled;
      onNativeScrolledChange?.(nextIsScrolled);
    },
    [onNativeScrolledChange],
  );

  React.useEffect(() => {
    isScrolledRef.current = false;
    onNativeScrolledChange?.(false);
  }, [onNativeScrolledChange]);

  const nativeSlotItems = React.useMemo<ActiveNearYouNativeSlotItem[]>(() => {
    return Array.from({ length: nativeSlotCount }, (_, index) => {
      return index < displayItems.length ? displayItems[index] : null;
    });
  }, [displayItems, nativeSlotCount]);

  if (isNative) {
    return (
      <View style={[styles.section, styles.sectionNative, style]}>
        <ScrollView
          testID='active-near-you-native-list'
          contentContainerStyle={[
            styles.nativeListContent,
            {
              paddingTop: isHeadingVisible ? Size.space['400'] : 0,
              paddingBottom: responsive.gap,
            },
          ]}
          style={styles.nativeList}
          showsVerticalScrollIndicator={false}
          bounces={false}
          onScroll={handleNativeScroll}
          scrollEventThrottle={16}
        >
          {header}
          {nativeSlotItems.map((item, index) => {
            const isVisible = item != null;
            const isFirstVisibleSlot = index === 0;
            const hasVisibleItemsBelow = index < displayItems.length - 1;

            return (
              <View
                key={`native-slot-${index}`}
                collapsable={false}
                testID={`active-near-you-native-item-wrapper-${index}`}
                accessibilityElementsHidden={!isVisible}
                importantForAccessibility={
                  isVisible ? 'auto' : 'no-hide-descendants'
                }
                style={[
                  styles.nativeItemWrapper,
                  isFirstVisibleSlot && nativeFirstItemTopMargin > 0
                    ? { marginTop: nativeFirstItemTopMargin }
                    : undefined,
                  hasVisibleItemsBelow && { marginBottom: cardGap },
                  !isVisible && styles.nativeHiddenItemWrapper,
                ]}
              >
                {item == null ? (
                  <View style={styles.nativeItemPlaceholder} />
                ) : (
                  renderSpeciesCard(item)
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      testID='active-near-you-section'
      style={[
        styles.section,
        isHeadingVisible && styles.sectionWithHeading,
        style,
      ]}
    >
      {header}

      <View
        testID='active-near-you-list'
        style={[styles.list, { gap: cardGap }]}
      >
        {displayItems.map((item) => (
          <React.Fragment key={getItemKey(item)}>
            {renderSpeciesCard(item)}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  sectionWithHeading: {
    gap: Size.space['400'],
  },
  sectionNative: {
    flex: 1,
    minHeight: 0,
    gap: 0,
  },
  header: {
    width: '100%',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  hiddenSlot: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  list: {
    paddingBottom: Size.space['200'],
  },
  nativeList: {
    flex: 1,
    minHeight: 0,
  },
  nativeListContent: {
    width: '100%',
    paddingBottom: Size.space['200'],
  },
  nativeItemWrapper: {
    width: '100%',
  },
  nativeHiddenItemWrapper: {
    height: 0,
    marginBottom: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  nativeItemPlaceholder: {
    height: 0,
    opacity: 0,
  },
  speciesCard: {
    maxWidth: '100%',
  },
});
