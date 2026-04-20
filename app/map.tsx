import { Redirect } from 'expo-router';
import {
  HomeRecommendationFilter,
  LocalMapSection,
  WeatherAttribution,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { Size } from '@/constants/theme';
import { useNativeHomeTabs } from '@/context/NativeHomeTabsContext';
import { useResponsive } from '@/hooks/useResponsive';
import type { HomePageData } from '@/data/types';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

function NativeMapScreen() {
  const responsive = useResponsive();
  const {
    activeGroup,
    allScored,
    handleBoundsChange,
    heatmapTileUrl,
    isFilterVisible,
    scoresLoading,
    setActiveGroup,
  } = useNativeHomeTabs();
  const horizontalInsetStyle = {
    paddingHorizontal: responsive.marginHorizontal,
  };

  return (
    <PageSurface>
      <View style={styles.screen}>
        <View
          testID='native-map-screen-content'
          style={styles.nativeMapScreenContent}
        >
          <View
            collapsable={false}
            testID='map-filter-slot'
            accessibilityElementsHidden={!isFilterVisible}
            importantForAccessibility={
              isFilterVisible ? 'auto' : 'no-hide-descendants'
            }
            style={[
              styles.filterSlot,
              isFilterVisible && styles.nativeMapFilterSlotVisible,
              isFilterVisible && { paddingTop: responsive.gap },
              !isFilterVisible && styles.hiddenSlot,
            ]}
          >
            <View style={horizontalInsetStyle}>
              <HomeRecommendationFilter
                allRecommendations={allScored}
                activeGroup={activeGroup}
                onGroupChange={setActiveGroup}
                loading={scoresLoading}
              />
            </View>
          </View>
          <View
            testID='native-map-content'
            style={[
              styles.nativeMapContent,
              isFilterVisible && { marginTop: responsive.gap },
            ]}
          >
            <LocalMapSection
              heatmapTileUrl={heatmapTileUrl}
              onBoundsChange={handleBoundsChange}
              showHeading={false}
              fillAvailableHeight={true}
              style={styles.nativeFullBleedMap}
            />
            <View style={horizontalInsetStyle}>
              <WeatherAttribution />
            </View>
          </View>
        </View>
      </View>
    </PageSurface>
  );
}

export default function MapScreen(_props: { data?: HomePageData } = {}) {
  if (Platform.OS === 'web') {
    return <Redirect href='/' />;
  }

  return <NativeMapScreen />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  nativeMapScreenContent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  filterSlot: {
    width: '100%',
  },
  nativeMapFilterSlotVisible: {
    width: '100%',
  },
  nativeFullBleedMap: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  nativeMapContent: {
    flex: 1,
    minHeight: 0,
    gap: Size.space['200'],
  },
  hiddenSlot: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
});
